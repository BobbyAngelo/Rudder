/* ═══════════════════════════════════════════════════════
   /api/act/[id] — review a single proposal (the confirm-before-act gate).
   POST { action: "confirm" | "dismiss" | "snooze" | "edit", until?, body? }
     confirm → runs the executor for the proposal's kind ONLY now (store.confirm
               is the one path that ever runs an effect). A {type:"none"} effect
               (every surface) simply completes.
     dismiss → archived, no action taken.
     snooze  → hidden until `until` (ISO), then returns to the desk.
     edit    → update a draft's body before confirming.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ollamaEmbed } from "@/lib/ollama";
import { getKind, store, type Proposal } from "@/lib/act";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const db = getDB();
    const existing = store.get(db, id);
    if (!existing) return NextResponse.json({ error: "No such proposal" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const action: string = body?.action;

    if (action === "dismiss") {
      return NextResponse.json({ proposal: store.dismiss(db, id) });
    }

    if (action === "snooze") {
      const until = typeof body?.until === "string" && body.until
        ? body.until
        : new Date(Date.now() + 7 * 86400000).toISOString(); // default: a week
      return NextResponse.json({ proposal: store.snooze(db, id, until) });
    }

    if (action === "edit") {
      if (typeof body?.body !== "string") return NextResponse.json({ error: "Provide body" }, { status: 400 });
      return NextResponse.json({ proposal: store.editBody(db, id, body.body) });
    }

    if (action === "confirm") {
      // The executor: dispatch to the kind's execute(), if any. A {type:"none"}
      // effect never reaches here (store.confirm short-circuits it).
      const runEffect = async (p: Proposal) => {
        const def = getKind(p.kind);
        if (def?.execute) {
          await def.execute(p, { db, embed: (t) => ollamaEmbed(t), now: new Date() });
        } else if (p.effect.type !== "none") {
          throw new Error(`No executor registered for kind "${p.kind}"`);
        }
      };
      try {
        const proposal = await store.confirm(db, id, runEffect);
        return NextResponse.json({ proposal });
      } catch (e: any) {
        // Stays 'confirmed' (not executed) so the user can retry.
        return NextResponse.json({ error: `Execution failed: ${e.message}`, proposal: store.get(db, id) }, { status: 500 });
      }
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
