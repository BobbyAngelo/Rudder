#!/usr/bin/env tsx

/**
 * Rudder 1.0 - Bookmarks HTML Import Script
 * Parses standard Netscape HTML exports and inserts them into reality_nodes.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { readBookmarksFile } from "../../app/src/lib/ingest/bookmarks";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const filePath = args.filter(a => !a.startsWith("--"))[0];
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[bookmarks] ${msg}`);
const ok = (msg: string) => console.log(`[bookmarks] ✅ ${msg}`);

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - Bookmarks HTML Import       ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/importers/import-bookmarks.ts <path/to/bookmarks.html> [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  log(`Reading: ${filePath}`);
  const bookmarks = readBookmarksFile(filePath);
  log(`Found ${bookmarks.length} bookmarks to import`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no data will be written");
    if (bookmarks.length > 0) {
      log(`Sample bookmark: ${bookmarks[0].title} (${bookmarks[0].url}) at ${bookmarks[0].addDate}`);
    }
    return;
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  const checkStmt = db.prepare(`
    SELECT event_id FROM reality_nodes WHERE event_id = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO reality_nodes (
      event_id, when_timestamp, where_context, who_entities, what_classification, 
      why_insight, how_actions, state_vitals, gravity_score, origin_provenance, raw_blob
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const bm of bookmarks) {
      const urlHash = crypto.createHash("sha256").update(bm.url).digest("hex").slice(0, 16);
      const eventId = `bookmark-${urlHash}`;
      const existing = checkStmt.get(eventId);

      if (existing) {
        skipped++;
        continue;
      }

      insertStmt.run(
        eventId,
        bm.addDate || now,
        bm.title,
        "[]", // who_entities
        "bookmark", // what_classification
        bm.url, // why_insight (URL)
        JSON.stringify(["bookmark"]), // how_actions
        "{}", // state_vitals
        1, // gravity_score
        "bookmarks", // origin_provenance
        bm.url // raw_blob
      );
      inserted++;
    }
  });

  tx();
  db.close();

  ok(`Processed ${bookmarks.length} bookmarks`);
  ok(`Inserted: ${inserted}`);
  ok(`Skipped (already imported): ${skipped}`);
}

main().catch(console.error);
