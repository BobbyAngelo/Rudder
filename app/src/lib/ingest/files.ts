/* ═══════════════════════════════════════════════════════
   Ingest · Files connector — "throw any folder at it".
   Walks a folder of mixed file types, parses each supported file
   via the universal parser, and hands RawDoc[] to enrich.toChunks().

   Reuses the same enrich pipeline as every other connector, so files
   inherit world-class chunking, date/entity extraction, and stable IDs.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { isSupported, parseFileBuffer } from "./parse";
import type { RawDoc } from "./enrich";

const IGNORE_DIRS = new Set([
  "node_modules", ".next", "dist", "build", "out", "coverage", "vendor", "target", ".git",
]);

const MAX_BYTES = 25 * 1024 * 1024; // skip anything implausibly large for a doc

function walk(dir: string, acc: string[] = [], excludes: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (excludes.some((ex) => full.includes(ex))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc, excludes);
    else if (isSupported(name) && st.size <= MAX_BYTES) acc.push(full);
  }
  return acc;
}

/**
 * Read a folder of mixed files into RawDoc[]. Parse failures (e.g. a PDF
 * lib not installed, a corrupt file) are skipped, not fatal — one bad
 * file never blocks ingesting the rest. Failures are returned for surfacing.
 */
export async function readFilesFolder(
  dir: string,
  excludes: string[] = []
): Promise<{ docs: RawDoc[]; skipped: { file: string; reason: string }[] }> {
  const files = walk(dir, [], excludes);
  const docs: RawDoc[] = [];
  const skipped: { file: string; reason: string }[] = [];

  for (const full of files) {
    const rel = relative(dir, full);
    try {
      const parsed = await parseFileBuffer(readFileSync(full), full);
      if (!parsed) { skipped.push({ file: rel, reason: "empty or unsupported" }); continue; }
      docs.push({
        source: "files",
        sourceId: rel,
        title: parsed.title,
        body: parsed.body,
        link: `file://${full}`,
      });
    } catch (e: unknown) {
      skipped.push({ file: rel, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { docs, skipped };
}
