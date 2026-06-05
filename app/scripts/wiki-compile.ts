/* ═══════════════════════════════════════════════════════
   Wiki compile — synthesize entity pages from your memory.
   Builds one markdown dossier per person under <vault>/wiki/people/, plus an
   index, linked by who appears together. Pure database reads — no model needed.
   Open the vault in Obsidian afterward to see your social graph.

   Run:  npm run wiki:compile        (from app/)
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { compileWiki } from "../src/lib/wiki";
import { vaultDir } from "../src/lib/vault";

function main() {
  const db = getDB();
  const { people, topics, files } = compileWiki(db);
  console.log(`\n  Compiled ${people} people + ${topics} topics → ${files.length} files`);
  console.log(`  Wiki: ${vaultDir()}/wiki`);
  console.log(`\n  Open the vault in Obsidian — people link by who appears together, topics link to the people around them.\n`);
  process.exit(0);
}

main();
