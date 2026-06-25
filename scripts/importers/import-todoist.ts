#!/usr/bin/env tsx

/**
 * Rudder 1.0 - Todoist CSV Import Script
 * Reads a Todoist CSV export file and imports tasks into the tasks table.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readTodoistCSVFile } from "../../app/src/lib/ingest/todoist";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const filePath = args.filter(a => !a.startsWith("--"))[0];
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[todoist] ${msg}`);
const ok = (msg: string) => console.log(`[todoist] ✅ ${msg}`);

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - Todoist CSV Import          ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/importers/import-todoist.ts <path/to/todoist.csv> [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  log(`Reading: ${filePath}`);
  const tasks = readTodoistCSVFile(filePath);
  log(`Found ${tasks.length} tasks to import`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no data will be written");
    if (tasks.length > 0) {
      log(`Sample task: ${tasks[0].title} (Priority ${tasks[0].priority}) due ${tasks[0].due_date} ${tasks[0].due_time}`);
    }
    return;
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  const checkStmt = db.prepare(`
    SELECT id FROM tasks 
    WHERE title = ? AND coalesce(due_date, '') = coalesce(?, '')
  `);

  const insertStmt = db.prepare(`
    INSERT INTO tasks (
      title, description, status, priority, project_id, parent_id, 
      due_date, due_time, completed_at, sort_order, is_recurring, 
      recurrence_rule, labels, created_at, updated_at
    ) VALUES (?, ?, 'todo', ?, 1, NULL, ?, ?, NULL, 0, 0, NULL, '[]', ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE tasks 
    SET description = ?, priority = ?, due_time = ?, updated_at = ?
    WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const task of tasks) {
      const existing = checkStmt.get(task.title, task.due_date) as { id: number } | undefined;

      if (existing) {
        updateStmt.run(
          task.description,
          task.priority,
          task.due_time,
          now,
          existing.id
        );
        updated++;
      } else {
        insertStmt.run(
          task.title,
          task.description,
          task.priority,
          task.due_date,
          task.due_time,
          now,
          now
        );
        inserted++;
      }
    }
  });

  tx();
  db.close();

  ok(`Processed ${tasks.length} tasks`);
  ok(`Inserted: ${inserted}`);
  ok(`Updated: ${updated}`);
}

main().catch(console.error);
