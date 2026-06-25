import chalk from "chalk";
import fs from "fs";
import path from "path";
import { BACKUP_DIR, ROOT_DIR } from "../constants.js";
import { log } from "../utils/logger.js";
import { dbBackupCommand } from "./db/backup.js";

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
 * Parses and loads environment variables from .env.local at the root directory
 */
function loadEnv() {
  const envPath = path.join(ROOT_DIR, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let val = trimmed.slice(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

export async function backupCommand(options: { port?: string }) {
  loadEnv();
  const port = options.port || "3000";

  log.section("System Backup");
  log.info(`Attempting full WAL-safe ZIP backup via API on port ${port}...`);

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFileName = `rudder-backup-${timestamp}.zip`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  let success = false;
  try {
    const headers: Record<string, string> = {};
    if (process.env.RUDDER_INGEST_TOKEN) {
      headers["x-rudder-token"] = process.env.RUDDER_INGEST_TOKEN;
    }

    const res = await fetch(`http://localhost:${port}/api/backup`, {
      method: "GET",
      headers
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(backupFilePath, buffer);
      
      success = true;
      log.success(`ZIP Backup downloaded successfully.`);
      log.kv("Saved to", path.relative(process.cwd(), backupFilePath));
      log.kv("Size", formatBytes(buffer.length), "blue");
    } else {
      const errText = await res.text();
      log.error(`API Backup request failed (${res.status}): ${errText}`);
    }
  } catch (err: any) {
    log.warn(`API server offline on port ${port}. Falling back to direct database snapshot.`);
  }

  // Fallback path
  if (!success) {
    dbBackupCommand();
  }
}
