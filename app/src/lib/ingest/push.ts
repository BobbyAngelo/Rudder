/* ═══════════════════════════════════════════════════════
   Ingest · push — the receiving side of the universal door.
   Devices/apps send items (or transcribed audio) → RawDoc →
   enrich → index. Append-only (each push is a captured moment).
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { toChunks, type RawDoc } from "./enrich";
import { indexChunks, type EmbedFn } from "../memory";
import { writeRawDocs } from "../vault";

export interface PushItem {
  source?: string;   // "typewriter" | "strava" | "capture" | "laptop" | ...
  id?: string;       // stable id if the sender has one (else generated)
  title?: string;
  text: string;      // the content (a transcript, a note, an event summary)
  date?: string;     // ISO yyyy-mm-dd; defaults to today
  people?: string[];
  kind?: string;     // session type label, e.g. "Meeting" (Apple-Health-style picker)
}

export function toRawDoc(item: PushItem): RawDoc {
  const source = (item.source || "capture").trim();
  const kind = item.kind?.trim();
  const titleBase = item.title?.trim();

  // Title carries the kind so it reads well and is recall-able ("Meeting: Q3 sync").
  const title = kind
    ? (titleBase ? `${kind}: ${titleBase}` : kind)
    : (titleBase || `${source} note`);

  // A small structured header makes the session type + attendees match on lexical
  // recall too ("show my meetings", "what did Jordan say"), on top of people[].
  const headerBits: string[] = [];
  if (kind) headerBits.push(`Session type: ${kind}`);
  if (item.people?.length) headerBits.push(`With: ${item.people.join(", ")}`);
  const header = headerBits.length ? headerBits.join("\n") + "\n\n" : "";

  return {
    source,
    sourceId: item.id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body: header + (item.text || "").toString(),
    date: item.date || new Date().toISOString().slice(0, 10),
    people: item.people,
  };
}

export async function pushDocs(db: Database.Database, items: PushItem[], embed: EmbedFn) {
  const docs = items.map(toRawDoc).filter((d) => d.body.trim().length > 0);
  // Vault is the source of truth: write files first, then derive the index.
  // A vault failure must never lose the ingest, so it's best-effort.
  try { writeRawDocs(docs); } catch (e: any) { console.warn("[vault] write failed:", e?.message); }
  const chunks = docs.flatMap(toChunks);
  const { indexed, skipped } = await indexChunks(db, chunks, embed);
  return { indexed, skipped, chunks: chunks.length, docs: docs.length };
}
