import { getDB } from "./db";
import { log } from "./logger";
import { executeChat, ChatMessage } from "./ai";
import { playNativeSpeech } from "./tts";

/* ═══════════════════════════════════════════════════════
   Voice Navigator Terminal Shell
   Simulating the conversational agent of the Knowledge Navigator.
   ═══════════════════════════════════════════════════════ */

async function main() {
  log.info("\n==================================================");
  log.info("    SOVEREIGN KNOWLEDGE NAVIGATOR (BOOTING...)");
  log.info("==================================================\n");

  const db = getDB();

  // 1. Fetch user display name
  let userName = "Robert";
  try {
    const profile = db.prepare("SELECT display_name FROM identity_profile WHERE id = 1").get() as { display_name?: string } | undefined;
    if (profile?.display_name) userName = profile.display_name;
  } catch { /* fallback */ }

  // 2. Fetch latest biometrics
  let sleepVal = "N/A";
  let restingHR = "N/A";
  try {
    const sleep = db.prepare("SELECT value, unit, category_value FROM health_records WHERE type = 'SleepAnalysis' ORDER BY start_date DESC LIMIT 1").get() as { value: number | null; unit: string | null; category_value: string | null } | undefined;
    if (sleep) sleepVal = sleep.value !== null ? `${sleep.value} ${sleep.unit || ""}` : sleep.category_value ?? "N/A";

    const hr = db.prepare("SELECT value, unit FROM health_records WHERE type = 'HeartRate' ORDER BY start_date DESC LIMIT 1").get() as { value: number | null; unit: string | null } | undefined;
    if (hr) restingHR = `${hr.value} ${hr.unit || ""}`;
  } catch { /* fallback */ }

  // 3. Fetch latest correlation insights
  let latestInsight = "";
  try {
    const insight = db.prepare(`
      SELECT why_insight 
      FROM reality_nodes 
      WHERE what_classification = 'Correlation Insight'
      ORDER BY when_timestamp DESC 
      LIMIT 1
    `).get() as { why_insight?: string } | undefined;
    if (insight?.why_insight) latestInsight = insight.why_insight;
  } catch { /* fallback */ }

  // 4. Fetch default execution mode
  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // 3b. Fetch recent context from RAG search index
  let recentContext = "";
  try {
    const matches = db.prepare(`
      SELECT title, content FROM search_index 
      ORDER BY rowid DESC LIMIT 3
    `).all() as { title: string; content: string }[];
    recentContext = matches.map(m => `- ${m.title}: ${m.content.slice(0, 120)}...`).join("\n");
  } catch { /* fallback */ }

  log.info(`[navigator] Querying local database...`);
  log.info(`  Identified User:  ${userName}`);
  log.info(`  Latest Sleep:     ${sleepVal}`);
  log.info(`  Latest HeartRate: ${restingHR}`);
  log.info(`  Recent Insight:   ${latestInsight ? "Available" : "None"}\n`);

  const prompt = `
Generate a conversational morning briefing from the Sovereign Knowledge Navigator.
Greet the user by name (${userName}).
Incorporate their latest biometric logs: Sleep duration of ${sleepVal} and recent HeartRate of ${restingHR}.
If a recent insight is available (${latestInsight}), integrate its recommendation.
Reference the following recent files, calendar entries, or voice logs retrieved from their search index to help them plan the day:
${recentContext || "No recent files recorded."}

You MUST split your response into three clear sections labeled as follows:
🎙️ GREETING: [Formal, clean greeting, referencing vitals]
📅 AGENDA: [Helpful overview of recent schedule and files]
💡 RECOMMENDATIONS: [A practical productivity advice, following their biometric trends]

Constraint rules:
1. Never use em-dashes (use hyphens, commas, or parentheses instead).
2. Avoid corporate buzzwords (synergy, innovate, optimize).
3. Do not include placeholders.
4. Speak in a slightly formal, clean, and helpful tone (the classic 1987 Knowledge Navigator butler style).
5. Keep the total response under 150 words.
`;

  const messages: ChatMessage[] = [
    { role: "system", content: "You are the conversational interface of the Sovereign Knowledge Navigator. Structure your output exactly as requested, keeping it brief." },
    { role: "user", content: prompt }
  ];

  let speechOutput = "";
  try {
    log.info("[navigator] Generating voice greeting via LLM...");
    speechOutput = await executeChat(messages, executionMode);
  } catch (err) {
    log.warn(`[navigator] LLM failed to respond: ${(err as Error).message}. Using offline default synthesis.`);
    
    // Offline default greeting template
    speechOutput = `🎙️ GREETING:\nGood morning, ${userName}. Based on your latest health records, you slept for ${sleepVal} with a resting heart rate of ${restingHR}.\n\n📅 AGENDA:\nYour agenda indicates hardware assembly sessions and recent voice captures regarding device buffer updates.\n\n💡 RECOMMENDATIONS:\nYour correlation logs suggest a link between adequate sleep and productivity. I recommend scheduling focus blocks early in the day.`;
  }

  // Double-check constraint enforcement (sanitize any em-dashes just in case)
  speechOutput = speechOutput.replace(/—/g, " - ").replace(/--/g, " - ");

  log.info("--------------------------------------------------");
  log.info("🎙️  NAVIGATOR SPEAKS:");
  log.info("--------------------------------------------------");
  log.info(speechOutput);
  log.info("--------------------------------------------------\n");
  
  // Play the speech audio output using the active local system TTS
  await playNativeSpeech(speechOutput);
}

main().catch((err) => {
  log.error("❌ Voice Navigator run failed:", err);
  process.exit(1);
});
