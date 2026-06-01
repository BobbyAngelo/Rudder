/* ═══════════════════════════════════════════════════════
   sqlite-vec smoke test — validates the vector store on THIS machine.
   Loads the extension, builds the table, inserts real embeddings,
   runs a KNN query, and checks the expected nearest neighbour.

   Run:  npm run vec:smoke   (from app/)   — needs Ollama + sqlite-vec.
   ═══════════════════════════════════════════════════════ */

import Database from "better-sqlite3";
import { loadVec, createVecTable, upsertEmbedding, knn } from "../src/lib/vectorStore";

const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";

async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  const d = await r.json();
  return d.embeddings?.[0] || [];
}

const DOCS = [
  { id: "attorney", text: "Marcus Webb, attorney specializing in startup contracts and intellectual property law." },
  { id: "doctor", text: "Anjali Patel, primary care physician at Bay Medical Group." },
  { id: "sleep", text: "Average sleep 6.2 hours over the last 30 days." },
  { id: "tahoe", text: "Planning a Tahoe trip in July with friends." },
];

async function main() {
  const db = new Database(":memory:");
  loadVec(db);

  const dim = (await embed("dimension probe")).length;
  console.log("\n  sqlite-vec smoke test");
  console.log("  embedding dim:", dim, dim === 768 ? "✓" : "(expected 768 for nomic-embed-text)");

  createVecTable(db, dim);
  for (const d of DOCS) upsertEmbedding(db, d.id, await embed(d.text));
  console.log("  inserted:", DOCS.length, "vectors");

  const q = "who can help me with legal stuff?";
  const hits = knn(db, await embed(q), 3);
  console.log(`\n  query: "${q}"`);
  for (const h of hits) console.log(`   ${h.chunk_id.padEnd(10)} distance=${h.distance.toFixed(4)}`);

  const pass = hits[0]?.chunk_id === "attorney";
  console.log(`\n  nearest = "${hits[0]?.chunk_id}"  →  ${pass ? "PASS ✓ (semantic KNN works)" : "FAIL ✗ (expected attorney)"}\n`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
