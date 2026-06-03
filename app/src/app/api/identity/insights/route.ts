/* ═══════════════════════════════════════════════════════
   /api/identity/insights — what Rudder has LEARNED about you.
   The other half of the two-way profile: not what you typed, but what
   your own memory reveals. Pure SQL over the local store (no model needed,
   fully offline, fast): memory composition, closest people, recent moments,
   and what you capture most.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ensureMemory } from "@/lib/memory";
import { CAPTURE_SOURCES, SESSION_KINDS } from "@/lib/sessionKinds";

export async function GET() {
  try {
    const db = getDB();
    ensureMemory(db);

    // Memory composition — what's actually in your brain (excluding identity itself).
    const composition = db
      .prepare(`SELECT source, COUNT(*) AS count FROM chunk_index WHERE source != 'identity' GROUP BY source ORDER BY count DESC`)
      .all() as { source: string; count: number }[];
    const memoryTotal = composition.reduce((n, c) => n + c.count, 0);

    // Closest people — from the People module (warmth + recency). May be empty.
    let topPeople: { name: string; relationship: string; warmth: number; last_contact: string | null }[] = [];
    try {
      topPeople = db
        .prepare(`SELECT name, relationship, warmth, last_contact FROM people ORDER BY COALESCE(warmth,0) DESC, COALESCE(last_contact,'') DESC LIMIT 5`)
        .all() as any[];
    } catch { /* people table may not exist yet */ }

    // Recent moments — the latest dated things in memory (not identity).
    const recent = db
      .prepare(`SELECT title, source, date FROM chunk_index WHERE source != 'identity' AND date IS NOT NULL AND date != '' ORDER BY date DESC, rowid DESC LIMIT 6`)
      .all() as { title: string; source: string; date: string }[];

    // What you capture most — session kinds (title prefix before ": " among capture sources).
    const capPh = CAPTURE_SOURCES.map(() => "?").join(", ");
    const knownKinds = new Set(SESSION_KINDS.map((k) => k.label));
    let sessionKinds: { kind: string; count: number }[] = [];
    try {
      const derived = db
        .prepare(
          `SELECT CASE WHEN instr(title, ': ') > 0 THEN substr(title, 1, instr(title, ': ') - 1) ELSE title END AS kind,
                  COUNT(*) AS count
             FROM chunk_index WHERE source IN (${capPh})
            GROUP BY kind`
        )
        .all(...CAPTURE_SOURCES) as { kind: string; count: number }[];
      sessionKinds = derived.filter((d) => knownKinds.has(d.kind)).sort((a, b) => b.count - a.count);
    } catch { /* no captures yet */ }

    return NextResponse.json({ memoryTotal, composition, topPeople, recent, sessionKinds });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
