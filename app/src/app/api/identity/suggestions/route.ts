/* ═══════════════════════════════════════════════════════
   /api/identity/suggestions — the identity nudge.
   GET → people Rudder noticed in your memory who aren't yet in your
         relationships. Pure database read (no model). The UI lets you add one
         with a click; saving goes through the normal identity PUT.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { suggestPeople } from "@/lib/people-suggest";

export async function GET() {
  try {
    const db = getDB();
    let existing: string[] = [];
    try {
      existing = (db.prepare("SELECT name FROM identity_relationships").all() as { name: string }[]).map((r) => r.name).filter(Boolean);
    } catch { /* table may not exist yet */ }
    const suggestions = suggestPeople(db, existing, 8);
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
