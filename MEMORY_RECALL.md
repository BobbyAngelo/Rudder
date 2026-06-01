# Nailing Trustworthy Recall — Spec + Gap Analysis

> The hero feature: *ask about your own life, get an accurate answer, and see exactly where it came from* — all local. This doc specs how to make it genuinely great, and compares that target to what's in the repo today.

## The bar

A stranger imports their data, asks *"When did I last see Sarah and what did we talk about?"*, and gets: a correct answer, plus the two notes and the calendar event it used, each clickable to the original. It can say *"I couldn't find that"* when the data isn't there. And it's right often enough to trust — measured, not vibes.

## What we have today

The pipeline is `buildContextChunks()` → `retrieveChunks()` → `executeChat()` (`app/src/lib/rag.ts`, `app/src/app/api/ask/route.ts`, `app/src/lib/ai.ts`).

- **Chunking:** `buildContextChunks()` rebuilds *all* context in-memory on every query, reading from `people` (LIMIT 400), `tasks` (200), `calendar_events` (200), `reality_nodes` (150), and a `health_metrics` summary.
- **Retrieval:** `retrieveChunks()` is pure keyword scoring — split the query into words >2 chars, +1 per keyword found, +2 for a title hit, +5 if it's a "schedule" intent on tasks/calendar. Return top 15.
- **Grounding:** the `ask` system prompt is already solid — *"answer using ONLY the context… never make up information… if the context doesn't contain enough, say so honestly."*
- **Citations:** context is numbered `[1] (source) …` internally, but the API returns only the unique source **types** (e.g. `["people","tasks"]`) — not the specific items, and there are no links back to originals.
- **Embeddings:** `ollamaEmbed()` (nomic-embed-text) and `cosineSimilarity()` exist in `app/src/lib/ollama.ts`, and a `vector_id` column exists in `db.ts` — but **none of it is wired into retrieval**. The semantic path is scaffolded and unused.
- **Eval:** none.

## Gap analysis

| Pillar | Target | Today | Gap |
| --- | --- | --- | --- |
| **1. Retrieval** | Hybrid: semantic (embeddings) + structured (time/person) filters, persisted vectors, re-rank | Keyword overlap only; rebuilds everything in-memory each call; arbitrary `LIMIT`s | **Large** — biggest lever. Pieces exist (`ollamaEmbed`, `cosineSimilarity`) but unused; no vector store, no time/entity parsing, no recency. |
| **2. Grounding** | Strict, forced citations, enforced "I don't know" | Strong system prompt already in place | **Small** — closest to done. Add forced per-claim citation + a light verification pass. |
| **3. Provenance** | Inline `[n]` → clickable source cards to the original item | Returns source *types* only; no items, no links, no UI | **Large** — the trust feature is essentially absent in the output. |
| **4. Eval** | 30–50 question→expected-source set; track recall + faithfulness | None | **Total** — nothing to measure quality with. |

One correctness landmine worth flagging: the `LIMIT 400 / 200 / 150` caps mean that past those limits, data is **silently invisible** to the answer. Recall is capped by row order, not relevance. That has to go when we move to a real index.

## Target architecture (the build)

**1. Hybrid retrieval — most of the effort goes here.**
- Persist embeddings instead of recomputing context every call: embed each life item once (on ingest/update) with `nomic-embed-text` via the existing `ollamaEmbed()`, store vectors in **`sqlite-vec`** inside the same SQLite file (stays 100% local, one store, on-brand). Wire up the existing `vector_id` column.
- Add **structured pre-filters** for the dimensions personal data actually turns on: parse the query for **time ranges** ("last week", "in March") and **entities/people** ("Sarah"), filter the candidate set first, then rank.
- Combine semantic + keyword scores and **re-rank** to the top ~8. Bias toward **recency** where the query implies it ("last time…").
- Carry structured metadata on every chunk: `{id, source, sourceId, date, people[], type}` — needed for both filtering and citations.

**2. Grounding — finish the last 20%.**
- Keep the strong prompt; add: *"Cite the source number for every claim. If you cannot cite it, do not state it. If the answer isn't in the sources, say 'I couldn't find that.'"*
- Optional cheap verification pass: confirm each cited number maps to a retrieved chunk; drop uncited sentences.

**3. Provenance — build the trust UI.**
- Thread `sourceId` end to end so the API returns the **actual items** used (note, event, person), not just source types.
- Render inline `[1][2]` markers that map to **source cards**; each card links to the original record. "Answer based on these N items," verifiable at a glance.
- Make "I couldn't find that" a first-class, graceful state.

**4. Eval harness — the thing that makes it reliably good.**
- Build a fixture dataset: 30–50 real questions, each tagged with the item(s) that *should* answer it.
- Track two numbers on every change: **retrieval recall** (did the right item get fetched?) and **faithfulness** (is every claim backed by a cited source, zero invention?).
- A `npm run eval` script that prints both. Iterate retrieval until recall is high; iterate prompt until faithfulness is ~100%.

## Build sequence

1. **Eval harness first** (small) — so every later change is measured, not guessed.
2. **Persisted embeddings + `sqlite-vec`** — embed on ingest, store vectors, replace the in-memory rebuild.
3. **Hybrid retrieval** — semantic + time/entity filters + re-rank; kill the `LIMIT` caps.
4. **Provenance plumbing + UI** — return real items, render clickable source cards.
5. **Grounding hardening** — forced citations, verification pass.
6. Re-run eval; tune until the numbers clear the bar.

## Honest risks

- **Retrieval is the hard 80%.** Semantic + structured + recency is fiddly to balance; budget accordingly.
- **Local embedding cost on large libraries** — embed incrementally on ingest, not all-at-once per query.
- **Trust is binary.** One confident wrong answer about someone's own life loses them. Citations + "I don't know" aren't polish; they're the product.
- **Don't skip the eval set** — it's the unglamorous difference between "worked in the demo" and "reliably correct."
