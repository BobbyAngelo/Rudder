/* ═══════════════════════════════════════════════════════
   Tasks repository — typed data access for the `tasks` table.

   Centralizes task SQL including the partial-update path, which previously
   built a dynamic `SET` clause in the route. Column names come from a fixed
   allowlist here (never from request keys), and every value is bound.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";
import type { SqlParam, TaskRow, TaskProjectRow } from "./types";

export interface TaskListFilter {
  status?: string | null;
  projectId?: number | null;
  minPriority?: number | null;
}

export interface TaskCounts {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: number | null;
  project_id?: number | null;
  due_date?: string | null;
  due_time?: string | null;
  labels?: unknown[] | null;
  parent_id?: number | null;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  project_id?: number;
  due_date?: string | null;
  due_time?: string | null;
  sort_order?: number;
  labels?: unknown[];
  parent_id?: number | null;
  is_recurring?: number;
  recurrence_rule?: string | null;
}

/** Columns a client is allowed to patch via updateTask, in stable order. */
export const TASK_UPDATABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "project_id",
  "due_date",
  "due_time",
  "sort_order",
  "labels",
  "parent_id",
  "is_recurring",
  "recurrence_rule",
] as const satisfies readonly (keyof TaskUpdateInput)[];

export function listTasks(filter: TaskListFilter = {}): TaskRow[] {
  let query = "SELECT * FROM tasks WHERE 1=1";
  const params: SqlParam[] = [];

  const { status } = filter;
  if (status && status !== "all") {
    if (status === "active") {
      query += " AND status IN ('todo', 'in_progress')";
    } else {
      query += " AND status = ?";
      params.push(status);
    }
  } else if (!status) {
    // Default view hides archived tasks.
    query += " AND status != 'archived'";
  }

  if (filter.projectId != null) {
    query += " AND project_id = ?";
    params.push(filter.projectId);
  }
  if (filter.minPriority != null) {
    query += " AND priority >= ?";
    params.push(filter.minPriority);
  }

  query +=
    " ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'done' THEN 2 ELSE 3 END," +
    " priority DESC, sort_order ASC, created_at DESC";

  return getDB().prepare(query).all(...params) as TaskRow[];
}

export function listProjects(): TaskProjectRow[] {
  return getDB()
    .prepare("SELECT * FROM task_projects ORDER BY sort_order, id")
    .all() as TaskProjectRow[];
}

export function taskCounts(): TaskCounts {
  return getDB()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
         COUNT(*) as total
       FROM tasks WHERE status != 'archived'`,
    )
    .get() as TaskCounts;
}

export function getTask(id: number): TaskRow | undefined {
  return getDB().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | TaskRow
    | undefined;
}

export function createTask(input: TaskCreateInput): TaskRow {
  const result = getDB()
    .prepare(
      `INSERT INTO tasks (title, description, status, priority, project_id, due_date, due_time, labels, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title.trim(),
      input.description ?? "",
      input.status ?? "todo",
      input.priority ?? 0,
      input.project_id ?? 1,
      input.due_date ?? null,
      input.due_time ?? null,
      JSON.stringify(input.labels ?? []),
      input.parent_id ?? null,
    );
  // Row is guaranteed to exist immediately after a successful insert.
  return getTask(Number(result.lastInsertRowid))!;
}

export type UpdateTaskResult =
  | { ok: true; task: TaskRow | undefined }
  | { ok: false; reason: "no_fields" };

export function updateTask(id: number, patch: TaskUpdateInput): UpdateTaskResult {
  const updates: string[] = [];
  const values: SqlParam[] = [];

  for (const field of TASK_UPDATABLE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    updates.push(`${field} = ?`);
    values.push(field === "labels" ? JSON.stringify(value) : (value as SqlParam));
  }

  // Toggle completion timestamp alongside status changes.
  if (patch.status === "done") {
    updates.push("completed_at = datetime('now')");
  } else if (patch.status && patch.status !== "done") {
    updates.push("completed_at = NULL");
  }

  if (updates.length === 0) {
    return { ok: false, reason: "no_fields" };
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  getDB()
    .prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`)
    .run(...values);

  return { ok: true, task: getTask(id) };
}

export function deleteTask(id: number): boolean {
  return getDB().prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
}
