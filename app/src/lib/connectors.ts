/* ═══════════════════════════════════════════════════════
   Connectors — manage data sources that feed the memory store.

   A connector's ONLY job is `list(config) → RawDoc[]`. Everything
   downstream — enrich, embed, index, prune — is shared. Adding a new
   source = adding one entry to REGISTRY.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { existsSync, statSync } from "fs";
import { readMarkdownVault } from "./ingest/markdown";
import { readFilesFolder } from "./ingest/files";
import { readCalendar } from "./ingest/ics";
import { readContacts } from "./ingest/vcard";
import { readHealthExport } from "./ingest/health";
import { readLinkedIn } from "./ingest/linkedin";
import { readEmailMbox } from "./ingest/email";
import { readMeta } from "./ingest/meta";
import { readTwitter } from "./ingest/twitter";
import { SUPPORTED_LABEL } from "./ingest/parse";
import { toChunks, type RawDoc } from "./ingest/enrich";
import { indexChunks, pruneConnector, type EmbedFn } from "./memory";

function assertFolder(p: string | undefined): void {
  if (!p || !existsSync(p) || !statSync(p).isDirectory()) {
    throw new Error(`Not a folder on this machine: ${p || "(empty)"}`);
  }
}

function assertPath(p: string | undefined): void {
  if (!p || !existsSync(p)) {
    throw new Error(`Not a file or folder on this machine: ${p || "(empty)"}`);
  }
}

function parseExcludes(cfg: Record<string, string>): string[] {
  return (cfg.exclude || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface ConfigField {
  key: string;
  label: string;
  type: "path" | "text" | "secret";
  placeholder?: string;
  optional?: boolean;
}

export interface Connector {
  type: string;
  label: string;
  config: ConfigField[];
  /** The only connector-specific code: turn a config into raw documents. */
  list(config: Record<string, string>): Promise<RawDoc[]> | RawDoc[];
}

// ── Registry: add a connector here and it works end-to-end. ──
const markdown: Connector = {
  type: "markdown",
  label: "Markdown / Obsidian",
  config: [
    { key: "path", label: "Folder path", type: "path", placeholder: "/Users/you/Notes" },
    { key: "exclude", label: "Exclude (comma-separated)", type: "text", placeholder: "Archive, Private", optional: true },
  ],
  list: (cfg) => {
    assertFolder(cfg.path);
    return readMarkdownVault(cfg.path, parseExcludes(cfg));
  },
};

// Universal drop: a folder of mixed file types (text always; pdf/docx/images
// when the optional parsers are installed). Same enrich pipeline as the rest.
const files: Connector = {
  type: "files",
  label: "Files (universal)",
  config: [
    { key: "path", label: "Folder path", type: "path", placeholder: "/Users/you/Documents" },
    { key: "exclude", label: "Exclude (comma-separated)", type: "text", placeholder: "Archive, Private", optional: true },
  ],
  list: async (cfg) => {
    assertFolder(cfg.path);
    const { docs, skipped } = await readFilesFolder(cfg.path, parseExcludes(cfg));
    if (skipped.length) {
      console.warn(`[files connector] skipped ${skipped.length} file(s):`,
        skipped.slice(0, 5).map((s) => `${s.file} (${s.reason})`).join("; "));
    }
    return docs;
  },
};

// Calendar: a .ics export (file) or a folder of them. Each event carries a
// real date + attendees, feeding the temporal/entity backbone.
const calendar: Connector = {
  type: "calendar",
  label: "Calendar (.ics)",
  config: [
    { key: "path", label: "File or folder", type: "path", placeholder: "/Users/you/Downloads/calendar.ics" },
    { key: "exclude", label: "Exclude (comma-separated)", type: "text", placeholder: "Archive", optional: true },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readCalendar(cfg.path, parseExcludes(cfg));
  },
};

// Contacts: a .vcf export (file) or a folder. Each contact becomes a
// people-tagged doc — the entity backbone for people-aware recall.
const contacts: Connector = {
  type: "contacts",
  label: "Contacts (.vcf)",
  config: [
    { key: "path", label: "File or folder", type: "path", placeholder: "/Users/you/Downloads/contacts.vcf" },
    { key: "exclude", label: "Exclude (comma-separated)", type: "text", placeholder: "Archive", optional: true },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readContacts(cfg.path, parseExcludes(cfg));
  },
};

// Apple Health: the unzipped export.xml (or apple_health_export folder).
// Streamed + aggregated into weekly per-metric summaries — sovereign quantified-self.
const health: Connector = {
  type: "health",
  label: "Apple Health",
  config: [
    { key: "path", label: "export.xml or folder", type: "path", placeholder: "/Users/you/apple_health_export/export.xml" },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readHealthExport(cfg.path);
  },
};

