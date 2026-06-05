/* ═══════════════════════════════════════════════════════
   memory:clean — evict dependency/build/vcs junk from memory.
   Removes chunks (and their vault files) that were ingested before the
   ignore-rules existed — node_modules READMEs, lockfiles, build output.

   Preview:  npm run memory:clean -- --dry-run
   Purge:    npm run memory:clean
   After purging, re-run wiki:compile to see a clean wiki.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { pruneJunk } from "../src/lib/maintenance";

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDB();
  const r = pruneJunk(db, { dryRun });

  if (r.chunks === 0) {
    console.log("\n  Nothing to clean — memory is already tidy.\n");
    process.exit(0);
  }

  const verb = dryRun ? "Would remove" : "Removed";
  console.log(`\n  ${verb} ${r.chunks} junk chunks (${r.files} vault files):`);
  for (const [src, n] of Object.entries(r.bySource)) console.log(`    ${src}: ${n}`);
  if (r.sampleTitles.length) console.log(`  e.g. ${r.sampleTitles.join(", ")}`);
  console.log(dryRun ? "\n  Dry run — nothing changed. Drop --dry-run to purge.\n" : "\n  Done. Re-run `npm run wiki:compile` for a clean wiki.\n");
  process.exit(0);
}

main();
