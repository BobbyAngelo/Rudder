#!/usr/bin/env tsx

/**
 * Rudder 1.0 — Data Migration Script
 * 
 * Reads from legacy data sources (READ-ONLY) and writes to rudder.db.
 * Idempotent — safe to re-run. Uses INSERT OR IGNORE to skip duplicates.
 * 
 * Usage:
 *   npx tsx scripts/migrate.ts
 *   npx tsx scripts/migrate.ts --people-only
 *   npx tsx scripts/migrate.ts --ledger-only
 *   npx tsx scripts/migrate.ts --dry-run
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ── Config ──
const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");
const PEOPLE_DB = "/Volumes/RUDDER 2/04_CELF_DATA/celf-data-layer/data/people.db";
const LEDGER_DB = path.join(ROOT, "data", "10d_ledger.db");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const PEOPLE_ONLY = args.includes("--people-only");
const LEDGER_ONLY = args.includes("--ledger-only");

// ── Logging ──
const log = (msg: string) => console.log(`[migrate] ${msg}`);
const warn = (msg: string) => console.log(`[migrate] ⚠️  ${msg}`);
const ok = (msg: string) => console.log(`[migrate] ✅ ${msg}`);
const skip = (msg: string) => console.log(`[migrate] ⏭️  ${msg}`);

// ── Helpers ──
function openReadOnly(dbPath: string): Database.Database | null {
  if (!fs.existsSync(dbPath)) {
    warn(`Source not found: ${dbPath}`);
    return null;
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    return db;
  } catch (err: any) {
    warn(`Failed to open ${dbPath}: ${err.message}`);
    return null;
  }
}

function openRudder(): Database.Database {
  if (!fs.existsSync(RUDDER_DB)) {
    throw new Error(`Rudder DB not found at ${RUDDER_DB}. Run the app first to create it.`);
  }
  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// ═══════════════════════════════════════════════════════
// Migration 1: People (398 contacts)
// ═══════════════════════════════════════════════════════

function migratePeople(rudder: Database.Database) {
  log("── People Migration ──");

  const source = openReadOnly(PEOPLE_DB);
  if (!source) return;

  // Read all people from source
  const people = source.prepare(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.org,
      p.title,
      p.relationship,
      p.warmth,
      p.notes,
      p.avatar_url,
      p.created_at,
      p.updated_at
    FROM people p
  `).all() as any[];

  log(`Found ${people.length} people in source`);

  // Read contact methods for email/phone enrichment
  let contactMethods: any[] = [];
  try {
    contactMethods = source.prepare(`
      SELECT person_id, type, value FROM contact_methods
    `).all() as any[];
    log(`Found ${contactMethods.length} contact methods`);
  } catch {
    warn("No contact_methods table found, skipping enrichment");
  }

  // Build a lookup map for contact methods
  const methodsByPerson = new Map<string, { emails: string[]; phones: string[] }>();
  for (const cm of contactMethods) {
    if (!methodsByPerson.has(cm.person_id)) {
      methodsByPerson.set(cm.person_id, { emails: [], phones: [] });
    }
    const entry = methodsByPerson.get(cm.person_id)!;
    if (cm.type === "email") entry.emails.push(cm.value);
    if (cm.type === "phone") entry.phones.push(cm.value);
  }

  // Read social profiles
  let socialProfiles: any[] = [];
  try {
    socialProfiles = source.prepare(`
      SELECT person_id, platform, url FROM social_profiles
    `).all() as any[];
    log(`Found ${socialProfiles.length} social profiles`);
  } catch {
    warn("No social_profiles table found");
  }

  source.close();

  if (DRY_RUN) {
    log(`[DRY RUN] Would insert ${people.length} people`);
    return;
  }

  // Insert into Rudder
  const insert = rudder.prepare(`
    INSERT OR IGNORE INTO people (name, email, phone, company, role, relationship, notes, warmth, created_at, updated_at)
    VALUES (@name, @email, @phone, @company, @role, @relationship, @notes, @warmth, @created_at, @updated_at)
  `);

  const tx = rudder.transaction(() => {
    let inserted = 0;
    let skipped = 0;

    for (const p of people) {
      const name = `${p.first_name} ${p.last_name}`.trim();
      if (!name) {
        skip(`Empty name (id: ${p.id})`);
        skipped++;
        continue;
      }

      // Enrich with contact methods
      const methods = methodsByPerson.get(p.id);
      const email = methods?.emails[0] || null;
      const phone = methods?.phones[0] || null;

      // Normalize relationship
      let relationship = p.relationship || "contact";
      if (relationship === "son's maternal family") relationship = "family";

      const result = insert.run({
        name,
        email,
        phone,
        company: p.org || null,
        role: p.title || null,
        relationship,
        notes: p.notes || "",
        warmth: p.warmth || 0,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
      });

      if (result.changes > 0) inserted++;
      else skipped++;
    }

    ok(`People: ${inserted} inserted, ${skipped} skipped`);
  });

  tx();
}

// ═══════════════════════════════════════════════════════
// Migration 2: 10D Reality Ledger (189 nodes)
// ═══════════════════════════════════════════════════════

function migrateLedger(rudder: Database.Database) {
  log("── 10D Ledger Migration ──");

  const source = openReadOnly(LEDGER_DB);
  if (!source) return;

  const nodes = source.prepare("SELECT * FROM reality_nodes").all() as any[];
  log(`Found ${nodes.length} reality nodes in source`);

  source.close();

  if (DRY_RUN) {
    log(`[DRY RUN] Would insert ${nodes.length} reality nodes`);
    return;
  }

  const insert = rudder.prepare(`
    INSERT OR IGNORE INTO reality_nodes (
      event_id, when_timestamp, where_context, who_entities, 
      what_classification, why_insight, how_actions, state_vitals, 
      gravity_score, origin_provenance, artifact_id, raw_blob
    ) VALUES (
      @event_id, @when_timestamp, @where_context, @who_entities, 
      @what_classification, @why_insight, @how_actions, @state_vitals, 
      @gravity_score, @origin_provenance, @artifact_id, @raw_blob
    )
  `);

  const tx = rudder.transaction(() => {
    let inserted = 0;
    let skipped = 0;

    for (const node of nodes) {
      const result = insert.run({
        event_id: node.event_id,
        when_timestamp: node.when_timestamp,
        where_context: node.where_context || null,
        who_entities: node.who_entities || "[]",
        what_classification: node.what_classification,
        why_insight: node.why_insight || null,
        how_actions: node.how_actions || "[]",
        state_vitals: node.state_vitals || "{}",
        gravity_score: node.gravity_score || 1,
        origin_provenance: node.origin_provenance,
        artifact_id: node.artifact_id || null,
        raw_blob: node.raw_blob || null,
      });

      if (result.changes > 0) inserted++;
      else skipped++;
    }

    ok(`Ledger: ${inserted} inserted, ${skipped} skipped`);
  });

  tx();
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════

function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 — Data Migration              ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE — no data will be written");
    console.log("");
  }

  const rudder = openRudder();
  log(`Target: ${RUDDER_DB}`);
  console.log("");

  if (!LEDGER_ONLY) migratePeople(rudder);
  if (!PEOPLE_ONLY) migrateLedger(rudder);

  rudder.close();
  console.log("");
  ok("Migration complete.");
}

main();
