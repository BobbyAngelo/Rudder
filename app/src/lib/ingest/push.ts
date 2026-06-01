/* ═══════════════════════════════════════════════════════
   Ingest · push — the receiving side of the universal door.
   Devices/apps send items (or transcribed audio) → RawDoc →
   enrich → index. Append-only (each push is a captured moment).
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { toChunks, type RawDoc } from "./enrich";
import { indexChunks, type EmbedFn } from "../memory";

export interface PushItem {
  source?: string;   // "typewriter" | "strava" | "capture" | ...
  id?: string;       // stable id if the sender has one (else generated)
  title?: string;
  text: string;      // the content (a transcript, a note, an event summary)
  date?: string;     // ISO yyyy-mm-dd; defaults to today
  people?: string[];
}

export function toRawDoc(item: PushItem): RawDoc {
  const source = (item.source || "capture").trim();
  return {
    source,
    sourceId: item.id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title || `${source} note`,
    body: (item.text || "").toString(),
    date: item.date || new Date().toISOString().slice(0, 10),
    people: item.people,
  };
}

export async function pushDocs(db: Database.Database, items: PushItem[], embed: EmbedFn) {
  const docs = items.map(toRawDoc).filter((d) => d.body.trim().length > 0);
  const chunks = docs.flatMap(toChunks);
  const { indexed, skipped } = await indexChunks(db, chunks, embed);
  return { indexed, skipped, chunks: chunks.length, docs: docs.length };
}
