# Rudder — Ingest Engine Tech Spec

> Engineering spec for the ingestion pipeline. Pairs with `INGEST_STRATEGY.md`. Describes what exists today and the path to the connector roadmap. Status tags: ✅ built · 🔧 partial · 📋 planned.

## 1. Architecture

```
 Connector            Enrich (shared)              Memory store
 ─────────            ───────────────              ────────────
 source ──list()──▶ RawDoc[] ──toChunks()──▶ Chunk[] ──indexChunks()──▶ chunk_index (metadata + vector JSON)
                                                          │                vec_chunks  (sqlite-vec KNN index)
                                                          └─ incremental: hash skip / prune
                                                                                  ▲
 question ──embed──▶ knn() candidates ──load──▶ retrieveHybrid() re-rank ──▶ recall() → { answer sources }
```

Components (all under `app/src/lib`):
- `ingest/enrich.ts` ✅ — source-agnostic chunking + metadata extraction.
- `ingest/markdown.ts` ✅ — first connector (folder → `RawDoc[]`).
- `connectors.ts` ✅ — connector registry + add/list/sync/remove + sync orchestration.
- `memory.ts` ✅ — `indexChunks` (incremental embed/upsert) + `recall`.
- `vectorStore.ts` ✅ — sqlite-vec load / table / upsert / KNN.
- `retrieval.ts` ✅ — pure hybrid scorer (semantic + lexical + temporal + source).
- API: `/api/connectors` ✅, `/api/ask` ✅. UI: `settings/connectors` ✅.

Design invariants: **100% local** (parse, embed, store all on-device); **one universal pipeline** (connectors only produce `RawDoc[]`; everything downstream is shared); **incremental** (re-sync only touches changes).

## 2. Data model

```sql
-- metadata + the embedding (as JSON, for re-ranking) for each chunk
chunk_index(chunk_id PK, source, title, content, date, source_id, vector TEXT, hash TEXT)
-- sqlite-vec ANN index for fast candidate generation
vec_chunks USING vec0(chunk_id TEXT PRIMARY KEY, embedding float[768])
-- configured sources
connectors(id PK, type, path, label, last_sync, chunk_count, status, created_at, UNIQUE(type,path))
```

`Chunk` (`retrieval.ts`): `{ source, title, content, id?, sourceId?, date?, people?[], vector? }`.
`RawDoc` (`enrich.ts`): `{ source, sourceId, title, body, date?, people?[], link? }`.

> Note: vectors are stored twice — in `vec_chunks` (for KNN) and as JSON in `chunk_index` (so `recall` can re-score candidates with `retrieveHybrid` without reading them back out of vec0). Acceptable duplication; revisit if storage matters.

## 3. The Connector contract

Today `connectors.ts` uses a folder-only registry: `Record<type, (path) => Chunk[]>`. That must generalize, because not every source is a local folder (calendar = CalDAV/OAuth, email = IMAP, health = an export file). Target interface:

```ts
interface Connector<Config = Record<string, unknown>> {
  type: string;                       // "markdown" | "calendar" | "files" | ...
  label: string;
  config: ConfigField[];              // what the Settings UI collects (path | file | oauth | url)
  list(config: Config): Promise<RawDoc[]>;   // the ONLY connector-specific code
}
```

Everything after `list()` — enrich, embed, index, prune — is shared. A connector is "done" when it can turn its source into well-formed `RawDoc[]`. Registry becomes `Record<string, Connector>`; the UI renders `config` fields generically.

📋 Migration: keep markdown working, wrap it as a `Connector`, move the registry to the interface, generalize the Settings form beyond a single path input.

## 4. Enrich rules (`enrich.ts`) ✅

- **Chunking:** split on Markdown headings → sections; pack paragraphs to ≤ `MAX_CHARS` (1200); hard-split any oversize remainder at whitespace. Guarantees bounded chunks (validated: a 9k-char blob → 8 chunks ≤1199).
- **Dates:** first ISO (`YYYY-MM-DD`) or "Month DD, YYYY" in frontmatter/body, normalized to ISO. Doc-level date propagates to sections.
- **Entities/people:** frontmatter `people`/`tags` + Obsidian `[[wikilinks]]` + `@mentions`, unioned per chunk.
- **IDs:** `${source}:${sourceId}#${i}` — deterministic, so re-ingest maps to the same rows.
- 📋 Roadmap: pluggable enrichers (per-source date/entity rules), optional local NER for plain prose, language detection.

