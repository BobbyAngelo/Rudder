/* ═══════════════════════════════════════════════════════
   memory:reset — wipe the local memory store for a clean slate.
   Clears chunk_index, vec_chunks, and connectors. Your source
   files are untouched; just the index is cleared. Re-sync to rebuild.

   Run:  npm run memory:reset
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { ensureMemory } from "../src/lib/memory";
import { ensureConnectors } from "../src/lib/connectors";

async function main() {
  const db = getDB();
  ensureMemory(db);
  ensureConnectors(db);
  const before = (db.prepare("SELECT COUNT(*) AS n FROM chunk_index").get() as { n: number }).n;
  db.exec("DELETE FROM chunk_index; DELETE FROM vec_chunks; DELETE FROM connectors;");
  console.log(`\n  Memory reset — cleared ${before} chunks and all connectors. Clean slate.\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
