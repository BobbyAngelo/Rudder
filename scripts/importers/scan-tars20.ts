#!/usr/bin/env tsx

/**
 * Rudder 1.0 — RUDDER 20 Deep Scanner
 * 
 * Scans the RUDDER 20 volume for structured data that can be ingested into Rudder.
 * Imports: G Drive production documents → journal_entries (mode: "script" or "note")
 * 
 * Usage:
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/scan-tars20.ts
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/scan-tars20.ts --dry-run
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");
const RUDDER20 = "/Volumes/RUDDER 20";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[tars20] ${msg}`);
const ok = (msg: string) => console.log(`[tars20] ✅ ${msg}`);

// Simple .docx text extractor (XML-based format)
function extractDocx(filePath: string): string {
  try {
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(filePath);
    const docXml = zip.readAsText("word/document.xml");
    if (!docXml) return "";
    // Strip XML tags, keep text content
    return docXml
      .replace(/<w:br[^/]*\/>/g, "\n")
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 — RUDDER 20 Deep Scanner       ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!fs.existsSync(RUDDER20)) {
    throw new Error(`RUDDER 20 volume not found at ${RUDDER20}`);
  }

  if (DRY_RUN) log("🔍 DRY RUN MODE");

  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  // ── Phase 1: G Drive Documents ──
  const gdrivePath = path.join(RUDDER20, "05_STAGING/G_Drive_TO_SORT/g drive docs");
  log("Phase 1: G Drive production documents");

  const docxFiles = fs.readdirSync(gdrivePath)
    .filter(f => f.endsWith(".docx") && !f.startsWith("Untitled document"))
    .sort();

  log(`Found ${docxFiles.length} named .docx files (excluding untitled)`);

  const insert = db.prepare(`
    INSERT INTO journal_entries (title, content, mode, word_count, tags, created_at, updated_at)
    VALUES (@title, @content, @mode, @word_count, @tags, @created_at, @updated_at)
  `);

  // Check how many we already have to avoid duplicates
  const existingTitles = new Set(
    (db.prepare("SELECT title FROM journal_entries").all() as any[]).map((r: any) => r.title)
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const tagMap: Record<string, string[]> = {};

  for (const file of docxFiles) {
    const title = file.replace(/\.docx$/, "").replace(/_/g, " ").trim();

    if (existingTitles.has(title)) {
      skipped++;
      continue;
    }

    const filePath = path.join(gdrivePath, file);
    const content = extractDocx(filePath);

    if (!content || content.length < 10) {
      failed++;
      continue;
    }

    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Auto-classify mode based on content/title
    let mode = "note";
    const lowerTitle = title.toLowerCase();
    const tags: string[] = ["gdrive", "production"];

    if (lowerTitle.includes("treatment") || lowerTitle.includes("pitch") || lowerTitle.includes("one sheet")) {
      mode = "script";
      tags.push("treatment");
    } else if (lowerTitle.includes("budget") || lowerTitle.includes("invoice") || lowerTitle.includes("call sheet")) {
      tags.push("operations");
    } else if (lowerTitle.includes("resume") || lowerTitle.includes("bio") || lowerTitle.includes("work history")) {
      tags.push("career");
    } else if (lowerTitle.includes("shot list") || lowerTitle.includes("style guide") || lowerTitle.includes("production")) {
      mode = "script";
      tags.push("production");
    }

    // Get file modification date for created_at
    const stat = fs.statSync(filePath);
    const created = stat.mtime.toISOString();

    if (!DRY_RUN) {
      try {
        insert.run({
          title,
          content,
          mode,
          word_count: wordCount,
          tags: JSON.stringify(tags),
          created_at: created,
          updated_at: created,
        });
        imported++;
      } catch (e: any) {
        log(`  ⚠️  Failed: ${title} — ${e.message}`);
        failed++;
      }
    } else {
      imported++;
    }
  }

  log(`  Imported: ${imported} | Skipped (exists): ${skipped} | Failed: ${failed}`);

  // ── Phase 2: Untitled documents (still valuable content) ──
  log("Phase 2: Untitled documents");
  const untitledFiles = fs.readdirSync(gdrivePath)
    .filter(f => f.startsWith("Untitled document") && f.endsWith(".docx"))
    .sort();

  let untitledImported = 0;
  for (const file of untitledFiles) {
    const filePath = path.join(gdrivePath, file);
    const content = extractDocx(filePath);

    if (!content || content.length < 50) continue;

    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
    const firstLine = content.split("\n").find(l => l.trim().length > 3)?.trim() || file;
    const title = firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;

    if (existingTitles.has(title)) continue;

    const stat = fs.statSync(filePath);

    if (!DRY_RUN) {
      try {
        insert.run({
          title,
          content,
          mode: "note",
          word_count: wordCount,
          tags: JSON.stringify(["gdrive", "untitled"]),
          created_at: stat.mtime.toISOString(),
          updated_at: stat.mtime.toISOString(),
        });
        untitledImported++;
      } catch { /* skip duplicates */ }
    } else {
      untitledImported++;
    }
  }
  log(`  Untitled docs with content: ${untitledImported}`);

  // ── Phase 3: Silent Boom PDFs (just record the titles/metadata) ──
  log("Phase 3: Silent Boom project docs");
  const silentBoom = path.join(RUDDER20, "01_PERSONAL_ARCHIVE/silent-boom");
  if (fs.existsSync(silentBoom)) {
    const sbFiles = fs.readdirSync(silentBoom).filter(f => f.endsWith(".pdf"));
    log(`  Found ${sbFiles.length} Silent Boom PDFs (catalog only — PDF parsing not available)`);
  }

  // ── Summary ──
  const totalEntries = (db.prepare("SELECT COUNT(*) as cnt FROM journal_entries").get() as any).cnt;
  db.close();

  console.log("");
  ok(`Total journal entries now: ${totalEntries}`);
  ok(`RUDDER 20 scan complete.`);
  console.log("");
  console.log("📋 Available but not ingested (need specialized parsers):");
  console.log("   • 222 G Drive docs (imported named .docx files)");
  console.log("   • 13GB Scene Montages (203 curated film clips)");
  console.log("   • 71GB video archive (production reels, demos)");
  console.log("   • Tax records 2013-2023 (11 years)");
  console.log("   • 246MB Outlook email archive (.olm)");
  console.log("   • Kaiser Permanente medical record (PDF)");
  console.log("   • Insurance cards, driver's license scans");
  console.log("   • 17 reference screenplays (PDF collection)");
}

main();
