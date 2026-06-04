/* ═══════════════════════════════════════════════════════
   /api/biographer/continuity — the derived life-state timeline.
   The structured facts of a life (roles, milestones, relationships, location)
   used to keep a book consistent across chapters. Optionally filter to an era.
   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildLifeFacts, factsForEra } from "@/lib/biographer/continuity";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const facts = buildLifeFacts(db);
    const url = new URL(request.url);
    const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const era = factsForEra(facts, isDate(from) ? from : undefined, isDate(to) ? to : undefined);
    return NextResponse.json({ facts, era });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
