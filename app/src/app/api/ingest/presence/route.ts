import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Non-negotiable: Standard hyphens, colons, or parentheses only. Zero em-dashes.

/**
 * Ensures that the presence_telemetry table is initialized in the SQLite database.
 */
function initializePresenceTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS presence_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      variance REAL NOT NULL,
      presence_detected INTEGER NOT NULL,
      raw_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_presence_sensor ON presence_telemetry(sensor_id);
    CREATE INDEX IF NOT EXISTS idx_presence_time ON presence_telemetry(created_at);
  `);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sensor_id, variance, presence_detected, ...rest } = body;

    if (!sensor_id || variance === undefined || presence_detected === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sensor_id, variance, presence_detected" },
        { status: 400 }
      );
    }

    const db = getDB();
    initializePresenceTable(db);

    const isPresence = presence_detected ? 1 : 0;
    const rawData = JSON.stringify(rest || {});

    const result = db.prepare(`
      INSERT INTO presence_telemetry (sensor_id, variance, presence_detected, raw_data)
      VALUES (?, ?, ?, ?)
    `).run(sensor_id, parseFloat(variance), isPresence, rawData);

    console.log(`[ESP32 Telemetry] Ingested node '${sensor_id}' presence (State: ${isPresence}, Var: ${variance})`);
    
    return NextResponse.json(
      { 
        success: true, 
        id: result.lastInsertRowid,
        sensor_id, 
        presence_detected: isPresence 
      }, 
      { status: 201 }
    );

  } catch (err: any) {
    console.error("[ESP32 Telemetry] Ingestion error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    initializePresenceTable(db);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const sensorId = url.searchParams.get("sensor_id");

    let query = "SELECT * FROM presence_telemetry";
    const params: any[] = [];

    if (sensorId) {
      query += " WHERE sensor_id = ?";
      params.push(sensorId);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const records = db.prepare(query).all(...params) as any[];

    // Parse JSON field
    const parsed = records.map(r => ({
      ...r,
      presence_detected: r.presence_detected === 1,
      raw_data: JSON.parse(r.raw_data || "{}")
    }));

    return NextResponse.json({ records: parsed });

  } catch (err: any) {
    console.error("[ESP32 Telemetry] Retrieval error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
