import { getDB } from "./db";
import { executeChat, ChatMessage } from "./ai";
import { playNativeSpeech } from "./tts";

/* ═══════════════════════════════════════════════════════
   Voice Navigator Terminal Shell
   Simulating the conversational agent of the Knowledge Navigator.
   ═══════════════════════════════════════════════════════ */

async function main() {
  console.log("\n==================================================");
  console.log("    SOVEREIGN KNOWLEDGE NAVIGATOR (BOOTING...)");
  console.log("==================================================\n");

  const db = getDB();

  // 1. Fetch user display name
  let userName = "Robert";
  try {
    const profile = db.prepare("SELECT display_name FROM identity_profile WHERE id = 1").get() as any;
    if (profile?.display_name) userName = profile.display_name;
  } catch { /* fallback */ }

  // 2. Fetch latest biometrics
  let sleepVal = "N/A";
  let hrvVal = "N/A";
  let restingHR = "N/A";
  try {
    const sleep = db.prepare("SELECT value, unit, category_value FROM health_records WHERE type = 'SleepAnalysis' ORDER BY start_date DESC LIMIT 1").get() as any;
    if (sleep) sleepVal = sleep.value !== null ? `${sleep.value} ${sleep.unit || ""}` : sleep.category_value;

    const hr = db.prepare("SELECT value, unit FROM health_records WHERE type = 'HeartRate' ORDER BY start_date DESC LIMIT 1").get() as any;
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
    `).get() as any;
    if (insight?.why_insight) latestInsight = insight.why_insight;
  } catch { /* fallback */ }

  // 4. Fetch default execution mode
  let executionMode = "local_ollama";
  try {
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    if (prefs?.default_execution_mode) executionMode = prefs.default_execution_mode;
  } catch { /* fallback */ }

  // 3b. Fetch recent context from RAG search index
  let recentContext = "";
  try {
    const matches = db.prepare(`
      SELECT title, content FROM search_index 
      ORDER BY rowid DESC LIMIT 3
    `).all() as any[];
    recentContext = matches.map(m => `- ${m.title}: ${m.content.slice(0, 120)}...`).join("\n");
  } catch { /* fallback */ }

  console.log(`[navigator] Querying local database...`);
  console.log(`  Identified User:  ${userName}`);
  console.log(`  Latest Sleep:     ${sleepVal}`);
  console.log(`  Latest HeartRate: ${restingHR}`);
  console.log(`  Recent Insight:   ${latestInsight ? "Available" : "None"}\n`);

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
    console.log("[navigator] Generating voice greeting via LLM...");
    speechOutput = await executeChat(messages, executionMode);
  } catch (err: any) {
    console.warn(`[navigator] LLM failed to respond: ${err.message}. Using offline default synthesis.`);
    
    // Offline default greeting template
    speechOutput = `🎙️ GREETING:\nGood morning, ${userName}. Based on your latest health records, you slept for ${sleepVal} with a resting heart rate of ${restingHR}.\n\n📅 AGENDA:\nYour agenda indicates hardware assembly sessions and recent voice captures regarding device buffer updates.\n\n💡 RECOMMENDATIONS:\nYour correlation logs suggest a link between adequate sleep and productivity. I recommend scheduling focus blocks early in the day.`;
  }

  // Double-check constraint enforcement (sanitize any em-dashes just in case)
  speechOutput = speechOutput.replace(/—/g, " - ").replace(/--/g, " - ");

  console.log("--------------------------------------------------");
  console.log("🎙️  NAVIGATOR SPEAKS:");
  console.log("--------------------------------------------------");
  console.log(speechOutput);
  console.log("--------------------------------------------------\n");
  
  // Play the speech audio output using the active local system TTS
  await playNativeSpeech(speechOutput);
}

main().catch((err) => {
  console.error("❌ Voice Navigator run failed:", err);
  process.exit(1);
});
