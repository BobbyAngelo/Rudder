import test from "node:test";
import assert from "node:assert";
import os from "os";
import path from "path";
import fs from "fs";

/* Calendar repository tests — isolated throwaway database. */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rudder-calendar-test-"));
process.env.RUDDER_DATA_DIR = TMP;

import {
  listEventsBetween,
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
} from "./calendar";

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("createEvent: trims title, coerces all_day, serializes linked_people", () => {
  const e = createEvent({
    title: "  Standup  ",
    start_date: "2026-06-10",
    start_time: "09:00",
    all_day: false,
    linked_people: [1, 2],
  });
  assert.strictEqual(e.title, "Standup");
  assert.strictEqual(e.all_day, 0, "boolean false coerced to 0");
  assert.strictEqual(e.linked_people, "[1,2]");
  assert.strictEqual(e.color, "#34d399", "default color applied");
});

test("listEventsBetween: inclusive range filter, ordered by date/time", () => {
  createEvent({ title: "AllHands", start_date: "2026-06-20", all_day: true });
  createEvent({ title: "NextMonth", start_date: "2026-07-05" });

  const june = listEventsBetween("2026-06-01", "2026-06-30").map((e) => e.title);
  assert.ok(june.includes("Standup") && june.includes("AllHands"), "in-range events returned");
  assert.ok(!june.includes("NextMonth"), "out-of-range event excluded");

  const dates = listEventsBetween("2026-06-01", "2026-07-31").map((e) => e.start_date);
  assert.deepStrictEqual(dates, [...dates].sort(), "ordered by start_date ascending");
});

test("updateEvent: boolean all_day coerces to 1 (regression: bind error)", () => {
  const e = createEvent({ title: "Flagged", start_date: "2026-06-15" });
  const r = updateEvent(e.id, { all_day: true });
  assert.ok(r.ok && r.event && r.event.all_day === 1, "boolean true -> 1, no bind error");
});

test("updateEvent: linked_people re-serialized, no_fields guard", () => {
  const e = createEvent({ title: "Linked", start_date: "2026-06-16" });
  const r = updateEvent(e.id, { linked_people: [7, 8, 9], reminder_minutes: 15 });
  assert.ok(r.ok && r.event && r.event.linked_people === "[7,8,9]");
  assert.ok(r.ok && r.event && r.event.reminder_minutes === 15);
  assert.deepStrictEqual(updateEvent(e.id, {}), { ok: false, reason: "no_fields" });
});

test("deleteEvent removes the row", () => {
  const e = createEvent({ title: "Temp", start_date: "2026-06-18" });
  assert.strictEqual(deleteEvent(e.id), true);
  assert.strictEqual(getEvent(e.id), undefined);
});
