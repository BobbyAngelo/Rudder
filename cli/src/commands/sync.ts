import chalk from "chalk";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";
import { RUDDER_DB_PATH } from "../constants.js";
import { openRudderDB } from "../utils/db.js";
import { log } from "../utils/logger.js";

/**
 * File metadata that gets ingested into the Reality Ledger.
 */
interface FileNode {
  event_id: string;
  when_timestamp: string;
  where_context: string;
  what_classification: string;
  origin_provenance: string;
  artifact_id: string;
  raw_blob: string;
}

/**
 * Classify a file by its extension into a human-readable category.
 */
function classifyFile(ext: string): string {
  const map: Record<string, string> = {
    // Images
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image",
    ".webp": "image", ".heic": "image", ".heif": "image", ".tiff": "image",
    ".bmp": "image", ".svg": "image", ".raw": "image", ".cr2": "image",
    ".nef": "image", ".arw": "image", ".dng": "image",
    // Video
    ".mp4": "video", ".mov": "video", ".avi": "video", ".mkv": "video",
    ".wmv": "video", ".flv": "video", ".webm": "video", ".m4v": "video",
    ".mpg": "video", ".mpeg": "video", ".3gp": "video",
    // Audio
    ".mp3": "audio", ".wav": "audio", ".flac": "audio", ".aac": "audio",
    ".ogg": "audio", ".wma": "audio", ".m4a": "audio", ".aiff": "audio",
    // Documents
    ".pdf": "document", ".doc": "document", ".docx": "document",
    ".txt": "document", ".rtf": "document", ".odt": "document",
    ".pages": "document",
    // Spreadsheets
    ".xls": "spreadsheet", ".xlsx": "spreadsheet", ".csv": "spreadsheet",
    ".numbers": "spreadsheet",
    // Presentations
    ".ppt": "presentation", ".pptx": "presentation", ".key": "presentation",
    // Code
    ".ts": "code", ".tsx": "code", ".js": "code", ".jsx": "code",
    ".py": "code", ".rs": "code", ".go": "code", ".c": "code",
    ".cpp": "code", ".h": "code", ".swift": "code", ".java": "code",
    ".rb": "code", ".php": "code", ".html": "code", ".css": "code",
    ".scss": "code", ".json": "code", ".yaml": "code", ".yml": "code",
    ".toml": "code", ".xml": "code", ".sh": "code", ".zsh": "code",
    ".md": "code", ".sql": "code",
    // 3D / CAD
    ".stl": "3d_model", ".obj": "3d_model", ".fbx": "3d_model",
    ".blend": "3d_model", ".scad": "3d_model", ".step": "3d_model",
    ".3mf": "3d_model",
    // Archives
    ".zip": "archive", ".tar": "archive", ".gz": "archive",
    ".rar": "archive", ".7z": "archive", ".dmg": "archive",
    // Database
    ".db": "database", ".sqlite": "database", ".sqlite3": "database",
  };
  return map[ext.toLowerCase()] || "other";
}

/**
 * Generate a deterministic event_id from a file path so re-scans don't duplicate.
 */
function fileEventId(filePath: string): string {
  return "file_" + crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16);
}

/**
 * Format bytes into human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Directories to always skip during scanning.
 */
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "__pycache__", ".cache",
  ".Trash", ".Spotlight-V100", ".fseventsd", ".DS_Store",
  "venv", ".venv", "dist", "build", ".turbo",
]);

/**
 * Recursively walk a directory and yield file stats.
 */
function* walkDir(dir: string, maxDepth: number = 8, currentDepth: number = 0): Generator<{ filePath: string; stat: fs.Stats }> {
  if (currentDepth > maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Permission denied or broken symlink — skip silently
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkDir(fullPath, maxDepth, currentDepth + 1);
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        yield { filePath: fullPath, stat };
      } catch {
        // Broken symlink or permission error
      }
    }
  }
}

/**
 * Scan a single data source path and ingest file metadata into reality_nodes.
 * Uses INSERT OR IGNORE so re-scans are idempotent.
 */
