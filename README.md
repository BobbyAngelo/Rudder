# Rudder

> The private memory & agent layer for your local AI. Ingest your life, ask across it with citations — 100% local.

**Your personal data is scattered across the cloud and mined by tech giants.** We believe you shouldn't have to sacrifice convenience to keep your digital life private.

**Rudder** is your sovereign, local-first personal operating system. It runs a private AI helper over your daily files, health stats, emails, and chats, serving as your private, long-term memory companion.

### The PEACE Framework
*   **Problem:** Your personal data is scattered across the cloud and mined by tech giants.
*   **Empathy:** We believe you shouldn't have to choose between convenience and total privacy.
*   **Answer:** Rudder runs a private AI helper over your daily files, health stats, and chats.
*   **Change:** Go from a passive data source to the sovereign master of your digital memory.
*   **End Result:** Never worry about cloud leaks, subscription fees, or losing access to your data again.

### Why Rudder?
*   **100% Local Privacy:** Your data never leaves your physical machine. No API subscriptions, no telemetry, and no corporate locks.
*   **Ambient Voice Assistant HUD:** Trigger a minimal, translucent overlay from anywhere on macOS with a global key shortcut (`Option + Space`) to talk to your local AI context.
*   **Hardware Telemetry Gateway:** Exposes a local HTTP port to register and stream real-time heart rate, steps, or environmental biometrics directly from smartwatches and ESP32 nodes.
*   **Autonomic Rebalancer:** An active feedback loop that analyzes biometric rest indexes (Sleep/HRV) and automatically reschedules cognitive-heavy tasks to protect your focus and prevent burnout.
*   **Universal Ingestion Watchers:** Auto-ingest browser bookmarks, chat history exports (ChatGPT/Claude), contacts, emails (IMAP inbox & SMTP send client), and task backups.

See [`VISION.md`](./VISION.md) for the canonical definition of what Rudder is (and is not). The creative/ad-studio engine **FLOW** has been split into its own repository — see [`SPLIT_FLOW.md`](./SPLIT_FLOW.md).

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Screenshots Gallery

### Ambient Voice Assistant Overlay
![Ambient Voice Assistant Overlay](./docs/screenshots/assistant_overlay.png)

### Hardware Telemetry Gateway Settings
![Hardware Telemetry Gateway](./docs/screenshots/hardware_telemetry_gate.png)

### Mission Control Dashboard & Autonomic Rebalancer
![Mission Control](./docs/screenshots/onboarding.png)

### Life & Identity
| Identity | People & Relationships |
| --- | --- |
| ![Identity](./docs/screenshots/identity.png) | ![People](./docs/screenshots/people.png) |

| Health Ledger | Biographer Ledger |
| --- | --- |
| ![Health](./docs/screenshots/health.png) | ![Biographer](./docs/screenshots/biographer.png) |

### Operations & Planner
| Timeline & Planner | Knowledge Graph | Career Hub |
| --- | --- | --- |
| ![Planner](./docs/screenshots/planner.png) | ![Graph](./docs/screenshots/graph.png) | ![Career](./docs/screenshots/career.png) |

### Creative
| Writing Studio | Media & Chronicles |
| --- | --- |
| ![Writing](./docs/screenshots/writing.png) | ![Media](./docs/screenshots/media.png) |

### Infrastructure
| Hardware Node | Settings & Connections |
| --- | --- |
| ![Hardware](./docs/screenshots/hardware.png) | ![Settings](./docs/screenshots/settings.png) |

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
