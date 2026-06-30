import * as fs from "fs";
import { log } from "./logger";
import * as path from "path";
import { getDB } from "./db";
import { executeChat, ChatMessage } from "./ai";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Autonomic Agent Swarms & Operations Daemon
   Processes reality observations into tasks & drafts replies.
   ═══════════════════════════════════════════════════════ */

const CACHE_FILE = path.resolve(__dirname, "processed_nodes.json");

interface PrefsRow {
  default_execution_mode?: string;
}

interface RealityNodeRow {
  event_id: string;
  what_classification: string;
  why_insight: string | null;
  raw_blob: string | null;
}

interface CorrespondenceRow {
  id: number;
  sender: string;
  recipient: string;
  subject: string | null;
  body: string;
  platform: string;
  decision_log: string | null;
}

interface PersonRow {
  id: number;
  name: string;
  email: string | null;
  last_contact: string | null;
  warmth: number | null;
}

interface HealthMetricRow {
  date: string;
  sleep_hours: number | null;
  hrv: number | null;
}

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  priority: number;
}

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
  log.info("[agent-swarm] Scanning reality_nodes for new insights and device logs...");
  const db = getDB();
  const cache = loadProcessedCache();

  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as PrefsRow | undefined;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // Fetch recent reality nodes (biometrics, voice logs, telemetry)
  const nodes = db.prepare(`
    SELECT event_id, what_classification, why_insight, raw_blob
    FROM reality_nodes
    WHERE what_classification IN ('Correlation Insight', 'Voice Capture', 'Device Telemetry')
    ORDER BY when_timestamp DESC
    LIMIT 10
  `).all() as RealityNodeRow[];

  for (const node of nodes) {
    if (cache.has(node.event_id)) continue;

    log.info(`[agent-swarm] Processing new node: [${node.what_classification}] (ID: ${node.event_id})`);
    
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
      const result = JSON.parse(cleanedJson) as {
        task_needed?: boolean;
        title?: string;
        description?: string;
        priority?: number;
        due_days_ahead?: number | null;
      };

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
        log.info(`✅ Autonomic Task Swarm created task: "${result.title}" (Priority: ${result.priority})`);
      } else {
        log.info(`[agent-swarm] Node did not require an actionable task.`);
      }

      cache.add(node.event_id);
      saveProcessedCache(cache);
    } catch (err) {
      log.warn(`[agent-swarm] Failed to parse task allocation: ${(err as Error).message}`);
    }
  }
}

