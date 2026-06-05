/* ═══════════════════════════════════════════════════════
   The identity nudge — notice the people in your memory.
   People pages stay empty until you add relationships. Rather than make you
   remember everyone, Rudder reads your own notes and suggests the people you
   actually mention — one click to add. Grounded, opt-in, no model.

   Detection uses person-context patterns ("with Diego", "Sam said", "Maya's")
   rather than bare capitalized words, so places ("Austin", "Denver") mostly
   don't slip through. The user reviews before adding, so recall matters more
   than precision.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";

export interface PersonSuggestion {
  name: string;
  mentions: number;   // distinct notes the name appears in (with person context)
  snippet: string;    // a sample line, so you recognize who it is
}

// Words that precede a person ("had coffee with Diego"). "from/to" are excluded
// on purpose — too place-prone ("moved to Austin").
const BEFORE = "(?:with|met|meeting|saw|seeing|called|calling|texted|texting|emailed|emailing|told|telling|asked|asking|thanked|visited|visiting|alongside|dinner with|lunch with|coffee with)";
// Words a person does, following their name ("Sam said", "Priya told me").
const AFTER = "(?:said|says|told|tells|asked|asks|wrote|writes|replied|texted|called|emailed|mentioned|thinks|thought|wants|wanted|loves|loved|recommended|suggested)";

const NAME = "([A-Z][a-z]{2,})"; // a single capitalized first name

const STOP_NAMES = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "today", "tomorrow", "yesterday",
  "rudder", "obsidian", "ollama", "google", "meta", "linkedin",
]);

/** Suggest people mentioned in memory who aren't already relationships. */
export function suggestPeople(db: Database.Database, existing: string[] = [], limit = 8): PersonSuggestion[] {
  let rows: any[] = [];
  try {
    rows = db.prepare("SELECT title, content FROM chunk_index WHERE source != 'identity'").all() as any[];
  } catch { return []; }

  // Exclude names already known (full names and their first names).
  const known = new Set<string>();
  for (const n of existing) {
    const t = n.trim().toLowerCase();
    if (t) { known.add(t); known.add(t.split(/\s+/)[0]); }
  }

  const reBefore = new RegExp(`\\b${BEFORE}\\s+${NAME}\\b`, "gi");
  const reAfter = new RegExp(`\\b${NAME}\\s+${AFTER}\\b`, "g");
  const rePoss = new RegExp(`\\b${NAME}'s\\b`, "g");

  const counts = new Map<string, { display: string; notes: Set<number>; snippet: string }>();
  const bump = (raw: string, docIdx: number, line: string) => {
    const name = raw.trim();
    const low = name.toLowerCase();
    if (low.length < 3 || STOP_NAMES.has(low) || known.has(low)) return;
    let e = counts.get(low);
    if (!e) { e = { display: name, notes: new Set(), snippet: line.trim().slice(0, 140) }; counts.set(low, e); }
    e.notes.add(docIdx);
  };

  rows.forEach((r, i) => {
    const text = `${r.title || ""}. ${r.content || ""}`;
    for (const m of text.matchAll(reBefore)) bump(m[1], i, contextAround(text, m.index ?? 0));
    for (const m of text.matchAll(reAfter)) bump(m[1], i, contextAround(text, m.index ?? 0));
    for (const m of text.matchAll(rePoss)) bump(m[1], i, contextAround(text, m.index ?? 0));
  });

  return [...counts.values()]
    .filter((e) => e.notes.size >= 2)
    .sort((a, b) => b.notes.size - a.notes.size)
    .slice(0, limit)
    .map((e) => ({ name: e.display, mentions: e.notes.size, snippet: e.snippet }));
}

function contextAround(text: string, idx: number): string {
  const start = Math.max(0, idx - 10);
  return text.slice(start, start + 120).replace(/\s+/g, " ").trim();
}
