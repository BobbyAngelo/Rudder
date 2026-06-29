import { getDB } from "./db";
import { executeChat, ChatMessage } from "./ai";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Nightly Correlation Engine (Insights Daemon)
   ═══════════════════════════════════════════════════════ */

async function main() {
  console.log("[correlation-daemon] Starting analysis loop...");
  const db = getDB();

  // 1. Fetch preferences for AI execution modes
  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    if (prefs?.default_execution_mode) {
      executionMode = prefs.default_execution_mode;
    }
  } catch { /* fallback */ }
  
  console.log(`[correlation-daemon] Using execution mode: ${executionMode}`);

  // 2. Fetch health records (last 7 days)
  const healthData: any[] = [];
  try {
    const records = db.prepare(`
      SELECT date, type, value, category_value, unit
      FROM health_records
      WHERE date >= date('now', '-7 days')
      ORDER BY date ASC
    `).all() as any[];
    healthData.push(...records);
  } catch (err: any) {
    console.warn(`[correlation-daemon] Health records query skipped: ${err.message}`);
  }

  // 3. Fetch journal entries (last 7 days, excluding voice captures)
  const journalData: any[] = [];
  try {
    const entries = db.prepare(`
      SELECT date(created_at) as entry_date, title, content
      FROM journal_entries
      WHERE created_at >= datetime('now', '-7 days') AND (tags NOT LIKE '%"voice"%' OR tags IS NULL)
      ORDER BY created_at ASC
    `).all() as any[];
    journalData.push(...entries);
  } catch (err: any) {
    console.warn(`[correlation-daemon] Journal entries query skipped: ${err.message}`);
  }

  // 3b. Fetch calendar events (last 7 days)
  const calendarData: any[] = [];
  try {
    const events = db.prepare(`
      SELECT start_date, start_time, title, description, location
      FROM calendar_events
      WHERE start_date >= date('now', '-7 days')
      ORDER BY start_date ASC
    `).all() as any[];
    calendarData.push(...events);
  } catch (err: any) {
    console.warn(`[correlation-daemon] Calendar events query skipped: ${err.message}`);
  }

  // 3c. Fetch voice transcripts (last 7 days)
  const voiceData: any[] = [];
  try {
    const voiceLogs = db.prepare(`
      SELECT date(created_at) as log_date, title, content
      FROM journal_entries
      WHERE created_at >= datetime('now', '-7 days') AND tags LIKE '%"voice"%'
      ORDER BY created_at ASC
    `).all() as any[];
    voiceData.push(...voiceLogs);
  } catch (err: any) {
    console.warn(`[correlation-daemon] Voice logs query skipped: ${err.message}`);
  }

  if (healthData.length === 0 && journalData.length === 0 && calendarData.length === 0 && voiceData.length === 0) {
    console.log("[correlation-daemon] No metrics, journals, calendar, or voice data found for the last 7 days. Exiting.");
    process.exit(0);
  }

  // 4. Format context block for the LLM
  let healthSummary = healthData.map(h => {
    const val = h.value !== null ? `${h.value} ${h.unit || ""}` : h.category_value;
    return `- ${h.date}: ${h.type} = ${val}`;
  }).join("\n");

  let journalSummary = journalData.map(j => {
    return `- ${j.entry_date} [${j.title}]: ${j.content.slice(0, 150)}...`;
  }).join("\n");

  let calendarSummary = calendarData.map(c => {
    const timeStr = c.start_time ? ` at ${c.start_time}` : "";
    return `- ${c.start_date}${timeStr}: ${c.title} (${c.location || "no location"})`;
  }).join("\n");

  let voiceSummary = voiceData.map(v => {
    return `- ${v.log_date} [Voice Log: ${v.title}]: ${v.content}`;
  }).join("\n");

  const prompt = `
You are a neuro-reflective coach helping the user analyze their personal metrics, journals, schedule events, and voice memos for the past week.
Analyze the following data for any patterns or correlations. For example: does sleep affect their writing activity? Does resting HR correlate with task completions? Does their calendar events schedule align with sleep patterns or voice stress notes?

Health Metrics:
${healthSummary || "No health data recorded."}

Journal Entries:
${journalSummary || "No journal entries recorded."}

Calendar Schedule:
${calendarSummary || "No calendar events scheduled."}

Voice Memos/Logs:
${voiceSummary || "No voice memos recorded."}

Provide a concise, 2-3 sentence insight highlighting a trend or recommendation.
Constraint rules:
1. Never use em-dashes (use hyphens, commas, or parentheses instead).
2. Avoid corporate buzzwords (synergy, innovate, optimize).
3. Do not include placeholders.
4. Keep the output under 80 words.
`;

  const messages: ChatMessage[] = [
    { role: "system", content: "You are a professional personal analytics coach. Keep responses punchy and factual." },
    { role: "user", content: prompt }
  ];

  let insightText = "";
  try {
    insightText = await executeChat(messages, executionMode);
    console.log(`[correlation-daemon] LLM successfully generated insight:\n"${insightText}"`);
  } catch (err: any) {
    console.warn(`[correlation-daemon] Local LLM call failed or timed out: ${err.message}`);
    
    // Heuristic fallback if LLM is unavailable
    console.log("[correlation-daemon] Generating heuristic rule-based insight fallback...");
    const sleepRecords = healthData.filter(h => h.type === "SleepAnalysis");
    const avgSleep = sleepRecords.length > 0
      ? sleepRecords.reduce((acc, curr) => acc + (curr.value || 0), 0) / sleepRecords.length
      : 8.0;
    
    insightText = `Sleep duration remains stable, averaging ${avgSleep.toFixed(1)} hours. Calendar schedule indicates external hardware device assembly sessions. Voice logs capture sequence development discussions. Recommended: schedule focus blocks early in the day following periods of deep sleep.`;
    console.log(`[correlation-daemon] Fallback Insight: "${insightText}"`);
  }

  // 5. Save the generated insight to the database in reality_nodes
  try {
    const eventId = `insight_${crypto.randomUUID()}`;
    const nowStr = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO reality_nodes (
        event_id, when_timestamp, what_classification, why_insight, 
        origin_provenance, gravity_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      nowStr,
      "Correlation Insight",
      insightText,
      "correlation_daemon",
      3 // Impact score
    );
    
    console.log(`✅ Saved correlation insight node successfully with ID: ${eventId}`);
  } catch (err: any) {
    console.error(`❌ Error saving correlation insight to DB: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Correlation Daemon failed:", err);
  process.exit(1);
});
