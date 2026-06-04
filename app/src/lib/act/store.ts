/* ═══════════════════════════════════════════════════════
   The act loop — store.
   CRUD over the `proposals` table, mapping rows ↔ the Proposal type and
   centralizing the one safety rule: an effect is only ever run from confirm(),
   never from insert. Generators call insert(); review calls confirm/dismiss/snooze.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import type {
  Proposal, ProposalEffect, ProposalSource, ProposalStatus, DraftProposal,
} from "./types";

function rowToProposal(r: any): Proposal {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body || "",
    rationale: r.rationale || "",
    sources: safeParse<ProposalSource[]>(r.sources_json, []),
    effect: safeParse<ProposalEffect>(r.effect_json, { type: "none" }),
    status: r.status,
    dedupeKey: r.dedupe_key || undefined,
    actOn: r.act_on || undefined,
    createdAt: r.created_at,
    executedAt: r.executed_at || undefined,
  };
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

/** Insert a generated proposal. Returns its id, or null if deduped away. */
export function insert(db: Database.Database, p: DraftProposal): number | null {
  const effect: ProposalEffect = p.effect ?? { type: "none" };
  try {
    const info = db.prepare(
      `INSERT INTO proposals (kind, title, body, rationale, sources_json, effect_json, status, dedupe_key, act_on)
       VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?, ?)`
    ).run(
      p.kind, p.title, p.body || "", p.rationale || "",
      JSON.stringify(p.sources || []), JSON.stringify(effect),
      p.dedupeKey || null, p.actOn || null,
    );
    return Number(info.lastInsertRowid);
  } catch (e: any) {
    // UNIQUE(dedupe_key) — this nudge already exists; skip silently.
    if (String(e.message).toLowerCase().includes("unique")) return null;
    throw e;
  }
}

export function get(db: Database.Database, id: number): Proposal | null {
  const r = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
  return r ? rowToProposal(r) : null;
}

/** The inbox: live proposals, newest first. Snoozed items reappear once due. */
export function inbox(db: Database.Database, statuses: ProposalStatus[] = ["proposed"]): Proposal[] {
  wakeSnoozed(db);
  const ph = statuses.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT * FROM proposals WHERE status IN (${ph}) ORDER BY created_at DESC, id DESC`
  ).all(...statuses) as any[];
  return rows.map(rowToProposal);
}

/** Snoozed proposals whose act_on has passed return to the inbox. */
export function wakeSnoozed(db: Database.Database): number {
  const info = db.prepare(
    `UPDATE proposals SET status = 'proposed', act_on = NULL
     WHERE status = 'snoozed' AND act_on IS NOT NULL AND act_on <= datetime('now')`
  ).run();
  return info.changes;
}

function setStatus(db: Database.Database, id: number, status: ProposalStatus, actOn?: string) {
  db.prepare("UPDATE proposals SET status = ?, act_on = ? WHERE id = ?").run(status, actOn || null, id);
}

export function dismiss(db: Database.Database, id: number): Proposal | null {
  setStatus(db, id, "dismissed");
  return get(db, id);
}

export function snooze(db: Database.Database, id: number, until: string): Proposal | null {
  setStatus(db, id, "snoozed", until);
  return get(db, id);
}

/** Allow editing a draft's body before confirming (drafts are meant to be edited). */
export function editBody(db: Database.Database, id: number, body: string): Proposal | null {
  db.prepare("UPDATE proposals SET body = ? WHERE id = ?").run(body, id);
  return get(db, id);
}

/**
 * The confirm-before-act gate. This is the ONLY path that runs an effect.
 * `runEffect` is the executor; for a {type:"none"} effect there's nothing to run,
 * so we go straight to 'executed'. Any executor error leaves status at 'confirmed'
 * so the user can retry — we never silently lose a confirmed intent.
 */
export async function confirm(
  db: Database.Database,
  id: number,
  runEffect: (p: Proposal) => Promise<void>,
): Promise<Proposal | null> {
  const p = get(db, id);
  if (!p) return null;
  if (p.status === "executed") return p; // idempotent

  setStatus(db, id, "confirmed");
  const confirmed = get(db, id)!;

  if (confirmed.effect.type === "none") {
    markExecuted(db, id);
    return get(db, id);
  }

  await runEffect(confirmed); // throws → stays 'confirmed', surfaced to caller
  markExecuted(db, id);
  return get(db, id);
}

function markExecuted(db: Database.Database, id: number) {
  db.prepare("UPDATE proposals SET status = 'executed', executed_at = datetime('now') WHERE id = ?").run(id);
}
