/* ═══════════════════════════════════════════════════════
   Calendar repository — typed data access for `calendar_events`.

   Centralizes calendar SQL including the partial-update path. Column names
   come from a fixed allowlist; values are bound. Booleans for integer flag
   columns (all_day, is_recurring) are coerced to 0/1, and array/object
   values (linked_people) are JSON-encoded.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";
import type { SqlParam, CalendarEventRow } from "./types";

export interface CalendarEventCreateInput {
  title: string;
  description?: string | null;
  start_date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  all_day?: boolean | number | null;
  location?: string | null;
  color?: string | null;
  category?: string | null;
  linked_people?: unknown[] | null;
  linked_task_id?: number | null;
}

export interface CalendarEventUpdateInput {
  title?: string;
  description?: string;
  start_date?: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  all_day?: boolean | number;
  location?: string;
  color?: string;
  category?: string;
  is_recurring?: boolean | number;
  recurrence_rule?: string | null;
  reminder_minutes?: number | null;
  linked_people?: unknown[];
  linked_task_id?: number | null;
}

/** Columns a client is allowed to patch via updateEvent, in stable order. */
export const CALENDAR_UPDATABLE_FIELDS = [
  "title",
  "description",
  "start_date",
  "start_time",
  "end_date",
  "end_time",
  "all_day",
  "location",
  "color",
  "category",
  "is_recurring",
  "recurrence_rule",
  "reminder_minutes",
  "linked_people",
  "linked_task_id",
] as const satisfies readonly (keyof CalendarEventUpdateInput)[];

/** Bind-safe coercion for a single update field. */
function coerce(field: keyof CalendarEventUpdateInput, value: unknown): SqlParam {
  if (field === "linked_people") return JSON.stringify(value ?? []);
  if (field === "all_day" || field === "is_recurring") return value ? 1 : 0;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value as SqlParam;
}

/** Events whose start_date falls within [start, end] inclusive. */
export function listEventsBetween(start: string, end: string): CalendarEventRow[] {
  return getDB()
    .prepare(
      "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ? ORDER BY start_date, start_time",
    )
    .all(start, end) as CalendarEventRow[];
}

export function getEvent(id: number): CalendarEventRow | undefined {
  return getDB().prepare("SELECT * FROM calendar_events WHERE id = ?").get(id) as
    | CalendarEventRow
    | undefined;
}

export function createEvent(input: CalendarEventCreateInput): CalendarEventRow {
  const result = getDB()
    .prepare(
      `INSERT INTO calendar_events
       (title, description, start_date, start_time, end_date, end_time, all_day, location, color, category, linked_people, linked_task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title.trim(),
      input.description ?? "",
      input.start_date,
      input.start_time ?? null,
      input.end_date ?? null,
      input.end_time ?? null,
      input.all_day ? 1 : 0,
      input.location ?? "",
      input.color ?? "#34d399",
      input.category ?? "personal",
      JSON.stringify(input.linked_people ?? []),
      input.linked_task_id ?? null,
    );
  return getEvent(Number(result.lastInsertRowid))!;
}

export type UpdateEventResult =
  | { ok: true; event: CalendarEventRow | undefined }
  | { ok: false; reason: "no_fields" };

export function updateEvent(
  id: number,
  patch: CalendarEventUpdateInput,
): UpdateEventResult {
  const updates: string[] = [];
  const values: SqlParam[] = [];

  for (const field of CALENDAR_UPDATABLE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    updates.push(`${field} = ?`);
    values.push(coerce(field, value));
  }

  if (updates.length === 0) {
    return { ok: false, reason: "no_fields" };
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  getDB()
    .prepare(`UPDATE calendar_events SET ${updates.join(", ")} WHERE id = ?`)
    .run(...values);

  return { ok: true, event: getEvent(id) };
}

export function deleteEvent(id: number): boolean {
  return (
    getDB().prepare("DELETE FROM calendar_events WHERE id = ?").run(id).changes > 0
  );
}
