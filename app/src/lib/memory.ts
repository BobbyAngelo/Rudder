/* ═══════════════════════════════════════════════════════
   Memory — the persistent recall pipeline.

   index:  chunk → store metadata (chunk_index) + embedding (vec_chunks)
   recall: question → embed → KNN candidates → load → retrieveHybrid re-rank

   Reuses the validated retrieveHybrid() for ranking; sqlite-vec only does
   fast candidate generation. db + embed are injected so this is testable.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { createHash } from "crypto";
import { loadVec, createVecTable, upsertEmbedding, deleteEmbedding, knn } from "./vectorStore";
import { retrieveHybrid, type Chunk } from "./retrieval";

export type EmbedFn = (text: string) => Promise<number[]>;

let vecLoaded = false;

export function ensureMemory(db: Database.Database): void {
  if (!vecLoaded) {
    loadVec(db);
    vecLoaded = true;
  }
  createVecTable(db);
  db.exec(
    `CREATE TABLE IF NOT EXISTS chunk_index (
       chunk_id  TEXT PRIMARY KEY,
       source    TEXT,
       title     TEXT,
       content   TEXT,
       date      TEXT,
       source_id TEXT,
       vector    TEXT,
       hash      TEXT,
       connector_id INTEGER
     )`
  );
  // Defensive: add columns to pre-existing tables (schema evolution).
  try { db.exec("ALTER TABLE chunk_index ADD COLUMN hash TEXT"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE chunk_index ADD COLUMN connector_id INTEGER"); } catch { /* exists */ }
}

function chunkHash(c: Chunk): string {
  return createHash("sha1").update(`${c.title}\n${c.content}\n${c.date ?? ""}`).digest("hex");
}

/** Index a batch of chunks: store metadata + embedding once. */
export interface IndexResult {
  indexed: number; // newly embedded (new or changed)
  skipped: number; // unchanged, embedding reused
}

export async function indexChunks(
  db: Database.Database,
  chunks: Chunk[],
  embed: EmbedFn,
  connectorId?: number
): Promise<IndexResult> {
  ensureMemory(db);
  const getHash = db.prepare("SELECT hash FROM chunk_index WHERE chunk_id = ?");
  const upMeta = db.prepare(
    `INSERT OR REPLACE INTO chunk_index(chunk_id, source, title, content, date, source_id, vector, hash, connector_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const claimOwner = db.prepare("UPDATE chunk_index SET connector_id = ? WHERE chunk_id = ?");
  let indexed = 0;
  let skipped = 0;
  for (const c of chunks) {
    if (!c.id) continue;
    const h = chunkHash(c);
    const existing = getHash.get(c.id) as { hash?: string } | undefined;
    if (existing && existing.hash === h) {
      // Unchanged — don't re-embed, but keep ownership current so pruning works.
      if (connectorId != null) claimOwner.run(connectorId, c.id);
      skipped++;
      continue;
    }
    // Truncation safety net: never exceed the embedding model's context.
    const vec = await embed(`${c.title}. ${c.content}`.slice(0, 6000));
    upMeta.run(c.id, c.source, c.title, c.content, c.date ?? null, c.sourceId ?? null, JSON.stringify(vec), h, connectorId ?? null);
    upsertEmbedding(db, c.id, vec);
    indexed++;
  }
  return { indexed, skipped };
}

/**
 * Remove chunks owned by a connector that are no longer present in its latest
 * sync (deleted/renamed source items). Deletes from chunk_index AND vec_chunks.
 */
export function pruneConnector(db: Database.Database, connectorId: number, keepIds: string[]): number {
  ensureMemory(db);
  const keep = new Set(keepIds);
  const rows = db.prepare("SELECT chunk_id FROM chunk_index WHERE connector_id = ?").all(connectorId) as { chunk_id: string }[];
  const stale = rows.filter((r) => !keep.has(r.chunk_id));
  const del = db.prepare("DELETE FROM chunk_index WHERE chunk_id = ?");
  const tx = db.transaction((ids: string[]) => {
    for (const id of ids) { del.run(id); deleteEmbedding(db, id); }
  });
  tx(stale.map((r) => r.chunk_id));
  return stale.length;
}

/**
 * Remove every chunk for a given source. Used to re-index a singleton source
 * (like "identity") cleanly so edits/removals don't leave stale memory behind.
 */
export function clearSource(db: Database.Database, source: string): number {
  ensureMemory(db);
  const rows = db.prepare("SELECT chunk_id FROM chunk_index WHERE source = ?").all(source) as { chunk_id: string }[];
  const del = db.prepare("DELETE FROM chunk_index WHERE chunk_id = ?");
  const tx = db.transaction((ids: string[]) => {
    for (const id of ids) { del.run(id); deleteEmbedding(db, id); }
  });
  tx(rows.map((r) => r.chunk_id));
  return rows.length;
}

/** Delete specific chunks by id (chunk_index + their embeddings). Returns count. */
export function removeChunks(db: Database.Database, ids: string[]): number {
  ensureMemory(db);
  const del = db.prepare("DELETE FROM chunk_index WHERE chunk_id = ?");
  const tx = db.transaction((list: string[]) => {
    for (const id of list) { del.run(id); deleteEmbedding(db, id); }
  });
  tx(ids);
  return ids.length;
}

export interface Source {
  id: string;
  source: string;
  title: string;
  date?: string;
  sourceId?: string;
  snippet: string;
}

export interface RecallResult {
  chunks: Chunk[];
  sources: Source[];
}

export interface RecallOpts {
  topN?: number;
  candidates?: number;
  now?: Date;
}

/** Answer a question: KNN candidate generation → hybrid re-rank → sources. */
export async function recall(
  db: Database.Database,
  question: string,
  embed: EmbedFn,
  opts: RecallOpts = {}
): Promise<RecallResult> {
  ensureMemory(db);
  const topN = opts.topN ?? 8;
  const candidates = opts.candidates ?? 40;

  const qVec = await embed(question);
  const hits = knn(db, qVec, candidates);
  if (hits.length === 0) return { chunks: [], sources: [] };

  const ids = hits.map((h) => h.chunk_id);
  const rows = db
    .prepare(`SELECT * FROM chunk_index WHERE chunk_id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as any[];

  const cands: Chunk[] = rows.map((r) => ({
    id: r.chunk_id,
    source: r.source,
    title: r.title,
    content: r.content,
    date: r.date ?? undefined,
    sourceId: r.source_id ?? undefined,
    vector: JSON.parse(r.vector),
  }));

  const ranked = retrieveHybrid(cands, question, qVec, { topN, now: opts.now });
  const sources: Source[] = ranked.map((c) => ({
    id: c.id!,
    source: c.source,
    title: c.title,
    date: c.date,
    sourceId: c.sourceId,
    snippet: c.content.slice(0, 160),
  }));
  return { chunks: ranked, sources };
}