function scanSource(
  db: Database.Database,
  source: { id: number; name: string; path: string; type: string },
): { filesScanned: number; newFiles: number; totalSize: number } {
  let filesScanned = 0;
  let newFiles = 0;
  let totalSize = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO reality_nodes
      (event_id, when_timestamp, where_context, who_entities, what_classification,
       why_insight, how_actions, origin_provenance, artifact_id, raw_blob)
    VALUES
      (@event_id, @when_timestamp, @where_context, '[]', @what_classification,
       NULL, '[]', @origin_provenance, @artifact_id, @raw_blob)
  `);

  const updateSourceStmt = db.prepare(`
    UPDATE data_sources SET last_scanned = datetime('now') WHERE id = ?
  `);

  const insertMany = db.transaction((nodes: FileNode[]) => {
    for (const node of nodes) {
      const info = insertStmt.run(node);
      if (info.changes > 0) newFiles++;
    }
    updateSourceStmt.run(source.id);
  });

  // Batch nodes to avoid holding too many in memory
  const BATCH_SIZE = 500;
  let batch: FileNode[] = [];

  for (const { filePath, stat } of walkDir(source.path)) {
    filesScanned++;
    totalSize += stat.size;

    const ext = path.extname(filePath);
    const classification = classifyFile(ext);

    batch.push({
      event_id: fileEventId(filePath),
      when_timestamp: stat.mtime.toISOString(),
      where_context: source.name,
      what_classification: classification,
      origin_provenance: `rudder_sync:${source.type}`,
      artifact_id: filePath,
      raw_blob: JSON.stringify({
        filename: path.basename(filePath),
        extension: ext,
        size: stat.size,
        created: stat.birthtime.toISOString(),
        modified: stat.mtime.toISOString(),
        dir: path.dirname(filePath),
      }),
    });

    if (batch.length >= BATCH_SIZE) {
      insertMany(batch);
      batch = [];
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    insertMany(batch);
  }

  return { filesScanned, newFiles, totalSize };
}

/**
 * `rudder sync` — Scan all registered data sources and ingest file metadata.
 *
 * Options:
 *   --watch    Keep running and re-scan every interval
 *   --interval Seconds between re-scans in watch mode (default: 300 = 5 min)
 */
export async function syncCommand(options: { watch?: boolean; interval?: number }) {
  log.section("Sovereign Sync Engine");

  const db = openRudderDB();

  // Ensure the tables exist (migration 013 might not have run via CLI path)
  try {
    db.prepare("SELECT 1 FROM data_sources LIMIT 1").get();
  } catch {
    log.error("data_sources table not found. Start the Rudder web app first to run migrations.");
    db.close();
    return;
  }

  const runScan = () => {
    const sources = db.prepare("SELECT * FROM data_sources WHERE status = 'active'").all() as any[];

    if (sources.length === 0) {
      log.warn("No active data sources registered.");
      log.info("Add sources via Settings → Integrations in the Rudder web UI.");
      return;
    }

    log.info(`Found ${sources.length} active data source(s)`);
    log.br();

    let totalScanned = 0;
    let totalNew = 0;
    let totalBytes = 0;

    for (const source of sources) {
      if (!fs.existsSync(source.path)) {
        log.warn(`Source disconnected: ${source.name} → ${source.path}`);
        db.prepare("UPDATE data_sources SET status = 'disconnected' WHERE id = ?").run(source.id);
        continue;
      }

      const label = `${source.name} (${source.type})`;
      log.info(`Scanning: ${chalk.bold(label)}`);
      log.kv("Path", source.path);

      const t0 = Date.now();
      const result = scanSource(db, source);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      totalScanned += result.filesScanned;
      totalNew += result.newFiles;
      totalBytes += result.totalSize;

      log.kv("Files scanned", result.filesScanned.toLocaleString());
      log.kv("New entries", result.newFiles.toLocaleString(), result.newFiles > 0 ? "green" : "yellow");
      log.kv("Source size", formatBytes(result.totalSize));
      log.kv("Elapsed", `${elapsed}s`);
      log.br();
    }

    log.section("Sync Summary");
    log.kv("Total files scanned", totalScanned.toLocaleString());
    log.kv("New ledger entries", totalNew.toLocaleString(), "green");
    log.kv("Total data scanned", formatBytes(totalBytes), "blue");

    // Show current ledger size
    const ledgerCount = (db.prepare("SELECT COUNT(*) as c FROM reality_nodes").get() as any).c;
    log.kv("Reality Ledger total", ledgerCount.toLocaleString(), "green");
    log.br();
    log.success("Sync complete");
  };

  // Run once
  runScan();

  // Watch mode: re-scan on interval
  if (options.watch) {
    const intervalSec = options.interval || 300;
    log.br();
    log.info(`Watch mode: re-scanning every ${intervalSec}s (Ctrl+C to stop)`);

    const tick = () => {
      log.br();
      log.info(`─── Re-scan at ${new Date().toLocaleTimeString()} ───`);
      runScan();
    };

    setInterval(tick, intervalSec * 1000);

    // Keep process alive
    process.on("SIGINT", () => {
      log.br();
      log.info("Shutting down sync daemon...");
      db.close();
      process.exit(0);
    });
  } else {
    db.close();
  }
}
