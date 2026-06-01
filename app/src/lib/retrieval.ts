/* ═══════════════════════════════════════════════════════
   Retrieval — pure ranking/selection logic (no I/O, no DB).
   Kept dependency-free so it can be unit-tested and benchmarked
   in isolation (see app/eval/recall.ts). Data loading lives in rag.ts.
   ═══════════════════════════════════════════════════════ */

export interface Chunk {
  source: string;   // 'people', 'career', 'writing', etc.
  title: string;
  content: string;
  // ── optional structured metadata (used by the hybrid retriever) ──
  id?: string;        // stable id, for citations/provenance
  sourceId?: string;  // id of the originating row, for linking back
  date?: string;      // ISO yyyy-mm-dd, for temporal filtering
  people?: string[];  // entity tags, for person-scoped queries
  vector?: number[];  // embedding, when available
}

// Common words that carry no retrieval signal. Matching them ("with", "who"…)
// inflates noise, so they're stripped from query keywords.
const STOPWORDS = new Set(
  ("a an the and or but of to in on at for with about from by as is are was were be been being " +
   "do does did have has had will would should shall can could may might must " +
   "me my mine you your yours we our ours it its this that these those there here " +
   "what when where who whom whose why how which while into over under out up down off " +
   "i so no not too very just than then them they he she his her him get got need").split(" ")
);

/** Normalize a query into meaningful keywords: lowercase, strip punctuation, drop stopwords. */
export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Simple keyword-based retrieval (fast, no embeddings needed).
 * Returns the top N chunks matching the query keywords.
 *
 * NOTE: this is the current baseline. The hybrid retriever
 * (semantic + time/entity filters) will extend this module and
 * is evaluated against the same harness.
 */
export function retrieveChunks(chunks: Chunk[], query: string, topN: number = 15): Chunk[] {
  const queryLower = query.toLowerCase();
  const keywords = extractKeywords(query);

  const isScheduleQuery =
    queryLower.includes("schedule") ||
    queryLower.includes("calendar") ||
    queryLower.includes("agenda") ||
    queryLower.includes("tasks") ||
    queryLower.includes("todo");

  const scored = chunks.map((chunk) => {
    const text = (chunk.content + " " + chunk.title).toLowerCase();
    let score = 0;

    // Explicit boosts for schedule intents
    if (isScheduleQuery && (chunk.source === "tasks" || chunk.source === "calendar")) {
      score += 5; // Base boost for relevant sources
    }

    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
      // Boost title matches
      if (chunk.title.toLowerCase().includes(kw)) score += 2;
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.chunk);
}

/* ═══════════════════════════════════════════════════════
   Hybrid retrieval — semantic + lexical + temporal.
   Pure: the caller supplies the query embedding and (optionally)
   per-chunk embeddings. DB / Ollama wiring lives in rag.ts.
   ═══════════════════════════════════════════════════════ */

export function cosineSim(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface TimeWindow {
  start?: string;       // ISO yyyy-mm-dd inclusive
  end?: string;         // ISO yyyy-mm-dd inclusive
  recencyBias: boolean; // "last time", "recent", "lately"
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Parse a coarse time window out of a natural-language query.
 * Returns null if the query has no temporal intent.
 */
export function parseTimeWindow(query: string, now: Date = new Date()): TimeWindow | null {
  const q = query.toLowerCase();
  const recencyBias = /\b(last time|recent|recently|lately|latest)\b/.test(q);
  const dow = now.getDay();                       // 0=Sun..6=Sat
  const mondayOffset = (dow + 6) % 7;             // days since Monday
  const monday = addDays(now, -mondayOffset);

  if (/\btoday\b/.test(q)) return { start: iso(now), end: iso(now), recencyBias };
  if (/\btomorrow\b/.test(q)) return { start: iso(addDays(now, 1)), end: iso(addDays(now, 1)), recencyBias };
  if (/\byesterday\b/.test(q)) return { start: iso(addDays(now, -1)), end: iso(addDays(now, -1)), recencyBias };
  if (/\bthis week\b/.test(q)) return { start: iso(monday), end: iso(addDays(monday, 6)), recencyBias };
  if (/\blast week\b/.test(q)) return { start: iso(addDays(monday, -7)), end: iso(addDays(monday, -1)), recencyBias };
  if (/\bthis month\b/.test(q)) {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: iso(first), end: iso(last), recencyBias };
  }
  const nextN = q.match(/\bnext (\d+) days?\b/);
  if (nextN) return { start: iso(now), end: iso(addDays(now, parseInt(nextN[1], 10))), recencyBias };
  if (recencyBias) return { recencyBias };        // recency intent, no hard window
  return null;
}

function lexicalScore(chunk: Chunk, keywords: string[]): number {
  const text = (chunk.content + " " + chunk.title).toLowerCase();
  let s = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) s += 1;
    if (chunk.title.toLowerCase().includes(kw)) s += 2;
  }
  return s;
}

