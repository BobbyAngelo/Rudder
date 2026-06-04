/* ═══════════════════════════════════════════════════════
   /api/biographer/on-this-day — the living loop.
   Find the moments from THIS calendar day in past years and write a short
   true "on this day" vignette. The weekly/daily retention hook a one-time
   keepsake can't touch. GET ?date=YYYY-MM-DD (optional; defaults to today).
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ensureMemory } from "@/lib/memory";
import { executeChat, type ChatMessage } from "@/lib/ai";
import { loadVoiceProfile, voiceInstruction } from "@/lib/biographer/voice";
import { buildCriticSystemPrompt } from "@/lib/biographer/critic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const param = url.searchParams.get("date");
    const today = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : new Date().toISOString().slice(0, 10);
    const md = today.slice(5);          // MM-DD
    const thisYear = today.slice(0, 4);

    const db = getDB();
    ensureMemory(db);

    // Moments on this calendar day, in years before this one.
    const rows = db.prepare(
      `SELECT chunk_id, source, title, content, date FROM chunk_index
       WHERE substr(date, 6, 5) = ? AND substr(date, 1, 4) < ? AND source != 'identity'
       ORDER BY date DESC LIMIT 8`
    ).all(md, thisYear) as any[];

    if (!rows.length) {
      return NextResponse.json({ today, story: "", sources: [], count: 0, empty: true, online: true });
    }

    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    const mode = prefs?.default_execution_mode || "local_ollama";
    const contextStr = rows.map((c, i) => `[${i + 1}] (${c.source} · ${c.date}) ${c.title}: ${c.content}`).join("\n\n");
    const voice = voiceInstruction(loadVoiceProfile());

    const sys = `You are the Life Historian. The SOURCES are all TRUE moments from this same calendar day in the user's past years. Write ONE short "on this day" vignette (about 120 words) — a small, vivid scene that brings a past version of this day to life.
- Open in motion; show, don't tell; EARN emotion (never name it).
- ${voice}
- Cite the source number [n] after each fact. Use ONLY the sources; never invent.`;

    let story = "";
    try {
      story = (await executeChat([
        { role: "system", content: sys },
        { role: "user", content: `Today is ${today}. Moments from this day in past years:\n\n${contextStr}\n\nWrite the "on this day" vignette.` },
      ] as ChatMessage[], mode)).trim();
      try {
        const revised = (await executeChat([
          { role: "system", content: buildCriticSystemPrompt({ voice, tone: "warm" }) },
          { role: "user", content: `SOURCES:\n\n${contextStr}\n\n---\n\nDRAFT:\n\n${story}\n\nReturn the improved version only.` },
        ] as ChatMessage[], mode)).trim();
        if (revised.length > 20) story = revised;
      } catch { /* keep draft */ }
    } catch (e: any) {
      return NextResponse.json({ today, story: `⚠️ ${e.message}`, sources: [], online: false });
    }

    return NextResponse.json({
      today,
      story,
      sources: rows.map((r) => ({ id: r.chunk_id, source: r.source, title: r.title, date: r.date, snippet: (r.content || "").slice(0, 160) })),
      count: rows.length,
      online: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, online: false }, { status: 500 });
  }
}
