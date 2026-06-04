/* ═══════════════════════════════════════════════════════
   /api/act/generate — run the generators and fill the desk.
   POST → every registered generator proposes; new items are inserted (deduped),
          and the refreshed inbox is returned. This is a READ of memory that
          WRITES only 'proposed' rows — it never executes anything.
   This is the route a morning scheduled task will hit to let Rudder work ahead.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ollamaEmbed } from "@/lib/ollama";
import { generateAll, store } from "@/lib/act";

export async function POST() {
  try {
    const db = getDB();
    const drafts = await generateAll({ db, embed: (t) => ollamaEmbed(t), now: new Date() });

    let added = 0;
    for (const d of drafts) {
      if (store.insert(db, d) !== null) added++;
    }

    const proposals = store.inbox(db, ["proposed"]);
    return NextResponse.json({ added, proposed: drafts.length, count: proposals.length, proposals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
