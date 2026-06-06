<div align="center">

# Rudder

### The private memory & agent layer for your local AI.

**Point it at your life. Ask it anything. Let it act. 100% on your own hardware.**

[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950.svg)](./LICENSE)
[![CI](https://github.com/BobbyAngelo/Rudder/actions/workflows/ci.yml/badge.svg)](https://github.com/BobbyAngelo/Rudder/actions/workflows/ci.yml)
![Local-first](https://img.shields.io/badge/local--first-100%25%20offline-34d399)
![Stack](https://img.shields.io/badge/Next.js%20·%20TypeScript%20·%20sqlite--vec%20·%20Ollama-18181b)

[Quick start](#quick-start) · [What you can ingest](#what-you-can-ingest) · [Use it from Claude or Cursor](#use-it-from-your-existing-ai-mcp) · [How it works](#how-it-works) · [Contributing](#contributing)

<!-- TODO(demo): drop the 60–90s hero-loop GIF here — it's the single highest-leverage asset.
     Record from a clean install with demo:seed data, airplane mode on. Save to docs/demo.gif -->
<!-- ![Rudder in action](docs/demo.gif) -->

</div>

---

Everyone else's "AI that knows you" uploads your life to their servers. In the last year, two of the biggest always-on memory products — **Limitless** and **Bee** — were quietly acquired by **Meta** and **Amazon**, their users' most intimate recordings absorbed overnight (one product was bricked within two weeks). Rudder is the opposite bet.

**Rudder remembers your whole life on plain files you own, and runs on your own machine — so it can't be leaked, bricked, or bought.** It gives any local LLM a private, persistent understanding of *you* — your notes, calendar, health, the people in your life, your history — answers with citations, turns it into your story, and acts on it with a human gate. Fully offline. No cloud, no data mining, no account. Yours.

## The loop

Point Rudder at your notes, calendar, contacts, email, and exports. Then:

- **Ask** anything only a system that knows your whole life could answer — *"What should I prep for tomorrow?"* — and get an answer **with sources**, airplane mode on.
- **Act** on it: Rudder's Desk surfaces what matters (a day from a past year, a friend gone quiet, an open loop), drafts the reply in your voice, and offers to put dated commitments on your calendar — **nothing happens without your confirm**.
- **Own** it: every source becomes plain Markdown in a vault you can open in Obsidian, and Rudder compiles a personal **wiki** of the people and places in your life — drawing it as a graph.
- **Tell** it: the **Life Historian** turns your timeline into cited, voiced story — chapters and a whole book, grounded in what really happened, never invented.

> **What ships today, all fully offline:** ingest → ask → cited answer, **plus** the act loop (surface · draft · schedule, with confirm-before-act), the files-first vault, the people/topic wiki, and the Life Historian. Always-on capture hardware is the active frontier — see [Capture](#what-you-can-ingest).

## Why Rudder

- **Sovereign structurally — not as a promise.** Your raw memory is plain Markdown files you own (Obsidian-compatible); SQLite is only a rebuildable index. Nothing phones home. There's no server, and no company, to trust — and nothing to acquire out from under you.
- **Grounded, with receipts.** Every answer, every story scene, every nudge cites the real source it came from. No hallucinated facts about your own life.
- **It acts, with a human gate.** Beyond recall: the Desk drafts, schedules, and surfaces — and never sends or writes anything without your explicit confirm.
- **Your whole life, not one silo — and your story.** Notes, calendar, contacts, health, email, and your social/Google exports flow into one memory; the Life Historian turns it into a book.
- **Bring your own model.** Ollama, LM Studio, or any OpenAI-compatible endpoint. Swap models freely; your memory stays put.

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org) 20+ and [Ollama](https://ollama.com) (for fully local AI).

**One command** — checks your tools, pulls the models, installs, and seeds a sample life:

```bash
git clone https://github.com/BobbyAngelo/Rudder.git
cd Rudder
./setup.sh
npm --prefix app run dev
```

<details>
<summary>Or run the steps manually</summary>

```bash
# 1. Pull a local embedding model (required) and a chat model
ollama pull nomic-embed-text
ollama pull llama3.2

# 2. Install and seed a sample life so the demo works on a clean install
git clone https://github.com/BobbyAngelo/Rudder.git
cd Rudder/app
npm install
npm run demo:seed

# 3. Run it
npm run dev
```

</details>

Open **[http://localhost:3000](http://localhost:3000)**, ask a question in **Ask Rudder**, then connect your own data under **Settings → Connectors**.

> No Ollama? Rudder can fall back to a cloud model (set `GEMINI_API_KEY`), but the whole point is local — we recommend Ollama. See [Configuration](#configuration).

## What you can ingest

Connect a source once; Rudder indexes it into local memory and re-syncs only what changed. Every connector reuses one enrichment pipeline (chunking, dates, entities, stable IDs), so each new source inherits good retrieval for free.

| Source | What it brings | Status |
| --- | --- | --- |
| **Markdown / Obsidian** | Your notes and PKM vault | ✅ |
| **Files (universal)** | Drop a folder of `txt, md, html, csv, json, rtf` — plus `pdf, docx, images (OCR)` with optional parsers | ✅ |
| **Calendar (.ics)** | Events with dates + attendees — powers "what's this week" | ✅ |
| **Contacts (.vcf)** | The people backbone for "who do I know at…" | ✅ |
| **Apple Health** | Weekly metric summaries + workouts — sovereign quantified-self | ✅ |
| **Email (.mbox)** | Gmail Takeout / Apple Mail / Thunderbird — your correspondence | ✅ |
| **LinkedIn export** | Roles, education, skills — your professional history | ✅ |
| **Meta (FB/IG) export** | Posts, comments, message threads | ✅ |
| **X / Twitter archive** | Your tweets and DMs | ✅ |
| **Google Takeout** | Activity, YouTube, Chrome history → one entry per day | ✅ |
| Browser history · chat exports · passive capture | The rest of your life | 🔜 |

All external sources are **export-based and sovereign** — you download your own data from the source and Rudder parses it locally. No scraping, no relay, no third-party account.

You can also **drag any file** straight onto the Connectors page for a one-off capture, or POST to the local `/api/ingest` door from your own devices.

> **Capturing live sessions — early preview.** There's also a **Capture** tab (and a
> thin phone client at `/m.html`) for recording a moment of life — a meeting, an idea, a
> call — picking its type, tagging it, and sending it to memory, the same way Apple Health
> starts a workout. It works today on the laptop and (typed) on the phone; the session
> protocol and the small capture devices that speak it are still taking shape. Treat it as
> a preview of where Rudder is going, not a finished surface.

## Use it from your existing AI (MCP)

Rudder ships an [MCP](https://modelcontextprotocol.io) server, so you can give the AI you *already* use — Claude Desktop, Cursor, any MCP client — a private memory of your life, locally.

```bash
cd app && npm run mcp
```

It exposes a `search_memory` tool over stdio. Full client wiring is in [`MCP_SETUP.md`](./MCP_SETUP.md).

## How it works

```text
source ─▶ enrich ─▶ embed ─▶ sqlite-vec ─▶ recall ─▶ grounded answer
(connector) (chunk,    (local    (KNN over    (hybrid     (+ citations)
            dates,     model)    your store)  re-rank)
            entities)
```

Everything runs on your machine: a connector lists documents, the shared **enrich** layer turns them into well-formed chunks with dates and entities, a **local** model embeds them, and they're stored alongside everything else in one SQLite file (vectors via [`sqlite-vec`](https://github.com/asg017/sqlite-vec)). At question time, Rudder embeds your query, pulls nearest neighbors, re-ranks with a hybrid **semantic + lexical + temporal** scorer, and hands the top sources to your local model to answer — with citations back to the originals.

```text
rudder/
├── app/                     ← Next.js application
│   ├── src/lib/
│   │   ├── ingest/          ← connectors + enrich pipeline
│   │   ├── memory.ts        ← index / recall / prune
│   │   ├── retrieval.ts     ← hybrid ranker (pure, testable)
│   │   └── vectorStore.ts   ← sqlite-vec KNN
│   ├── src/app/api/         ← ask · memory · connectors · ingest
│   └── scripts/mcp-server.ts
└── data/                    ← your local SQLite store (git-ignored)
```

## Configuration

Rudder runs with zero config for the local path. Optional settings (set in `app/.env.local`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `OLLAMA_URL` | Local model endpoint | `http://localhost:11434` |
| `GEMINI_API_KEY` | Cloud fallback when local is unreachable | — (off) |
| `OPENAI_API_KEY` | Use an OpenAI-compatible endpoint | — (off) |
| `RUDDER_DATA_DIR` | Where the SQLite store lives | `../data` |
| `RUDDER_INGEST_TOKEN` | Require a token on the `/api/ingest` door | — (open locally) |
| `WHISPER_URL` | Local speech-to-text for audio capture | `http://localhost:8080/inference` |

## Sovereignty & privacy

Rudder is built so there is nothing to trust. Your data is parsed, embedded, and stored **only** on your machine; the ingest pipeline never makes an outbound call. The single network dependency is your *local* model endpoint (Ollama, on `localhost`). If you set a cloud fallback key, that — and only that — leaves the box, by your explicit choice. "Acts on your life" is gated behind confirm-before-act.

## Contributing

Connectors are the community surface: adding a new source is one entry in the registry plus a `list(config) → documents` function — the enrich, embed, index, and prune machinery is shared. If you can parse a file or hit an API, you can add a memory source.

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — setup, project shape, conventions, PR checklist.
- **[Good first issues](https://github.com/BobbyAngelo/Rudder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** — the easiest places to start (new connectors mostly).
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** · **[Security policy](./SECURITY.md)**
- Have an idea or a question? Open an [issue](https://github.com/BobbyAngelo/Rudder/issues).

## License

[MIT](./LICENSE) © 2026 Robert Angelo. Use it, fork it, build on it.
