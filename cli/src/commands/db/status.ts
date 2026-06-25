import chalk from "chalk";
import fs from "fs";
import Database from "better-sqlite3";
import { DATA_DIR, RUDDER_DB_PATH } from "../../constants.js";
import { log } from "../../utils/logger.js";
import { findAllDatabases, getTableStats } from "../../utils/db.js";

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * `rudder db status` — Show database inventory, table counts, and sizes.
 */
export function dbStatusCommand(options: { verbose?: boolean }) {
  log.section("Database Status");

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    log.error(`Data directory not found: ${DATA_DIR}`);
    log.info('Run "rudder setup" to initialize.');
    return;
  }

  // Find all database files
  const databases = findAllDatabases();

  if (databases.length === 0) {
    log.warn("No databases found.");
    return;
  }

  // Total size
  const totalSize = databases.reduce((sum, db) => sum + db.size, 0);
  log.kv("Total databases", databases.length.toString());
  log.kv("Total size", formatBytes(totalSize), "blue");
  log.br();

  // Per-database summary
  for (const db of databases) {
    const isMain = db.path === RUDDER_DB_PATH;
    const label = isMain ? `${db.name} ${chalk.green("(main)")}` : db.name;

    console.log(`   ${chalk.bold(label)}  ${chalk.dim(formatBytes(db.size))}`);

    if (options.verbose || isMain) {
      const tables = getTableStats(db.path);
      for (const t of tables) {
        const rowStr = t.rows >= 0 ? t.rows.toLocaleString() : "error";
        const color = t.rows > 1000 ? chalk.green : t.rows > 0 ? chalk.white : chalk.dim;
        console.log(`     ${chalk.dim("├─")} ${t.table.padEnd(28)} ${color(rowStr)} rows`);
      }
      console.log("");
    }
  }

  // Migration status
  if (fs.existsSync(RUDDER_DB_PATH)) {
    log.section("Migrations");
    const db = new Database(RUDDER_DB_PATH, { readonly: true });
    try {
      const migrations = db
        .prepare("SELECT name, applied_at FROM _migrations ORDER BY applied_at")
        .all() as { name: string; applied_at: string }[];

      for (const m of migrations) {
        log.kv(m.name, m.applied_at, "green");
      }
      log.br();
      log.success(`${migrations.length} migrations applied`);
    } catch {
      log.warn("No migration tracking table found");
    } finally {
      db.close();
    }
  }
}
