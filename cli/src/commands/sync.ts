import chalk from "chalk";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";
import { RUDDER_DB_PATH, ROOT_DIR } from "../constants.js";
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

/**
 * Classify a file by its extension into a category.
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
 * Directories to skip during scanning.
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
        // Skip inaccessible files
      }
    }
  }
}

/**
 * Scan a data source and ingest metadata using POST /api/ingest batches.
 */
async function scanSource(
  db: Database.Database,
  source: { id: number; name: string; path: string; type: string },
  port: string
): Promise<{ filesScanned: number; newFiles: number; totalSize: number }> {
  let filesScanned = 0;
  let newFiles = 0;
  let totalSize = 0;

  const updateSourceStmt = db.prepare(`
    UPDATE data_sources SET status = 'active', error_message = NULL, last_scanned = datetime('now') WHERE id = ?
  `);

  const sendBatchToAPI = async (nodes: FileNode[]) => {
    const payloads = nodes.map(node => {
      const parsedBlob = JSON.parse(node.raw_blob);
      return {
        source: node.origin_provenance,
        timestamp: node.when_timestamp,
        classification: "note", // reality_nodes ledger fallback
        payload: {
          event_id: node.event_id,
          title: parsedBlob.filename,
          location: node.where_context,
          what_classification: node.what_classification,
          origin_provenance: node.origin_provenance,
          artifact_id: node.artifact_id,
          ...parsedBlob
        }
      };
    });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.RUDDER_INGEST_TOKEN) {
        headers["x-rudder-token"] = process.env.RUDDER_INGEST_TOKEN;
      }

      const res = await fetch(`http://localhost:${port}/api/ingest`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloads)
      });

      if (!res.ok) {
        const errText = await res.text();
        log.error(`API Ingestion Error (${res.status}): ${errText}`);
      } else {
        const data = await res.json() as any;
        if (data.results && Array.isArray(data.results)) {
          for (const item of data.results) {
            if (item.success && !item.duplicate) {
              newFiles++;
            }
          }
        }
      }
    } catch (err: any) {
      log.error(`API connection failed on port ${port}: ${err.message}. Ensure Rudder server is running.`);
    }
  };

  // Batch nodes
  const BATCH_SIZE = 200;
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
      await sendBatchToAPI(batch);
      batch = [];
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await sendBatchToAPI(batch);
  }

  // Update last scanned timestamp in SQLite metadata
  updateSourceStmt.run(source.id);

  return { filesScanned, newFiles, totalSize };
}

/**
 * `rudder sync` — Scan registered data sources and ingest file metadata via API.
 */
