/* ═══════════════════════════════════════════════════════
   The wiki — Rudder's synthesis layer (the "missing middle").
   Raw memory is searchable but shapeless. The wiki compiles it into durable
   entity pages — one markdown file per person — so the big picture is standing
   and ready, not re-derived on every query. Pages live under <vault>/wiki/ and
   link to each other, so opening the vault in Obsidian shows your social graph.

   Pure database reads — no model, no network. Pages are regenerated each
   compile (overwrite), unlike the append-only raw layer they're built from.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { writeWikiFile, entityFileName } from "./vault";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const collapse = (s: string) => (s || "").replace(/\s+/g, " ").trim();

function monthsAgo(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24 * 30.4);
}

export interface Person { name: string; relation?: string; note?: string; }
export interface Mention { date?: string; source: string; title: string; snippet: string; }

/** Match a person by first name with a word boundary (so "Sam" ≠ "same"). */
function matcher(name: string) {
  const full = name.trim();
  const first = full.split(/\s+/)[0];
  const search = first.length >= 3 ? first : full;
  const word = new RegExp(`\\b(${escapeRe(full)}|${escapeRe(first)})\\b`, "i");
  return { search, word };
}

/** Every dated mention of a person in memory, most-recent first. */
export function personMentions(db: Database.Database, name: string): Mention[] {
  const { search, word } = matcher(name);
  if (search.length < 3) return [];
  let rows: any[] = [];
  try {
    rows = db.prepare(
      `SELECT source, title, content, date FROM chunk_index
       WHERE source != 'identity' AND date IS NOT NULL AND (content LIKE ? OR title LIKE ?)
       ORDER BY date DESC LIMIT 200`
    ).all(`%${search}%`, `%${search}%`) as any[];
  } catch { return []; }
  return rows
    .filter((r) => word.test(`${r.title || ""} ${r.content || ""}`))
    .map((r) => ({ date: r.date || undefined, source: r.source, title: collapse(r.title) || "(untitled)", snippet: collapse(r.content).slice(0, 150) }));
}

/** Build one person's markdown dossier. Pure — all data passed in. */
export function buildPersonPage(p: Person, mentions: Mention[], connected: string[], now: Date = new Date()): string {
  const lastDate = mentions.find((m) => m.date)?.date;
  const fm = [
    "---",
    "type: person",
    `name: "${p.name.replace(/"/g, "'")}"`,
    p.relation ? `relation: "${p.relation.replace(/"/g, "'")}"` : "",
    `mentions: ${mentions.length}`,
    lastDate ? `last_seen: ${lastDate}` : "",
    "---",
    "",
  ].filter((l) => l !== "");

  const out = [...fm, `# ${p.name}`, ""];

  const lead = p.relation ? `Your **${p.relation}**.` : "Someone in your orbit.";
  out.push(p.note ? `${lead} ${p.note}` : lead, "");

  if (lastDate) {
    const m = Math.round(monthsAgo(lastDate, now));
    const quiet = m >= 6 ? `  ⚠️ It's been a while — maybe reach out.` : "";
    out.push(`> Last in your memory on **${lastDate}**${m >= 1 ? ` — about ${m} month${m === 1 ? "" : "s"} ago.` : "."}${quiet}`, "");
  }

  if (connected.length) {
    out.push("## Connected to", "", connected.map((n) => `[[${entityFileName(n)}]]`).join(" · "), "");
  }

  if (mentions.length) {
    out.push("## Timeline", "");
    for (const m of mentions.slice(0, 40)) {
      const when = m.date ? `**${m.date}**` : "_undated_";
      out.push(`- ${when} · ${m.source} — ${m.title}: ${m.snippet}${m.snippet.length >= 150 ? "…" : ""}`);
    }
    out.push("");
  } else {
    out.push("_No mentions in memory yet._", "");
  }

  out.push("---", "_Compiled by Rudder from your memory. Edit the raw notes, not this page — it's regenerated._");
  return out.join("\n");
}

/** Compile a page for every relationship person, plus a wiki index. */
export function compilePeoplePages(db: Database.Database, now: Date = new Date()): { people: number; files: string[] } {
  let people: Person[] = [];
  try {
    people = db.prepare("SELECT name, relation, note FROM identity_relationships ORDER BY priority").all() as Person[];
  } catch { return { people: 0, files: [] }; }

  const names = people.map((p) => p.name).filter(Boolean);
  const files: string[] = [];
  const summary: { p: Person; count: number; last?: string }[] = [];

  for (const p of people) {
    if (!p.name || p.name.trim().length < 2) continue;
    const mentions = personMentions(db, p.name);

    // Co-mentions → the social graph: other known people in the same notes.
    const connected = new Set<string>();
    for (const other of names) {
      if (other === p.name) continue;
      const { word } = matcher(other);
      if (mentions.some((m) => word.test(`${m.title} ${m.snippet}`))) connected.add(other);
    }

    files.push(writeWikiFile(`people/${entityFileName(p.name)}.md`, buildPersonPage(p, mentions, [...connected], now)));
    summary.push({ p, count: mentions.length, last: mentions.find((m) => m.date)?.date });
  }

  files.push(writeWikiFile("index.md", buildIndex(summary, now)));
  return { people: summary.length, files };
}

function buildIndex(rows: { p: Person; count: number; last?: string }[], now: Date): string {
  const out = ["---", "type: index", "---", "", "# Your people", "", "_Compiled by Rudder. One page per person, linked by who appears together._", ""];
  const sorted = [...rows].sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  for (const r of sorted) {
    const rel = r.p.relation ? ` — ${r.p.relation}` : "";
    const quiet = r.last && monthsAgo(r.last, now) >= 6 ? " · ⚠️ gone quiet" : "";
    out.push(`- [[${entityFileName(r.p.name)}|${r.p.name}]]${rel} · ${r.count} mention${r.count === 1 ? "" : "s"}${r.last ? ` · last ${r.last}` : ""}${quiet}`);
  }
  out.push("");
  return out.join("\n");
}
