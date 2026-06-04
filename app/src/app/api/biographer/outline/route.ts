/* ═══════════════════════════════════════════════════════
   /api/biographer/outline — the table of contents of a life.
   Pure SQL over the memory timeline (no model needed): the eras your book
   would have, each with its date range and moment count.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ensureMemory } from "@/lib/memory";
import { buildOutline } from "@/lib/biographer/book";

export async function GET() {
  try {
    const db = getDB();
    ensureMemory(db);
    const rows = db
      .prepare("SELECT date FROM chunk_index WHERE date IS NOT NULL AND date != '' AND source != 'identity'")
      .all() as { date: string }[];
    return NextResponse.json(buildOutline(rows.map((r) => r.date)));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
