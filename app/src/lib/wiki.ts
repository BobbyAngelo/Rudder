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

/** Mentions of `search` (a LIKE prefilter) confirmed by `word` (a boundary regex). */
function gather(db: Database.Database, search: string, word: RegExp, requireDate: boolean): Mention[] {
  let rows: any[] = [];
  try {
    rows = db.prepare(
      `SELECT source, title, content, date FROM chunk_index
       WHERE source != 'identity' ${requireDate ? "AND date IS NOT NULL" : ""} AND (content LIKE ? OR title LIKE ?)
       ORDER BY (date IS NULL), date DESC LIMIT 200`
    ).all(`%${search}%`, `%${search}%`) as any[];
  } catch { return []; }
  return rows
    .filter((r) => word.test(`${r.title || ""} ${r.content || ""}`))
    .map((r) => ({ date: r.date || undefined, source: r.source, title: collapse(r.title) || "(untitled)", snippet: collapse(r.content).slice(0, 150) }));
}

/** Every dated mention of a person in memory, most-recent first. */
export function personMentions(db: Database.Database, name: string): Mention[] {
  const { search, word } = matcher(name);
  if (search.length < 3) return [];
  return gather(db, search, word, true);
}

/** Mentions of a topic/place — exact phrase, word-bounded; dated first, undated after. */
export function mentionsOf(db: Database.Database, term: string): Mention[] {
  const word = new RegExp(`\\b${escapeRe(term)}\\b`, "i");
  return gather(db, term, word, false);
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

/* ── Topics & places: the other half of the wiki ── */

const STOP_PHRASES = new Set([
  "united states", "new york", "los angeles", "san francisco", // generic places, not personal topics
  "new feature", "bug fix", "bug fixes", "build status", "quick start", "spec compliance",
]);

// A capitalized phrase that STARTS with one of these is almost always a sentence
// fragment ("The Next…", "What Rudder…", "Our Alignment"), not a real topic.
const LEAD_STOPWORDS = new Set([
  "the", "a", "an", "this", "that", "these", "those", "our", "my", "your", "their",
  "his", "her", "its", "what", "where", "when", "why", "how", "which", "who",
  "and", "but", "or", "as", "if", "so", "we", "i", "it", "they", "you", "he", "she",
  "new", "every", "each", "some", "any", "all", "no",
]);

/** Detect recurring topics/places: multi-word proper nouns + explicit [[wikilinks]]
    that appear in 2+ notes and aren't people. High-precision, no model. */
export function extractTopics(db: Database.Database, peopleNames: string[]): { term: string; df: number }[] {
  let rows: any[] = [];
  try {
    rows = db.prepare("SELECT title, content FROM chunk_index WHERE source != 'identity'").all() as any[];
  } catch { return []; }

  const peopleWords = new Set(peopleNames.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const display = new Map<string, string>(); // lowercased term → first-seen display form
  const docs = new Map<string, Set<number>>(); // lowercased term → distinct chunk indexes

  rows.forEach((r, i) => {
    const text = `${r.title || ""}. ${r.content || ""}`;
    const found = new Set<string>();
    for (const m of text.matchAll(/\b([A-Z][a-zA-Z]+(?:\s+(?:&\s+)?[A-Z][a-zA-Z]+){1,2})\b/g)) found.add(m[1]);
    for (const m of text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) found.add(m[1].trim());
    for (const raw of found) {
      const term = collapse(raw);
      const low = term.toLowerCase();
      if (STOP_PHRASES.has(low)) continue;
      // Drop sentence fragments that lead with a function word ("The Next", "Our Work").
      if (LEAD_STOPWORDS.has(term.split(/\s+/)[0].toLowerCase())) continue;
      // Skip anything that is or contains a known person.
      if (term.split(/\s+/).some((w) => peopleWords.has(w.toLowerCase()))) continue;
      if (!display.has(low)) display.set(low, term);
      if (!docs.has(low)) docs.set(low, new Set());
      docs.get(low)!.add(i);
    }
  });

  const out: { term: string; df: number }[] = [];
  for (const [low, set] of docs) {
    if (set.size >= 2) out.push({ term: display.get(low)!, df: set.size });
  }
  return out.sort((a, b) => b.df - a.df).slice(0, 30);
}

/** Build a topic/place page: who and what shows up around it, over time. */
export function buildTopicPage(term: string, mentions: Mention[], people: string[]): string {
  const out = [
    "---", "type: topic", `name: "${term.replace(/"/g, "'")}"`, `mentions: ${mentions.length}`, "---", "",
    `# ${term}`, "", "A recurring thread in your memory.", "",
  ];
  if (people.length) out.push("## People", "", people.map((n) => `[[${entityFileName(n)}]]`).join(" · "), "");
  if (mentions.length) {
    out.push("## Timeline", "");
    for (const m of mentions.slice(0, 40)) {
      const when = m.date ? `**${m.date}**` : "_undated_";
      out.push(`- ${when} · ${m.source} — ${m.title}: ${m.snippet}${m.snippet.length >= 150 ? "…" : ""}`);
    }
    out.push("");
  }
  out.push("---", "_Compiled by Rudder from your memory. Edit the raw notes, not this page — it's regenerated._");
  return out.join("\n");
}

/** Compile a page for every relationship person (no index — see compileWiki). */
interface PersonSummary { p: Person; count: number; last?: string }
interface TopicSummary { term: string; count: number }

export function compilePeoplePages(db: Database.Database, now: Date = new Date()): { pages: PersonSummary[]; files: string[] } {
  let people: Person[] = [];
  try {
    people = db.prepare("SELECT name, relation, note FROM identity_relationships ORDER BY priority").all() as Person[];
  } catch { return { pages: [], files: [] }; }

  const names = people.map((p) => p.name).filter(Boolean);
  const files: string[] = [];
  const pages: PersonSummary[] = [];

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
    pages.push({ p, count: mentions.length, last: mentions.find((m) => m.date)?.date });
  }
  return { pages, files };
}

export function compileTopicPages(db: Database.Database, peopleNames: string[]): { pages: TopicSummary[]; files: string[] } {
  const topics = extractTopics(db, peopleNames);
  const files: string[] = [];
  const pages: TopicSummary[] = [];
  for (const { term } of topics) {
    const mentions = mentionsOf(db, term);
    if (!mentions.length) continue;
    const people = peopleNames.filter((n) => {
      const { word } = matcher(n);
      return mentions.some((m) => word.test(`${m.title} ${m.snippet}`));
    });
    files.push(writeWikiFile(`topics/${entityFileName(term)}.md`, buildTopicPage(term, mentions, people)));
    pages.push({ term, count: mentions.length });
  }
  return { pages, files };
}

/** Compile the whole wiki — people + topics + a combined index. */
export function compileWiki(db: Database.Database, now: Date = new Date()): { people: number; topics: number; files: string[] } {
  const ppl = compilePeoplePages(db, now);
  let peopleNames: string[] = [];
  try {
    peopleNames = (db.prepare("SELECT name FROM identity_relationships").all() as { name: string }[]).map((r) => r.name).filter(Boolean);
  } catch { /* none */ }
  const top = compileTopicPages(db, peopleNames);
  const index = writeWikiFile("index.md", buildIndex(ppl.pages, top.pages, now));
  return { people: ppl.pages.length, topics: top.pages.length, files: [...ppl.files, ...top.files, index] };
}

function buildIndex(people: PersonSummary[], topics: TopicSummary[], now: Date): string {
  const out = ["---", "type: index", "---", "", "# Your wiki", "", "_Compiled by Rudder from your memory. People link to each other by who appears together; topics link to the people around them._", "", "## People", ""];
  for (const r of [...people].sort((a, b) => (b.last || "").localeCompare(a.last || ""))) {
    const rel = r.p.relation ? ` — ${r.p.relation}` : "";
    const quiet = r.last && monthsAgo(r.last, now) >= 6 ? " · ⚠️ gone quiet" : "";
    out.push(`- [[${entityFileName(r.p.name)}|${r.p.name}]]${rel} · ${r.count} mention${r.count === 1 ? "" : "s"}${r.last ? ` · last ${r.last}` : ""}${quiet}`);
  }
  if (topics.length) {
    out.push("", "## Topics & places", "");
    for (const t of [...topics].sort((a, b) => b.count - a.count)) {
      out.push(`- [[${entityFileName(t.term)}|${t.term}]] · ${t.count} mention${t.count === 1 ? "" : "s"}`);
    }
  }
  out.push("");
  return out.join("\n");
}
