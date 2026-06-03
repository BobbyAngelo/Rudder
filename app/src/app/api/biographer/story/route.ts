/* ═══════════════════════════════════════════════════════
   /api/biographer/story — the Life Historian's grounded vignette writer.

   Given a SUBJECT (a year, an era, a person, a place, or a free query),
   recall the relevant moments from the user's own local memory and write
   ONE bite-size TRUE story — in the user's own voice, with citations.

   Sovereign + faithful: uses ONLY recalled sources, never invents, and
   returns the exact sources it drew from. When memory is thin, it says so
   and hands back an interview question instead of fabricating.

   POST { subject, pov?, length?, topN? }
     → { subject, title, era?, pov, story, sources, chunksUsed, thin, gapPrompt?, online, mode }
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recall } from "@/lib/memory";
import { ollamaEmbed } from "@/lib/ollama";
import { executeChat, ChatMessage } from "@/lib/ai";
import {
  loadVoiceProfile,
  voiceInstruction,
  povInstruction,
  parseSubject,
  defaultTitle,
  wordTarget,
  type PointOfView,
  type StoryLength,
} from "@/lib/biographer/voice";

const THIN_THRESHOLD = 3; // fewer cited moments than this ⇒ thin material

function buildSystemPrompt(opts: {
  voice: string;
  pov: PointOfView;
  words: number;
}): string {
  return `You are the Life Historian — a masterful biographer who turns a person's real, remembered life into short, true stories worth reading.

You are given numbered SOURCES drawn entirely from the user's own local memory: their notes, calendar, contacts, health, photos, and recorded moments. Write ONE bite-size true story (a vignette) about the SUBJECT using ONLY those sources.

Craft:
- Tell it as a scene: a specific moment, a small turn, and the feeling underneath. Show, don't summarize.
- Spend the concrete details the sources give you — real dates, names, places, numbers — so it is vivid and unmistakably theirs.
- ${opts.voice}
- Point of view: ${povInstruction(opts.pov)}
- Keep it tight: about ${opts.words} words. No headings, no lists, no preamble — just the story.

Truth rules — non-negotiable, this is a real person's life:
- Use ONLY facts present in the SOURCES. Never invent events, people, places, dates, or feelings that the sources do not support.
- Cite the source number in brackets like [2] right after each factual detail you draw from it.
- If the sources are too thin to tell the story honestly, write only what is supported and end with one short line beginning "Gap:" naming what's missing. Do not fill gaps with invention.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawSubject: string = body?.subject;
    if (!rawSubject || typeof rawSubject !== "string" || rawSubject.trim().length < 2) {
      return NextResponse.json({ error: "Provide a subject — a year, person, place, era, or moment." }, { status: 400 });
    }

    const pov: PointOfView = ["memoir", "biography", "for-kids"].includes(body?.pov) ? body.pov : "memoir";
    const length: StoryLength = body?.length === "chapter" ? "chapter" : "vignette";
    const topN: number = Math.min(Math.max(Number(body?.topN) || (length === "chapter" ? 12 : 8), 4), 20);

    const parsed = parseSubject(rawSubject);

    const db = getDB();
    const prefs = db
      .prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1")
      .get() as { default_execution_mode?: string } | undefined;
    const mode = prefs?.default_execution_mode || "local_ollama";

    // 1) Recall the moments for this subject from local memory.
    let result;
    try {
      result = await recall(db, parsed.recallQuery, (t) => ollamaEmbed(t), { topN });
    } catch (e: any) {
      return NextResponse.json({
        subject: parsed.subject,
        story: `⚠️ Couldn't search your memory: ${e.message}. Is Ollama running?`,
        sources: [],
        online: false,
      });
    }

    // 2) No material ⇒ don't invent; hand back an interview question.
    if (result.sources.length === 0) {
      return NextResponse.json({
        subject: parsed.subject,
        title: defaultTitle(parsed),
        era: parsed.eraLabel,
        pov,
        story: "",
        sources: [],
        chunksUsed: 0,
        thin: true,
        gapPrompt: `There's nothing in your memory about “${parsed.subject}” yet. Tell me about it — what's one specific moment you remember?`,
        online: true,
        mode,
      });
    }

    // 3) Render the numbered sources for grounding + citation.
    const contextStr = result.chunks
      .map((c, i) => {
        const date = c.date ? ` · ${c.date}` : "";
        return `[${i + 1}] (${c.source}${date}) ${c.title}: ${c.content}`;
      })
      .join("\n\n");

    const voice = voiceInstruction(loadVoiceProfile());
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt({ voice, pov, words: wordTarget(length) }) },
      {
        role: "user",
        content: `SUBJECT: ${parsed.subject}${parsed.eraLabel ? `\nERA: ${parsed.eraLabel}` : ""}\n\nSOURCES from your memory:\n\n${contextStr}\n\n---\n\nWrite the story now.`,
      },
    ];

    // 4) Write it.
    let story = "";
    try {
      story = (await executeChat(messages, mode)).trim();
    } catch (modelError: any) {
      return NextResponse.json({
        subject: parsed.subject,
        story: `⚠️ The writer failed [${mode}]: ${modelError.message}`,
        sources: result.sources,
        online: false,
        mode,
      });
    }

    // 5) Faithfulness signals: did it cite, and was material thin?
    const citedNums = new Set((story.match(/\[(\d+)\]/g) || []).map((m) => Number(m.replace(/\D/g, ""))));
    const thin = result.sources.length < THIN_THRESHOLD;
    const gapMatch = story.match(/\bGap:\s*(.+)$/im);

    return NextResponse.json({
      subject: parsed.subject,
      title: defaultTitle(parsed),
      era: parsed.eraLabel,
      pov,
      length,
      story,
      sources: result.sources, // [{ id, source, title, date, sourceId, snippet }] in [1..n] order
      chunksUsed: result.chunks.length,
      cited: [...citedNums].sort((a, b) => a - b),
      thin,
      gapPrompt: thin
        ? `Your memory of “${parsed.subject}” is sparse — I told only what's there. Want to add more? What else do you remember?`
        : gapMatch
          ? gapMatch[1].trim()
          : undefined,
      online: true,
      mode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, online: false }, { status: 500 });
  }
}
