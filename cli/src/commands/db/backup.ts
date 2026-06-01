import chalk from "chalk";
import fs from "fs";
import path from "path";
import { BACKUP_DIR } from "../../constants.js";
import { log } from "../../utils/logger.js";
import { findAllDatabases } from "../../utils/db.js";

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
 * `rudder db backup` — Snapshot all database files into timestamped backup.
 */
export function dbBackupCommand() {
  log.section("Database Backup");

  // Create timestamped backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, timestamp);

  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  // Find all databases
  const databases = findAllDatabases();

  if (databases.length === 0) {
    log.warn("No databases found to back up.");
    return;
  }

  log.info(`Backing up ${databases.length} database(s)...`);
  log.br();

  let totalSize = 0;

  for (const db of databases) {
    const destDir = path.join(backupPath, path.dirname(db.name));
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(backupPath, db.name);

    try {
      fs.copyFileSync(db.path, destPath);
      totalSize += db.size;
      log.success(`${db.name} ${chalk.dim(`(${formatBytes(db.size)})`)}`);

      // Also copy WAL and SHM if they exist (for consistency)
      const walPath = db.path + "-wal";
      const shmPath = db.path + "-shm";
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, destPath + "-wal");
        const walSize = fs.statSync(walPath).size;
        totalSize += walSize;
      }
      if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, destPath + "-shm");
      }
    } catch (err: any) {
      log.error(`Failed to backup ${db.name}: ${err.message}`);
    }
  }

  log.br();
  log.success(`Backup complete: ${chalk.blue(backupPath)}`);
  log.kv("Total size", formatBytes(totalSize), "blue");
  log.kv("Location", path.relative(process.cwd(), backupPath));

  // Show existing backups count
  if (fs.existsSync(BACKUP_DIR)) {
    const existing = fs.readdirSync(BACKUP_DIR).filter((d) =>
      fs.statSync(path.join(BACKUP_DIR, d)).isDirectory()
    );
    if (existing.length > 5) {
      log.br();
      log.warn(
        `${existing.length} backups exist. Consider cleaning old ones in ${chalk.dim("data/backups/")}`
      );
    }
  }
}
