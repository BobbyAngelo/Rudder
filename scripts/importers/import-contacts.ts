#!/usr/bin/env tsx

/**
 * Rudder 1.0 - vCard Contacts Import Script
 * Reads a .vcf file and imports contacts into the people table.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { readVCFFile } from "../../app/src/lib/ingest/contacts";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");

const args = process.argv.slice(2);
const filePath = args.filter(a => !a.startsWith("--"))[0];
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[contacts] ${msg}`);
const ok = (msg: string) => console.log(`[contacts] ✅ ${msg}`);

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 - vCard Contacts Import       ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/importers/import-contacts.ts <path/to/contacts.vcf> [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  log(`Reading: ${filePath}`);
  const contacts = readVCFFile(filePath);
  log(`Found ${contacts.length} contacts to import`);

  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - no data will be written");
    return;
  }

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  const checkStmt = db.prepare(`
    SELECT id FROM people WHERE name = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO people (
      name, email, phone, company, role, relationship, notes, 
      warmth, linkedin, website, address, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE people 
    SET email = ?, phone = ?, company = ?, role = ?, notes = ?, 
        linkedin = ?, website = ?, address = ?, updated_at = ?
    WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (const contact of contacts) {
      const existing = checkStmt.get(contact.name) as { id: number } | undefined;

      if (existing) {
        updateStmt.run(
          contact.email,
          contact.phone,
          contact.company,
          contact.role,
          contact.notes,
          contact.linkedin,
          contact.website,
          contact.address,
          now,
          existing.id
        );
        updated++;
      } else {
        insertStmt.run(
          contact.name,
          contact.email,
          contact.phone,
          contact.company,
          contact.role,
          "colleague", // default relationship
          contact.notes,
          0, // warmth
          contact.linkedin,
          contact.website,
          contact.address,
          now,
          now
        );
        inserted++;
      }
    }
  });

  tx();
  db.close();

  ok(`Processed ${contacts.length} contacts`);
  ok(`Inserted: ${inserted}`);
  ok(`Updated: ${updated}`);
}

main().catch(console.error);
