#!/usr/bin/env tsx

/**
 * Rudder 1.0 - iCalendar Import Script
 * Reads an .ics file and imports events into the calendar_events table.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readICSFile } from "../../app/src/lib/ingest/calendar";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const filePath = args.filter(a => !a.startsWith("--"))[0];
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[calendar] ${msg}`);
const ok = (msg: string) => console.log(`[calendar] ✅ ${msg}`);

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - iCalendar Import            ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/importers/import-calendar.ts <path/to/events.ics> [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  log(`Reading: ${filePath}`);
  const events = readICSFile(filePath);
  log(`Found ${events.length} events to import`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no data will be written");
    return;
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  const checkStmt = db.prepare(`
    SELECT id FROM calendar_events 
    WHERE title = ? AND start_date = ? AND coalesce(start_time, '') = coalesce(?, '')
  `);

  const insertStmt = db.prepare(`
    INSERT INTO calendar_events (
      title, description, start_date, start_time, end_date, end_time, 
      all_day, location, color, category, is_recurring, recurrence_rule, 
      reminder_minutes, linked_people, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE calendar_events 
    SET description = ?, end_date = ?, end_time = ?, all_day = ?, location = ?, 
        is_recurring = ?, recurrence_rule = ?, updated_at = ?
    WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const event of events) {
      const isRecurring = event.recurrence_rule ? 1 : 0;
      const existing = checkStmt.get(event.title, event.start_date, event.start_time) as { id: number } | undefined;

      if (existing) {
        updateStmt.run(
          event.description,
          event.end_date,
          event.end_time,
          event.all_day,
          event.location,
          isRecurring,
          event.recurrence_rule,
          now,
          existing.id
        );
        updated++;
      } else {
        insertStmt.run(
          event.title,
          event.description,
          event.start_date,
          event.start_time,
          event.end_date,
          event.end_time,
          event.all_day,
          event.location,
          "#34d399", // default green
          "personal", // default category
          isRecurring,
          event.recurrence_rule,
          null, // reminder_minutes
          "[]", // linked_people JSON
          now,
          now
        );
        inserted++;
      }
    }
  });

  tx();
  db.close();

  ok(`Processed ${events.length} events`);
  ok(`Inserted: ${inserted}`);
  ok(`Updated: ${updated}`);
}

main().catch(console.error);
