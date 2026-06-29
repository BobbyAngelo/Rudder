import * as fs from "fs";
import * as path from "path";
import { getDB } from "./db";
import { executeChat, ChatMessage } from "./ai";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Autonomic Agent Swarms & Operations Daemon
   Processes reality observations into tasks & drafts replies.
   ═══════════════════════════════════════════════════════ */

const CACHE_FILE = path.resolve(__dirname, "processed_nodes.json");

function loadProcessedCache(): Set<string> {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      return new Set(data);
    } catch {
      return new Set();
    }
  }
  return new Set();
}

function saveProcessedCache(cache: Set<string>) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(Array.from(cache), null, 2));
}

async function runTaskAllocator() {
  console.log("[agent-swarm] Scanning reality_nodes for new insights and device logs...");
  const db = getDB();
  const cache = loadProcessedCache();

  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // Fetch recent reality nodes (biometrics, voice logs, telemetry)
  const nodes = db.prepare(`
    SELECT event_id, what_classification, why_insight, raw_blob
    FROM reality_nodes
    WHERE what_classification IN ('Correlation Insight', 'Voice Capture', 'Device Telemetry')
    ORDER BY when_timestamp DESC
    LIMIT 10
  `).all() as any[];

  for (const node of nodes) {
    if (cache.has(node.event_id)) continue;

    console.log(`[agent-swarm] Processing new node: [${node.what_classification}] (ID: ${node.event_id})`);
    
    const contextText = node.why_insight || node.raw_blob || "";
    
    const prompt = `
Given this new reality log from the user's personal environment:
Classification: ${node.what_classification}
Details: "${contextText}"

Evaluate if this log requires any actionable task or follow-up item.
If a task is needed, output a single JSON block conforming exactly to this schema:
{
  "task_needed": true,
  "title": "Short descriptive task title",
  "description": "Elaborated action item context",
  "priority": 1, // Low=1, Medium=2, High=3, Urgent=4
  "due_days_ahead": 1 // Number of days from today this is due, or null
}
If no task is needed (e.g. it's just raw informational data with no action items), return:
{ "task_needed": false }

Constraint rules:
1. Output ONLY valid JSON. Do not include markdown wraps or commentary.
2. Never use em-dashes in titles or descriptions.
`;

    const messages: ChatMessage[] = [
      { role: "system", content: "You are an autonomic task planner. Output raw JSON only." },
      { role: "user", content: prompt }
    ];

    try {
      const response = await executeChat(messages, executionMode);
      const cleanedJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanedJson);

      if (result.task_needed && result.title) {
        let dueDate: string | null = null;
        if (result.due_days_ahead) {
          const d = new Date();
          d.setDate(d.getDate() + result.due_days_ahead);
          dueDate = d.toISOString().split("T")[0];
        }

        db.prepare(`
          INSERT INTO tasks (title, description, status, priority, due_date)
          VALUES (?, ?, 'todo', ?, ?)
        `).run(
          result.title,
          result.description || "",
          result.priority || 1,
          dueDate
        );
        console.log(`✅ Autonomic Task Swarm created task: "${result.title}" (Priority: ${result.priority})`);
      } else {
        console.log(`[agent-swarm] Node did not require an actionable task.`);
      }

      cache.add(node.event_id);
      saveProcessedCache(cache);
    } catch (err: any) {
      console.warn(`[agent-swarm] Failed to parse task allocation: ${err.message}`);
    }
  }
}

