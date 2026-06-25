#!/usr/bin/env tsx

/**
 * Rudder 1.0 - Browser History Import Script
 * Copies local Chrome or Arc SQLite history databases, extracts visits, and writes to reality_nodes.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readBrowserHistory } from "../../app/src/lib/ingest/browser-history";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 1000;
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[browser] ${msg}`);
const ok = (msg: string) => console.log(`[browser] ✅ ${msg}`);

function getStandardHistoryPaths(): { name: string; path: string }[] {
  const home = process.env.HOME || "";
  return [
    {
      name: "Arc",
      path: path.join(home, "Library", "Application Support", "Arc", "User Data", "Default", "History")
    },
    {
      name: "Chrome",
      path: path.join(home, "Library", "Application Support", "Google", "Chrome", "Default", "History")
    }
  ];
}

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - Browser History Import      ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  let historyPath = args.filter(a => !a.startsWith("--"))[0];

  if (!historyPath) {
    // Try to find Arc or Chrome history paths
    const candidates = getStandardHistoryPaths();
    for (const cand of candidates) {
      if (fs.existsSync(cand.path)) {
        log(`Found local ${cand.name} history at: ${cand.path}`);
        historyPath = cand.path;
        break;
      }
    }
  }

  if (!historyPath || !fs.existsSync(historyPath)) {
    console.error("Error: Could not automatically detect local browser history.");
    console.error("Usage: npx tsx scripts/importers/import-browser.ts <path/to/History> [--limit=1000] [--dry-run]");
    process.exit(1);
  }

  log(`Reading: ${historyPath}`);
  const docs = readBrowserHistory(historyPath, LIMIT);
  log(`Extracted ${docs.length} page visits`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no database updates will occur");
    if (docs.length > 0) {
      log(`Sample visit: ${docs[0].title} (${docs[0].link}) at ${docs[0].date}`);
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
    for (const doc of docs) {
      const existing = checkStmt.get(doc.sourceId);
      if (existing) {
        skipped++;
        continue;
      }

      insertStmt.run(
        doc.sourceId,
        doc.date,
        doc.title,
        "[]", // who_entities
        "browser-visit", // what_classification
        doc.link, // why_insight
        JSON.stringify(["navigate"]), // how_actions
        "{}", // state_vitals
        1, // gravity_score
        "browser", // origin_provenance
        doc.link // raw_blob
      );
      inserted++;
    }
  });

  tx();
  db.close();

  ok(`Browser history sync complete`);
  ok(`Inserted: ${inserted}`);
  ok(`Skipped (already imported): ${skipped}`);
}

main().catch(console.error);
