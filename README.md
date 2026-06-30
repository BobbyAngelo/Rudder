# Rudder

> The private memory & agent layer for your local AI. Ingest your life, ask across it with citations — 100% local.

**Your personal data is mined by corporate clouds and fragmented across disconnected offline apps.** We believe you shouldn't have to choose between convenience and total privacy to command your digital memory.

**Rudder** is your sovereign, local-first personal operating system. It unifies your journals, correspondence, calendar, biometrics, and media under a single local retrieval layer—enabling you to query across all personal domains with verified citations, running 100% locally on your own machine.

### The PEACE Framework
*   **Problem:** Your personal data is mined by corporate clouds and fragmented across disconnected offline apps.
*   **Empathy:** We believe you shouldn't have to choose between convenience and total privacy.
*   **Answer:** Rudder unifies all personal domains under one local retrieval and citation layer.
*   **Change:** Go from a passive data source to the sovereign master of your digital memory.
*   **End Result:** Cited answers across your entire digital life—100% local, with zero API or subscription fees.

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
├── app/                       ← Next.js 16 application
│   ├── src/
│   │   ├── app/api/           ← Route handlers (thin: parse → call repo → respond)
│   │   ├── app/               ← Page routes (App Router)
│   │   ├── components/        ← Shared UI components
│   │   └── lib/
│   │       ├── db/            ← Typed data-access layer (one repository per domain)
│   │       ├── logger.ts      ← Leveled structured logger
│   │       └── api-error.ts   ← Safe error responses (no internal leakage)
│   └── .env.example           ← Configuration template
├── firmware/                  ← ESP32 / Pico W telemetry reference firmware
├── scripts/                   ← Importers, MCP, OKF, telemetry simulator
├── data/                      ← Runtime data (SQLite, etc.; gitignored)
└── README.md
```

**Data-access layer.** Every API route is a thin handler that parses the request and delegates to a typed repository under `app/src/lib/db/` (`people`, `tasks`, `calendar`, `health`, etc.). Repositories own all SQL, return typed rows, and build any dynamic `UPDATE` from a fixed column allowlist (never from request keys). The codebase is `any`-free and lint-clean.

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

## Development & Testing

```bash
cd app
npm run dev                  # start the dev server (http://localhost:3000)
npm run build                # production build
npm run lint                 # ESLint (zero-warning gate)
npm test                     # unit + route tests (node:test via tsx)
npm run simulate:telemetry   # post synthetic vitals to the telemetry gate
```

- **Tests** live next to the code as `*.test.ts` and run on `node:test`. Database-backed suites (repositories and the telemetry route) run against an **isolated throwaway SQLite file** via the `RUDDER_DATA_DIR` override, so they never touch your real `data/rudder.db`.
- **CI** (`.github/workflows/ci.yml`) runs lint → tests → type-check → production build on every push and PR. Lint and type-check are hard gates; the project is currently `any`-free and lint-clean.
- **Hardware telemetry** can be exercised end-to-end without a device using `npm run simulate:telemetry` (see [`firmware/README.md`](./firmware/README.md) for the contract, reference ESP32/Pico W firmware, and the device-token setup).

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

**MIT** — Rudder is open source and for the people. Sovereignty isn't a premium tier; the core is free and open forever. See [`docs/value-proposition.md`](docs/value-proposition.md) for the positioning and how the project sustains itself without ever charging the people it serves.
