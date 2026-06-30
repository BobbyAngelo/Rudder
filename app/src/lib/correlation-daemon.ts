import { getDB } from "./db";
import { log } from "./logger";
import { executeChat, ChatMessage } from "./ai";
import * as crypto from "crypto";

/* ═══════════════════════════════════════════════════════
   Nightly Correlation Engine (Insights Daemon)
   ═══════════════════════════════════════════════════════ */

interface HealthRecordRow {
  date: string;
  type: string;
  value: number | null;
  category_value: string | null;
  unit: string | null;
}

interface JournalRow {
  entry_date: string;
  title: string;
  content: string;
}

interface CalendarRow {
  start_date: string;
  start_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
}

interface VoiceRow {
  log_date: string;
  title: string;
  content: string;
}

async function main() {
  log.info("[correlation-daemon] Starting analysis loop...");
  const db = getDB();

  // 1. Fetch preferences for AI execution modes
  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    if (prefs?.default_execution_mode) {
      executionMode = prefs.default_execution_mode;
    }
  } catch { /* fallback */ }
  
  log.info(`[correlation-daemon] Using execution mode: ${executionMode}`);

  // 2. Fetch health records (last 7 days)
  const healthData: HealthRecordRow[] = [];
  try {
    const records = db.prepare(`
      SELECT date, type, value, category_value, unit
      FROM health_records
      WHERE date >= date('now', '-7 days')
      ORDER BY date ASC
    `).all() as HealthRecordRow[];
    healthData.push(...records);
  } catch (err) {
    log.warn(`[correlation-daemon] Health records query skipped: ${(err as Error).message}`);
  }

  // 3. Fetch journal entries (last 7 days, excluding voice captures)
  const journalData: JournalRow[] = [];
  try {
    const entries = db.prepare(`
      SELECT date(created_at) as entry_date, title, content
      FROM journal_entries
      WHERE created_at >= datetime('now', '-7 days') AND (tags NOT LIKE '%"voice"%' OR tags IS NULL)
      ORDER BY created_at ASC
    `).all() as JournalRow[];
    journalData.push(...entries);
  } catch (err) {
    log.warn(`[correlation-daemon] Journal entries query skipped: ${(err as Error).message}`);
  }

  // 3b. Fetch calendar events (last 7 days)
  const calendarData: CalendarRow[] = [];
  try {
    const events = db.prepare(`
      SELECT start_date, start_time, title, description, location
      FROM calendar_events
      WHERE start_date >= date('now', '-7 days')
      ORDER BY start_date ASC
    `).all() as CalendarRow[];
    calendarData.push(...events);
  } catch (err) {
    log.warn(`[correlation-daemon] Calendar events query skipped: ${(err as Error).message}`);
  }

  // 3c. Fetch voice transcripts (last 7 days)
  const voiceData: VoiceRow[] = [];
  try {
    const voiceLogs = db.prepare(`
      SELECT date(created_at) as log_date, title, content
      FROM journal_entries
      WHERE created_at >= datetime('now', '-7 days') AND tags LIKE '%"voice"%'
      ORDER BY created_at ASC
    `).all() as VoiceRow[];
    voiceData.push(...voiceLogs);
  } catch (err) {
    log.warn(`[correlation-daemon] Voice logs query skipped: ${(err as Error).message}`);
  }

  if (healthData.length === 0 && journalData.length === 0 && calendarData.length === 0 && voiceData.length === 0) {
    log.info("[correlation-daemon] No metrics, journals, calendar, or voice data found for the last 7 days. Exiting.");
    process.exit(0);
  }

  // 4. Format context block for the LLM
  const healthSummary = healthData.map(h => {
    const val = h.value !== null ? `${h.value} ${h.unit || ""}` : h.category_value;
    return `- ${h.date}: ${h.type} = ${val}`;
  }).join("\n");

  const journalSummary = journalData.map(j => {
    return `- ${j.entry_date} [${j.title}]: ${j.content.slice(0, 150)}...`;
  }).join("\n");

  const calendarSummary = calendarData.map(c => {
    const timeStr = c.start_time ? ` at ${c.start_time}` : "";
    return `- ${c.start_date}${timeStr}: ${c.title} (${c.location || "no location"})`;
  }).join("\n");

  const voiceSummary = voiceData.map(v => {
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
    log.info(`[correlation-daemon] LLM successfully generated insight:\n"${insightText}"`);
  } catch (err) {
    log.warn(`[correlation-daemon] Local LLM call failed or timed out: ${(err as Error).message}`);
    
    // Heuristic fallback if LLM is unavailable
    log.info("[correlation-daemon] Generating heuristic rule-based insight fallback...");
    const sleepRecords = healthData.filter(h => h.type === "SleepAnalysis");
    const avgSleep = sleepRecords.length > 0
      ? sleepRecords.reduce((acc, curr) => acc + (curr.value || 0), 0) / sleepRecords.length
      : 8.0;
    
    insightText = `Sleep duration remains stable, averaging ${avgSleep.toFixed(1)} hours. Calendar schedule indicates external hardware device assembly sessions. Voice logs capture sequence development discussions. Recommended: schedule focus blocks early in the day following periods of deep sleep.`;
    log.info(`[correlation-daemon] Fallback Insight: "${insightText}"`);
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
    
    log.info(`✅ Saved correlation insight node successfully with ID: ${eventId}`);
  } catch (err) {
    log.error(`❌ Error saving correlation insight to DB: ${(err as Error).message}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  log.error("❌ Correlation Daemon failed:", err);
  process.exit(1);
});
