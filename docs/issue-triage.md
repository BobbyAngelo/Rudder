# Issue Triage — 2026-06-30

Audit of the 14 open issues against the current `main`. **All 14 are
implemented.** Below is the status table, followed by ready-to-paste closing
comments. Issues #1–#12 are unambiguously done; **#13 and #14 are worth a quick
manual smoke-test before closing** (run the app and try the flow).

| # | Title | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Connector: ChatGPT export | ✅ Done | `app/src/lib/ingest/chatgpt.ts`, `scripts/importers/import-chatgpt.ts` (commit `b392c61`) |
| 2 | Connector: Claude export | ✅ Done | `app/src/lib/ingest/claude.ts`, `import-claude.ts` (`b392c61`) |
| 3 | Connector: Browser history (read-only) | ✅ Done | `app/src/lib/ingest/browser-history.ts`, `import-browser.ts` |
| 4 | Connector: Bookmarks (Netscape HTML) | ✅ Done | `app/src/lib/ingest/bookmarks.ts` + sync-daemon watcher (`c7698c8`) |
| 5 | Connector: Generic tasks / Todoist | ✅ Done | `todoist.ts`, `tasks-backup.ts` + external-id migration (`e9e00d0`) |
| 6 | Connector: Read-later (Pocket/Instapaper) | ✅ Done | `read-later.ts` + folder watcher (`80a9c83`) |
| 7 | setup.sh: `--help` and `--check` | ✅ Done | `setup.sh` (help text L30-31, arg parsing L118-127) |
| 8 | CI: type-check + build on every PR | ✅ Done | `.github/workflows/ci.yml` (push + PR: lint, tests, type-check, build) |
| 9 | Tests: unit-test the retrieval ranker | ✅ Done | `app/src/lib/rag.test.ts` (5 tests over `retrieveChunks`) |
| 10 | Connectors UI: surface sync errors | ✅ Done | `error_message` migration + sync-daemon status + settings badges (`6db61b5`) |
| 11 | Docs: data export mini-guides | ✅ Done | `docs/export-guides.md` |
| 12 | Docs: README screenshots | ✅ Done | README screenshots gallery (`a2f16e2`) |
| 13 | Act loop: draft-email with confirm-before-act | ✅ Done | Inbox draft → review → explicit **inline confirm** → Send; guarded by `send/route.test.ts` |
| 14 | Optional parsers: auto-detect + install prompt | ✅ Done | `parse.ts` lazy import + `installCommand`; surfaced in settings; `optionalDependencies`; covered by `parse.test.ts` |

---

## Ready-to-paste closing comments

**#1 — ChatGPT export**
> Implemented. Parser at `app/src/lib/ingest/chatgpt.ts` handles `conversations.json`, with the importer `scripts/importers/import-chatgpt.ts` and sync-daemon integration (`b392c61`). Export steps documented in `docs/export-guides.md`. Closing as done.

**#2 — Claude export**
> Implemented. Parser at `app/src/lib/ingest/claude.ts` + importer `scripts/importers/import-claude.ts` (`b392c61`). Documented in `docs/export-guides.md`. Closing as done.

**#3 — Browser history (read-only)**
> Implemented. Read-only history parser at `app/src/lib/ingest/browser-history.ts` + importer `scripts/importers/import-browser.ts`. Closing as done.

**#4 — Bookmarks (Netscape HTML)**
> Implemented. Netscape-bookmark parser at `app/src/lib/ingest/bookmarks.ts`, wired into the sync-daemon folder watcher (`c7698c8`). Closing as done.

**#5 — Generic tasks / Todoist**
> Implemented. Todoist CSV + generic tasks-backup parsers (`todoist.ts`, `tasks-backup.ts`) with an external-id migration and sync-daemon integration (`e9e00d0`). Documented in `docs/export-guides.md`. Closing as done.

**#6 — Read-later (Pocket / Instapaper)**
> Implemented. Pocket-HTML and Instapaper-CSV parsers at `app/src/lib/ingest/read-later.ts`, integrated into the sync-daemon folder watcher (`80a9c83`). Closing as done.

**#7 — setup.sh `--help` / `--check`**
> Implemented. `setup.sh` now supports `-h/--help` (usage text) and `-c/--check` (dry-run prerequisite verification without modifying anything). Closing as done.

**#8 — CI: type-check + build on every PR**
> Implemented. `.github/workflows/ci.yml` runs on every push and PR to `main` and now goes beyond the original ask: **lint → unit tests → `tsc --noEmit` → `next build`**, with lint/type-check as hard gates. Closing as done.

**#9 — Unit-test the retrieval ranker**
> Implemented. `app/src/lib/rag.test.ts` covers `retrieveChunks` with 5 cases: keyword matching, lexical title-match boost, schedule-intent boost, top-N limiting, and zero-match handling. Runs in CI via `npm test`. Closing as done.

**#10 — Connectors UI: surface sync errors**
> Implemented. Added an `error_message` column migration, sync-daemon try/catch status updates, and warning badges on the Settings → Integrations cards (`6db61b5`). Closing as done.

**#11 — Docs: data export mini-guides**
> Implemented. `docs/export-guides.md` covers exporting from Apple Health, Google/Apple Calendar & Contacts, LinkedIn, Outlook, and ChatGPT/Claude. Closing as done.

**#12 — Docs: README screenshots**
> Implemented. A full screenshots gallery was added to the README covering the overlay, telemetry, dashboard, identity, people, health, planner, graph, writing, media, and settings surfaces (`a2f16e2`). Closing as done.

**#13 — Act loop: draft-email with confirm-before-act**
> Implemented as the Sovereign Inbox loop (`d8edc1e`): IMAP sync ingests mail, the local LLM auto-drafts a reply, and the Correspondence widget shows the draft for review. Sending is a **separate, explicit action** — the user clicks "Send Email," which calls `/api/correspondence/send` (drafting and sending are decoupled), satisfying confirm-before-act. Closing after a manual smoke-test of draft → review → send.

**#14 — Optional parsers: auto-detect + friendly install prompt**
> Implemented. `app/src/lib/ingest/parse.ts` lazy-imports `pdf-parse`, `mammoth`, and `tesseract.js`; on `MODULE_NOT_FOUND` it returns a structured `{ missingDependency, installCommand }` instead of crashing, which the Settings → Integrations UI surfaces to the user. The three are also declared as `optionalDependencies` so they install by default. Closing after confirming the prompt renders for a missing parser.
