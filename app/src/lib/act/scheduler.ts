/* ═══════════════════════════════════════════════════════
   The act loop — the scheduler (Phase 3).
   When a note carries a commitment AND a clear date ("send the deck by Friday",
   "dinner on the 13th"), Rudder proposes a calendar event for it. Confirming
   writes a LOCAL calendar entry — sovereign and reversible. It never touches an
   external calendar; that would be a separate, explicit step.

   This pairs with the surfacer: a dated commitment becomes a schedule proposal
   here, while an undated one stays an "open loop" nudge there.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import type { DraftProposal, ProposalSource } from "./types";
import { parseWhen } from "./when";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const COMMIT_CUES = [
  "i'll ", "i will ", "i need to ", "i should ", "i promised", "promised to",
  "follow up", "follow-up", "let's ", "lets ", "we should ", "todo", "to-do",
  "remind me", "don't forget", "meeting", "call ", "lunch", "dinner", "coffee",
  "appointment", "due", "deadline", "send ", "ship ", "submit",
];

/** Has this note both a commitment cue and a concrete future date? */
export function datedCommitment(text: string, noteDate: string | undefined, todayIso: string) {
  const hay = (text || "").toLowerCase();
  const cue = COMMIT_CUES.find((c) => hay.includes(c));
  if (!cue) return null;
  const when = parseWhen(text, noteDate);
  if (!when || when.date < todayIso) return null; // no date, or already past
  return { cue: cue.trim(), when };
}

function eventCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(deck|client|launch|studio|investor|meeting|standup|deadline|submit|ship|work|press)\b/.test(t)) return "work";
  if (/\b(dinner|lunch|coffee|party|drinks|friend|date|wedding|birthday|reunion)\b/.test(t)) return "social";
  if (/\b(doctor|dentist|appointment|gym|run|clinic|therapy|checkup)\b/.test(t)) return "health";
  return "personal";
}

function shortTitle(title: string | undefined, content: string): string {
  const t = (title || "").trim();
  if (t && t.length <= 60) return t;
  const firstClause = content.split(/[.!?\n]/)[0].trim();
  return (firstClause.length <= 60 ? firstClause : firstClause.slice(0, 57) + "…") || "Untitled";
}

function chunkSource(r: any): ProposalSource {
  return { id: r.chunk_id, source: r.source, title: r.title || "(untitled)", date: r.date || undefined, snippet: (r.content || "").slice(0, 160) };
}

/** Propose local calendar events for dated commitments in recent memory. */
export function scheduleProposals(db: Database.Database, now: Date = new Date(), withinDays = 120): DraftProposal[] {
  const today = iso(now);
  const since = iso(new Date(now.getTime() - withinDays * 86400000));
  let rows: any[] = [];
  try {
    rows = db.prepare(
      `SELECT chunk_id, source, title, content, date FROM chunk_index
       WHERE date IS NOT NULL AND date >= ? AND source NOT IN ('identity', 'calendar')
       ORDER BY date DESC LIMIT 200`
    ).all(since) as any[];
  } catch { return []; }

  const out: DraftProposal[] = [];
  for (const r of rows) {
    const text = `${r.title || ""}. ${r.content || ""}`;
    const hit = datedCommitment(text, r.date, today);
    if (!hit) continue;
    const { when, cue } = hit;
    const title = shortTitle(r.title, r.content || "");
    const category = eventCategory(text);
    const whenLabel = `${prettyDate(when.date)}${when.time ? ` at ${prettyTime(when.time)}` : ""}`;
    out.push({
      kind: "schedule",
      title,
      body: `${whenLabel}${when.time ? "" : " · all day"}`,
      rationale: `You wrote this on ${r.date} — “${when.matched}” lands on ${whenLabel}. Add it to your calendar so it doesn't slip.`,
      sources: [chunkSource(r)],
      effect: { type: "schedule_local", date: when.date, time: when.time, category },
      dedupeKey: `schedule:${r.chunk_id}:${when.date}`,
    });
    if (out.length >= 5) break;
  }
  return out;
}

function prettyDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

/* ── The executor: write a confirmed schedule to the LOCAL calendar. ── */

export function writeCalendarEvent(db: Database.Database, opts: {
  title: string; description?: string; date: string; time?: string; durationMin?: number; category?: string;
}): number {
  const allDay = opts.time ? 0 : 1;
  let endTime: string | null = null;
  if (opts.time && opts.durationMin) {
    const [h, m] = opts.time.split(":").map(Number);
    const end = new Date(2000, 0, 1, h, m + opts.durationMin);
    endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  }
  const info = db.prepare(
    `INSERT INTO calendar_events (title, description, start_date, start_time, end_time, all_day, category, reminder_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.title, opts.description || "", opts.date, opts.time || null, endTime, allDay,
    opts.category || "personal", opts.time ? 60 : null,
  );
  return Number(info.lastInsertRowid);
}
