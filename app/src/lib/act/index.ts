/* ═══════════════════════════════════════════════════════
   The act loop — wiring.
   Registers the built-in action kinds and re-exports the public surface. Import
   this module once (the API routes do) to make sure the registry is populated.
   ═══════════════════════════════════════════════════════ */

import { registerKind, type ActContext } from "./registry";
import { surface } from "./surfacer";
import { scheduleProposals, writeCalendarEvent } from "./scheduler";

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

// "schedule": a dated commitment from memory → a proposed calendar event.
// Confirming writes a LOCAL calendar entry (sovereign, reversible). External
// calendars are never written without a separate, explicit step.
registerKind({
  kind: "schedule",
  label: "Schedule",
  blurb: "Catch a dated commitment and offer to put it on your local calendar.",
  generate: async (ctx: ActContext) => scheduleProposals(ctx.db, ctx.now ?? new Date()),
  execute: async (p, ctx) => {
    if (p.effect.type !== "schedule_local") return;
    writeCalendarEvent(ctx.db, {
      title: p.title,
      description: p.sources[0]?.snippet || "",
      date: p.effect.date,
      time: p.effect.time,
      durationMin: p.effect.durationMin ?? (p.effect.time ? 60 : undefined),
      category: p.effect.category,
    });
  },
});

export * from "./types";
export * from "./registry";
export * as store from "./store";
