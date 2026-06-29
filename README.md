# Rudder

> A sovereign, local-first personal operating system.

**Rudder** is your private command center for the data of your life — identity, relationships, health, career, writing, knowledge, and media. It runs on your own machine, keeps your data local, and reasons over it with local AI. Your data is owned entirely by you.

See [`VISION.md`](./VISION.md) for the canonical definition of what Rudder is (and is not). The creative/ad-studio engine **FLOW** has been split into its own repository — see [`SPLIT_FLOW.md`](./SPLIT_FLOW.md).

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy the environment template and fill in your values:

```bash
cp app/.env.example app/.env.local
```

### AI Engine (Optional)

Rudder supports a dual AI pipeline:

1. **Local LLM** (primary) — Ollama, Exo, vLLM, or any OpenAI-compatible endpoint
2. **Cloud fallback** — Gemini, when local is unreachable

Set `LOCAL_LLM_URL` and optionally `GEMINI_API_KEY` in your `.env.local`.

On top of inference, Rudder has two intelligence layers (both local-first, both optional):

- **Semantic retrieval** — hybrid embedding + keyword RAG over your data, with embeddings persisted in SQLite.
- **Long-term memory (Mem0)** — learns facts and preferences from conversations, backed by a local Qdrant vector store.

See [`docs/memory-and-retrieval.md`](docs/memory-and-retrieval.md) for setup (Qdrant, embedding model) and configuration.

### Knowledge Export (OKF)

Rudder can export your knowledge as an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) bundle - portable, cross-linked markdown that any other agent or tool can consume. Available from Settings, the `/api/export/okf` endpoint, or `npm run export:okf`. See [`docs/okf-export.md`](docs/okf-export.md). (People and Health data are excluded by design.)

## Data Ingestion

Rudder allows you to ingest personal data archives locally. For step - by - step instructions on how to export your own files from Apple Health, Google/Apple Calendar, Google/Apple Contacts, LinkedIn, Outlook, and chat logs (ChatGPT/Claude), refer to the [Data Export Mini-Guides](docs/export-guides.md).

## Architecture

```text
Rudder/
├── app/                    ← Next.js 16 application
│   ├── src/
│   │   ├── app/            ← Page routes (App Router)
│   │   └── components/     ← Shared UI components
│   └── .env.example        ← Configuration template
├── data/                   ← Runtime data (SQLite, etc.)
├── legacy/                 ← Previous codebase (reference)
└── README.md
```

## Modules

Defined by the registry in `app/src/lib/modules.ts` and grouped as they appear in the sidebar.

| Group | Modules |
| --- | --- |
| **Life & Identity** | Identity, People, Health, Biographer |
| **Operations** | Schedule/Planner (Timeline · Tasks · Board), Knowledge Graph, Career Hub |
| **Creative** | Writing, Notes, Photos, Videos |
| **Infrastructure** | Hardware |

Plus the **Mission Control** dashboard as the home surface.

Out of scope (slated for removal/relocation): the never-built "Money / Business / Properties / Cyrano / Analytics / Wiki" scaffolds, and the orphaned standalone `/calendar`, `/tasks`, `/habits` routes now folded into Planner.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** SQLite (better-sqlite3)
- **AI:** Ollama / Gemini (configurable)
- **Icons:** Lucide React

## Design Principles

1. **Local-first** — Your data stays on your machine
2. **No fake data** — Empty states are honest, never mocked
3. **Sovereign AI** — Local LLM first, cloud only as fallback
4. **Grandpa-proof** — If it needs a tutorial, it's too complex

## License

MIT
