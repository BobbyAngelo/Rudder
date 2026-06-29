import fs from "fs";
import path from "path";

/* ═══════════════════════════════════════════════════════
   export-okf.ts — Open Knowledge Format (OKF) Exporter CLI

   Walks Rudder's local database and writes a conformant OKF
   v0.1 bundle (a directory of cross-linked markdown files) so
   your knowledge is portable to any other agent or tool.

   Usage:
     node --import tsx scripts/export-okf.ts [--out <dir>] [options]

   Options:
     --out <dir>     Output directory (default: ./okf-export)
     --no-notes      Exclude notes
     --no-career     Exclude career & identity
     --no-graph      Exclude knowledge graph overview

   Privacy: People contacts and Health data are never exported.
   ═══════════════════════════════════════════════════════ */

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

function parseArgs(argv: string[]) {
  const out =
    argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(ROOT, "okf-export");
  return {
    out: path.resolve(out),
    includeNotes: !argv.includes("--no-notes"),
    includeCareer: !argv.includes("--no-career"),
    includeIdentity: !argv.includes("--no-career"),
    includeGraph: !argv.includes("--no-graph"),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // db.ts resolves the database via process.cwd()/../data, so run as if
  // we were inside the app directory.
  process.chdir(APP_DIR);

  // Imported after chdir; okf.ts only depends on better-sqlite3 (no @ alias).
  const { buildOKFBundle } = await import(path.join(APP_DIR, "src/lib/okf.ts"));

  const files = buildOKFBundle({
    includeIdentity: opts.includeIdentity,
    includeCareer: opts.includeCareer,
    includeNotes: opts.includeNotes,
    includeGraph: opts.includeGraph,
  });

  if (!files.length) {
    process.stderr.write("[okf] No exportable knowledge found. Is data/rudder.db populated?\n");
    process.exit(1);
  }

  fs.mkdirSync(opts.out, { recursive: true });
  for (const f of files) {
    const dest = path.join(opts.out, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content, "utf-8");
  }

  process.stdout.write(
    `[okf] Wrote ${files.length} files to ${opts.out}\n` +
    `[okf] Open ${path.join(opts.out, "index.md")} to browse the bundle.\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[okf] Export failed: ${err?.message || err}\n`);
  process.exit(1);
});