export interface HybridOpts {
  topN?: number;
  now?: Date;
  weights?: { semantic: number; lexical: number; temporal: number; source: number };
}

/**
 * Hybrid scorer. `queryVec` + per-chunk `.vector` enable semantic search;
 * if absent, it degrades gracefully to lexical + temporal.
 */
export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  sem: number;     // semantic similarity 0..1
  lex: number;     // normalized lexical 0..1
  temporal: number;
  source: number;
}

// Relevance gate: recency/source boosts may only re-order items that are
// already on-topic — they must never promote unrelated noise.
const REL_SEM = 0.45;
const REL_LEX = 0.15;

/**
 * Hybrid scorer with a full score breakdown (for ranking + diagnostics).
 * `queryVec` + per-chunk `.vector` enable semantic search; absent, it
 * degrades gracefully to lexical + temporal.
 */
export function scoreHybrid(
  chunks: Chunk[],
  query: string,
  queryVec: number[] | null,
  opts: HybridOpts = {}
): ScoredChunk[] {
  const now = opts.now ?? new Date();
  const w = opts.weights ?? { semantic: 0.6, lexical: 0.35, temporal: 0.8, source: 0.4 };

  const q = query.toLowerCase();
  const keywords = extractKeywords(query);
  const tw = parseTimeWindow(query, now);

  // Query → source routing (e.g. "what tasks are due" favors tasks/calendar).
  const isScheduleQuery = /\b(schedule|calendar|agenda|tasks?|todo|due|appointments?|events?|meetings?)\b/.test(q);

  const lexRaw = chunks.map((c) => lexicalScore(c, keywords));
  const maxLex = Math.max(1, ...lexRaw);

  const scored: ScoredChunk[] = chunks.map((chunk, i) => {
    const sem = queryVec && chunk.vector ? Math.max(0, cosineSim(queryVec, chunk.vector)) : 0;
    const lex = lexRaw[i] / maxLex;
    const relevant = sem > REL_SEM || lex > REL_LEX;

    let temporal = 0;
    if (tw?.start && tw?.end) {
      // hard window: in-window items get the full temporal signal
      temporal = chunk.date && chunk.date >= tw.start && chunk.date <= tw.end ? 1 : 0;
    } else if (tw?.recencyBias && chunk.date && relevant) {
      // soft recency: only nudges items that are ALREADY relevant — never noise
      const ageDays = Math.abs(now.getTime() - new Date(chunk.date).getTime()) / 86_400_000;
      temporal = Math.max(0, 1 - Math.min(ageDays, 180) / 180) * 0.25;
    }

    const source = isScheduleQuery && (chunk.source === "tasks" || chunk.source === "calendar") ? 1 : 0;
    const score = w.semantic * sem + w.lexical * lex + w.temporal * temporal + w.source * source;
    return { chunk, score, sem, lex, temporal, source };
  });

  const ranked = scored.filter((s) => s.score > 0.01).sort((a, b) => b.score - a.score);

  // Precision: for a hard time window, prefer in-window items when any exist.
  if (tw?.start && tw?.end) {
    const inWindow = ranked.filter(
      (s) => s.chunk.date && s.chunk.date >= tw.start! && s.chunk.date <= tw.end!
    );
    if (inWindow.length) return inWindow;
  }
  return ranked;
}

export function retrieveHybrid(
  chunks: Chunk[],
  query: string,
  queryVec: number[] | null,
  opts: HybridOpts = {}
): Chunk[] {
  const topN = opts.topN ?? 8;
  return scoreHybrid(chunks, query, queryVec, opts).slice(0, topN).map((s) => s.chunk);
}
