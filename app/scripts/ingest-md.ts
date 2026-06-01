/* ═══════════════════════════════════════════════════════
   ingest:md — ingest a Markdown/Obsidian folder into memory.
   Incremental: re-run after edits and only changed notes re-embed.

   Run:  npm run ingest:md -- /path/to/your/vault
   ═══════════════════════════════════════════════════════ */

import { mkdirSync } from "fs";
import { join } from "path";
import { getDB } from "../src/lib/db";
import { recall } from "../src/lib/memory";
import { addConnector, syncConnector } from "../src/lib/connectors";
import { ollamaEmbed } from "../src/lib/ollama";

const dir = process.argv.slice(2).join(" ").trim();
const embed = (t: string) => ollamaEmbed(t);

async function main() {
  if (!dir) {
    console.log("\n  Usage: npm run ingest:md -- /path/to/your/vault\n");
    process.exit(1);
  }
  mkdirSync(join(process.cwd(), "..", "data"), { recursive: true });
  const db = getDB();

  const t0 = Date.now();
  // Route through the connector so CLI and UI share one sync path (incl. pruning).
  const connector = addConnector(db, "markdown", { path: dir });
  const { indexed, skipped, pruned, total } = await syncConnector(db, connector.id, embed);
  console.log(`\n  Synced ${dir}`);
  console.log(`  ${total} chunks · embedded ${indexed} · skipped ${skipped} unchanged · pruned ${pruned} removed. (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  // Quick proof it's queryable.
  const q = process.env.ASK || "what have I been working on?";
  const { sources } = await recall(db, q, embed, { topN: 5 });
  console.log(`  Q: ${q}`);
  if (!sources.length) console.log("     (no results)");
  for (const s of sources) {
    console.log(`     • [${s.source}] ${s.title}${s.date ? " (" + s.date + ")" : ""}`);
  }
  console.log("");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
