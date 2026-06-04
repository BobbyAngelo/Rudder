/* ═══════════════════════════════════════════════════════
   The act loop — registry.
   Like lib/connectors.ts is the catalog of ways data comes IN, this is the
   catalog of ways Rudder acts OUT. Each ActionKind pairs a GENERATOR (proposes)
   with an EXECUTOR (runs the confirmed effect). Adding a verb = adding an entry.

   Phase 1 ships only "surface" — a verb with no external side effect, so the
   spine can be proven end-to-end safely. "draft" and "schedule" slot in next.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import type { DraftProposal, Proposal, ProposalKind } from "./types";

/** Context handed to generators so they can read memory without importing the world. */
export interface ActContext {
  db: Database.Database;
  embed: (t: string) => Promise<number[]>;
  now?: Date;
}

export interface ActionKindDef {
  kind: ProposalKind;
  label: string;
  /** One-line description shown in the UI / docs. */
  blurb: string;
  /** Propose zero or more new items. Pure read of memory — no writes, no side effects. */
  generate?: (ctx: ActContext) => Promise<DraftProposal[]>;
  /** Run a confirmed proposal's effect. Omitted ⇒ effect must be {type:"none"}. */
  execute?: (p: Proposal, ctx: ActContext) => Promise<void>;
}

const REGISTRY = new Map<ProposalKind, ActionKindDef>();

export function registerKind(def: ActionKindDef) {
  REGISTRY.set(def.kind, def);
}

export function getKind(kind: ProposalKind): ActionKindDef | undefined {
  return REGISTRY.get(kind);
}

export function allKinds(): ActionKindDef[] {
  return [...REGISTRY.values()];
}

/** Run every registered generator and collect all proposed items. */
export async function generateAll(ctx: ActContext): Promise<DraftProposal[]> {
  const out: DraftProposal[] = [];
  for (const def of REGISTRY.values()) {
    if (!def.generate) continue;
    try {
      out.push(...(await def.generate(ctx)));
    } catch (e: any) {
      console.warn(`[act] generator ${def.kind} failed:`, e?.message);
    }
  }
  return out;
}
