# Changelog

All notable changes to Rudder are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
date-based pre-1.0 releases.

## [Unreleased]

### Added
- Live **session capture** (early preview): a Capture surface and a thin phone client
  (`/m.html`) to record a meeting/idea/call, pick its type, tag it, and send it to memory.
- **Life Historian** (`/biographer/story`): turns your memory into short, cited stories in
  your own voice.
- **Identity** is now a first-class memory source — your profile, values, and milestones are
  indexed into memory, so Ask and the Life Historian know who you are.

## [0.1.0] — 2026-06-03

First public release — the sovereign, local-first memory layer.

### Added
- **Memory engine** — hybrid retrieval (semantic + lexical + temporal) over `sqlite-vec`;
  one local SQLite store, no outbound calls.
- **Ask** — natural-language questions answered from your own data, **with citations**, fully
  offline.
- **Connectors (5)** — Markdown/Obsidian, universal files (txt/md/html/csv/json/rtf, plus
  pdf/docx/OCR via optional parsers), Calendar (`.ics`), Contacts (`.vcf`), and Apple Health.
- **Universal ingest door** (`/api/ingest`) for pushing notes or audio from your own devices.
- **MCP server** — exposes a `search_memory` tool over stdio for Claude Desktop, Cursor, etc.
- **One-command setup** (`./setup.sh`) that checks tools, pulls models, installs, and seeds a
  sample life.
- Memory browser, Connectors UI, and a standard onboarding flow.

### Security / privacy
- No telemetry, no account, no cloud dependency. The only network call is to your local model
  endpoint. Optional cloud fallback is off unless you set an API key.

[Unreleased]: https://github.com/BobbyAngelo/Rudder/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BobbyAngelo/Rudder/releases/tag/v0.1.0
