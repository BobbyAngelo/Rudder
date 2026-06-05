/* ═══════════════════════════════════════════════════════
   Vault export — mirror your current memory into plain files.
   One-time (re-runnable) migration: reconstructs raw documents from the sqlite
   index and writes them to the vault, so your existing memory becomes markdown
   you own and can open in Obsidian. New ingests already write files directly.

   Run:  npm run vault:export        (from app/)
   Vault location: $RUDDER_VAULT_DIR or <data>/vault
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { exportChunkIndexToVault, vaultDir } from "../src/lib/vault";

function main() {
  const db = getDB();
  const { docs, files } = exportChunkIndexToVault(db);
  console.log(`\n  Mirrored ${docs} documents → ${files} files`);
  console.log(`  Vault: ${vaultDir()}/raw`);
  console.log(`\n  Open that folder in Obsidian to see your memory as a graph.\n`);
  process.exit(0);
}

main();
