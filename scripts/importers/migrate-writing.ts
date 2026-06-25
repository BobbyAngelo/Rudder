#!/usr/bin/env tsx

/**
 * Rudder 1.0 — Writing Migration
 * 
 * Extracts creative writing content from reality_nodes 
 * and imports into journal_entries for the Library.
 * 
 * Usage:
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/migrate-writing.ts
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/migrate-writing.ts --dry-run
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[migrate-writing] ${msg}`);
const ok = (msg: string) => console.log(`[migrate-writing] ✅ ${msg}`);

function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 — Writing Migration           ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (DRY_RUN) log("🔍 DRY RUN MODE");

  if (!fs.existsSync(RUDDER_DB)) {
    throw new Error(`DB not found: ${RUDDER_DB}`);
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  // Read all creative writing nodes from reality_nodes
  const nodes = db.prepare(`
    SELECT event_id, when_timestamp, what_classification, raw_blob, gravity_score
    FROM reality_nodes
    WHERE what_classification LIKE '%Writing%' 
       OR what_classification LIKE '%Script%'
    ORDER BY when_timestamp ASC
  `).all() as any[];

  log(`Found ${nodes.length} writing nodes in reality_nodes`);

  // Check what's already migrated
  const existingCount = (db.prepare("SELECT COUNT(*) as cnt FROM journal_entries").get() as any).cnt;
  log(`Existing journal entries: ${existingCount}`);

  if (DRY_RUN) {
    log(`[DRY RUN] Would create ${nodes.length} journal entries`);
    
    // Show sample titles
    for (const node of nodes.slice(0, 5)) {
      const content = node.raw_blob || "";
      const title = extractTitle(content, node.event_id);
      const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
      log(`  → "${title}" (${wordCount} words)`);
    }
    if (nodes.length > 5) log(`  ... and ${nodes.length - 5} more`);
    
    db.close();
    return;
  }

  // Insert entries
  const insert = db.prepare(`
    INSERT INTO journal_entries (title, content, mode, word_count, tags, created_at, updated_at)
    VALUES (@title, @content, @mode, @word_count, @tags, @created_at, @updated_at)
  `);

  const tx = db.transaction(() => {
    let inserted = 0;

    for (const node of nodes) {
      const content = node.raw_blob || "";
      if (!content.trim()) continue;

      const title = extractTitle(content, node.event_id);
      const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

      insert.run({
        title,
        content,
        mode: "script", // All 189 are Creative Writing / Script
        word_count: wordCount,
        tags: JSON.stringify(["legacy", "script"]),
        created_at: node.when_timestamp || new Date().toISOString(),
        updated_at: node.when_timestamp || new Date().toISOString(),
      });
      inserted++;
    }

    ok(`Created ${inserted} journal entries from reality nodes`);
  });

  tx();
  db.close();
  ok("Writing migration complete.");
}

/**
 * Extract a readable title from the document content.
 * Looks for first non-empty line, series name, or falls back to ID.
 */
function extractTitle(content: string, fallbackId: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  
  if (lines.length === 0) return fallbackId;

  // Check for known patterns
  for (const line of lines.slice(0, 5)) {
    // "Series or show name: X"
    const showMatch = line.match(/(?:Series|show|Show)\s*(?:name|Name)?:\s*(.+)/i);
    if (showMatch) return showMatch[1].trim();

    // "Title: X" 
    const titleMatch = line.match(/^Title:\s*(.+)/i);
    if (titleMatch) return titleMatch[1].trim();
  }

  // Use first meaningful line (skip short labels)
  const firstLine = lines[0];
  if (firstLine.length > 3 && firstLine.length < 80) {
    return firstLine;
  }

  // Fallback
  return `Script ${fallbackId.slice(-8)}`;
}

main();
