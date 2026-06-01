/* ═══════════════════════════════════════════════════════
   Retrieval recall eval — the measurement loop.

   Compares the keyword baseline against the hybrid retriever
   (semantic + lexical + temporal) over a fixed synthetic corpus
   with questions tagged to the items that SHOULD answer them.

   Embeddings: uses local Ollama (nomic-embed-text) when reachable;
   otherwise falls back to a MOCK embedder so the harness still runs
   (semantic numbers in mock mode are illustrative only — the
   temporal logic is real either way).

   Run:  npm run eval        (from app/)
   ═══════════════════════════════════════════════════════ */

import { retrieveChunks, retrieveHybrid, type Chunk } from "../src/lib/retrieval";

type EvalChunk = Chunk & { id: string };

// Fixed "now" so temporal queries are deterministic. 2026-05-27 is a Wednesday;
// "this week" => Mon 2026-05-25 .. Sun 2026-05-31.
const NOW = new Date("2026-05-27T12:00:00Z");

const CORPUS: EvalChunk[] = [
  { id: "p-sarah", source: "people", title: "Sarah Chen", content: "Sarah Chen, product designer at Northwind. Met at the 2024 design conference. Close friend." },
  { id: "cal-sarah", source: "calendar", title: "Coffee with Sarah", content: "Coffee with Sarah Chen at Blue Bottle. Discussed her new job offer and the Tahoe trip plan.", date: "2026-05-20" },
  { id: "note-sarah", source: "writing", title: "Catch-up notes", content: "Catching up with Sarah — she's considering leaving Northwind and wants advice on the offer from Figma.", date: "2026-05-19" },
  { id: "p-attorney", source: "people", title: "Marcus Webb", content: "Marcus Webb, attorney specializing in startup contracts and intellectual property law. Referred by Dana." },
  { id: "p-doctor", source: "people", title: "Dr. Patel", content: "Anjali Patel, primary care physician at Bay Medical Group." },
  { id: "task-taxes", source: "tasks", title: "File quarterly taxes", content: "Submit Q1 estimated taxes to the accountant before the deadline.", date: "2026-06-15" },
  { id: "task-gift", source: "tasks", title: "Buy anniversary gift", content: "Find an anniversary gift for partner — she liked the ceramics studio.", date: "2026-05-30" },
  { id: "cal-dentist", source: "calendar", title: "Dentist appointment", content: "Routine dental cleaning with Dr. Lee.", date: "2026-05-28" },
  { id: "health-sleep", source: "health", title: "Sleep", content: "Average sleep 6.2 hours over the last 30 days, trending down." },
  { id: "note-tahoe", source: "writing", title: "Tahoe trip", content: "Planning a Tahoe trip in July with Sarah and the group. Need to book a cabin." },
  { id: "p-boss", source: "people", title: "Dana Rivera", content: "Dana Rivera, my manager at Acme. Performance reviews due quarterly." },
  { id: "note-idea", source: "writing", title: "App idea", content: "Idea: a local-first journaling app that summarizes your week automatically." },
  { id: "cal-standup", source: "calendar", title: "Team standup", content: "Daily standup with the Acme engineering team." },
  { id: "task-call-mom", source: "tasks", title: "Call Mom", content: "Call Mom about the weekend visit.", date: "2026-05-31" },
];

const CASES: { q: string; expected: string[]; kind: "keyword" | "semantic" | "temporal" }[] = [
  { q: "When did I last see Sarah and what did we talk about?", expected: ["cal-sarah", "note-sarah"], kind: "keyword" },
  { q: "What tasks are due?", expected: ["task-taxes", "task-gift", "task-call-mom"], kind: "keyword" },
  { q: "Notes about my Tahoe trip", expected: ["note-tahoe"], kind: "keyword" },
  { q: "anniversary gift ideas", expected: ["task-gift"], kind: "keyword" },
  { q: "How has my sleep been?", expected: ["health-sleep"], kind: "keyword" },
  { q: "How has my sleep been lately?", expected: ["health-sleep"], kind: "temporal" },
  { q: "Who can help me with legal stuff?", expected: ["p-attorney"], kind: "semantic" },
  { q: "Who is my doctor?", expected: ["p-doctor"], kind: "semantic" },
  { q: "What do I need to get done this week?", expected: ["task-gift", "task-call-mom", "cal-dentist"], kind: "temporal" },
];

