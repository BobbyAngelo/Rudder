/* ═══════════════════════════════════════════════════════
   Writing repository — typed data access for the `journal_entries` table.

   Centralizes the journal/writing SQL so API routes don't build queries
   inline. All inputs are passed as bound parameters; column lists are fixed
   string literals, never interpolated from user input.

   Schema: journal_entries (migration 002) plus the writing extensions in
   migration 020 (parent_id, meta_json, is_folder).
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

/** A value that can be safely bound to a prepared statement placeholder. */
type SqlParam = string | number | bigint | null;

/** Row shape of the `journal_entries` table (migrations 002 / 020). */
export interface JournalEntryRow {
  id: number;
  title: string;
  content: string;
  mode: string;
  word_count: number;
  wpm: number | null;
  tags: string;
  parent_id: number | null;
  meta_json: string | null;
  is_folder: number | null;
  created_at: string;
  updated_at: string;
}

/** Summary projection used by the list view (omits the full content). */
export interface JournalEntrySummary {
  id: number;
  title: string;
  mode: string;
  word_count: number;
  wpm: number | null;
  tags: string;
  parent_id: number | null;
  meta_json: string | null;
  is_folder: number | null;
  created_at: string;
  updated_at: string;
}

/** Count of entries grouped by mode. */
export interface ModeCount {
  mode: string;
  count: number;
}

export interface JournalListFilter {
  mode?: string;
}

export interface JournalEntryInput {
  title?: string | null;
  content?: string | null;
  mode?: string | null;
  wpm?: number | null;
  tags?: unknown[] | null;
  parent_id?: number | null;
  meta_json?: string | null;
  is_folder?: number | null;
}

/** Word count helper, matching the previous route behavior. */
function countWords(content: string): number {
  return content.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Fetch a single entry by id (full row including content). */
export function getEntry(id: number | string): JournalEntryRow | undefined {
  return getDB()
    .prepare("SELECT * FROM journal_entries WHERE id = ?")
    .get(id) as JournalEntryRow | undefined;
}

/** List entry summaries, optionally filtered by mode (folders first). */
export function listEntries(filter: JournalListFilter = {}): JournalEntrySummary[] {
  let query =
    "SELECT id, title, mode, word_count, wpm, tags, parent_id, meta_json, is_folder, created_at, updated_at FROM journal_entries WHERE 1=1";
  const params: SqlParam[] = [];

  if (filter.mode) {
    query += " AND mode = ?";
    params.push(filter.mode);
  }

  query += " ORDER BY is_folder DESC, updated_at DESC";

  return getDB().prepare(query).all(...params) as JournalEntrySummary[];
}

/** Count of entries grouped by mode, most common first. */
export function modeBreakdown(): ModeCount[] {
  return getDB()
    .prepare(
      "SELECT mode, COUNT(*) as count FROM journal_entries GROUP BY mode ORDER BY count DESC",
    )
    .all() as ModeCount[];
}

/** Insert a new entry; returns the new row id. */
export function createEntry(input: JournalEntryInput): number | bigint {
  const content = input.content || "";
  const result = getDB()
    .prepare(
      `INSERT INTO journal_entries (title, content, mode, word_count, wpm, tags, parent_id, meta_json, is_folder)
       VALUES (@title, @content, @mode, @word_count, @wpm, @tags, @parent_id, @meta_json, @is_folder)`,
    )
    .run({
      title: input.title || "Untitled",
      content,
      mode: input.mode || "journal",
      word_count: countWords(content),
      wpm: input.wpm || null,
      tags: JSON.stringify(input.tags || []),
      parent_id: input.parent_id !== undefined ? input.parent_id : null,
      meta_json: input.meta_json || "{}",
      is_folder: input.is_folder || 0,
    });
  return result.lastInsertRowid;
}

/** Update an existing entry by id. */
export function updateEntry(id: number | string, input: JournalEntryInput): void {
  const content = input.content || "";
  getDB()
    .prepare(
      `UPDATE journal_entries
       SET title = @title, content = @content, mode = @mode,
           word_count = @word_count, wpm = @wpm, tags = @tags,
           parent_id = @parent_id, meta_json = @meta_json, is_folder = @is_folder,
           updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id,
      title: input.title || "Untitled",
      content,
      mode: input.mode || "journal",
      word_count: countWords(content),
      wpm: input.wpm || null,
      tags: JSON.stringify(input.tags || []),
      parent_id: input.parent_id !== undefined ? input.parent_id : null,
      meta_json: input.meta_json || "{}",
      is_folder: input.is_folder || 0,
    });
}

/** Delete an entry by id. */
export function deleteEntry(id: number | string): void {
  getDB().prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
}

/** Read the default execution mode from user preferences (id = 1). */
export function getDefaultExecutionMode(): string {
  const prefs = getDB()
    .prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1")
    .get() as { default_execution_mode: string | null } | undefined;
  return prefs?.default_execution_mode || "local_ollama";
}