async function runAutoReplyDrafting() {
  log.info("[agent-swarm] Scanning correspondence for incoming messages...");
  const db = getDB();
  const cache = loadProcessedCache();

  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as PrefsRow | undefined;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // Fetch identity profile
  let userName = "Robert";
  try {
    const profile = db.prepare("SELECT display_name FROM identity_profile WHERE id = 1").get() as { display_name?: string } | undefined;
    if (profile?.display_name) userName = profile.display_name;
  } catch { /* fallback */ }

  // Fetch incoming messages
  const messagesList = db.prepare(`
    SELECT id, sender, recipient, subject, body, platform, decision_log
    FROM correspondence
    WHERE direction = 'incoming'
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as CorrespondenceRow[];

  for (const msg of messagesList) {
    const cacheKey = `reply_draft_${msg.id}`;
    if (cache.has(cacheKey)) continue;

    log.info(`[agent-swarm] Ingesting message from ${msg.sender} on ${msg.platform}...`);

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

      log.info(`✅ Autonomic Reply Swarm drafted message to ${msg.sender}:\n"${draftText.trim()}"`);
      cache.add(cacheKey);
      saveProcessedCache(cache);
    } catch (err) {
      log.warn(`[agent-swarm] Failed to generate reply draft: ${(err as Error).message}`);
    }
  }
}

async function runContactWarmthTracker() {
  log.info("[agent-swarm] Running contact warmth and last contact updates...");
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
    log.info("[agent-swarm] Seeded contacts for warmth tracking.");
  }

  const contacts = db.prepare("SELECT id, name, email, last_contact, warmth FROM people").all() as PersonRow[];

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

    log.info(`[agent-swarm] Updated contact "${person.name}": Warmth: ${warmth}, Last Contact: ${lastContact || "None"}`);
  }
}

async function runAutonomicRebalancer() {
  log.info("[agent-swarm] Checking user biometrics for task rebalancing...");
  const db = getDB();
  const todayStr = new Date().toISOString().split("T")[0];

  // Seed default health metrics if empty for testing/demo
  const healthCount = db.prepare("SELECT COUNT(*) as count FROM health_metrics").get() as { count: number };
  if (healthCount.count === 0) {
    db.prepare(`
      INSERT INTO health_metrics (date, sleep_hours, resting_hr, hrv, steps, mood, energy)
      VALUES (?, 5.2, 72, 35, 4500, 4, 3)
    `).run(todayStr);
    log.info("[agent-swarm] Seeded fatigued biometric log for today.");
  }

  const health = db.prepare(`
    SELECT date, sleep_hours, hrv 
    FROM health_metrics 
    ORDER BY date DESC
    LIMIT 1
  `).get() as HealthMetricRow | undefined;

  if (!health) {
    return;
  }

  const isFatigued = (health.sleep_hours && health.sleep_hours < 6.0) || (health.hrv && health.hrv < 40);
  if (!isFatigued) {
    log.info(`[agent-swarm] Biometrics are optimal (Sleep: ${health.sleep_hours} hrs, HRV: ${health.hrv}). No rebalancing needed.`);
    return;
  }

  log.info(`[agent-swarm] ⚠️ Fatigue detected: Sleep: ${health.sleep_hours} hrs, HRV: ${health.hrv}. Evaluation active...`);

  // Check if proposals already exist for today
  const existing = db.prepare("SELECT id FROM rebalance_proposals WHERE date = ?").get(todayStr);
  if (existing) {
    log.info(`[agent-swarm] Rebalance proposals already generated for today (${todayStr}).`);
    return;
  }

  const todayTasks = db.prepare(`
    SELECT id, title, description, priority 
    FROM tasks 
    WHERE status IN ('todo', 'in_progress') AND due_date = ?
  `).all(todayStr) as TaskRow[];

  if (todayTasks.length === 0) {
    log.info(`[agent-swarm] No active tasks scheduled for today (${todayStr}).`);
    return;
  }

  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as PrefsRow | undefined;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  const highEnergyKeywords = ["build", "write", "compile", "design", "presentation", "meeting", "workout", "gym", "code", "run", "refactor", "develop", "plan"];
  
  for (const task of todayTasks) {
    const isPriorityHigh = task.priority >= 3;
    const matchesKeyword = highEnergyKeywords.some(kw => task.title.toLowerCase().includes(kw));

    if (isPriorityHigh || matchesKeyword) {
      let shouldReschedule = true;
      let reason = "High-energy task scheduled on a low-rest day.";

      if (executionMode !== "disabled") {
        try {
          const prompt = `
The user is fatigued today. Vitals: Sleep ${health.sleep_hours} hours, HRV ${health.hrv}.
Task: "${task.title}"
Description: "${task.description || "(No description)"}"

Evaluate if this task should be rescheduled to another day to protect the user's rest and focus.
Output a raw JSON block conforming to this schema:
{
  "should_reschedule": true,
  "reason": "Short reason explaining why this task demands high physical/cognitive energy"
}
`;
          const messages: ChatMessage[] = [
            { role: "system", content: "You are an autonomic task planner. Output raw JSON only." },
            { role: "user", content: prompt }
          ];
          const response = await executeChat(messages, executionMode);
          const result = JSON.parse(response.replace(/```json/g, "").replace(/```/g, "").trim()) as {
            should_reschedule: boolean;
            reason: string;
          };
          shouldReschedule = result.should_reschedule;
          reason = result.reason;
        } catch {
          // Keep default fallback values
        }
      }

      if (shouldReschedule) {
        // Find lightest day in next 3 days
        let bestDateStr = "";
        let minTaskCount = 999;
        
        for (let i = 1; i <= 3; i++) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + i);
          const targetDateStr = targetDate.toISOString().split("T")[0];
          
          const countRow = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE due_date = ?").get(targetDateStr) as { count: number };
          if (countRow.count < minTaskCount) {
            minTaskCount = countRow.count;
            bestDateStr = targetDateStr;
          }
        }

        db.prepare(`
          INSERT INTO rebalance_proposals (date, task_id, original_date, proposed_date, reason)
          VALUES (?, ?, ?, ?, ?)
        `).run(todayStr, task.id, todayStr, bestDateStr, reason);

        log.info(`[agent-swarm] ⚠️ Created rebalance proposal for task "${task.title}": Move to ${bestDateStr} (${reason})`);
      }
    }
  }
}

async function main() {
  log.info("\n==================================================");
  log.info("       AUTONOMIC AGENT SWARM (STARTING...)");
  log.info("==================================================\n");

  try {
    await runTaskAllocator();
    await runAutoReplyDrafting();
    await runContactWarmthTracker();
    await runAutonomicRebalancer();
  } catch (err) {
    log.error("❌ Agent Swarm cycle failed:", (err as Error).message);
  }

  log.info("\n[agent-swarm] Operations cycle completed successfully.");
}

main().catch((err) => {
  log.error("❌ Swarm process failed:", err);
  process.exit(1);
});