// ── Embedder: real Ollama if reachable, else a labeled mock ──────────────
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";

async function ollamaUp(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function embedReal(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  const d = await r.json();
  return d.embeddings?.[0] || [];
}

// Mock: concept-grouped bag-of-words so synonyms cluster. SANDBOX ONLY.
const CONCEPTS: Record<string, string[]> = {
  legal: ["legal", "law", "attorney", "lawyer", "contract", "contracts", "ip", "intellectual", "property"],
  medical: ["doctor", "physician", "medical", "clinic", "care", "dental", "dentist"],
  schedule: ["task", "tasks", "due", "todo", "calendar", "appointment", "meeting", "standup", "get", "done"],
  social: ["sarah", "friend", "coffee", "catch", "trip", "tahoe", "talk"],
  family: ["mom", "family", "anniversary", "partner", "gift"],
  sleep: ["sleep", "rest", "tired"],
};
const CONCEPT_KEYS = Object.keys(CONCEPTS);
function embedMock(text: string): number[] {
  const toks = text.toLowerCase().split(/\W+/).filter(Boolean);
  const v = new Array(CONCEPT_KEYS.length + 16).fill(0);
  for (const t of toks) {
    CONCEPT_KEYS.forEach((k, i) => { if (CONCEPTS[k].includes(t)) v[i] += 1; });
    let h = 0;
    for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[CONCEPT_KEYS.length + (h % 16)] += 0.5;
  }
  return v;
}

function recall(per: { got: number; need: number }[]): number {
  return per.reduce((s, p) => s + p.got / p.need, 0) / per.length;
}
const pct = (x: number) => (x * 100).toFixed(0) + "%";

async function main() {
  const real = await ollamaUp();
  const embed = real ? embedReal : async (t: string) => embedMock(t);
  console.log(`\n  Retrieval eval — ${CORPUS.length} items, ${CASES.length} questions`);
  console.log(`  Embeddings: ${real ? "REAL (nomic-embed-text via Ollama)" : "MOCK (sandbox fallback — semantic numbers illustrative)"}\n`);

  // Embed corpus once.
  for (const c of CORPUS) c.vector = await embed(`${c.title}. ${c.content}`);

  // ── Baseline: keyword @5 ──
  const base = CASES.map((c) => {
    const ids = new Set((retrieveChunks(CORPUS, c.q, 5) as EvalChunk[]).map((r) => r.id));
    return { ...c, got: c.expected.filter((e) => ids.has(e)).length, need: c.expected.length };
  });
  // ── Hybrid @8 ──
  const hyb: { q: string; kind: string; got: number; need: number }[] = [];
  for (const c of CASES) {
    const qv = await embed(c.q);
    const ids = new Set((retrieveHybrid(CORPUS, c.q, qv, { topN: 8, now: NOW }) as EvalChunk[]).map((r) => r.id));
    hyb.push({ q: c.q, kind: c.kind, got: c.expected.filter((e) => ids.has(e)).length, need: c.expected.length });
  }

  console.log("  ── per question (keyword@5  →  hybrid@8) ──");
  for (let i = 0; i < CASES.length; i++) {
    const b = base[i], h = hyb[i];
    const bm = b.got === b.need ? "✓" : b.got > 0 ? "~" : "✗";
    const hm = h.got === h.need ? "✓" : h.got > 0 ? "~" : "✗";
    console.log(`   ${bm} ${b.got}/${b.need}  →  ${hm} ${h.got}/${h.need}  [${h.kind.padEnd(8)}] ${h.q}`);
  }
  console.log(`\n  macro recall — keyword@5: ${pct(recall(base))}   hybrid@8: ${pct(recall(hyb))}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
