import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import { getDB } from "@/lib/db";
import { deviceTokenValid } from "@/lib/device-auth";

// Non-negotiable: Standard hyphens, colons, or parentheses only. Zero em-dashes.
// The presence_telemetry table is provisioned by migration 037 in lib/db.ts.

export async function POST(req: NextRequest) {
  try {
    if (!deviceTokenValid(req)) {
      return NextResponse.json({ error: "Unauthorized device" }, { status: 401 });
    }

    const body = await req.json() as {
      sensor_id?: string;
      variance?: number | string;
      presence_detected?: boolean | number;
      [key: string]: unknown;
    };
    const { sensor_id, variance, presence_detected, ...rest } = body;

    if (!sensor_id || variance === undefined || presence_detected === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sensor_id, variance, presence_detected" },
        { status: 400 }
      );
    }

    const db = getDB();

    const isPresence = presence_detected ? 1 : 0;
    const rawData = JSON.stringify(rest || {});

    const result = db.prepare(`
      INSERT INTO presence_telemetry (sensor_id, variance, presence_detected, raw_data)
      VALUES (?, ?, ?, ?)
    `).run(sensor_id, parseFloat(String(variance)), isPresence, rawData);

    log.info(`[ESP32 Telemetry] Ingested node '${sensor_id}' presence (State: ${isPresence}, Var: ${variance})`);
    
    return NextResponse.json(
      { 
        success: true, 
        id: result.lastInsertRowid,
        sensor_id, 
        presence_detected: isPresence 
      }, 
      { status: 201 }
    );

  } catch (err) {
    log.error("[ESP32 Telemetry] Ingestion error:", err);
    return serverError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!deviceTokenValid(req)) {
      return NextResponse.json({ error: "Unauthorized device" }, { status: 401 });
    }

    const db = getDB();

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const sensorId = url.searchParams.get("sensor_id");

    let query = "SELECT * FROM presence_telemetry";
    const params: (string | number)[] = [];

    if (sensorId) {
      query += " WHERE sensor_id = ?";
      params.push(sensorId);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const records = db.prepare(query).all(...params) as {
      presence_detected: number;
      raw_data: string | null;
      [key: string]: unknown;
    }[];

    // Parse JSON field
    const parsed = records.map(r => ({
      ...r,
      presence_detected: r.presence_detected === 1,
      raw_data: JSON.parse(r.raw_data || "{}")
    }));

    return NextResponse.json({ records: parsed });

  } catch (err) {
    log.error("[ESP32 Telemetry] Retrieval error:", err);
    return serverError(err);
  }
}
