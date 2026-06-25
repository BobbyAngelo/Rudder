#!/usr/bin/env tsx

/**
 * Rudder 1.0 - Claude Conversations Import Script
 * Reads Anthropic's conversations.json and imports conversations into journal_entries.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readClaudeExport } from "../../app/src/lib/ingest/claude";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const filePath = args.filter(a => !a.startsWith("--"))[0];
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[claude] ${msg}`);
const ok = (msg: string) => console.log(`[claude] ✅ ${msg}`);

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - Claude Import               ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/importers/import-claude.ts <path/to/conversations.json> [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File or folder not found: ${filePath}`);
  }

  log(`Reading: ${filePath}`);
  const docs = readClaudeExport(filePath);
  log(`Found ${docs.length} conversations to import`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no data will be written");
    return;
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  const checkStmt = db.prepare(`
    SELECT id FROM journal_entries 
    WHERE json_extract(meta_json, '$.sourceId') = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO journal_entries (title, content, mode, word_count, tags, meta_json, created_at, updated_at)
    VALUES (?, ?, 'biographer', ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE journal_entries 
    SET title = ?, content = ?, word_count = ?, tags = ?, meta_json = ?, updated_at = ?
    WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    for (const doc of docs) {
      const wordCount = doc.body.split(/\s+/).filter(Boolean).length;
      const tags = JSON.stringify(["claude"]);
      const meta = JSON.stringify({ sourceId: doc.sourceId, link: doc.link });
      const dateStr = doc.date ? `${doc.date} 12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const existing = checkStmt.get(doc.sourceId) as { id: number } | undefined;

      if (existing) {
        updateStmt.run(doc.title, doc.body, wordCount, tags, meta, now, existing.id);
        updated++;
      } else {
        insertStmt.run(doc.title, doc.body, wordCount, tags, meta, dateStr, now);
        inserted++;
      }
    }
  });

  tx();
  db.close();

  ok(`Processed ${docs.length} conversations`);
  ok(`Inserted: ${inserted}`);
  ok(`Updated: ${updated}`);
}

main().catch(console.error);
