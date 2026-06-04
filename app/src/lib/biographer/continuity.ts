/* ═══════════════════════════════════════════════════════
   Continuity tracker — a life-state timeline for cross-chapter consistency.
   In a book spanning decades, chapter 5 must not contradict chapter 2 (where
   you lived, your role, who your partner was). Rather than extract world-state
   from prose (fragile), we DERIVE it from the structured facts Rudder already
   holds — milestones, relationships, location, LinkedIn roles — and feed the
   facts true during an era into that chapter's writer.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";

export interface LifeFact {
  kind: "role" | "milestone" | "education" | "relationship" | "location";
  text: string;
  from?: string; // ISO date the fact began, when known
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Gather the structured, mostly-dated facts of a life from local data. */
export function buildLifeFacts(db: Database.Database): LifeFact[] {
  const facts: LifeFact[] = [];
  const push = (kind: LifeFact["kind"], text?: string, from?: string) => {
    if (text && text.trim()) facts.push({ kind, text: text.trim(), from: from || undefined });
  };

  try {
    const ms = db.prepare("SELECT title, date, category FROM identity_milestones ORDER BY COALESCE(date,'')").all() as any[];
    for (const m of ms) push(m.category === "education" ? "education" : "milestone", m.title, m.date);
  } catch { /* table may not exist */ }

  try {
    const rs = db.prepare("SELECT name, relation FROM identity_relationships ORDER BY priority").all() as any[];
    for (const r of rs) push("relationship", r.relation ? `${r.name} — ${r.relation}` : r.name);
  } catch { /* */ }

  try {
    const p = db.prepare("SELECT location FROM identity_profile WHERE id = 1").get() as any;
    if (p?.location) push("location", `Lives in ${p.location}`);
  } catch { /* */ }

  try {
    // LinkedIn positions are indexed with title "Title — Company" and date = start.
    const roles = db.prepare("SELECT title, MIN(date) AS d FROM chunk_index WHERE source = 'linkedin' AND title LIKE '% — %' GROUP BY title").all() as any[];
    for (const r of roles) push("role", r.title, r.d);
  } catch { /* */ }

  return facts;
}

/** The facts that should hold true during [from, to] — concise lines for the writer. */
export function factsForEra(facts: LifeFact[], from?: string, to?: string): string[] {
  const dated = facts.filter((f) => f.from);
  const undated = facts.filter((f) => !f.from);

  let relevant = dated;
  if (to) relevant = dated.filter((f) => (f.from as string) <= to); // established by the era's end
  relevant = relevant
    .sort((a, b) => (b.from as string).localeCompare(a.from as string)) // most recent first
    .slice(0, 8);

  const lines = [
    ...relevant.map((f) => `${cap(f.kind)}: ${f.text}${f.from ? ` (since ${f.from.slice(0, 7)})` : ""}`),
    ...undated.slice(0, 5).map((f) => `${cap(f.kind)}: ${f.text}`),
  ];
  return [...new Set(lines)].slice(0, 12);
}
