/* ═══════════════════════════════════════════════════════
   /api/act — Rudder's desk (the inbox).
   GET  → the live proposals awaiting your review, plus the registered verbs.
          ?status=proposed,snoozed,confirmed,executed,dismissed to widen the view.
   The desk is read-only here; review actions live at /api/act/[id], generation
   at /api/act/generate. Nothing on this route causes a side effect.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { allKinds, store, type ProposalStatus } from "@/lib/act";

const VALID: ProposalStatus[] = ["proposed", "confirmed", "executed", "dismissed", "snoozed"];

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const raw = (url.searchParams.get("status") || "proposed").split(",").map((s) => s.trim());
    const statuses = raw.filter((s): s is ProposalStatus => (VALID as string[]).includes(s));
    const proposals = store.inbox(db, statuses.length ? statuses : ["proposed"]);
    const kinds = allKinds().map((k) => ({ kind: k.kind, label: k.label, blurb: k.blurb }));
    return NextResponse.json({ proposals, kinds, count: proposals.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
