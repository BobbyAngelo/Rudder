import { getDB } from "./db";
import * as path from "path";
import * as fs from "fs";

/* ═══════════════════════════════════════════════════════
   Database Integrity Check Script (Local to app/src/lib/)
   ═══════════════════════════════════════════════════════ */

console.log("[test-db] Initializing database via getDB()...");
const db = getDB();


// List of expected tables
const EXPECTED_TABLES = [
  "identity_profile",
  "identity_values",
  "identity_milestones",
  "identity_links",
  "journal_entries",
  "hardware_projects",
  "people",
  "health_metrics",
  "health_records",
  "health_providers",
  "user_preferences",
  "task_projects",
  "task_labels",
  "tasks",
  "calendar_events",
  "habits",
  "habit_logs",
  "data_sources",
  "mcp_servers",
  "search_index",
  "correspondence",
  "chunk_embeddings"
];

let failures = 0;

console.log("\n--- Checking Table Existence ---");
for (const table of EXPECTED_TABLES) {
  try {
    const info = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?`).get(table) as { count: number };
    if (info && info.count > 0) {
      const rowCount = db.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
      console.log(`✅ Table [${table}] exists. Rows: ${rowCount.count}`);
    } else {
      // Check virtual tables or schema
      const vInfo = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?`).get(table) as { count: number };
      console.log(`⚠️ Table [${table}] not found in standard sqlite_master. Checking schema...`);
      failures++;
    }
  } catch (err: any) {
    console.error(`❌ Error checking table [${table}]: ${err.message}`);
    failures++;
  }
}

console.log("\n--- Checking User Preferences Configuration ---");
try {
  const prefs = db.prepare("SELECT * FROM user_preferences WHERE id = 1").get() as any;
  if (prefs) {
    console.log("✅ User preferences row 1 exists.");
    console.log(`   Theme: ${prefs.theme}`);
    console.log(`   Enabled Modules: ${prefs.enabled_modules}`);
    console.log(`   Default Execution Mode: ${prefs.default_execution_mode}`);
    console.log(`   Fallback Execution Mode: ${prefs.fallback_execution_mode}`);
  } else {
    console.error("❌ User preferences row 1 is missing!");
    failures++;
  }
} catch (err: any) {
  console.error(`❌ Error querying user preferences: ${err.message}`);
  failures++;
}

console.log("\n--- Checking Foreign Key Integrity ---");
try {
  const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
  if (fkCheck.length === 0) {
    console.log("✅ Foreign key check passed. No integrity violations found.");
  } else {
    console.error(`❌ Foreign key check failed. Found ${fkCheck.length} violations:`, fkCheck);
    failures++;
  }
} catch (err: any) {
  console.error(`❌ Error checking foreign keys: ${err.message}`);
  failures++;
}

console.log("\n--- Checking FTS5 Search Index ---");
try {
  const count = db.prepare("SELECT count(*) as count FROM search_index").get() as { count: number };
  console.log(`✅ search_index FTS5 virtual table is populated with ${count.count} documents.`);
} catch (err: any) {
  console.error(`❌ Error querying search_index: ${err.message}`);
  failures++;
}

db.close();

console.log("\n--- Validation Summary ---");
if (failures === 0) {
  console.log("🚀 All database validation checks passed successfully!");
  process.exit(0);
} else {
  console.error(`💥 Database validation failed with ${failures} error(s).`);
  process.exit(1);
}
