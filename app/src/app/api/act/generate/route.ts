/* ═══════════════════════════════════════════════════════
   /api/act/generate — run the generators and fill the desk.
   POST { force? }  (force defaults true — a manual "Scan now" always runs)
     → every generator proposes; new items are inserted (deduped); the daily
       stamp is updated; the refreshed inbox is returned.
   This READS memory and WRITES only 'proposed' rows — it never executes anything.
   The same path runs from the cron/launchd job and the Desk's auto-scan.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ollamaEmbed } from "@/lib/ollama";
import { store } from "@/lib/act";
import { runDailyScan } from "@/lib/act/daily";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body?.force !== false; // default: force

    const db = getDB();
    const result = await runDailyScan(db, { force, embed: (t) => ollamaEmbed(t) });
    const proposals = store.inbox(db, ["proposed"]);

    return NextResponse.json({
      added: result.added,
      proposed: result.proposed,
      alreadyToday: result.alreadyToday,
      lastScanAt: result.ranAt,
      count: proposals.length,
      proposals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
