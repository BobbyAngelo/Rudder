/* ═══════════════════════════════════════════════════════
   Habits repository — typed data access for the `habits`,
   `habit_logs`, and related `identity_values` tables.

   Centralizes the SQL so API routes don't build queries inline. All inputs
   are passed as bound parameters; column lists are fixed string literals,
   never interpolated from user input.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

type SqlParam = string | number | bigint | null;

export interface HabitRow {
  id: number;
  title: string;
  description: string;
  frequency: string;
  linked_value_id: number | null;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

/** A habit joined with its linked identity value's label. */
export interface HabitWithValueRow extends HabitRow {
  value_label: string | null;
}

export interface HabitLogRow {
  habit_id: number;
  date: string;
  status: string;
  notes: string;
}

export interface HabitValueRow {
  id: number;
  label: string;
  description: string;
}

export interface HabitInput {
  title: string;
  description?: string | null;
  frequency?: string | null;
  linked_value_id?: number | null;
  color?: string | null;
  icon?: string | null;
}

export interface HabitUpdateInput extends HabitInput {
  id: number;
}

export interface HabitLogInput {
  habit_id: number;
  date: string;
  status?: string | null;
  notes?: string | null;
}

/** List all habits with their linked value label, oldest first. */
export function listHabits(): HabitWithValueRow[] {
  return getDB()
    .prepare(
      `SELECT
         h.*,
         v.label as value_label
       FROM habits h
       LEFT JOIN identity_values v ON h.linked_value_id = v.id
       ORDER BY h.created_at ASC`,
    )
    .all() as HabitWithValueRow[];
}

/** List all habit logs, most recent date first. */
export function listHabitLogs(): HabitLogRow[] {
  return getDB()
    .prepare(
      `SELECT habit_id, date, status, notes
       FROM habit_logs
       ORDER BY date DESC`,
    )
    .all() as HabitLogRow[];
}

/** List identity values used to populate the habit linkage dropdown. */
export function listHabitValues(): HabitValueRow[] {
  return getDB()
    .prepare(
      "SELECT id, label, description FROM identity_values ORDER BY priority ASC",
    )
    .all() as HabitValueRow[];
}

/** Insert a new habit; returns the new row id. */
export function createHabit(input: HabitInput): number | bigint {
  const result = getDB()
    .prepare(
      `INSERT INTO habits (title, description, frequency, linked_value_id, color, icon)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description || "",
      input.frequency || "daily",
      input.linked_value_id || null,
      input.color || "#60a5fa",
      input.icon || "Target",
    );
  return result.lastInsertRowid;
}

/** Update an existing habit by id. */
export function updateHabit(input: HabitUpdateInput): void {
  getDB()
    .prepare(
      `UPDATE habits
       SET title = ?, description = ?, frequency = ?, linked_value_id = ?, color = ?, icon = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      input.title,
      input.description || "",
      input.frequency || "daily",
      input.linked_value_id || null,
      input.color || "#60a5fa",
      input.icon || "Target",
      input.id,
    );
}

/** Delete a habit by id. */
export function deleteHabit(id: SqlParam): void {
  getDB().prepare("DELETE FROM habits WHERE id = ?").run(id);
}

export type ToggleHabitLogResult =
  | { action: "removed" }
  | { action: "added" };

/**
 * Toggle a habit log for a (habit_id, date) pair: if a log exists, delete it;
 * otherwise insert one. Returns which action was taken.
 */
export function toggleHabitLog(input: HabitLogInput): ToggleHabitLogResult {
  const db = getDB();
  const existing = db
    .prepare("SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?")
    .get(input.habit_id, input.date) as { id: number } | undefined;

  if (existing) {
    db.prepare("DELETE FROM habit_logs WHERE id = ?").run(existing.id);
    return { action: "removed" };
  }

  db.prepare(
    `INSERT INTO habit_logs (habit_id, date, status, notes)
     VALUES (?, ?, ?, ?)`,
  ).run(
    input.habit_id,
    input.date,
    input.status || "completed",
    input.notes || "",
  );
  return { action: "added" };
}
