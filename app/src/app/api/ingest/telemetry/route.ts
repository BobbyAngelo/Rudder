import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../../lib/db";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Telemetry Gate API Route
   Receives streaming metrics from local devices (ESP32/wearables).
   ═══════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, metrics, timestamp, classification } = body;

    if (!device_id || !metrics || typeof metrics !== "object") {
      return NextResponse.json({ error: "Missing required parameters: device_id and metrics object." }, { status: 400 });
    }

    const db = getDB();
    const now = new Date().toISOString();
    const eventTime = timestamp || now;
    const todayStr = eventTime.split("T")[0];

    // 1. Generate unique event_id for the telemetry log
    const hash = crypto.createHash("sha256").update(JSON.stringify(body) + eventTime).digest("hex").slice(0, 16);
    const eventId = `telemetry-${device_id}-${hash}`;

    // 2. Write telemetry log to reality_nodes
    db.prepare(`
      INSERT INTO reality_nodes (
        event_id, when_timestamp, where_context, who_entities, what_classification,
        why_insight, how_actions, state_vitals, gravity_score, origin_provenance, raw_blob
      ) VALUES (?, ?, ?, '[]', ?, ?, '[]', ?, 1, ?, ?)
    `).run(
      eventId,
      eventTime.replace("T", " ").slice(0, 19),
      device_id,
      classification || "Device Telemetry",
      JSON.stringify(metrics),
      JSON.stringify(metrics),
      device_id,
      JSON.stringify(body)
    );

    // 3. Check for biometric/health variables in metrics
    const hr = metrics.heart_rate ?? metrics.resting_hr;
    const hrv = metrics.hrv;
    const steps = metrics.steps;
    const sleep = metrics.sleep_hours ?? metrics.sleep;

    if (hr !== undefined || hrv !== undefined || steps !== undefined || sleep !== undefined) {
      console.log(`[telemetry-gate] Extracted biometric state from device "${device_id}"`);

      db.prepare(`
        INSERT INTO health_metrics (date, resting_hr, hrv, steps, sleep_hours)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          resting_hr = CASE WHEN ? IS NOT NULL THEN ? ELSE resting_hr END,
          hrv = CASE WHEN ? IS NOT NULL THEN ? ELSE hrv END,
          steps = CASE WHEN ? IS NOT NULL THEN ? ELSE steps END,
          sleep_hours = CASE WHEN ? IS NOT NULL THEN ? ELSE sleep_hours END
      `).run(
        todayStr,
        hr ?? null,
        hrv ?? null,
        steps ?? null,
        sleep ?? null,
        hr ?? null, hr ?? null,
        hrv ?? null, hrv ?? null,
        steps ?? null, steps ?? null,
        sleep ?? null, sleep ?? null
      );
    }

    console.log(`[telemetry-gate] ✅ Successfully processed telemetry stream from "${device_id}"`);

    return NextResponse.json({
      success: true,
      message: `Telemetry node ${eventId} created successfully.`,
      eventId
    });

  } catch (error: any) {
    console.error("POST /api/ingest/telemetry Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
