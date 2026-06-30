import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* Health repository tests — isolated throwaway database. */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-health-test-"));
process.env.RUDDER_DATA_DIR = TMP;

import {
  listProviders,
  upsertProvider,
  deleteProvider,
  upsertMetrics,
  dashboard,
  chart,
} from "./health";
import { getDB } from "../db";

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("upsertProvider: insert returns id, update by id mutates in place", () => {
  const id = upsertProvider({ name: "Dr. Smith", specialty: "Dentist" });
  assert.ok(id > 0, "insert returns a row id");
  const same = upsertProvider({ id, name: "Dr. Smith", specialty: "Orthodontist" });
  assert.strictEqual(same, id, "update returns the same id");

  const rows = listProviders().filter((p) => p.id === id);
  assert.strictEqual(rows.length, 1, "no duplicate row created");
  assert.strictEqual(rows[0].specialty, "Orthodontist", "specialty updated in place");

  assert.strictEqual(deleteProvider(id), true);
});

test("upsertMetrics: one row per date; empty strings coerce to null", () => {
  upsertMetrics({ date: "2026-06-11", sleep_hours: "7.5", resting_hr: "55", steps: "" });
  upsertMetrics({ date: "2026-06-11", sleep_hours: "8", mood: "9" });

  const row = getDB()
    .prepare("SELECT * FROM health_metrics WHERE date = ?")
    .get("2026-06-11") as {
    sleep_hours: number | null;
    mood: number | null;
    steps: number | null;
    resting_hr: number | null;
  };
  const count = getDB()
    .prepare("SELECT COUNT(*) AS c FROM health_metrics WHERE date = ?")
    .get("2026-06-11") as { c: number };

  assert.strictEqual(count.c, 1, "upsert keeps a single row per date");
  assert.strictEqual(row.sleep_hours, 8, "later upsert overwrote sleep_hours");
  assert.strictEqual(row.mood, 9);
  assert.strictEqual(row.steps, null, "empty-string steps coerced to null");
  assert.strictEqual(row.resting_hr, null, "field omitted on 2nd upsert reset to null (full overwrite)");
});

test("dashboard + chart aggregate health_records correctly", () => {
  const db = getDB();
  const ins = db.prepare(
    "INSERT INTO health_records (type, value, source, start_date, end_date, date) VALUES (?, ?, ?, ?, ?, ?)",
  );
  ins.run("StepCount", 1000, "watch", "2026-06-10T08:00", "2026-06-10T08:01", "2026-06-10");
  ins.run("StepCount", 2000, "watch", "2026-06-11T08:00", "2026-06-11T08:01", "2026-06-11");
  ins.run("HeartRate", 62, "watch", "2026-06-11T09:00", "2026-06-11T09:00", "2026-06-11");

  const d = dashboard();
  assert.strictEqual(d.totalRecords, 3);
  assert.strictEqual(d.latestStats.steps, 2000, "latest-day step sum");
  assert.strictEqual(d.latestStats.heartRate, 62, "latest heart rate");
  assert.ok(d.weekSteps.length >= 2, "week step buckets present");

  const c = chart("StepCount", 30);
  assert.strictEqual(c.type, "StepCount");
  assert.ok(c.data.length >= 2, "chart returns per-day points");
});
