/* ═══════════════════════════════════════════════════════
   Persistent recall smoke — runs the FULL real path:
   index fixture chunks into sqlite-vec, then recall() via
   KNN → retrieveHybrid. Confirms the stored path matches the
   in-memory eval (should stay 100% on the fixture).

   Run:  npm run recall:store   (from app/)   — needs Ollama + sqlite-vec.
   ═══════════════════════════════════════════════════════ */

import Database from "better-sqlite3";
import { indexChunks, recall } from "../src/lib/memory";
import type { Chunk } from "../src/lib/retrieval";

const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const NOW = new Date("2026-05-27T12:00:00Z");

async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  const d = await r.json();
  return d.embeddings?.[0] || [];
}

const CORPUS: (Chunk & { id: string })[] = [
  { id: "cal-sarah", source: "calendar", title: "Coffee with Sarah", content: "Coffee with Sarah Chen. Discussed her new job offer and the Tahoe trip.", date: "2026-05-20" },
  { id: "note-sarah", source: "writing", title: "Catch-up notes", content: "Catching up with Sarah — considering leaving Northwind for a Figma offer.", date: "2026-05-19" },
  { id: "p-attorney", source: "people", title: "Marcus Webb", content: "Marcus Webb, attorney specializing in startup contracts and intellectual property law." },
  { id: "p-doctor", source: "people", title: "Dr. Patel", content: "Anjali Patel, primary care physician at Bay Medical Group." },
  { id: "task-gift", source: "tasks", title: "Buy anniversary gift", content: "Find an anniversary gift for partner — she liked the ceramics studio.", date: "2026-05-30" },
  { id: "cal-dentist", source: "calendar", title: "Dentist appointment", content: "Routine dental cleaning with Dr. Lee.", date: "2026-05-28" },
  { id: "task-call-mom", source: "tasks", title: "Call Mom", content: "Call Mom about the weekend visit.", date: "2026-05-31" },
  { id: "health-sleep", source: "health", title: "Sleep", content: "Average sleep 6.2 hours over the last 30 days, trending down." },
  { id: "note-tahoe", source: "writing", title: "Tahoe trip", content: "Planning a Tahoe trip in July with Sarah. Need to book a cabin." },
];

const CASES: { q: string; expected: string[]; kind: string }[] = [
  { q: "When did I last see Sarah and what did we talk about?", expected: ["cal-sarah", "note-sarah"], kind: "keyword" },
  { q: "Who can help me with legal stuff?", expected: ["p-attorney"], kind: "semantic" },
  { q: "Who is my doctor?", expected: ["p-doctor"], kind: "semantic" },
  { q: "What do I need to get done this week?", expected: ["task-gift", "task-call-mom", "cal-dentist"], kind: "temporal" },
  { q: "How has my sleep been?", expected: ["health-sleep"], kind: "keyword" },
];

async function main() {
  const db = new Database(":memory:");
  const { indexed } = await indexChunks(db, CORPUS, embed);
  console.log(`\n  Persistent recall smoke — indexed ${indexed} chunks into sqlite-vec\n`);

  const per: { got: number; need: number }[] = [];
  for (const c of CASES) {
    const { sources } = await recall(db, c.q, embed, { topN: 8, now: NOW });
    const ids = new Set(sources.map((s) => s.id));
    const got = c.expected.filter((e) => ids.has(e)).length;
    per.push({ got, need: c.expected.length });
    const mark = got === c.expected.length ? "✓" : got > 0 ? "~" : "✗";
    console.log(`   ${mark} ${got}/${c.expected.length}  [${c.kind.padEnd(8)}] ${c.q}`);
    // show the receipts for one case
    if (c.kind === "temporal") {
      console.log("      sources: " + sources.map((s) => `${s.id}(${s.date ?? "—"})`).join(", "));
    }
  }
  const macro = per.reduce((s, p) => s + p.got / p.need, 0) / per.length;
  console.log(`\n  macro recall (persistent path): ${(macro * 100).toFixed(0)}%\n`);
  process.exit(macro >= 0.99 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
