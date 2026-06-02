/* ═══════════════════════════════════════════════════════
   /api/memory — browse the memory store (no model needed).
   GET ?source=<type>&limit=<n>&q=<text>&captured=1&kind=<label>
     • returns recent indexed items (reverse-chronological)
     • plus the list of sources with counts (for filter chips)
     • capturedTotal (count across all capture clients)
     • kinds[] (session-type counts) when captured=1
   Read-only over chunk_index; resilient even if Ollama is down.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ensureMemory } from "@/lib/memory";
import { CAPTURE_SOURCES, SESSION_KINDS } from "@/lib/sessionKinds";

export async function GET(request: Request) {
  try {
    const db = getDB();
    ensureMemory(db);

    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    const captured = url.searchParams.get("captured") === "1";
    const kind = url.searchParams.get("kind")?.trim();
    const q = url.searchParams.get("q")?.trim();
    const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 300);

    const sources = db
      .prepare("SELECT source, COUNT(*) AS count FROM chunk_index GROUP BY source ORDER BY count DESC")
      .all() as { source: string; count: number }[];

    const capPlaceholders = CAPTURE_SOURCES.map(() => "?").join(", ");
    const capturedTotal = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM chunk_index WHERE source IN (${capPlaceholders})`)
        .get(...CAPTURE_SOURCES) as { n: number }
    ).n;

    const where: string[] = [];
    const params: any[] = [];

    if (captured) {
      where.push(`source IN (${capPlaceholders})`);
      params.push(...CAPTURE_SOURCES);
    } else if (source && source !== "all") {
      where.push("source = ?");
      params.push(source);
    }

    // kind is stored as the title prefix: "<Kind>" or "<Kind>: <title>"
    if (kind && kind !== "all") {
      where.push("(title = ? OR title LIKE ?)");
      params.push(kind, `${kind}: %`);
    }

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

    // Session-type facet counts (only meaningful for the captured view).
    let kinds: { kind: string; count: number }[] = [];
    if (captured) {
      const derived = db
        .prepare(
          `SELECT CASE WHEN instr(title, ': ') > 0
                       THEN substr(title, 1, instr(title, ': ') - 1)
                       ELSE title END AS kind,
                  COUNT(*) AS count
             FROM chunk_index
            WHERE source IN (${capPlaceholders})
            GROUP BY kind`
        )
        .all(...CAPTURE_SOURCES) as { kind: string; count: number }[];
      const known = new Set(SESSION_KINDS.map((k) => k.label));
      kinds = derived
        .filter((d) => known.has(d.kind))
        .sort((a, b) => b.count - a.count);
    }

    const total = (db.prepare("SELECT COUNT(*) AS n FROM chunk_index").get() as { n: number }).n;

    return NextResponse.json({ items, sources, total, capturedTotal, kinds });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
