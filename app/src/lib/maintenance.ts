/* ═══════════════════════════════════════════════════════
   Maintenance — purge junk that slipped into memory before the ignore-rules.
   Finds stored chunks whose path is dependency/build/vcs noise (node_modules
   READMEs, lockfiles, …) and removes them from the index, their embeddings, and
   their vault files — using the same policy new ingests now enforce.
   ═══════════════════════════════════════════════════════ */

import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { ignoredByPath } from "./ingest/ignore";
import { removeChunks } from "./memory";
import { vaultDir, vaultRelPath } from "./vault";

export interface PruneResult {
  chunks: number;                          // chunk rows removed
  files: number;                           // vault files removed
  bySource: Record<string, number>;        // chunks removed per source
  sampleTitles: string[];                  // a few examples of what went
  dryRun: boolean;
}

/** Remove (or preview) every chunk whose source path is junk. */
export function pruneJunk(db: Database.Database, opts: { dryRun?: boolean } = {}): PruneResult {
  const dryRun = !!opts.dryRun;
  let rows: { chunk_id: string; source: string; source_id: string | null; title: string }[] = [];
  try {
    rows = db.prepare("SELECT chunk_id, source, source_id, title FROM chunk_index").all() as any[];
  } catch {
    return { chunks: 0, files: 0, bySource: {}, sampleTitles: [], dryRun };
  }

  const junk = rows.filter((r) => r.source_id && ignoredByPath(r.source_id));
  const bySource: Record<string, number> = {};
  const docFiles = new Set<string>();
  for (const r of junk) {
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.source_id) docFiles.add(vaultRelPath(r.source, r.source_id));
  }
  const sampleTitles = [...new Set(junk.map((r) => (r.title || "").split(" — ")[0]))].slice(0, 8);

  if (!dryRun && junk.length) {
    removeChunks(db, junk.map((r) => r.chunk_id));
    for (const rel of docFiles) {
      const abs = path.join(vaultDir(), rel);
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { /* ignore */ }
    }
  }

  return { chunks: junk.length, files: docFiles.size, bySource, sampleTitles, dryRun };
}
