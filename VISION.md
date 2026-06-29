# Rudder — Vision

> Canonical definition. If any other doc, the app metadata, the README, or the nav disagrees with this file, this file wins. Last set: May 29, 2026.

## What Rudder is

**Rudder is a sovereign, local-first personal operating system: one private command center for your life data — identity, relationships, health, career, writing, knowledge, and media — run on local AI models and owned entirely by you.**

One person. One private dashboard. Your data never leaves hardware you control. The AI that reasons over it runs locally (with optional, explicit cloud fallback). Nothing is mined, leased back, or subject to a platform shutting down.

## What Rudder is NOT

Rudder is **not** a creative agency, an ad studio, or a tool for reverse-engineering Fortune 500 commercials. That was **FLOW**, which has been **removed from Rudder entirely**. Any "luxury creative ingestion," "brand DNA," "taste engine," or "reverse-engineer Fortune 500" language is gone and should never reappear in Rudder.

Rudder is about *your life* — a focused, sovereign personal OS. That focus is what makes it a clean open-source project.

## Principles

**Sovereignty first.** Local-first storage, local models by default, data owned end-to-end by the user. Cloud is opt-in and explicit, never the default.

**One coherent experience.** Every module lives behind one shell, one navigation, one design system. A user should never be able to tell which module is "newer" by its colors or layout. All screens consume the design tokens in `app/src/app/globals.css` and the shared primitives in `components/ui.tsx` — no raw `neutral-*`/`zinc-*`/hex colors in page files.

**Focused scope.** Rudder is the modules below and nothing else. New surface area must earn its place against this definition. "Might be useful someday" is not a reason to ship a module.

## The modules that constitute Rudder

Grouped as they appear in the sidebar:

- **Life & Identity** — Identity, People, Health, Biographer
- **Operations** — Schedule/Planner (Timeline · Tasks · Board), Knowledge Graph, Career Hub
- **Creative** — Writing, Notes, Photos, Videos *(personal creation and capture — distinct from FLOW's commercial creative work)*
- **Infrastructure** — Hardware

Plus the **Mission Control** dashboard as the home surface.

Anything not on this list (the removed FLOW engine; the never-built "Money / Business / Properties / Cyrano / Analytics / Wiki" scaffolds; the orphaned standalone `/calendar`, `/tasks`, `/habits` routes now folded into Planner) is **out of scope** and removed before the open-source release.

## Canonical strings (copy verbatim)

Use these exact phrasings everywhere Rudder describes itself, so metadata, README, and nav all agree:

- **Tagline:** "The private memory & agent layer for your local AI."
- **One-liner:** "Ingest your life, ask across it with citations — 100% local."
- **Metadata description:** "The private memory & agent layer for your local AI. Ingest your life, ask across it with citations — 100% local."

## FLOW (removed)

FLOW — the creative/ad-studio engine — has been cut from Rudder. The open-source Rudder contains no `/flow` route, no `api/flow`, no `taste_library`/`brand_contexts` tables, and no `scan-taste`/`flow-mcp` scripts. See `RELEASE.md` for how it's removed as part of release prep.
