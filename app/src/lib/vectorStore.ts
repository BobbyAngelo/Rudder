/* ═══════════════════════════════════════════════════════
   Vector store — sqlite-vec KNN over local embeddings.
   Keeps vectors in the same SQLite file as everything else
   (sovereign, one store). Pairs with retrieveHybrid() in retrieval.ts.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export const EMBED_DIM = 768; // nomic-embed-text

/** Load the sqlite-vec extension into a connection (idempotent per process). */
export function loadVec(db: Database.Database): void {
  sqliteVec.load(db);
}

/** Create the vector table if absent. Call once after loadVec(). */
export function createVecTable(db: Database.Database, dim: number = EMBED_DIM): void {
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
       chunk_id TEXT PRIMARY KEY,
       embedding float[${dim}]
     )`
  );
}

/** Insert or replace one chunk's embedding. */
export function upsertEmbedding(db: Database.Database, chunkId: string, vec: number[]): void {
  db.prepare("DELETE FROM vec_chunks WHERE chunk_id = ?").run(chunkId);
  db.prepare("INSERT INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)").run(
    chunkId,
    new Float32Array(vec)
  );
}

/** Remove one chunk's embedding (used by pruning). */
export function deleteEmbedding(db: Database.Database, chunkId: string): void {
  db.prepare("DELETE FROM vec_chunks WHERE chunk_id = ?").run(chunkId);
}

export interface KnnHit {
  chunk_id: string;
  distance: number;
}

/** K nearest neighbours to a query vector (smaller distance = closer). */
export function knn(db: Database.Database, queryVec: number[], k: number = 20): KnnHit[] {
  return db
    .prepare(
      "SELECT chunk_id, distance FROM vec_chunks WHERE embedding MATCH ? AND k = ? ORDER BY distance"
    )
    .all(new Float32Array(queryVec), k) as KnnHit[];
}
