import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* ═══════════════════════════════════════════════════════
   Telemetry ingest route tests.
   Isolated throwaway database (RUDDER_DATA_DIR set before the first getDB()).
   Exercises the real POST handler: validation, device-token gate, telemetry
   node creation, and biometric promotion into health_metrics.
   ═══════════════════════════════════════════════════════ */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-telemetry-test-"));
process.env.RUDDER_DATA_DIR = TMP;
delete process.env.RUDDER_DEVICE_TOKEN; // default: open dev mode

import { NextRequest } from "next/server";
import { POST } from "./route";
import { getDB } from "../../../../lib/db";

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/ingest/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("rejects a payload missing device_id or metrics", async () => {
  assert.strictEqual((await POST(makeReq({ device_id: "x" }))).status, 400);
  assert.strictEqual((await POST(makeReq({ metrics: { steps: 1 } }))).status, 400);
});

test("ingests telemetry and promotes biometrics into health_metrics", async () => {
  const res = await POST(
    makeReq({
      device_id: "test-ring",
      timestamp: "2026-06-15T08:00:00.000Z",
      metrics: { heart_rate: 61, hrv: 70, steps: 1234, sleep_hours: 7.5, temperature: 21 },
    }),
  );
  assert.strictEqual(res.status, 200);
  const json = (await res.json()) as { success: boolean; eventId: string };
  assert.ok(json.success && json.eventId, "returns success + eventId");

  const db = getDB();
  const node = db
    .prepare("SELECT where_context, what_classification FROM reality_nodes WHERE where_context = ?")
    .get("test-ring") as { where_context: string; what_classification: string } | undefined;
  assert.ok(node, "a reality_node was written for the device");

  const metrics = db
    .prepare("SELECT resting_hr, hrv, steps, sleep_hours FROM health_metrics WHERE date = ?")
    .get("2026-06-15") as
    | { resting_hr: number; hrv: number; steps: number; sleep_hours: number }
    | undefined;
  assert.ok(metrics, "a health_metrics row exists for the event date");
  assert.strictEqual(metrics!.resting_hr, 61, "heart_rate promoted to resting_hr");
  assert.strictEqual(metrics!.hrv, 70);
  assert.strictEqual(metrics!.steps, 1234);
  assert.strictEqual(metrics!.sleep_hours, 7.5);
});

test("accepts resting_hr and sleep aliases", async () => {
  const res = await POST(
    makeReq({
      device_id: "alias-dev",
      timestamp: "2026-07-01T08:00:00.000Z",
      metrics: { resting_hr: 58, sleep: 8 },
    }),
  );
  assert.strictEqual(res.status, 200);
  const row = getDB()
    .prepare("SELECT resting_hr, sleep_hours FROM health_metrics WHERE date = ?")
    .get("2026-07-01") as { resting_hr: number; sleep_hours: number };
  assert.strictEqual(row.resting_hr, 58, "resting_hr alias accepted");
  assert.strictEqual(row.sleep_hours, 8, "sleep alias promoted to sleep_hours");
});

test("enforces the device token when RUDDER_DEVICE_TOKEN is set", async () => {
  process.env.RUDDER_DEVICE_TOKEN = "sekret";
  try {
    const body = { device_id: "gated", metrics: { steps: 5 } };
    assert.strictEqual((await POST(makeReq(body))).status, 401, "missing token rejected");
    assert.strictEqual(
      (await POST(makeReq(body, { "X-Device-Token": "wrong" }))).status,
      401,
      "wrong token rejected",
    );
    assert.strictEqual(
      (await POST(makeReq(body, { "X-Device-Token": "sekret" }))).status,
      200,
      "correct token accepted",
    );
  } finally {
    delete process.env.RUDDER_DEVICE_TOKEN;
  }
});
