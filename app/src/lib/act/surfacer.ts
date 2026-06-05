/* ═══════════════════════════════════════════════════════
   The act loop — the surfacer (the safe verb).
   Rudder's first forward-facing move is the gentlest one: bring the right thing
   back to your attention at the right time. No external side effect — a surfaced
   proposal's effect is {type:"none"}, so confirming it just means "noted."

   Three grounded signals, each cited to your own memory:
     1. On this day   — a moment from a past year that shares today's date.
     2. Gone quiet    — a key relationship you haven't logged anything about in a while.
     3. Open loop     — something you recently wrote that reads like an unfinished commitment.

   Every helper is pure (db + now in, DraftProposals out) so the spine is testable
   without a model or network.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import type { DraftProposal, ProposalSource } from "./types";
import { parseWhen } from "./when";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const monthsBetween = (aIso: string, b: Date) =>
  (b.getTime() - new Date(aIso + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24 * 30.4);

function chunkSource(r: any): ProposalSource {
  return {
    id: r.chunk_id,
    source: r.source,
    title: r.title || "(untitled)",
    date: r.date || undefined,
    snippet: (r.content || "").slice(0, 160),
  };
}

/** A moment from a previous year that shares today's month-day. */
export function onThisDay(db: Database.Database, now: Date): DraftProposal[] {
  const mmdd = iso(now).slice(5); // MM-DD
  const thisYear = iso(now).slice(0, 4);
  let rows: any[] = [];
  try {
    rows = db.prepare(
      `SELECT chunk_id, source, title, content, date FROM chunk_index
       WHERE date IS NOT NULL AND substr(date,6,5) = ?
         AND substr(date,1,4) < ? AND source != 'identity'
       ORDER BY date DESC LIMIT 1`
    ).all(mmdd, thisYear) as any[];
  } catch { return []; }
  return rows.map((r) => {
    const year = (r.date || "").slice(0, 4);
    return {
      kind: "surface" as const,
      title: `On this day in ${year}: ${r.title || "a moment"}`,
      body: (r.content || "").slice(0, 400),
      rationale: `${year} — ${todayMonthDay(now)} — shares today's date. Worth a glance back.`,
      sources: [chunkSource(r)],
      effect: { type: "none" as const },
      dedupeKey: `surface:otd:${iso(now)}:${r.chunk_id}`,
    };
  });
}

/** Key people you haven't logged anything about in over `quietMonths`. */
export function goneQuiet(db: Database.Database, now: Date, quietMonths = 6): DraftProposal[] {
  let people: any[] = [];
  try {
    people = db.prepare(
      "SELECT name, relation FROM identity_relationships ORDER BY priority LIMIT 40"
    ).all() as any[];
  } catch { return []; }

  const out: DraftProposal[] = [];
  for (const p of people) {
    if (!p.name || p.name.trim().length < 2) continue;
    // People go by first names in notes ("Diego"), but relationships store the
    // full name ("Diego Alvarez"). Search by the first name, then confirm a
    // whole-word match (full OR first) so "Sam" doesn't match "same".
    const full = p.name.trim();
    const first = full.split(/\s+/)[0];
    const search = first.length >= 3 ? first : full;
    if (search.length < 3) continue; // too short to match safely
    const word = new RegExp(`\\b(${escapeRe(full)}|${escapeRe(first)})\\b`, "i");
    let rows: any[] = [];
    try {
      rows = db.prepare(
        `SELECT chunk_id, source, title, content, date FROM chunk_index
         WHERE source != 'identity' AND date IS NOT NULL
           AND (content LIKE ? OR title LIKE ?)
         ORDER BY date DESC LIMIT 8`
      ).all(`%${search}%`, `%${search}%`) as any[];
    } catch { continue; }
    const last = rows.find((r) => word.test(`${r.title || ""} ${r.content || ""}`));
    if (!last || !last.date) continue; // never mentioned → skip (avoid noise in phase 1)
    const months = monthsBetween(last.date, now);
    if (months < quietMonths) continue;
    const who = p.relation ? `${p.name}, your ${p.relation}` : p.name;
    out.push({
      kind: "surface",
      title: `It's been a while — ${who}`,
      body: `The last thing in your memory about ${p.name} was ${last.date}. Maybe reach out.`,
      rationale: `~${Math.round(months)} months since anything about ${p.name}. A relationship worth not letting drift.`,
      sources: [chunkSource(last)],
      effect: { type: "none" },
      dedupeKey: `surface:quiet:${p.name.toLowerCase()}:${iso(now).slice(0, 7)}`,
    });
  }
  return out.slice(0, 3);
}

const COMMIT_CUES = [
  "i'll ", "i will ", "i need to ", "i should ", "i promised", "promised to",
  "follow up", "follow-up", "let's ", "lets ", "we should ", "todo", "to-do",
  "remind me", "don't forget", "next week", "by friday", "by monday",
];

/** Recent notes that read like an unfinished commitment. */
export function openLoops(db: Database.Database, now: Date, withinDays = 90): DraftProposal[] {
  const since = iso(new Date(now.getTime() - withinDays * 86400000));
  let rows: any[] = [];
  try {
    rows = db.prepare(
      `SELECT chunk_id, source, title, content, date FROM chunk_index
       WHERE date IS NOT NULL AND date >= ? AND source NOT IN ('identity')
       ORDER BY date DESC LIMIT 200`
    ).all(since) as any[];
  } catch { return []; }

  const today = iso(now);
  const out: DraftProposal[] = [];
  for (const r of rows) {
    const hay = `${r.title || ""} ${r.content || ""}`.toLowerCase();
    const cue = COMMIT_CUES.find((c) => hay.includes(c));
    if (!cue) continue;
    // If it has a concrete future date, the scheduler turns it into a calendar
    // proposal instead — don't also nudge about it here.
    const when = parseWhen(`${r.title || ""}. ${r.content || ""}`, r.date);
    if (when && when.date >= today) continue;
    out.push({
      kind: "surface",
      title: `Open loop: ${(r.title || (r.content || "").slice(0, 50)).trim()}`,
      body: (r.content || "").slice(0, 400),
      rationale: `Written ${r.date} and it reads like an open commitment ("${cue.trim()}"). Still outstanding?`,
      sources: [chunkSource(r)],
      effect: { type: "none" },
      dedupeKey: `surface:loop:${r.chunk_id}`,
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** The full surfacer: all three signals, capped so the desk never floods. */
export function surface(db: Database.Database, now: Date = new Date()): DraftProposal[] {
  return [
    ...onThisDay(db, now),
    ...goneQuiet(db, now),
    ...openLoops(db, now),
  ].slice(0, 7);
}

function todayMonthDay(now: Date): string {
  return now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}
