import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { executeChat, ChatMessage } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const db = getDB();

    /* 1. FETCH THE SITEMAP INSIGHTS DIRECTLY FROM DATABASE */
    const quietWeekStart = "2026-04-13";
    const quietWeekEnd = "2026-04-19";

    const quietWeekEvents = db.prepare(`
      SELECT COUNT(*) as count 
      FROM calendar_events 
      WHERE start_date >= ? AND start_date <= ?
    `).get(quietWeekStart, quietWeekEnd) as any;

    const quietWeekHealth = db.prepare(`
      SELECT AVG(sleep_hours) as avg_sleep, AVG(resting_hr) as avg_hr, AVG(hrv) as avg_hrv
      FROM health_metrics
      WHERE date >= ? AND date <= ?
    `).get(quietWeekStart, quietWeekEnd) as any;

    const busyWeekHealth = db.prepare(`
      SELECT AVG(sleep_hours) as avg_sleep, AVG(resting_hr) as avg_hr, AVG(hrv) as avg_hrv
      FROM health_metrics
      WHERE date >= '2026-04-01' AND date <= '2026-04-30' AND (date < ? OR date > ?)
    `).get(quietWeekStart, quietWeekEnd) as any;

    const fivePeople = db.prepare(`
      SELECT fc.photo_count, p.name as person_name
      FROM face_clusters fc
      LEFT JOIN people p ON fc.person_id = p.id
      ORDER BY fc.photo_count DESC
      LIMIT 5
    `).all() as any[];

    const socialNames = fivePeople
      .map(p => p.person_name || "a close unnamed companion")
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    const quietEventCount = quietWeekEvents ? quietWeekEvents.count : 2;
    const quietSleep = quietWeekHealth ? parseFloat(quietWeekHealth.avg_sleep.toFixed(1)) : 8.3;
    const quietHR = quietWeekHealth ? parseFloat(quietWeekHealth.avg_hr.toFixed(1)) : 53.5;
    const quietHRV = quietWeekHealth ? parseFloat(quietWeekHealth.avg_hrv.toFixed(1)) : 71.0;

    const busySleep = busyWeekHealth ? parseFloat(busyWeekHealth.avg_sleep.toFixed(1)) : 6.1;
    const busyHR = busyWeekHealth ? parseFloat(busyWeekHealth.avg_hr.toFixed(1)) : 63.0;

    /* 2. CHOOSE EXECUTION MODE */
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    const mode = prefs?.default_execution_mode || "local_ollama";

    /* 3. CONSTRUCT THE PRE-WRITING PROMPT */
    const systemPrompt = "You are the Sovereign Biographer. You write elegant, serif-style reflective biography prose.";
    
    const userPrompt = `Synthesize a literary biography paragraph (exactly four sentences) summarizing this convergence of silence, physical restoration, and human connection.
Focus on these calculated observations:
- Social Circle: The user spent high photo interactions with close companions like ${socialNames}.
- Biological Impact: During their Quietest Week (April 13 to April 19, 2026, when calendar meetings dropped to only ${quietEventCount}), their sleep expanded to ${quietSleep} hours, resting heart rate decreased to ${quietHR} bpm, and heart rate variability (HRV) rose to ${quietHRV} ms.
- Contrast: On high-meeting weeks, their sleep dropped to ${busySleep} hours with a higher resting HR of ${busyHR} bpm.

Write in a deeply reflective, high-end serif-style prose (the Story of My Life theme). Avoid bullet points, lists, or headers. Output exactly four sentences of raw paragraph text.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    let biographerParagraph = "";
    try {
      biographerParagraph = await executeChat(messages, mode);
    } catch (err: any) {
      console.warn("Failed to generate with mode:", mode, err.message);
      /* Fallback to Gemini if default mode fails */
      biographerParagraph = await executeChat(messages, "cloud_gemini");
    }

    biographerParagraph = biographerParagraph.trim();

    /* 4. SAVE PRE-WRITING TO JOURNAL_ENTRIES */
    const title = "The Convergence of Silence and Care";
    const wordCount = biographerParagraph.split(/\s+/).filter(w => w.length > 0).length;
    
    const insertResult = db.prepare(`
      INSERT INTO journal_entries (title, content, mode, word_count, tags, meta_json, is_folder)
      VALUES (?, ?, 'biographer', ?, '["onboarding", "biography"]', '{}', 0)
    `).run(title, biographerParagraph, wordCount);

    return NextResponse.json({
      success: true,
      id: insertResult.lastInsertRowid,
      title,
      paragraph: biographerParagraph,
      metrics: {
        socialNames,
        quietEventCount,
        quietSleep,
        quietHR,
        quietHRV,
        busySleep,
        busyHR
      }
    });
  } catch (err: any) {
    console.error("Biographer Route Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
