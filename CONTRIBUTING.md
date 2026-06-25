# Contributing to Rudder

Thanks for your interest in Rudder - a sovereign, local-first personal operating system. Before contributing, please read [`VISION.md`](./VISION.md); it defines what Rudder is and is not, and PRs are evaluated against it.

## Getting started

```bash
cd app
cp .env.example .env.local   # fill in your values (all optional for local dev)
npm install
npm run dev                  # http://localhost:3000
npm run test                 # run the test suite
```

Rudder runs fully locally. AI features use a local LLM (Ollama or any OpenAI-compatible endpoint) by default, with an optional cloud fallback - see the README.

## Project shape

- `app/src/app` - page routes (Next.js App Router) and `api/` route handlers
- `app/src/components` - shared UI; reuse `ui.tsx` primitives (`PageHeader`, `Card`, `StatCard`, `Badge`, `EmptyState`)
- `app/src/lib` - `db.ts` (SQLite + migrations), `ai.ts`, `modules.ts` (the module registry)
- `app/src/app/globals.css` - the design system (CSS color tokens)
- `docs/` - documentation guides, including [`docs/export-guides.md`](./docs/export-guides.md)

## Conventions

**Use the design tokens.** Style with the CSS variables in `globals.css` (`var(--color-…)`) and the `ui.tsx` primitives. Do not introduce raw `neutral-*` / `zinc-*` / hex colors in page files - keeping one color vocabulary is what makes Rudder feel unified.

**Adding a module?** Register it in `lib/modules.ts`, add its route under `app/src/app/<id>/`, its API under `app/src/app/api/<id>/`, and any tables as a migration in `db.ts`. It must fit the vision.

**No fake data.** Empty states are honest, never mocked.

**Never commit personal data or secrets.** `data/`, `temp/`, and all `.env*` files are gitignored - keep it that way. Don't add real databases, credentials, or API keys to the repo.

## Pull requests

Keep PRs focused. Run `npm run lint`, ensure `npm run test` passes, and confirm `npm run build` passes before opening. Describe what changed and why, and reference the part of the vision it serves.
