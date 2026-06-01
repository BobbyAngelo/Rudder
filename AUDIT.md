# Rudder Audit — Consistency, Bloat, and Vision Alignment

> Date: May 29, 2026 · Scope: `app/` (Next.js 16 product), `legacy/`, `scratch/`, `data/`
> Goals: (1) unify the UI/UX across modules, (2) cut bloat, (3) align vision and product.

## The one-sentence diagnosis

Rudder is a genuinely capable app with a real design system and a clean module registry, but it has drifted into being **three products at once** — a personal life-OS, a creative ad studio, and a hardware-sovereignty project — and roughly half the screens ignore the shared design system. The fix is not more building; it is *deciding what Rudder is* and then enforcing that decision in the nav, the design tokens, and the routes.

---

## Goal 1 — Unified UI/UX

### What's already right

A real design system exists in `app/src/app/globals.css`: a full dark token set (`--color-background`, `--color-surface`, `--color-accent` emerald, section colors, typography). Shared primitives exist in `components/ui.tsx` — `PageHeader`, `Card`, `CardHeader`, `CardBody`, `StatCard`, `Badge`, `EmptyState`. The sidebar is data-driven from a single `lib/modules.ts` registry. The foundation for consistency is in place.

### The problem: adoption is split roughly in half

Counting design-token references (`var(--color-…)`) versus hardcoded colors (`neutral-800`, `zinc-900`, `bg-[#…]`) per page tells the story plainly:

| Page | Token refs | Hardcoded colors | Verdict |
|---|---|---|---|
| `page.tsx` (dashboard) | 43 | 0 | On-system |
| `habits` | 47 | 0 | On-system |
| `calendar` | 68 | 2 | On-system |
| `hardware` | 76 | 13 | On-system |
| `tasks` | 38 | 0 | On-system |
| `settings/integrations` | 60 | 7 | On-system |
| `flow` | 25 | 121 | **Off-system** |
| `biographer` | 30 | 128 | **Off-system** |
| `media` | 24 | 181 | **Off-system** |
| `career` | 7 | 223 | **Off-system** |
| `identity` | 2 | 222 | **Off-system** |
| `health` | 1 | 226 | **Off-system** |
| `writing` | 44 | 261 | **Off-system** |
| `pala` (Notes) | 0 | 158 | **Off-system** |
| `people` | 1 | 292 | **Off-system** |
| `onboarding` | 0 | 129 | **Off-system** |

The dashboard, planner, habits, calendar, tasks, and hardware obey the token system. The newer/heavier feature pages — people, health, identity, career, writing, media, flow, biographer, pala — hardcode raw Tailwind `neutral`/`zinc` shades and one-off hex values. This is the direct, measurable cause of "doesn't feel unified": two color vocabularies coexist (token emerald-on-`#09090b` vs. ad-hoc `neutral`/`zinc`), and `people/page.tsx` even references `text-neutral-350`, which is not a real Tailwind class.

### Secondary inconsistencies

FLOW is a deliberate visual outlier — a "twilight glassmorphic / Outfit typography" aesthetic described in the docs — sitting inside an app whose system is "calm emerald operational." It looks like a different product. Glassmorphism (`backdrop-blur`) is also applied ad hoc across many pages rather than as a defined surface token, so blur strength and panel opacity vary screen to screen. And the shared `ui.tsx` primitives are barely used by the off-system pages, which re-implement their own cards, headers, and empty states.

### Recommendations (Goal 1)

Adopt a "one token vocabulary" rule: no raw `neutral-*`/`zinc-*`/hex in page files — everything routes through `globals.css` tokens. Migrate the nine off-system pages to the tokens and to the `ui.tsx` primitives (start with `people`, `health`, `identity`, `career` — they have the worst ratios and the most surface area). Either fold FLOW's twilight look into the shared system as a documented "creative" theme variant, or formally declare FLOW a separate surface — but don't leave it as undocumented drift. Promote glassmorphism into one or two named surface tokens so blur/opacity are consistent.

---

## Goal 2 — Cut the bloat

### Dead / orphaned routes (highest-value, lowest-risk cut)

`/planner` is the new unified surface: a single page with Timeline / Tasks / Board tabs (its own `TimelineView`, `TaskListView`, `TaskBoardView`). The registry's "Schedule" module points only at `/planner`. Yet three older full-page routes still exist and **nothing in the nav or registry links to them**:

- `/calendar` — 698 lines, superseded by Planner's Timeline tab
- `/tasks` — 585 lines, superseded by Planner's Tasks/Board tabs
- `/habits` — 399 lines, not referenced anywhere in the registry or sidebar
- `/onboarding` — 644 lines, a one-time flow (keep, but it's not nav-linked)

That's ~2,300 lines of orphaned page code shadowing live features. Confirm no deep links, then delete `/calendar`, `/tasks`, `/habits` (their logic already lives in Planner's view components).

### Registry drift

`lib/modules.ts` is described as the "single source of truth," but it and the actual routes have diverged: the registry lists 13 modules; the app has 20 page routes. `/habits`, `/calendar`, `/tasks` exist with no registry entry, while `photos` and `videos` are two registry entries that both point into the same `/media` page via query strings. Reconcile the two so the registry genuinely matches what ships.

### Never-built scaffolds

`Docs/PROJECT_STATUS.md` advertises a dozen "scaffold sections ready to build": Identity, People, Health, Money, Business, Properties, Ideaverse, Media, Scripts, Cyrano, Analytics, Wiki. Several never materialized as modules (Money, Business, Properties, Cyrano, Analytics, Wiki, Scripts). Either remove them from the status doc or move them to an explicit "future / not started" list so the doc stops overstating the surface area.

### Disk weight

