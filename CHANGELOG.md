# Changelog

All notable changes to Rudder are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project is pre-1.0.

## [Unreleased]

### Security
- **Session secret hard-fail.** Auth now refuses to run the login gate when `RUDDER_PASSWORD_HASH` is set but `RUDDER_SESSION_SECRET` is missing or still the public default — preventing forgeable session cookies. Secret/auth logic is shared between the Node route and Edge middleware via `lib/session.ts`.
- **Constant-time session comparison.** HMAC signature checks use a timing-safe comparison.
- **Device-token auth for hardware ingest.** `/api/ingest/telemetry` and `/api/ingest/presence` accept an optional `RUDDER_DEVICE_TOKEN` (via `Authorization: Bearer` or `X-Device-Token`); when set, they require it and bypass the session gate so unattended devices can post.
- **No error-message leakage.** All API routes return a generic `Internal server error` and log the real cause server-side (`lib/api-error.ts`); fixed a latent calendar boolean-bind crash along the way.

### Added
- **Typed data-access layer (`app/src/lib/db/`).** 13 repositories (`people`, `tasks`, `calendar`, `health`, `habits`, `career`, `identity`, `settings`, `writing`, `correspondence`, `harness`, `media`, plus shared `types`). Every API route is now a thin handler delegating to a repository; dynamic `UPDATE`s are built from fixed column allowlists, never request keys.
- **Structured logger (`lib/logger.ts`).** Leveled, `LOG_LEVEL`-gated, isomorphic; replaced ~115 raw `console.*` calls across server code.
- **RAG corpus cache.** `buildContextChunks()` is memoized with a TTL (`RAG_CACHE_TTL_MS`, default 30s) instead of rebuilding on every `/ask` and `/chat`, with explicit invalidation on ingest.
- **Repository + route tests.** `node:test` suites for the `people`/`tasks`/`calendar`/`health` repos and the telemetry route (validation, biometric promotion, metric aliases, device-token gate). DB-backed tests use an isolated database via the new `RUDDER_DATA_DIR` override.
- **Hardware telemetry kit.** Reference firmware for ESP32 (Arduino) and ESP32/Pico W (MicroPython) in `firmware/`, a hardware-free simulator (`npm run simulate:telemetry`), and updated in-app code snippets that include the device-token header.
- **CI.** GitHub Actions now runs lint → tests → type-check → production build; lint is a hard gate.

### Changed
- **Atomic migrations.** Each migration applies its schema change and its tracking row in a single transaction (rolls back cleanly on failure); the idempotency check is narrowed to genuine "already exists" cases.
- **Config honored consistently.** `ai.ts` and `status` route use `OLLAMA_URL` / `LOCAL_LLM_URL` instead of hardcoded localhost; `presence_telemetry` moved from per-request DDL into the migration system.
- **Codebase is `any`-free and lint-clean** across API routes, repositories, daemons, and React components (down from 602 lint errors / 277 `any`).

### Removed
- Unused `Editor.tsx` component and the unused `deviceTokenConfigured()` helper.
- Unused dependencies: `@google/generative-ai`, `framer-motion`, `openai` (the SDKs were never imported; cloud calls use raw `fetch`).

### Fixed
- Declared the dynamically-imported document parsers (`mammoth`, `pdf-parse`, `tesseract.js`) as `optionalDependencies`, clearing the build's "module not found" warnings.

### Docs
- Reframed `docs/value-proposition.md` around the open-source, for-the-people ethos (sustainability over monetization).
- Documented all runtime env vars in `app/.env.example`; added Development & Testing and data-access sections to the README; updated the roadmap's hardware-telemetry status.
