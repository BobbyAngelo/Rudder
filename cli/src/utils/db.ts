import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DATA_DIR, RUDDER_DB_PATH } from "../constants.js";
import { log } from "./logger.js";

/**
 * Open the main rudder.db (read/write).
 * Creates the data directory if it doesn't exist.
 */
export function openRudderDB(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(RUDDER_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Open any SQLite database read-only.
 */
export function openReadOnly(dbPath: string): Database.Database | null {
  if (!fs.existsSync(dbPath)) {
    log.warn(`Database not found: ${dbPath}`);
    return null;
  }
  try {
    return new Database(dbPath, { readonly: true });
  } catch (err: any) {
    log.error(`Failed to open ${dbPath}: ${err.message}`);
    return null;
  }
}

/**
 * Get all .db and .sqlite files in the data directory tree.
 */
export function findAllDatabases(): { path: string; name: string; size: number }[] {
  const results: { path: string; name: string; size: number }[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "backups") {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".db") || entry.name.endsWith(".sqlite"))) {
        // Skip WAL and SHM files
        if (entry.name.endsWith("-wal") || entry.name.endsWith("-shm")) continue;
        const stat = fs.statSync(fullPath);
        results.push({
          path: fullPath,
          name: path.relative(DATA_DIR, fullPath),
          size: stat.size,
        });
      }
    }
  }

  scan(DATA_DIR);
  return results;
}

/**
 * Get table names and row counts for a database.
 */
export function getTableStats(dbPath: string): { table: string; rows: number }[] {
  const db = openReadOnly(dbPath);
  if (!db) return [];

  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    return tables.map((t) => {
      try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number };
        return { table: t.name, rows: count.c };
      } catch {
        return { table: t.name, rows: -1 };
      }
    });
  } finally {
    db.close();
  }
}
