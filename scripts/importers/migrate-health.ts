#!/usr/bin/env tsx

/**
 * Rudder 1.0 — Apple Health XML Parser
 * 
 * Streaming XML parser for HealthKit exports.
 * Handles 150MB+ files without loading into memory.
 * 
 * Usage:
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/migrate-health.ts
 *   cd app && NODE_PATH=./node_modules npx tsx ../scripts/migrate-health.ts --dry-run
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const ROOT = path.resolve(__dirname, "..", "..");
const RUDDER_DB = path.join(ROOT, "data", "rudder.db");
const HEALTH_XML = "/Volumes/RUDDER 2/apple_health_export/export.xml";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const log = (msg: string) => console.log(`[health] ${msg}`);
const ok = (msg: string) => console.log(`[health] ✅ ${msg}`);

// Types we care about (mapped to short names)
const TYPE_MAP: Record<string, string> = {
  HKQuantityTypeIdentifierStepCount: "StepCount",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "Distance",
  HKQuantityTypeIdentifierHeartRate: "HeartRate",
  HKQuantityTypeIdentifierRestingHeartRate: "RestingHR",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "HRV",
  HKQuantityTypeIdentifierActiveEnergyBurned: "ActiveEnergy",
  HKQuantityTypeIdentifierBasalEnergyBurned: "BasalEnergy",
  HKQuantityTypeIdentifierFlightsClimbed: "FlightsClimbed",
  HKQuantityTypeIdentifierBodyMass: "BodyMass",
  HKQuantityTypeIdentifierRespiratoryRate: "RespiratoryRate",
  HKQuantityTypeIdentifierOxygenSaturation: "OxygenSaturation",
  HKCategoryTypeIdentifierSleepAnalysis: "SleepAnalysis",
  HKQuantityTypeIdentifierWalkingSpeed: "WalkingSpeed",
  HKQuantityTypeIdentifierHeadphoneAudioExposure: "AudioExposure",
};

interface HealthRecord {
  type: string;
  value: number | null;
  unit: string | null;
  categoryValue: string | null;
  source: string;
  startDate: string;
  endDate: string;
  date: string; // ISO date only
}

function parseAppleDate(dateStr: string): { iso: string; dateOnly: string } {
  // Format: "2026-05-09 08:21:28 -0700"
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/);
  if (!match) return { iso: dateStr, dateOnly: dateStr.slice(0, 10) };

  const [, datePart, timePart, tz] = match;
  const tzFormatted = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  return {
    iso: `${datePart}T${timePart}${tzFormatted}`,
    dateOnly: datePart,
  };
}

function extractAttr(line: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = line.match(regex);
  return match ? match[1] : null;
}

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  Rudder 1.0 — Health Data Import          ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  if (!fs.existsSync(HEALTH_XML)) {
    throw new Error(`Health export not found: ${HEALTH_XML}`);
  }

  const fileStat = fs.statSync(HEALTH_XML);
  log(`Source: ${HEALTH_XML} (${(fileStat.size / 1024 / 1024).toFixed(1)} MB)`);

  if (DRY_RUN) log("🔍 DRY RUN MODE");

  // Open DB and ensure migration is applied
  const db = new Database(RUDDER_DB);
  db.pragma("journal_mode = WAL");

  // Check if table exists, if not create it
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='health_records'"
  ).get();
  
  if (!tableExists) {
    log("Creating health_records table...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS health_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value REAL,
        unit TEXT,
        category_value TEXT,
        source TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(type);
      CREATE INDEX IF NOT EXISTS idx_health_records_date ON health_records(date);
      CREATE INDEX IF NOT EXISTS idx_health_records_type_date ON health_records(type, date);
    `);
  }

  // Check existing count
  const existing = (db.prepare("SELECT COUNT(*) as cnt FROM health_records").get() as any).cnt;
  if (existing > 0) {
    log(`⚠️  health_records already has ${existing} records. Clearing for fresh import...`);
    if (!DRY_RUN) db.prepare("DELETE FROM health_records").run();
  }

  // Parse XML line by line (streaming)
  const records: HealthRecord[] = [];
  const typeCounts: Record<string, number> = {};

  const rl = createInterface({
    input: createReadStream(HEALTH_XML, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    lineCount++;

    // Progress every 100k lines
    if (lineCount % 100000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`  ... ${lineCount} lines, ${records.length} records (${elapsed}s)`);
    }

    // Only process Record elements
    if (!line.includes("<Record ")) continue;

    const rawType = extractAttr(line, "type");
    if (!rawType || !TYPE_MAP[rawType]) continue;

    const shortType = TYPE_MAP[rawType];
    const rawValue = extractAttr(line, "value");
    const unit = extractAttr(line, "unit");
    const source = extractAttr(line, "sourceName") || "";
    const rawStart = extractAttr(line, "startDate");
    const rawEnd = extractAttr(line, "endDate");

    if (!rawStart || !rawEnd) continue;

    const start = parseAppleDate(rawStart);
    const end = parseAppleDate(rawEnd);

    // Handle category vs quantity types
    let value: number | null = null;
    let categoryValue: string | null = null;

    if (rawType.includes("Category")) {
      categoryValue = rawValue;
    } else {
      value = rawValue ? parseFloat(rawValue) : null;
    }

    typeCounts[shortType] = (typeCounts[shortType] || 0) + 1;

    records.push({
      type: shortType,
      value,
      unit,
      categoryValue,
      source,
      startDate: start.iso,
      endDate: end.iso,
      date: start.dateOnly,
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Parsed ${lineCount} lines in ${elapsed}s`);
  log(`Extracted ${records.length} health records`);
  console.log("");

  // Show breakdown
  log("Record breakdown:");
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    log(`  ${type}: ${count.toLocaleString()}`);
  }
  console.log("");

  // Date range
  const dates = records.map((r) => r.date).sort();
  log(`Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

  if (DRY_RUN) {
    log(`[DRY RUN] Would insert ${records.length} records`);
    db.close();
    return;
  }

  // Batch insert (1000 at a time for performance)
  log("Inserting records...");
  const insert = db.prepare(`
    INSERT INTO health_records (type, value, unit, category_value, source, start_date, end_date, date)
    VALUES (@type, @value, @unit, @categoryValue, @source, @startDate, @endDate, @date)
  `);

  const BATCH_SIZE = 5000;
  const insertBatch = db.transaction((batch: HealthRecord[]) => {
    for (const r of batch) {
      insert.run(r);
    }
  });

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    insertBatch(batch);
    if ((i / BATCH_SIZE) % 10 === 0 && i > 0) {
      log(`  ... ${i.toLocaleString()} / ${records.length.toLocaleString()}`);
    }
  }

  // Also populate the daily rollup table
  log("Building daily rollups...");
  db.exec(`
    INSERT OR REPLACE INTO health_metrics (date, steps, resting_hr, sleep_hours)
    SELECT 
      date,
      (SELECT SUM(value) FROM health_records hr2 WHERE hr2.type = 'StepCount' AND hr2.date = hr.date) as steps,
      (SELECT AVG(value) FROM health_records hr2 WHERE hr2.type = 'RestingHR' AND hr2.date = hr.date) as resting_hr,
      (SELECT SUM(
        (julianday(end_date) - julianday(start_date)) * 24
      ) FROM health_records hr2 WHERE hr2.type = 'SleepAnalysis' AND hr2.date = hr.date) as sleep_hours
    FROM health_records hr
    GROUP BY date
    ORDER BY date;
  `);

  const finalCount = (db.prepare("SELECT COUNT(*) as cnt FROM health_records").get() as any).cnt;
  const dailyCount = (db.prepare("SELECT COUNT(*) as cnt FROM health_metrics").get() as any).cnt;

  db.close();
  console.log("");
  ok(`Inserted ${finalCount.toLocaleString()} health records`);
  ok(`Built ${dailyCount} daily rollups`);
  ok("Health import complete.");
}

main().catch(console.error);
