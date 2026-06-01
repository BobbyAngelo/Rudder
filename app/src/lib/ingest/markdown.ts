/* ═══════════════════════════════════════════════════════
   Ingest · Markdown/Obsidian connector.
   Walks a folder of .md/.markdown files → RawDoc[] (frontmatter
   parsed for title/date/people), then enrich.toChunks() does the rest.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename, extname } from "path";
import type { Chunk } from "../retrieval";
import { toChunks, type RawDoc } from "./enrich";

const IGNORE_DIRS = new Set([
  "node_modules", ".next", "dist", "build", "out", "coverage", "vendor", "target",
]);

function walk(dir: string, root: string, acc: string[] = [], excludes: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue; // skip .obsidian, .git, etc.
    if (IGNORE_DIRS.has(name)) continue; // skip dependency/build noise
    const full = join(dir, name);
    if (excludes.some((ex) => full.includes(ex))) continue; // user exclude rules
    const st = statSync(full);
    if (st.isDirectory()) walk(full, root, acc, excludes);
    else if (/\.(md|markdown)$/i.test(name)) acc.push(full);
  }
  return acc;
}

/** Minimal frontmatter parse (no YAML dep): pulls title, date, people. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

function splitList(v?: string): string[] | undefined {
  if (!v) return undefined;
  const cleaned = v.replace(/^\[|\]$/g, "");
  const parts = cleaned.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  return parts.length ? parts : undefined;
}

export function readMarkdownVault(dir: string, excludes: string[] = []): RawDoc[] {
  const files = walk(dir, dir, [], excludes);
  return files.map((full) => {
    const raw = readFileSync(full, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const rel = relative(dir, full);
    return {
      source: "markdown",
      sourceId: rel,
      title: meta.title || basename(full, extname(full)),
      body,
      date: meta.date || undefined,
      people: splitList(meta.people || meta.tags),
      link: `file://${full}`,
    } as RawDoc;
  });
}

/** Full connector: folder → enriched chunks ready to index. */
export function ingestMarkdownVault(dir: string): Chunk[] {
  return readMarkdownVault(dir).flatMap(toChunks);
}
