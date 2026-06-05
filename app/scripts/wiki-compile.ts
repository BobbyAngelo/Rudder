/* ═══════════════════════════════════════════════════════
   Wiki compile — synthesize entity pages from your memory.
   Builds one markdown dossier per person under <vault>/wiki/people/, plus an
   index, linked by who appears together. Pure database reads — no model needed.
   Open the vault in Obsidian afterward to see your social graph.

   Run:  npm run wiki:compile        (from app/)
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { compilePeoplePages } from "../src/lib/wiki";
import { vaultDir } from "../src/lib/vault";

function main() {
  const db = getDB();
  const { people, files } = compilePeoplePages(db);
  console.log(`\n  Compiled ${people} people pages → ${files.length} files`);
  console.log(`  Wiki: ${vaultDir()}/wiki`);
  console.log(`\n  Open the vault in Obsidian — the people link to each other by who appears together.\n`);
  process.exit(0);
}

main();
