/* ═══════════════════════════════════════════════════════
   The act loop — types.
   Rudder reads the past (memory, identity, biographer). The act loop points it
   FORWARD: it proposes things to do. The unit is the Proposal. The safety spine
   is one rule — nothing executes without an explicit human confirmation.

   Lifecycle:   proposed → confirmed → executed
                proposed → dismissed
                proposed → snoozed → proposed (when act_on passes)

   A GENERATOR creates proposals (e.g. the surfacer). An EXECUTOR runs a
   proposal's `effect` only after status becomes 'confirmed'. A proposal with an
   empty effect ({}) has no external side effect — confirming just acknowledges.
   ═══════════════════════════════════════════════════════ */

/** The verbs Rudder can propose. Added safest-first. */
export type ProposalKind = "surface" | "draft" | "schedule";

export type ProposalStatus =
  | "proposed"   // awaiting your review
  | "confirmed"  // you said yes; ready to execute (or executed if no effect)
  | "executed"   // the effect ran
  | "dismissed"  // you said no
  | "snoozed";   // hidden until act_on

/** A memory citation behind a proposal — same shape the biographer uses. */
export interface ProposalSource {
  id: string;
  source: string;
  title: string;
  date?: string;
  snippet: string;
}

/** What executing a proposal actually does. {} (type "none") = no external effect. */
export type ProposalEffect =
  | { type: "none" }
  | { type: "draft_export"; format?: "markdown" | "text" }   // produce text, never send
  | { type: "schedule_local"; date: string; durationMin?: number }; // local planner only

export interface Proposal {
  id: number;
  kind: ProposalKind;
  title: string;
  body: string;
  rationale: string;
  sources: ProposalSource[];
  effect: ProposalEffect;
  status: ProposalStatus;
  dedupeKey?: string;
  actOn?: string;
  createdAt: string;
  executedAt?: string;
}

/** Shape a generator returns — the store assigns id/status/timestamps. */
export interface DraftProposal {
  kind: ProposalKind;
  title: string;
  body?: string;
  rationale?: string;
  sources?: ProposalSource[];
  effect?: ProposalEffect;
  dedupeKey?: string;
  actOn?: string;
}

/** Which status transitions a human review may request. */
export type ReviewAction = "confirm" | "dismiss" | "snooze";

export const TERMINAL: ProposalStatus[] = ["executed", "dismissed"];

/** Is this effect purely local (no external side effect)? Surfaces always are. */
export function isLocalEffect(effect: ProposalEffect): boolean {
  return effect.type === "none" || effect.type === "draft_export" || effect.type === "schedule_local";
}
