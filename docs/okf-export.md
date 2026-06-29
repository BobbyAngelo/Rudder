# Open Knowledge Format (OKF) Export

Rudder can export your knowledge as an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (OKF v0.1) bundle: a directory of cross-linked markdown files with YAML frontmatter that any agent or tool can consume without an SDK or integration. It is "just files" - readable in any editor, hostable in any git repo, and portable beyond Rudder.

This complements the MCP server (`scripts/rudder-mcp.ts`): MCP lets a live model query Rudder; OKF hands another system a static, self-describing copy of your knowledge.

## What's included

To keep shared bundles safe, only non-sensitive knowledge is exported:

- **Identity** - profile, values, milestones, links
- **Career** - timeline/positions, skills, awards, original IP
- **Notes** - your notes, with `[[wikilinks]]` rewritten to OKF cross-links
- **Knowledge Graph** - a markdown overview connecting values, projects, and notes

**Excluded by design:** People (contacts) and Health data are never exported.

## Bundle shape

```
index.md                       # root index (type: Knowledge Bundle)
identity/
  index.md
  profile.md                   # type: Identity Profile
  values/<value>.md            # type: Value
  milestones/<milestone>.md    # type: Milestone
  links.md                     # type: Links
career/
  index.md
  timeline/<role-company>.md   # type: Career Position
  skills.md                    # type: Skill Set
  awards/<award>.md            # type: Award
  ip/<title>.md                # type: Original IP
notes/<note>.md                # type: Note
knowledge-graph/index.md       # type: Knowledge Graph
```

Every concept file carries OKF frontmatter (`type` is required, plus `title`, `description`, `resource`, `tags`, `timestamp` where available) and each directory has an `index.md` for progressive disclosure.

## How to export

**From the UI:** Settings → Integrations & Connectors → Knowledge Export → "Export OKF" (downloads a `.zip`).

**Via API:**

```bash
curl -L "http://localhost:3000/api/export/okf" -o rudder-okf.zip
# Toggle modules with query params (set to 0 to exclude):
#   ?identity=0&career=0&notes=0&graph=0
```

**Via CLI:**

```bash
cd app
npm run export:okf -- --out ../my-bundle
# Options: --no-notes  --no-career  --no-graph
```

## Importing external OKF bundles

Rudder can also **consume** OKF bundles from other producers. Imported bundles are stored under `data/okf-imports/<bundle>/` and picked up by `buildContextChunks()`, so their concepts are embedded into the semantic-retrieval layer and become searchable on the next query - no manual reindexing.

Only concept files are ingested; navigation/history files (`index.md`, `log.md`) are skipped. Imports are sandboxed against zip-slip/path-traversal.

**From the UI:** Settings → Integrations & Connectors → Knowledge → "Import .zip".

**Via API:**

```bash
curl -F "file=@friends-bundle.zip" http://localhost:3000/api/import/okf
```

**Via CLI** (accepts a directory or a .zip):

```bash
cd app
npm run import:okf -- ../friends-bundle.zip --name friends
npm run import:okf -- /path/to/unpacked-bundle
```

To remove imported knowledge, delete the relevant folder under `data/okf-imports/`.

## Implementation

- `app/src/lib/okf.ts` - the bundle generator (`buildOKFBundle(options, db?)`; `db` is injectable for testing)
- `app/src/lib/okf-import.ts` - frontmatter parser, concept-to-chunk converter, safe extraction
- `app/src/lib/rag.ts` - `buildContextChunks()` ingests `data/okf-imports/**` as `source: "okf"` chunks
- `app/src/app/api/export/okf/route.ts` and `api/import/okf/route.ts` - HTTP endpoints
- `scripts/export-okf.ts` / `scripts/import-okf.ts` - CLIs
- `app/src/components/OKFExportCard.tsx` - Settings UI (export + import)
