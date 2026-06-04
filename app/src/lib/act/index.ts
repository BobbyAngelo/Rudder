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

export * from "./types";
export * from "./registry";
export * as store from "./store";
