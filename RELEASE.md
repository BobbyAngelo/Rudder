# Releasing Rudder as Open Source

> Goal: publish Rudder on GitHub as a clean, focused open-source project. Decisions (2026-05-29): publish from a **fresh repo with no history**; license **MIT**; **FLOW removed**.

## ⛔ The one hard gate: do not publish your current git history

Your private repo's history contains **personal data baked into past commits**, which a public clone would carry forever even if you delete the files today:

| File | Size | What it is |
| --- | --- | --- |
| `data/backups/.../health/health-ledger.sqlite` | 179 MB | health records |
| `legacy/ideaverse/health-ledger.sqlite` | 149 MB | health records |
| `data/backups/.../rudder.db` | 63 MB | your full life DB |
| `data/backups/.../media/media-index.sqlite` | 516 MB | media catalog |
| `legacy/agentzero/.../media-index.sqlite` | 141 MB | media catalog |
| `data/backups/.../identity/10d_ledger.db`, `legacy/ideaverse/people.db`, `graph.sqlite`, `data/celf/skills.sqlite` | — | identity / people |

The `.git` directory is **3.7 GB**. `.env.local` was never committed (good), and no hardcoded API keys were found in tracked source — but the databases above are the blocker.

**Therefore: publish from a brand-new repo with no history.** Your private repo stays exactly as it is on your machine; only a clean copy goes public.

## Step-by-step

1. **Clear the leftover sandbox artifacts** (from earlier work):
   ```bash
   rm -f .git/index.lock app/_deltest.txt
   ```
2. **Build the clean public copy** (non-destructive — creates `../rudder-public`, doesn't touch your private repo):
   ```bash
   ./prep-opensource.sh          # preview what's included/excluded
   ./prep-opensource.sh --go     # build it + init fresh git + first commit
   ```
   The script excludes `data/`, `legacy/`, `scratch/`, `temp/`, all `.env*`, `node_modules`, `.next`, the removed FLOW files, and the orphaned `/calendar` `/tasks` `/habits` routes. It then prints a verification block.
3. **Verify the public copy is clean** — the script checks, but eyeball it yourself:
   ```bash
   cd ../rudder-public
   git ls-files | grep -iE '\.(db|sqlite)|\.env|credential|secret' || echo "clean"
   ```
   For extra confidence, run a dedicated scanner: `gitleaks detect` or `trufflehog filesystem .`.
4. **Create an EMPTY repo on GitHub** (no README/license — you already have them), then:
   ```bash
   git remote add origin git@github.com:<you>/rudder.git
   git branch -M main && git push -u origin main
   ```

## Release checklist

Already done in this session:

- [x] `LICENSE` — MIT, © 2026 Robert Angelo
- [x] `VISION.md` — canonical definition (sovereign personal OS; FLOW removed)
- [x] `README.md` — tagline, description, module table aligned to the vision
- [x] `app/src/lib/modules.ts` — FLOW removed from the registry
- [x] `CONTRIBUTING.md` — contributor guide
- [x] `prep-opensource.sh` — builds the clean, history-free public repo

Do before / during publish (the script handles the file-level parts):

- [ ] Run `prep-opensource.sh --go` and verify the clean tree
- [ ] Confirm `app/.env.example` lists every variable `app/.env.local` actually uses (so contributors can run it)
- [ ] Remove the unused FLOW database migration `021_flow_taste_library` from `app/src/lib/db.ts` (it creates empty `taste_library`/`brand_contexts` tables; harmless but dead)
- [ ] Replace the boilerplate `app/README.md` (still the default create-next-app text) or delete it in favor of the root README
- [ ] Add a short repo description + topics on GitHub

## "Make it the best we can" — post-vision polish (not release blockers)

From `AUDIT.md`, the biggest quality win is **design-system consistency**: ~9 pages (`people`, `health`, `identity`, `career`, `writing`, `media`, `pala`, `biographer`, plus `onboarding`) hardcode raw `neutral`/`zinc`/hex colors instead of the design tokens in `globals.css`. `people/page.tsx` even references a non-existent `text-neutral-350`. Migrating these to tokens + the `ui.tsx` primitives is what will make Rudder feel like one polished product to anyone who stars it. Worth doing before or shortly after launch.

Other nice-to-haves for an OSS project: a `screenshots/` section in the README, a minimal CI workflow (`npm run lint` + `next build`), and issue/PR templates.

## Superseded

`SPLIT_FLOW.md` and `split-flow.sh` are obsolete — FLOW is removed, not split. This file replaces them.