## 5. Incremental sync, deletion & lifecycle

- **Change detection** ✅: `chunkHash = sha1(title + content + date)`. `indexChunks` skips chunks whose stored hash matches (no re-embed). Returns `{ indexed, skipped }`.

- **Deletion / pruning** 📋 **(spec — adopt Rewind's purge-table pattern).** Rewind handled deletes by *enqueueing* them in a `purge` table (one row per stale frame/chunk) and letting an async job remove the referenced rows across every store. We do the same, generalized to connector ownership:
  1. Add `connector_id` to `chunk_index` so every chunk is owned by exactly one connector.
  2. On each sync, the connector yields the current set of `chunk_id`s. Diff against the stored set **for that `connector_id`**; the difference is stale.
  3. Enqueue stale ids into a `purge_queue(chunk_id, enqueued_at)` table, then delete from **both** `chunk_index` and `vec_chunks` (a delete that misses vec0 leaves orphan vectors). Async/batched so a large prune never blocks a sync.
  4. Removing a connector purges all of its chunks the same way.

- **Re-embed on model change** 📋: persist the embedding model + dim (a `meta` row); if either changes, force a full re-embed — vectors aren't comparable across models.

- **Retention** 📋: per-connector optional retention window (Rewind's default was "forever," but it was a first-class setting). Chunks older than the window are purged via the same queue.

## 5.1 Privacy & exclusions (capture/ingest-time)

Rewind earned its trust by excluding sensitive data **at capture time, not after** (app/site exclusion lists, auto-skip private/incognito windows, redaction, instant pause). Microsoft Recall shipped the same idea with weak exclusions + unencrypted storage and got hammered — the cautionary opposite. We apply the lesson to connectors:

- **Per-connector exclude rules** 📋: glob/path excludes for folders (already skip `node_modules`/dot-dirs); sender/label filters for email; date-range limits for any source. Excludes apply *before* embedding, so excluded data never enters the store.
- **Global pause** 📋: a switch that halts all syncs.
- **Sensitive sources are opt-in** 📋: email/health require explicit enable.
- **Local-only is an invariant**, not a setting — no exclusion logic is needed for "don't upload," because nothing ever uploads.

## 6. Sync orchestration

- **Manual** ✅: Settings → Connectors "Connect" / re-sync; `/api/connectors` `action: add|sync|remove`; CLI `npm run ingest:md`.
- **Scheduled** 📋: a periodic re-sync (cron-like) per connector.
- **File-watch** 📋: for folder connectors, watch for changes and re-sync the touched files only (true "set and forget").
- **Concurrency** 📋: serialize syncs per connector; a global lock so two syncs don't race the same DB writes.

## 7. Per-connector technical approach

| Connector | Source → RawDoc approach | Key deps / notes |
| --- | --- | --- |
| Markdown ✅ | walk folder, parse frontmatter, body → sections | fs only; skips `node_modules`/dot-dirs |
| Universal drop 📋 | per-type parser: PDF→text, docx→text, html→readability, image→OCR, csv→rows | pdf-parse/pdfjs, mammoth, local OCR (tesseract). Drop-zone UI + `/api/ingest/file` |
| Calendar 📋 | parse `.ics` first; then CalDAV/Google OAuth | ical parser; each event = RawDoc with `date`, attendees→people |
| Contacts 📋 | vCard parse (or macOS Contacts export) | each contact = RawDoc; seeds the entity vocabulary for `people` |
| Apple Health 📋 | parse `export.zip` → `export.xml` | stream-parse (large); summarize per metric/day, not per sample |
| Email 📋 | mbox first, then IMAP | volume + PII; allow date/sender filters; thread = RawDoc |
| Browser 📋 | read history SQLite / bookmarks export | local file read; URL+title+visit time |
| Chat exports 📋 | parse ChatGPT/Claude JSON exports | each conversation = RawDoc |
| Passive audio 📋 | native helper captures mic/system audio → Whisper transcribe → RawDoc | separate desktop agent + local Whisper; feeds via local API |

## 8. Error handling & resilience

- **Oversized input** ✅: hard-split in enrich + 6000-char truncation safety net at the embed call.
- **Per-item isolation** 📋: a single bad file/event shouldn't abort a whole sync — catch per-RawDoc, record failures, continue.
- **Ollama down** 🔧: surfaced as an error in `/api/ask`; sync should report a clear "embedding model unreachable" and leave prior state intact.
- **Large libraries** 📋: batch embeds, show progress, make sync resumable (hash skip already makes re-runs cheap).

## 9. Testing & eval

- **Recall eval** ✅ (`npm run eval`): fixture corpus + question→expected-source, reports recall@k; guards regressions.
- **Store smoke** ✅ (`npm run recall:store`), **vec smoke** ✅ (`npm run vec:smoke`).
- 📋 Per-connector fixtures: a tiny sample input per connector + expected chunk/metadata assertions (e.g., a sample `.ics` → N event chunks with correct dates).
- 📋 Enrich unit tests: chunk-size bound, date parsing, entity extraction (already validated ad hoc).

## 10. Prior art — how Rewind/Limitless handled these

Rewind/Limitless ran the closest analogue at scale (passive screen+audio capture). They're a *capture* product, not connector-based, so the mapping isn't 1:1 — but the patterns transfer, and the meta-lesson is the whole reason they're our case study.

| Decision | How Rewind/Limitless handled it | Our decision |
| --- | --- | --- |
| Deletion | `purge` table: enqueue deletes, async-remove rows + chunk files across every store | Adopt it (§5) — purge queue, delete from `chunk_index` **and** `vec_chunks`, owned by `connector_id` |
| Sensitive / PII | Exclude apps/sites *at capture time*, auto-skip private browsing, redaction, pause. (Microsoft Recall did this badly → backlash) | Capture-time exclude rules per connector + global pause + opt-in sensitive sources (§5.1) |
| Cross-source dedup | Compression/diffing to avoid near-dup frames; Limitless time-aligned pendant + system audio of the same meeting | Defer; tolerate dups initially, then reconcile by time + participants |
| Retention / storage | Configurable retention (default "forever") + ~3750× compression, SQLite FTS | Per-connector retention window via the purge queue; storage is trivial for text |
| Recall method | SQLite **FTS** + OCR/ASR — largely *lexical* | We're ahead: hybrid semantic + lexical + temporal already |
| Sovereignty | Local-first + AES-256 by default — **then abandoned it** (cloud → Meta acquisition → shelved) | Guarantee it *structurally*: open source, runs on the user's hardware, no owner who can flip it to cloud |

**Meta-lesson:** they got the technical decisions right and won a devoted privacy audience on exactly those choices — then threw the principle away by selling. Copying their tech (purge table, capture-time exclusions, retention) is necessary but not sufficient; the durable advantage is the sovereignty they *couldn't* promise and we can.

## 11. Still-open decisions

- **Cross-source dedup:** dedup by (date + title + people) similarity, or keep both and let recall dedupe? → defer; tolerate duplicates initially.
- **Source namespacing / demo isolation:** demo-seed chunks currently co-mingle with real data → add a `source = "demo"` namespace + a "clear demo data" action.
- **Embedding model:** standardize on `nomic-embed-text` (768d) for now; record model + dim to enable future migration.
- **Chunk size:** 1200 chars is a starting point; tune against the eval once we have real multi-source data.

## 12. Milestones

1. **Generalize the Connector contract** (§3) + add deletion/pruning (§5) + capture-time exclusions (§5.1) — hardens the core for everything else.
2. **Universal drop connector** (§7) — biggest breadth unlock; drop-zone UI + file parsers.
3. **Calendar + Contacts** — temporal + entity backbone.
4. **Scheduled / file-watch sync** (§6) — true "connect once, forget."
5. **Apple Health, Email, Browser, Chat exports** — breadth.
6. **Passive audio capture** (native helper) — the frontier.
