/* ═══════════════════════════════════════════════════════
   recall:why — diagnostic. Prints the hybrid score breakdown
   (semantic / lexical / temporal / source) for a query over the
   currently-seeded memory store, so ranking can be tuned.

   Run:  npm run recall:why -- "who can help me with a contract"
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../src/lib/db";
import { ensureMemory } from "../src/lib/memory";
import { scoreHybrid, type Chunk } from "../src/lib/retrieval";
import { ollamaEmbed } from "../src/lib/ollama";

const query = process.argv.slice(2).join(" ").trim() || "Who can help me with a contract?";

async function main() {
  const db = getDB();
  ensureMemory(db);
  const rows = db.prepare("SELECT * FROM chunk_index").all() as any[];
  if (!rows.length) {
    console.log("\n  No indexed chunks. Run:  npm run demo:seed\n");
    process.exit(1);
  }
  const chunks: Chunk[] = rows.map((r) => ({
    id: r.chunk_id, source: r.source, title: r.title, content: r.content,
    date: r.date ?? undefined, sourceId: r.source_id ?? undefined, vector: JSON.parse(r.vector),
  }));

  const qv = await ollamaEmbed(query);
  const scored = scoreHybrid(chunks, query, qv, { topN: 9999 });

  const f = (n: number) => n.toFixed(2);
  console.log(`\n  query: "${query}"   (${chunks.length} chunks indexed)\n`);
  console.log("   score  sem   lex   tmp   src   item");
  console.log("   ─────  ────  ────  ────  ────  ────────────────────────");
  for (const s of scored.slice(0, 10)) {
    console.log(`   ${f(s.score)}   ${f(s.sem)}  ${f(s.lex)}  ${f(s.temporal)}  ${f(s.source)}  [${s.chunk.source}] ${s.chunk.title}`);
  }
  console.log("");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
