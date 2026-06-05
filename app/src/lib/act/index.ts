/* ═══════════════════════════════════════════════════════
   The act loop — wiring.
   Registers the built-in action kinds and re-exports the public surface. Import
   this module once (the API routes do) to make sure the registry is populated.
   ═══════════════════════════════════════════════════════ */

import { registerKind, type ActContext } from "./registry";
import { surface } from "./surfacer";

// "surface": propose moments worth your attention. No executor — a surfaced
// proposal's effect is {type:"none"}, so the store completes it on confirm.
registerKind({
  kind: "surface",
  label: "Surface",
  blurb: "Bring the right memory back at the right time — on this day, a relationship gone quiet, an open loop.",
  generate: async (ctx: ActContext) => surface(ctx.db, ctx.now ?? new Date()),
});

// "draft": a message or journal entry written in your voice from a surfaced
// item. Created on demand (see /api/act/draft), not by a background generator.
// Its effect is {type:"draft_export"} — producing text only. The executor is a
// deliberate no-op: confirming ("Use this") just marks it done. Rudder never
// sends a draft; you copy it where you want it.
registerKind({
  kind: "draft",
  label: "Draft",
  blurb: "Turn a surfaced moment into a message or note in your own voice — yours to copy, never sent.",
  execute: async () => { /* no-op: a draft is text; using it is a human action */ },
});

export * from "./types";
export * from "./registry";
export * as store from "./store";
