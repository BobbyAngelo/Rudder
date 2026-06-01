/* ═══════════════════════════════════════════════════════
   /api/memory — browse the memory store (no model needed).
   GET ?source=<type>&limit=<n>&q=<text>
     • returns recent indexed items (reverse-chronological)
     • plus the list of sources with counts (for filter chips)
   Read-only over chunk_index; resilient even if Ollama is down.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ensureMemory } from "@/lib/memory";

export async function GET(request: Request) {
  try {
    const db = getDB();
    ensureMemory(db);

    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    const q = url.searchParams.get("q")?.trim();
    const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 300);

    const sources = db
      .prepare("SELECT source, COUNT(*) AS count FROM chunk_index GROUP BY source ORDER BY count DESC")
      .all() as { source: string; count: number }[];

    const where: string[] = [];
    const params: any[] = [];
    if (source && source !== "all") { where.push("source = ?"); params.push(source); }
    if (q) { where.push("(title LIKE ? OR content LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const items = db
      .prepare(
        `SELECT chunk_id AS id, source, title, date, substr(content, 1, 240) AS snippet
         FROM chunk_index ${clause}
         ORDER BY COALESCE(date, '') DESC, rowid DESC
         LIMIT ?`
      )
      .all(...params, limit) as any[];

    const total = (db.prepare("SELECT COUNT(*) AS n FROM chunk_index").get() as { n: number }).n;

    return NextResponse.json({ items, sources, total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
