/* ═══════════════════════════════════════════════════════
   /api/act/draft — turn a surfaced item into a voiced draft.
   POST { sourceId, intent? }
     → recalls context, writes a message/journal in your voice, and inserts a
       new 'draft' proposal (effect: draft_export — text only, never sent).
   This is the on-demand generator behind the Desk's "Draft a reply" button.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ollamaEmbed } from "@/lib/ollama";
import { identityName } from "@/lib/identity";
import { store } from "@/lib/act";
import { generateDraft, intentForKind, type DraftIntent } from "@/lib/act/drafter";

const INTENTS: DraftIntent[] = ["reconnect", "followup", "reflect"];
const VERB: Record<DraftIntent, string> = { reconnect: "reconnect", followup: "follow up", reflect: "reflect" };

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = Number(body?.sourceId);
    if (!Number.isInteger(sourceId)) {
      return NextResponse.json({ error: "Provide the sourceId of the item to draft from." }, { status: 400 });
    }

    const db = getDB();
    const src = store.get(db, sourceId);
    if (!src) return NextResponse.json({ error: "No such proposal" }, { status: 404 });

    const intent: DraftIntent = INTENTS.includes(body?.intent) ? body.intent : intentForKind(src.kind, src.title);

    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    const mode = prefs?.default_execution_mode || "local_ollama";
    const name = identityName(db);
    const manual = (db.prepare("SELECT operating_manual FROM identity_profile WHERE id = 1").get() as { operating_manual?: string } | undefined)?.operating_manual || "";

    let draft;
    try {
      draft = await generateDraft(
        db,
        { intent, title: src.title, context: src.body || src.rationale, sources: src.sources },
        (t) => ollamaEmbed(t), mode, name, manual,
      );
    } catch (e: any) {
      return NextResponse.json({ error: `Couldn't write the draft [${mode}]: ${e.message}. Is Ollama running?` }, { status: 500 });
    }

    if (!draft.text || draft.text.length < 2) {
      return NextResponse.json({ error: "The draft came back empty — try again." }, { status: 502 });
    }

    const shortFrom = src.title.replace(/^(On this day[^:]*:|Open loop:|It's been a while —)\s*/i, "").trim();
    const id = store.insert(db, {
      kind: "draft",
      title: `Draft — ${VERB[intent]}: ${shortFrom}`.slice(0, 120),
      body: draft.text,
      rationale: `Written in ${name}'s voice to ${VERB[intent]}, from "${src.title}". Yours to edit and copy — Rudder won't send it.`,
      sources: draft.sources,
      effect: { type: "draft_export", format: "text" },
    });

    return NextResponse.json({ proposal: id ? store.get(db, id) : null, intent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