// LinkedIn: your own "Get a copy of your data" export folder (CSVs). Parsed
// locally — no scraping, no API. Feeds professional identity into memory.
const linkedin: Connector = {
  type: "linkedin",
  label: "LinkedIn (export)",
  config: [
    { key: "path", label: "LinkedIn export folder", type: "path", placeholder: "/Users/you/Downloads/Basic_LinkedInDataExport" },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readLinkedIn(cfg.path);
  },
};

// Email: your own .mbox export (Gmail Takeout, Apple Mail, Thunderbird, …).
// Streamed so huge archives don't blow memory; skips Spam/Trash. Local only.
const email: Connector = {
  type: "email",
  label: "Email (.mbox)",
  config: [
    { key: "path", label: ".mbox file", type: "path", placeholder: "/Users/you/Downloads/All mail.mbox" },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readEmailMbox(cfg.path);
  },
};

// Meta: your own Facebook/Instagram "Download Your Information" export (JSON).
// Shape-detecting walker (posts + message threads), fixes Meta's UTF-8 mojibake.
const meta: Connector = {
  type: "meta",
  label: "Meta (FB/IG export)",
  config: [
    { key: "path", label: "Meta export folder (JSON)", type: "path", placeholder: "/Users/you/Downloads/facebook-export" },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readMeta(cfg.path);
  },
};

// X/Twitter: your own archive (Settings → Download an archive of your data).
// Files are JS (window.YTD…) — strip the prefix, parse tweets + DMs. Local only.
const twitter: Connector = {
  type: "twitter",
  label: "X / Twitter (archive)",
  config: [
    { key: "path", label: "Twitter archive folder", type: "path", placeholder: "/Users/you/Downloads/twitter-archive" },
  ],
  list: (cfg) => {
    assertPath(cfg.path);
    return readTwitter(cfg.path);
  },
};

export const REGISTRY: Record<string, Connector> = { markdown, files, calendar, contacts, health, linkedin, email, meta, twitter };

// Accepted by the universal-drop door, surfaced in the UI.
export const FILES_SUPPORTED = SUPPORTED_LABEL;

export interface ConnectorRow {
  id: number;
  type: string;
  path: string;
  label: string | null;
  config: string | null;
  last_sync: string | null;
  chunk_count: number;
  status: string;
}

export function ensureConnectors(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS connectors (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       type TEXT NOT NULL,
       path TEXT,
       label TEXT,
       config TEXT,
       last_sync TEXT,
       chunk_count INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'idle',
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       UNIQUE(type, path)
     )`
  );
  try { db.exec("ALTER TABLE connectors ADD COLUMN config TEXT"); } catch { /* exists */ }
}

export function listConnectors(db: Database.Database): ConnectorRow[] {
  ensureConnectors(db);
  return db.prepare("SELECT * FROM connectors ORDER BY created_at DESC").all() as ConnectorRow[];
}

export function addConnector(db: Database.Database, type: string, config: Record<string, string>): ConnectorRow {
  ensureConnectors(db);
  const connector = REGISTRY[type];
  if (!connector) throw new Error(`Unknown connector type: ${type}`);
  const path = config.path ?? type; // folder connectors key on path; others on type
  db.prepare("INSERT OR IGNORE INTO connectors (type, path, label, config) VALUES (?, ?, ?, ?)")
    .run(type, path, connector.label, JSON.stringify(config));
  return db.prepare("SELECT * FROM connectors WHERE type = ? AND path = ?").get(type, path) as ConnectorRow;
}

export async function syncConnector(db: Database.Database, id: number, embed: EmbedFn) {
  ensureConnectors(db);
  const row = db.prepare("SELECT * FROM connectors WHERE id = ?").get(id) as ConnectorRow | undefined;
  if (!row) throw new Error("Connector not found");
  const connector = REGISTRY[row.type];
  if (!connector) throw new Error(`Unknown connector type: ${row.type}`);

  const config = { path: row.path, ...(row.config ? JSON.parse(row.config) : {}) };
  const docs = await connector.list(config);
  const chunks = docs.flatMap(toChunks);

  const { indexed, skipped } = await indexChunks(db, chunks, embed, row.id);
  const pruned = pruneConnector(db, row.id, chunks.map((c) => c.id!).filter(Boolean));

  db.prepare("UPDATE connectors SET last_sync = datetime('now'), chunk_count = ?, status = 'synced' WHERE id = ?")
    .run(chunks.length, id);
  return { indexed, skipped, pruned, total: chunks.length };
}

export function removeConnector(db: Database.Database, id: number): void {
  ensureConnectors(db);
  pruneConnector(db, id, []); // delete every chunk this connector owns
  db.prepare("DELETE FROM connectors WHERE id = ?").run(id);
}
