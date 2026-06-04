/* ═══════════════════════════════════════════════════════
   Demo seed — load the sample "Tom Bennett" life into the local store so
   Rudder works with zero setup: memory to recall over, an identity so "I/me"
   resolves, and the act loop's Desk lights up the moment you scan.

   Run:  npm run demo:seed   (from app/)   — needs Ollama + sqlite-vec.
   ═══════════════════════════════════════════════════════ */

import { mkdirSync } from "fs";
import { join } from "path";
import { getDB } from "../src/lib/db";
import { indexChunks, recall } from "../src/lib/memory";
import { buildDemoChunks, buildDemoIdentity } from "../src/lib/demoData";
import { indexIdentity } from "../src/lib/identity";
import { ollamaEmbed } from "../src/lib/ollama";
import { surface } from "../src/lib/act/surfacer";

const embed = (t: string) => ollamaEmbed(t);

/** Replace the identity tables with the demo persona (idempotent). */
function seedIdentity(db: ReturnType<typeof getDB>) {
  const id = buildDemoIdentity(new Date());
  const p = id.profile;
  db.prepare(
    `UPDATE identity_profile SET display_name=?, full_name=?, headline=?, bio=?,
       operating_manual=?, goals=?, location=?, timezone=?, email=?, website=? WHERE id=1`
  ).run(
    p.display_name, p.full_name, p.headline, p.bio, p.operating_manual, p.goals,
    p.location, p.timezone, p.email, p.website
  );

  db.prepare("DELETE FROM identity_values").run();
  const vi = db.prepare("INSERT INTO identity_values (label, description, priority) VALUES (?,?,?)");
  for (const v of id.values) vi.run(v.label, v.description, v.priority);

  db.prepare("DELETE FROM identity_milestones").run();
  const mi = db.prepare("INSERT INTO identity_milestones (title, description, date, category) VALUES (?,?,?,?)");
  for (const m of id.milestones) mi.run(m.title, m.description, m.date, m.category);

  db.prepare("DELETE FROM identity_links").run();
  const li = db.prepare("INSERT INTO identity_links (platform, url, label) VALUES (?,?,?)");
  for (const l of id.links) li.run(l.platform, l.url, l.label);

  db.prepare("DELETE FROM identity_relationships").run();
  const ri = db.prepare("INSERT INTO identity_relationships (name, relation, note, priority) VALUES (?,?,?,?)");
  for (const r of id.relationships) ri.run(r.name, r.relation, r.note, r.priority);
}

async function main() {
  // getDB() opens <cwd>/../data/rudder.db — make sure the dir exists.
  mkdirSync(join(process.cwd(), "..", "data"), { recursive: true });

  const db = getDB();
  const now = new Date();

  // 1. Memory.
  const chunks = buildDemoChunks(now);
  const { indexed, skipped } = await indexChunks(db, chunks, embed);
  console.log(`\n  Memory — ${indexed} chunks embedded, ${skipped} unchanged.`);

  // 2. Identity (then index it into memory so "I/me/my" resolves).
  seedIdentity(db);
  try {
    const { indexed: idIndexed } = await indexIdentity(db, embed);
    console.log(`  Identity — Tom Bennett seeded; ${idIndexed} identity facts indexed.`);
  } catch (e: any) {
    console.log(`  Identity — seeded (memory indexing skipped: ${e.message}).`);
  }

  // 3. Land in a working app.
  db.prepare("INSERT OR IGNORE INTO user_preferences (id) VALUES (1)").run();
  db.prepare(
    "UPDATE user_preferences SET onboarding_completed = 1, enabled_modules = ? WHERE id = 1"
  ).run(JSON.stringify(["identity", "memory", "people", "health", "schedule", "graph"]));
  console.log("  Onboarding marked complete; modules enabled.\n");

  // 4. Preview the act loop's Desk on this fresh data (pure SQL — no model needed).
  const drafts = surface(db, now);
  console.log(`  ── Rudder's Desk (what 'Scan now' will surface today) — ${drafts.length} items ──`);
  for (const d of drafts) {
    console.log(`   • [${d.kind}] ${d.title}`);
    if (d.rationale) console.log(`       ${d.rationale}`);
  }
  console.log("");

  // 5. Show recall working.
  const demoQs = [
    "What's coming up for the launch?",
    "Who have I lost touch with?",
    "Tell me about how the studio started",
  ];
  for (const q of demoQs) {
    const { sources } = await recall(db, q, embed, { topN: 3, now });
    console.log(`  Q: ${q}`);
    for (const s of sources) console.log(`     • [${s.source}] ${s.title}${s.date ? " (" + s.date + ")" : ""}`);
    console.log("");
  }
  console.log("  Tom's life is loaded. Open /act and hit “Scan now”.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
