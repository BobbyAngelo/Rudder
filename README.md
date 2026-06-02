<div align="center">

# Rudder

### The private memory & agent layer for your local AI.

**Point it at your life. Ask it anything. Let it act. 100% on your own hardware.**

[Quick start](#quick-start) · [What you can ingest](#what-you-can-ingest) · [Use it from Claude or Cursor](#use-it-from-your-existing-ai-mcp) · [How it works](#how-it-works) · [Contributing](#contributing)

<!-- TODO(demo): drop the 60–90s hero-loop GIF here — it's the single highest-leverage asset.
     Record from a clean install with demo:seed data, airplane mode on. Save to docs/demo.gif -->
<!-- ![Rudder in action](docs/demo.gif) -->

</div>

---

Everyone else's "AI that knows you" uploads your life to their servers. **Rudder is the one that knows your whole life without it ever leaving your machine** — and can act on it.

It gives any local LLM a private, persistent understanding of *you* — your notes, calendar, health, the people in your life, your history — and answers from that memory with citations, fully offline. No cloud, no data mining, no account. Yours.

## The hero loop

Point Rudder at a folder of notes, a calendar export, your contacts, an Apple Health export. Then ask your **local** model something only a system that knows your whole life could answer:

> **"What should I prep for tomorrow?"**
>
> → It pulls your calendar, the people in those meetings, your past notes with them, and your recent energy/health — and drafts the prep. With sources. Airplane mode on the whole time.

That single loop — **ingest → ask across your whole life → act, offline** — is the entire product.

> **What's shipped today:** the **ingest → ask → cited-answer** loop runs end-to-end, fully offline, over five source types. The **acting** step (drafting, scheduling, surfacing, with confirm-before-act) is the active next milestone — see [What you can ingest](#what-you-can-ingest) for the connector status and the roadmap.

## Why Rudder

- **Sovereign by default.** Every byte is parsed, embedded, and stored locally in one SQLite file. The pipeline never phones home. There is no server to trust.
- **Your whole life, not one silo.** Notes, calendar, contacts, and health already flow into one memory; more sources land every week. Breadth is the moat.
- **Answers with receipts.** Every response cites the exact items it came from. No hallucinated facts about your own life.
- **Bring your own model.** Ollama, LM Studio, or any OpenAI-compatible endpoint. Swap models freely; your memory stays put.
- **Built to act, not just answer.** The cited-answer loop ships today; the agent loop that drafts, schedules, and surfaces — with confirm-before-act — is the current milestone.

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org) 20+ and [Ollama](https://ollama.com) (for fully local AI).

**One command** — checks your tools, pulls the models, installs, and seeds a sample life:

```bash
git clone https://github.com/<you>/rudder.git
cd rudder
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
git clone https://github.com/<you>/rudder.git
cd rudder/app
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
| Email · browser history · chat exports · passive capture | The rest of your life | 🔜 |

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

Connectors are the community surface: adding a new source is one entry in the registry plus a `list(config) → documents` function — the enrich, embed, index, and prune machinery is shared. If you can parse a file or hit an API, you can add a memory source. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE).