async function runAutoReplyDrafting() {
  console.log("[agent-swarm] Scanning correspondence for incoming messages...");
  const db = getDB();
  const cache = loadProcessedCache();

  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // Fetch identity profile
  let userName = "Robert";
  try {
    const profile = db.prepare("SELECT display_name FROM identity_profile WHERE id = 1").get() as any;
    if (profile?.display_name) userName = profile.display_name;
  } catch { /* fallback */ }

  // Fetch incoming messages
  const messagesList = db.prepare(`
    SELECT id, sender, recipient, subject, body, platform, decision_log
    FROM correspondence
    WHERE direction = 'incoming'
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as any[];

  for (const msg of messagesList) {
    const cacheKey = `reply_draft_${msg.id}`;
    if (cache.has(cacheKey)) continue;

    console.log(`[agent-swarm] Ingesting message from ${msg.sender} on ${msg.platform}...`);

    const prompt = `
You are drafting an auto-reply message on behalf of ${userName} for this incoming correspondence:
From: ${msg.sender}
Platform: ${msg.platform}
Subject: ${msg.subject || "(No Subject)"}
Body: ${msg.body}

Write a natural, helpful reply.
Constraint rules:
1. Never use em-dashes (use hyphens, commas, or parentheses instead).
2. Keep it under 100 words.
3. Output ONLY the draft reply body. Do not include signature blocks, placeholders, or explanations.
`;

    const chatMsg: ChatMessage[] = [
      { role: "system", content: "You are the personal communications editor. Output only the draft reply text." },
      { role: "user", content: prompt }
    ];

    try {
      const draftText = await executeChat(chatMsg, executionMode);
      
      db.transaction(() => {
        // 1. Update decision log in correspondence
        db.prepare("UPDATE correspondence SET decision_log = ? WHERE id = ?").run(
          `[Draft Generated] ${draftText.slice(0, 80)}...`,
          msg.id
        );

        // 2. Save auto-reply draft to reality_nodes
        const eventId = `draft_reply_${crypto.randomUUID()}`;
        const nowStr = new Date().toISOString();
        db.prepare(`
          INSERT INTO reality_nodes (
            event_id, when_timestamp, what_classification, why_insight, 
            origin_provenance, raw_blob
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          eventId,
          nowStr,
          "Auto-Reply Draft",
          `Suggested reply to ${msg.sender}`,
          "agent_swarm_reply",
          JSON.stringify({ correspondence_id: msg.id, draft: draftText, sender: msg.sender })
        );
      })();

      console.log(`✅ Autonomic Reply Swarm drafted message to ${msg.sender}:\n"${draftText.trim()}"`);
      cache.add(cacheKey);
      saveProcessedCache(cache);
    } catch (err: any) {
      console.warn(`[agent-swarm] Failed to generate reply draft: ${err.message}`);
    }
  }
}

async function runContactWarmthTracker() {
  console.log("[agent-swarm] Running contact warmth and last contact updates...");
  const db = getDB();

  // Seed contacts if people table is empty
  const count = db.prepare("SELECT COUNT(*) as count FROM people").get() as { count: number };
  if (count.count === 0) {
    db.prepare(`
      INSERT INTO people (name, email, relationship, notes, warmth)
      VALUES ('Sarah K.', 'sarah.k@flowagency.co', 'colleague', 'LuxAuto campaign lead', 0.8)
    `).run();
    db.prepare(`
      INSERT INTO people (name, email, relationship, notes, warmth)
      VALUES ('Marcus', 'marcus@flowagency.co', 'colleague', 'Creative Director', 0.5)
    `).run();
    console.log("[agent-swarm] Seeded contacts for warmth tracking.");
  }

  const contacts = db.prepare("SELECT id, name, email, last_contact, warmth FROM people").all() as any[];

  for (const person of contacts) {
    if (!person.email) continue;

    // Get count and latest timestamp from correspondence
    const stats = db.prepare(`
      SELECT COUNT(*) as count, MAX(created_at) as latest 
      FROM correspondence 
      WHERE sender = ? OR recipient = ?
    `).get(person.email, person.email) as { count: number; latest: string | null };

    let lastContact = person.last_contact;
    let warmth = person.warmth ?? 0.5;

    if (stats.count > 0 && stats.latest) {
      lastContact = stats.latest;
      const latestMs = new Date(stats.latest).getTime();
      const diffMs = Math.max(0, Date.now() - latestMs);
      const daysSince = diffMs / (1000 * 3600 * 24);
      
      const baseWarmth = Math.min(1.0, stats.count * 0.15);
      warmth = Math.max(0.0, parseFloat((baseWarmth * Math.exp(-daysSince / 30.0)).toFixed(2)));
    } else if (person.last_contact) {
      const latestMs = new Date(person.last_contact).getTime();
      const diffMs = Math.max(0, Date.now() - latestMs);
      const daysSince = diffMs / (1000 * 3600 * 24);
      
      warmth = Math.max(0.0, parseFloat((warmth * Math.exp(-daysSince / 30.0)).toFixed(2)));
    } else {
      // Decay default warmth if never contacted
      warmth = Math.max(0.1, parseFloat((warmth * 0.95).toFixed(2)));
    }

    db.prepare(`
      UPDATE people 
      SET last_contact = ?, warmth = ?, updated_at = (datetime('now')) 
      WHERE id = ?
    `).run(lastContact, warmth, person.id);

    console.log(`[agent-swarm] Updated contact "${person.name}": Warmth: ${warmth}, Last Contact: ${lastContact || "None"}`);
  }
}

async function main() {
  console.log("\n==================================================");
  console.log("       AUTONOMIC AGENT SWARM (STARTING...)");
  console.log("==================================================\n");

  try {
    await runTaskAllocator();
    await runAutoReplyDrafting();
    await runContactWarmthTracker();
  } catch (err: any) {
    console.error("❌ Agent Swarm cycle failed:", err.message);
  }

  console.log("\n[agent-swarm] Operations cycle completed successfully.");
}

main().catch((err) => {
  console.error("❌ Swarm process failed:", err);
  process.exit(1);
});
