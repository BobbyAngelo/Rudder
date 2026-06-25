#!/usr/bin/env tsx

/**
 * Rudder 1.0 — LinkedIn Data Import
 * Populates identity profile, milestones, values, and links from LinkedIn data.
 */

import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(__dirname, "..", "..", "data", "rudder.db"));
db.pragma("journal_mode = WAL");

// ── Update Identity Profile Bio ──
db.prepare(`
  UPDATE identity_profile SET
    bio = ?,
    updated_at = datetime('now')
  WHERE id = 1
`).run(
  `2x Emmy® Winner | Producer & Director for NBC, BuzzFeed, Disney & Nat Geo | AI-Augmented Production

For the last 15 years I've been building teams and producing high end campaigns for global brands like Jaguar, Acura, and Hennessey. A creative producer who focuses heavily on the operational side of making premium video happen.

Whether it's directing large physical shoots with specialized camera cars or building out the post production pipelines to handle massive amounts of footage, the goal is always the same: Execute the creative vision at the highest possible standard, but build the systems in the background so we actually deliver it on time and on budget.

Currently focused on consulting and running specialized production operations. Helping creative teams figure out how to scale their output and lock down their internal workflows so they can focus on the craft.`
);
console.log("✅ Updated profile bio");

// ── Add LinkedIn Link ──
const existingLink = db.prepare("SELECT id FROM identity_links WHERE platform = 'linkedin'").get();
if (!existingLink) {
  db.prepare("INSERT INTO identity_links (platform, url, label) VALUES (?, ?, ?)").run(
    "linkedin", "https://www.linkedin.com/in/sovereigncreative/", "Sovereign User"
  );
  console.log("✅ Added LinkedIn link");
} else {
  console.log("⏭️  LinkedIn link already exists");
}

// ── Add Career Milestones ──
const milestones = [
  { title: "Olympics.com: Producer - 2000 & 2002 Games", description: "Producer at Quokka Sports for Olympics.com coverage", date: "1999-01-01", category: "career" },
  { title: "Disney.com: Producer of Digital Content", description: "Producer at Disney Internet Group. Game management and project management.", date: "2000-01-01", category: "career" },
  { title: "BFA - Academy of Art University", description: "Bachelor of Fine Arts", date: "2000-06-01", category: "education" },
  { title: "NBC Digital: Director of Video Production", description: "5 years leading video production for NBC Digital", date: "2004-01-01", category: "career" },
  { title: "Jay Leno's Garage: Co-Creator & Executive Producer", description: "Co-created and showran Jay Leno's Garage for 6 years at NBCUniversal", date: "2007-01-01", category: "career" },
  { title: "NBC Digital: Vice President of Production", description: "3 years as VP overseeing all digital video production at NBC", date: "2009-01-01", category: "career" },
  { title: "Jimmy Fallon Digital Experience: Producer", description: "Produced digital content for The Tonight Show with Jimmy Fallon", date: "2010-04-01", category: "career" },
  { title: "Self-Employed: Creative Producer & Director", description: "Leading multi-platform content strategies for NBC, Disney, National Geographic, BuzzFeed. Managing multi-million dollar budgets. Integrated AI workflows into production pipelines.", date: "2014-01-01", category: "career" },
  { title: "2x Emmy® Award Winner", description: "Outstanding production work in digital and television", date: "2015-01-01", category: "career" },
  { title: "BuzzFeed: Producer, Current Series & Development", description: "Producer for current series and development at BuzzFeed", date: "2022-01-01", category: "career" },
];

const insertMilestone = db.prepare(
  "INSERT INTO identity_milestones (title, description, date, category) VALUES (@title, @description, @date, @category)"
);

// Check if milestones already exist
const existingMilestones = (db.prepare("SELECT COUNT(*) as cnt FROM identity_milestones").get() as any).cnt;
if (existingMilestones === 0) {
  for (const m of milestones) {
    insertMilestone.run(m);
  }
  console.log(`✅ Added ${milestones.length} career milestones`);
} else {
  console.log(`⏭️  ${existingMilestones} milestones already exist, skipping`);
}

// ── Add Core Values ──
const values = [
  { label: "Operational Excellence", description: "Execute the creative vision at the highest possible standard, but build the systems to deliver on time and on budget.", priority: 1 },
  { label: "Creative Production", description: "15+ years producing high-end campaigns for global brands. Showrunner, director, and executive producer.", priority: 2 },
  { label: "Sovereign Infrastructure", description: "Building self-hosted, self-owned systems. Local-first AI, hardware fleet, and data sovereignty.", priority: 3 },
  { label: "Innovation", description: "Integrating emerging technologies and AI workflows into traditional production pipelines.", priority: 4 },
];

const insertValue = db.prepare(
  "INSERT INTO identity_values (label, description, priority) VALUES (@label, @description, @priority)"
);

const existingValues = (db.prepare("SELECT COUNT(*) as cnt FROM identity_values").get() as any).cnt;
if (existingValues === 0) {
  for (const v of values) {
    insertValue.run(v);
  }
  console.log(`✅ Added ${values.length} core values`);
} else {
  console.log(`⏭️  ${existingValues} values already exist, skipping`);
}

db.close();
console.log("\n✅ LinkedIn data imported into Rudder");
