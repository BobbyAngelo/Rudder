/* ═══════════════════════════════════════════════════════
   Demo seed — index the sample "Alex Rivera" life into the local
   memory store (chunk_index + sqlite-vec) so the ask UI has data
   to recall over with zero setup. Re-runnable.

   Run:  npm run demo:seed   (from app/)   — needs Ollama + sqlite-vec.
   ═══════════════════════════════════════════════════════ */

import { mkdirSync } from "fs";
import { join } from "path";
import { getDB } from "../src/lib/db";
import { indexChunks, recall } from "../src/lib/memory";
import { buildDemoChunks } from "../src/lib/demoData";
import { ollamaEmbed } from "../src/lib/ollama";

const embed = (t: string) => ollamaEmbed(t);

async function main() {
  // getDB() opens <cwd>/../data/rudder.db — make sure the dir exists.
  mkdirSync(join(process.cwd(), "..", "data"), { recursive: true });

  const db = getDB();
  const now = new Date();
  const chunks = buildDemoChunks(now);

  const { indexed, skipped } = await indexChunks(db, chunks, embed);
  console.log(`\n  Demo seed — ${indexed} chunks embedded, ${skipped} unchanged (skipped).\n`);

  // Land straight in a working app: mark onboarding complete + enable modules.
  db.prepare("INSERT OR IGNORE INTO user_preferences (id) VALUES (1)").run();
  db.prepare(
    "UPDATE user_preferences SET onboarding_completed = 1, enabled_modules = ? WHERE id = 1"
  ).run(
    JSON.stringify([
      // Lean core (on-thesis). Bespoke modules (career, writing, pala/notes,
      // photos, videos, hardware, identity) are hidden from nav by default —
      // re-enable in Settings → Modules. See REFRAME.md / BIOGRAPHER_AUDIT.md.
      "identity", "memory", "people", "health", "schedule", "graph",
    ])
  );
  console.log("  Onboarding marked complete; modules enabled.\n");

  // Show recall working on the seeded demo data.
  const demoQs = [
    "Who can help me with a contract?",
    "What do I need to get done this week?",
    "How has my sleep been lately?",
    "What's going on with Sarah?",
  ];
  for (const q of demoQs) {
    const { sources } = await recall(db, q, embed, { topN: 4, now });
    console.log(`  Q: ${q}`);
    for (const s of sources) {
      console.log(`     • [${s.source}] ${s.title}${s.date ? " (" + s.date + ")" : ""}`);
    }
    console.log("");
  }
  console.log("  Demo data is ready. Start the app and ask away.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
