# Rudder — Ingest Strategy

> The grand vision for ingestion, and the connector roadmap. Pairs with `INGEST_TECHSPEC.md`. Last set: May 2026.

## Thesis

**Ingestion is the moat.** Rudder wins by making your entire life effortless to bring in and keep current — so the "empty database" problem that kills every personal-AI tool simply never happens.

Retrieval is commoditized; everyone can do RAG now. What nobody has solved cleanly is getting a *whole person's life* in — effortlessly, continuously, and sovereignly. Rewind proved the lesson (their whole moat was effortless capture, and they were acquired for it) and then abandoned the sovereign part when Meta bought them. Rudder generalizes effortless capture beyond screen/audio to *everything*, and keeps every byte local.

Bluntly: most competitors are a great answer engine on an empty or shallow store. Rudder's bet is to be the best at **filling — and continuously refreshing — a sovereign store of your real life.** Win ingestion and you win the category.

## Principles

1. **One universal pipeline, many sources.** `source → normalize → enrich (chunk, dates, entities, links, stable IDs) → embed → index`, with incremental sync. The enrich layer is source-agnostic, so every new connector inherits world-class chunking + metadata for free.
2. **Connect once, forget forever.** After setup the user never thinks about ingestion again — change-detection, background watch, scheduled re-sync. Memory accumulates on its own.
3. **Sovereign, always.** Every byte parsed, embedded, and stored locally. The pipeline never phones home. (The exact promise Rewind gave up.)
4. **Quality compounds.** Shared enrich + an eval loop mean every fix raises recall for *all* sources at once.
5. **Connectors are the community surface.** An extensible connector registry gives breadth without a solo-maintainer burden — and every new connector makes the memory more complete and the product stickier.

## The three tiers of effort-removal

- **Tier 1 — Pull connectors (here now).** Folders, calendar, health, contacts, email. Connect once, auto-sync.
- **Tier 2 — Drop / push.** Drag in anything — files, a pasted blob, a screenshot, a share-sheet hand-off — parsed and indexed.
- **Tier 3 — Passive capture (the Rewind frontier).** Meetings/audio, optionally screen and location, captured with zero user action. Most magical; needs a native helper.

## Connector roadmap

Ordered by value ÷ effort, front-loading breadth and the entity/temporal backbone.

| # | Connector | Why | Effort | Status |
| --- | --- | --- | --- | --- |
| 1 | **Markdown / Obsidian** | Biggest PKM format; validates the engine | Low | ✅ Done |
| 2 | **Universal drop (files)** — PDF, docx, txt, html, image-OCR | Instant broad coverage; "throw anything at it"; great demo | Med | ✅ Done — text formats zero-dep; pdf/docx/OCR via optional libs |
| 3 | **Calendar** (ICS export → CalDAV/Google) | High-value temporal data; powers "what's this week" | Med | ✅ Done — .ics export (file/folder), zero-dep; live CalDAV/Google sync TBD |
| 4 | **Contacts** (vCard / macOS Contacts) | Entity backbone for people-aware recall | Low–Med | ✅ Done — .vcf export (file/folder), zero-dep |
| 5 | **Apple Health export** (export.zip XML) | Sovereign quantified-self; differentiator | Med | ✅ Done — streamed export.xml, weekly per-metric summaries + workouts, zero-dep |
| 6 | **Email** (mbox → IMAP) | Huge personal corpus, high value | High (volume/privacy) | — |
| 7 | **Browser history / bookmarks** | What you read and researched | Med | — |
| 8 | **Chat exports** (ChatGPT/Claude) | Your AI conversations as memory | Low | — |
| 9 | **Passive audio / meetings** (native helper + Whisper) | The Rewind frontier; effortless capture | High (native) | — |

Rationale: Markdown is done. The **universal drop** connector is next because it unlocks the widest range of "ingest my X" in one build and demos beautifully. Then **calendar + contacts** lay the temporal + entity backbone that makes recall feel like it truly knows you. **Health** is the sovereign differentiator. **Email** is huge but heavy (volume + privacy), so it comes after the engine is proven at scale. **Passive capture** is the headline-grabbing frontier but wants a separate native agent — deliberately last so it lands on a hardened core.

## Success metrics

- **Time-to-first-recall:** minutes from install to a useful answer over your own data.
- **Effort after setup:** ~zero (auto-sync; re-runs skip unchanged).
- **Breadth:** number of source types a user can bring in.
- **Recall quality:** measured continuously by the eval harness, per connector.
- **Sovereignty:** 100% local, always — a hard invariant, not a metric.
