/* ═══════════════════════════════════════════════════════
   Vault rebuild — re-derive the search index FROM the files.
   Proves the files are the source of truth: you can delete the sqlite index and
   reconstruct it entirely from the markdown vault. Needs Ollama (re-embeds).

   Run:  npm run vault:rebuild       (from app/)
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { rebuildIndexFromVault, vaultDir } from "../src/lib/vault";
import { ollamaEmbed } from "../src/lib/ollama";

async function main() {
  const db = getDB();
  console.log(`\n  Rebuilding the index from ${vaultDir()}/raw …`);
  const { indexed, skipped, docs } = await rebuildIndexFromVault(db, (t) => ollamaEmbed(t));
  console.log(`  ${docs} files → ${indexed} chunks embedded, ${skipped} unchanged.\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
