/* ═══════════════════════════════════════════════════════
   OKF Importer — consume external Open Knowledge Format bundles

   Parses OKF v0.1 bundles (markdown + YAML frontmatter) produced
   by Rudder or any other OKF producer, and turns each concept into
   a RAG Chunk. Imported bundles live under data/okf-imports/ and
   are picked up by buildContextChunks(), so they automatically flow
   into the semantic-retrieval + embeddings pipeline.

   Dependency-free: a small frontmatter parser handles the reserved
   OKF fields (type, title, description, resource, tags, timestamp).
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, sep } from "path";
import type { Chunk } from "./rag";

export const OKF_IMPORTS_SUBDIR = "okf-imports";

// Files that are navigation/history, not substantive concepts.
const SKIP_BASENAMES = new Set(["index.md", "log.md"]);
const MAX_BODY_CHARS = 4000;

export interface OKFFrontmatter {
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  timestamp?: string;
  [k: string]: any;
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return t;
}

/**
 * Minimal YAML-frontmatter parser. Handles scalars, quoted strings,
 * and simple inline arrays `[a, b, c]` - sufficient for OKF v0.1.
 */
export function parseFrontmatter(content: string): { data: OKFFrontmatter; body: string } {
  const normalized = content.replace(/^﻿/, "");
  if (!normalized.startsWith("---")) return { data: {}, body: normalized };

  // Find the closing delimiter line.
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: normalized };

  const raw = normalized.slice(3, end).replace(/^\r?\n/, "");
  let body = normalized.slice(end + 4);
  body = body.replace(/^\r?\n/, "");

  const data: OKFFrontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const valRaw = m[2].trim();
    if (valRaw.startsWith("[") && valRaw.endsWith("]")) {
      data[key] = valRaw
        .slice(1, -1)
        .split(",")
        .map(s => unquote(s))
        .filter(Boolean);
    } else if (valRaw !== "") {
      data[key] = unquote(valRaw);
    }
  }
  return { data, body };
}

/**
 * Convert a single OKF concept markdown file into a Chunk.
 * Returns null for empty/navigation files.
 */
export function okfConceptToChunk(markdown: string, relPath: string, bundle: string): Chunk | null {
  const { data, body } = parseFrontmatter(markdown);
  const cleanBody = body.trim();
  if (!cleanBody && !data.title) return null;

  const title = data.title || relPath.split("/").pop()?.replace(/\.md$/, "") || relPath;
  const typePrefix = data.type ? `[${data.type}] ` : "";
  const tagStr = Array.isArray(data.tags) && data.tags.length ? ` (tags: ${data.tags.join(", ")})` : "";
  const content =
    `${typePrefix}${title}${tagStr}: ${cleanBody}`.slice(0, MAX_BODY_CHARS).trim();

  return {
    source: "okf",
    title: `${bundle}/${title}`,
    content,
  };
}

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  let entries: any[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walkMarkdown(full, acc);
    } else if (e.isFile() && e.name.endsWith(".md") && !SKIP_BASENAMES.has(e.name.toLowerCase())) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Read every imported OKF bundle under <dataDir>/okf-imports and
 * return them as chunks. Bundle name = first path segment.
 */
export function collectImportedOKFChunks(dataDir: string): Chunk[] {
  const root = join(dataDir, OKF_IMPORTS_SUBDIR);
  if (!existsSync(root)) return [];

  const chunks: Chunk[] = [];
  for (const file of walkMarkdown(root)) {
    try {
      const rel = file.slice(root.length + 1).split(sep).join("/");
      const bundle = rel.split("/")[0] || "okf";
      const relInBundle = rel.split("/").slice(1).join("/") || rel;
      const chunk = okfConceptToChunk(readFileSync(file, "utf-8"), relInBundle, bundle);
      if (chunk) chunks.push(chunk);
    } catch {
      /* skip unreadable file */
    }
  }
  return chunks;
}

/* ── Import (extraction) ── */

export interface ImportResult {
  bundle: string;
  conceptCount: number;
  fileCount: number;
  dir: string;
}

function sanitizeBundleName(name: string): string {
  const base = (name || "imported").replace(/\.(zip|tar|gz)$/i, "");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 60) || "imported";
}

// Reject zip-slip / absolute / traversal paths.
function isSafeEntryPath(entryName: string): boolean {
  if (!entryName) return false;
  const norm = entryName.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return false;
  return !norm.split("/").some(seg => seg === "..");
}

/**
 * Extract an OKF zip (as a Buffer) into <dataDir>/okf-imports/<bundle>.
 * `entries` is the decoded list from adm-zip: { entryName, isDirectory, getData() }.
 * Returns a summary. Throws if no markdown is found.
 */
export function writeImportedBundle(
  dataDir: string,
  bundleNameRaw: string,
  entries: { entryName: string; isDirectory: boolean; getData: () => Buffer }[]
): ImportResult {
  const bundle = sanitizeBundleName(bundleNameRaw);
  const dest = join(dataDir, OKF_IMPORTS_SUBDIR, bundle);

  let fileCount = 0;
  let conceptCount = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!isSafeEntryPath(entry.entryName)) continue;
    if (!entry.entryName.toLowerCase().endsWith(".md")) continue;

    const rel = entry.entryName.replace(/\\/g, "/");
    const outPath = join(dest, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, entry.getData());
    fileCount++;
    const base = rel.split("/").pop()!.toLowerCase();
    if (!SKIP_BASENAMES.has(base)) conceptCount++;
  }

  if (fileCount === 0) {
    throw new Error("No markdown files found in the OKF bundle.");
  }

  return { bundle, conceptCount, fileCount, dir: dest };
}