export async function syncCommand(options: { watch?: boolean; interval?: number; port?: string }) {
  log.section("Sovereign Sync Engine");

  // Load API token
  loadEnv();

  const port = options.port || "3100";
  const db = openRudderDB();

  // Ensure table exists
  try {
    db.prepare("SELECT 1 FROM data_sources LIMIT 1").get();
  } catch {
    log.error("data_sources table not found. Start the Rudder web app first to run migrations.");
    db.close();
    return;
  }

  const runScan = async () => {
    const sources = db.prepare("SELECT * FROM data_sources WHERE status IN ('active', 'error', 'disconnected')").all() as any[];

    if (sources.length === 0) {
      log.warn("No active data sources registered.");
      log.info("Add sources via Settings → Integrations in the Rudder web UI.");
      return;
    }

    log.info(`Found ${sources.length} active data source(s). Syncing via API on port ${port}...`);
    log.br();

    let totalScanned = 0;
    let totalNew = 0;
    let totalBytes = 0;

    for (const source of sources) {
      if (!fs.existsSync(source.path)) {
        log.warn(`Source disconnected: ${source.name} → ${source.path}`);
        db.prepare("UPDATE data_sources SET status = 'disconnected', error_message = ? WHERE id = ?").run(
          `Directory does not exist: ${source.path}`,
          source.id
        );
        continue;
      }

      const label = `${source.name} (${source.type})`;
      log.info(`Scanning: ${chalk.bold(label)}`);
      log.kv("Path", source.path);

      try {
        const t0 = Date.now();
        const result = await scanSource(db, source, port);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        totalScanned += result.filesScanned;
        totalNew += result.newFiles;
        totalBytes += result.totalSize;

        log.kv("Files scanned", result.filesScanned.toLocaleString());
        log.kv("New entries", result.newFiles.toLocaleString(), result.newFiles > 0 ? "green" : "yellow");
        log.kv("Source size", formatBytes(result.totalSize));
        log.kv("Elapsed", `${elapsed}s`);
        log.br();
      } catch (err: any) {
        log.error(`Scan failed for source "${source.name}": ${err.message}`);
        db.prepare("UPDATE data_sources SET status = 'error', error_message = ? WHERE id = ?").run(
          err.message,
          source.id
        );
        log.br();
      }
    }

    log.section("Sync Summary");
    log.kv("Total files scanned", totalScanned.toLocaleString());
    log.kv("New API entries", totalNew.toLocaleString(), "green");
    log.kv("Total data scanned", formatBytes(totalBytes), "blue");

    // Display current database ledger size
    const ledgerCount = (db.prepare("SELECT COUNT(*) as c FROM reality_nodes").get() as any).c;
    log.kv("Reality Ledger total", ledgerCount.toLocaleString(), "green");
    log.br();
    log.success("Sync complete");
  };

  // Run initial scan
  await runScan();

  // Watch mode: active folder watching using chokidar
  if (options.watch) {
    log.br();
    log.info("Watch mode: starting chokidar folder watcher (Ctrl+C to stop)");

    const sources = db.prepare("SELECT * FROM data_sources WHERE status = 'active'").all() as any[];
    if (sources.length === 0) {
      log.warn("No active data sources registered to watch.");
      db.close();
      return;
    }

    const chokidar = await import("chokidar");
    const pathsToWatch = sources.map(s => s.path).filter(p => fs.existsSync(p));

    if (pathsToWatch.length === 0) {
      log.warn("None of the active data source paths exist on disk.");
      db.close();
      return;
    }

    log.info(`Watching paths: ${pathsToWatch.join(", ")}`);

    const watcher = chokidar.watch(pathsToWatch, {
      ignored: (filePath) => {
        const parts = filePath.split(path.sep);
        return parts.some(part => SKIP_DIRS.has(part) || (part.startsWith(".") && part !== ".env"));
      },
      persistent: true,
      ignoreInitial: true,
    });

    const handleFileEvent = async (filePath: string, eventType: "add" | "change" | "unlink") => {
      log.info(`File event [${eventType}]: ${filePath}`);
      if (eventType === "unlink") {
        const eventId = fileEventId(filePath);
        try {
          db.prepare("DELETE FROM reality_nodes WHERE event_id = ?").run(eventId);
          log.info(`Removed node: ${eventId}`);
        } catch (err: any) {
          log.error(`Failed to delete node: ${err.message}`);
        }
        return;
      }

      try {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath);
        const classification = classifyFile(ext);
        const eventId = fileEventId(filePath);
        
        const source = sources.find(s => filePath.startsWith(s.path));
        const sourceName = source ? source.name : "Watched Folder";
        const sourceProvenance = source ? `rudder_sync:${source.type}` : "rudder_sync:watched";

        const node = {
          event_id: eventId,
          when_timestamp: stat.mtime.toISOString(),
          where_context: sourceName,
          what_classification: classification,
          origin_provenance: sourceProvenance,
          artifact_id: filePath,
          raw_blob: JSON.stringify({
            filename: path.basename(filePath),
            extension: ext,
            size: stat.size,
            created: stat.birthtime.toISOString(),
            modified: stat.mtime.toISOString(),
            dir: path.dirname(filePath),
          }),
        };

        const parsedBlob = JSON.parse(node.raw_blob);
        const payload = {
          source: node.origin_provenance,
          timestamp: node.when_timestamp,
          classification: "note",
          payload: {
            event_id: node.event_id,
            title: parsedBlob.filename,
            location: node.where_context,
            what_classification: node.what_classification,
            origin_provenance: node.origin_provenance,
            artifact_id: node.artifact_id,
            ...parsedBlob
          }
        };

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (process.env.RUDDER_INGEST_TOKEN) {
          headers["x-rudder-token"] = process.env.RUDDER_INGEST_TOKEN;
        }

        const res = await fetch(`http://localhost:${port}/api/ingest`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          log.error(`API Ingestion Error (${res.status}): ${errText}`);
        } else {
          log.success(`Ingested: ${path.basename(filePath)} (${classification})`);
        }
      } catch (err: any) {
        log.error(`Error processing file: ${err.message}`);
      }
    };

    watcher
      .on("add", (p) => handleFileEvent(p, "add"))
      .on("change", (p) => handleFileEvent(p, "change"))
      .on("unlink", (p) => handleFileEvent(p, "unlink"));

    process.on("SIGINT", async () => {
      log.br();
      log.info("Shutting down sync watcher...");
      await watcher.close();
      db.close();
      process.exit(0);
    });
  } else {
    db.close();
  }
}