| Folder | Size | Notes |
|---|---|---|
| `data/` | 3.5 GB | media, taste frames, SQLite DBs — mostly legitimate, but worth pruning `backups/` and `taste_raw/` |
| `app/` | 2.6 GB | `src` is only **1.4 MB**; the rest is `node_modules` + `.next` build cache |
| `legacy/` | 1.8 GB | full second `node_modules`, Firebase config, 2006–2008 NBC archive docs, loose `test-*.js/ts` files |
| `cli/` | 66 MB | check whether still used by the current app |
| `scratch/` | 176 KB | ~38 one-off Python/TS investigation scripts |

`legacy/` is 1.8 GB of dead weight in the working tree. It's already preserved in git history — consider moving it out of the active repo entirely (archive branch or separate location) rather than carrying it. `scratch/` should be `.gitignore`d, not committed. These don't affect the running app but they bloat clones, search, and cognitive load.

### Recommendations (Goal 2)

Delete the three orphaned routes after a link check; reconcile the registry to match shipped routes; demote unbuilt scaffolds in the status doc; relocate `legacy/` out of the active tree and gitignore `scratch/`.

---

## Goal 3 — Align vision and product

### Rudder currently describes itself four different ways

1. **Pasted executive summary** — "a sovereign AI creative studio engineered to reverse-engineer Fortune 500 decision-making"; RUDDER (operations) + FLOW (creative ad production).
2. **`Docs/PROJECT_STATUS.md` / `ROADMAP.md`** — "your sovereign personal operating system and agency engine."
3. **`app/layout.tsx` metadata** — "Your personal operating system — open source life management dashboard."
4. **`legacy/MASTER_PLAN.md`** — frames everything under "LIL DOG PRODUCTIONS (LLC)" and CELF OS.

These aren't phrasings of one idea; they're different products. "Reverse-engineer Fortune 500 ads" and "open-source life-management dashboard" imply different users, different roadmaps, different success metrics.

### What the product actually is

Map the 13 shipped modules to the two leading visions:

- **Personal life-OS** (vision #2/#3): Identity, People, Health, Biographer, Career, Writing, Notes, Photos, Videos, Schedule/Planner, Knowledge Graph — **11 of 13 modules**.
- **Creative ad studio** (vision #1, the pasted exec summary): **FLOW only** (Hardware is shared infrastructure).

So the headline vision you pasted — the RUDDER/FLOW bi-hemispheric creative studio — is realized by exactly *one* module out of thirteen. The product that actually exists is overwhelmingly a **personal sovereign life-OS**, with FLOW as one powerful creative tool inside it. The sidebar groups confirm this: "Life & Identity / Operations / Creative Engines / Infrastructure" — a life-OS taxonomy, not the RUDDER-vs-FLOW split the architecture diagram describes.

### The decision to make

There's no consistency fix that survives an undecided identity. Pick one of two coherent directions:

- **A — Personal sovereign OS (what's built):** Make FLOW one creative module among many. Rewrite the exec summary and MASTER_PLAN to match the life-OS framing already in the metadata and roadmap. Lowest effort; aligns docs to reality.
- **B — Creative studio (the pasted vision):** Treat the life modules (health, people, career, biographer) as secondary or spin them out, and make RUDDER-ops + FLOW-creative the spine — including reorganizing the nav around that bi-hemispheric split. Higher effort; aligns reality to the headline vision.

Most of the codebase points at A; the document you pasted argues for B. The single highest-leverage action in this whole audit is choosing between them, because Goals 1 and 2 both get easier once the answer is fixed (nav groups, module registry, and which off-system pages are even worth migrating all follow from it).

### Recommendations (Goal 3)

Write one canonical `VISION.md`, delete or clearly mark the competing framings as historical, and make the app metadata, the sidebar group labels, and the README all repeat the *same* sentence.

---

## Prioritized action plan

**Phase 0 — Decide (blocks everything else).** Choose vision A or B. Write a single canonical `VISION.md`. ~1 sitting; unblocks the rest.

**Phase 1 — Cheap, safe cleanup (days).**
Delete orphaned `/calendar`, `/tasks`, `/habits` after a link check. Reconcile `lib/modules.ts` with shipped routes. Move `legacy/` out of the active tree; gitignore `scratch/`. Update `PROJECT_STATUS.md` to stop listing unbuilt scaffolds as ready.

**Phase 2 — Design-system unification (1–2 weeks).**
Enforce a "tokens only, no raw `neutral`/`zinc`/hex in pages" rule (an ESLint rule can catch regressions). Migrate the nine off-system pages to tokens + `ui.tsx` primitives, worst-first: `people`, `health`, `identity`, `career`, then `writing`, `media`, `pala`, `biographer`. Fix the invalid `text-neutral-350`. Define one or two glass surface tokens.

**Phase 3 — Resolve FLOW's look (depends on Phase 0).**
Either fold FLOW's twilight aesthetic into the shared system as a documented theme variant (vision A), or formalize the RUDDER/FLOW split in the nav and treat FLOW as an intentionally distinct surface (vision B).

**Phase 4 — Re-align nav and docs.**
Make sidebar group labels, README, and app metadata all state the canonical vision. Confirm the module registry is the true single source of truth for the nav.

---

## What to keep, merge, cut (summary)

- **Keep:** the token system + `ui.tsx` primitives, the data-driven sidebar/registry pattern, Planner as the unified schedule surface, FLOW as the flagship creative engine, the dashboard/hardware/planner pages (already on-system).
- **Merge:** `photos` + `videos` registry entries already share `/media` — make that explicit; fold the off-system pages onto the shared design tokens.
- **Cut:** orphaned `/calendar`, `/tasks`, `/habits` routes; `legacy/` from the active tree; committed `scratch/` scripts; unbuilt scaffold claims in the status doc; three of the four competing identity statements.
