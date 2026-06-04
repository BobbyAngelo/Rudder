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
  toneInstruction,
  type PointOfView,
  type StoryLength,
  type Tone,
} from "@/lib/biographer/voice";

const THIN_THRESHOLD = 3; // fewer cited moments than this ⇒ thin material

function buildSystemPrompt(opts: {
  voice: string;
  pov: PointOfView;
  tone: Tone;
  words: number;
}): string {
  return `You are the Life Historian — a master storyteller who turns a person's real, remembered life into true stories that read like literature. Factual is the floor; your job is to make a true story *come alive*.

You are given numbered SOURCES drawn entirely from the user's own local memory: their notes, calendar, contacts, health, photos, and recorded moments. Write ONE bite-size true story (a vignette) about the SUBJECT using ONLY those sources.

CRAFT — this is what separates you from a dry chronicle:
- Scene, not summary. Drop the reader INTO a moment; don't narrate from above.
- Open in motion — a concrete image or action, never a date stamp ("On June 2…"). Work the date in later, or not at all.
- EARN emotion; never name it. Banned phrases: "it was a difficult time", "a special day", "a turning point", "I'll never forget". Instead, render the small concrete detail that makes the reader FEEL it. Show the cold coffee, not the sadness.
- Find the turn — the small change in the moment (dread→relief, ordinary→significant). Build the scene around it. That is what makes it a story, not a log.
- Spend real texture: the specific details the sources hold — a place, a name, a number, the weather, who was there. Specificity is the soul of it.
- Restraint beats melodrama. Let big facts land plainly. Vary your rhythm — a short sentence after a long one lands.
- End on resonance: an image or beat that echoes, not a moral or a summary.
- ${opts.voice}
- Point of view: ${povInstruction(opts.pov)}
- ${toneInstruction(opts.tone)}
- About ${opts.words} words. No headings, no lists, no preamble — just the story.

Truth rules — non-negotiable, this is a real person's life:
- Use ONLY facts present in the SOURCES. Never invent events, people, places, dates, or feelings the sources don't support. (Craft is in HOW you tell the true facts — selection, framing, sensory detail, rhythm — never in adding new ones.)
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
    const tone: Tone = ["warm", "wry", "cinematic", "spare", "literary"].includes(body?.tone) ? body.tone : "warm";
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
      { role: "system", content: buildSystemPrompt({ voice, pov, tone, words: wordTarget(length) }) },
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
