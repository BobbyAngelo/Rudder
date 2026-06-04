/* ═══════════════════════════════════════════════════════
   /api/biographer/chapter — the chapter assembler.
   A chapter is several beats told in order. We recall an era's moments,
   sort them chronologically, split into beats, and write each as a scene
   that continues from the last — one global citation numbering throughout —
   then polish the whole thing. Vignettes → a chapter.

   POST { subject, pov?, tone?, beats?, polish? }
     → { subject, title, era, pov, tone, story, sources, beats, chunksUsed, polished, online, mode }
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recall } from "@/lib/memory";
import { ollamaEmbed } from "@/lib/ollama";
import { executeChat, type ChatMessage } from "@/lib/ai";
import {
  loadVoiceProfile, voiceInstruction, povInstruction, toneInstruction,
  parseSubject, defaultTitle, type PointOfView, type Tone,
} from "@/lib/biographer/voice";
import { buildCriticSystemPrompt } from "@/lib/biographer/critic";
import { segmentBeats } from "@/lib/biographer/chapter";
import { buildLifeFacts, factsForEra } from "@/lib/biographer/continuity";

function beatSystemPrompt(opts: { voice: string; pov: PointOfView; tone: Tone }): string {
  return `You are the Life Historian, writing ONE scene of a chapter of a person's TRUE life — in order, continuing from the scene before it. Use ONLY the numbered SOURCES (the chapter's full evidence).

Craft (this is what makes it read like literature, not a log):
- Scene, not summary. Open in motion. EARN emotion — never name it ("it was hard", "a special day", "a turning point"); render the concrete detail instead.
- Find the small turn. Spend real texture (places, names, numbers, weather). Restraint over melodrama. Vary rhythm. End on resonance.
- ${opts.voice}
- Point of view: ${povInstruction(opts.pov)}
- ${toneInstruction(opts.tone)}
- Continue naturally from the PREVIOUS SCENE — don't repeat it, don't recap. About 150 words. Just the prose.

Truth rules — non-negotiable:
- Use ONLY facts in the SOURCES. Never invent events, people, places, dates, or feelings.
- Cite the source number in brackets [n] after each fact you use.
- You may be given KNOWN FACTS (role, location, key people) for continuity. Use them to stay consistent across the book, but narrate only what the SOURCES support, and never cite KNOWN FACTS with [n].`;
}

/** Pull an era's moments by date range (chronological), shaped like recall's output. */
function fetchEra(db: any, from: string, to: string, limit: number) {
  const rows = db.prepare(
    `SELECT chunk_id, source, title, content, date FROM chunk_index
     WHERE date BETWEEN ? AND ? AND source != 'identity'
     ORDER BY date ASC LIMIT ?`
  ).all(from, to, limit) as any[];
  return {
    chunks: rows.map((r) => ({ id: r.chunk_id, source: r.source, title: r.title, content: r.content, date: r.date })),
    sources: rows.map((r) => ({ id: r.chunk_id, source: r.source, title: r.title, date: r.date, snippet: (r.content || "").slice(0, 160) })),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawSubject: string = body?.subject;
    if (!rawSubject || typeof rawSubject !== "string" || rawSubject.trim().length < 2) {
      return NextResponse.json({ error: "Provide an era or subject for the chapter." }, { status: 400 });
    }

    const pov: PointOfView = ["memoir", "biography", "for-kids"].includes(body?.pov) ? body.pov : "memoir";
    const tone: Tone = ["warm", "wry", "cinematic", "spare", "literary"].includes(body?.tone) ? body.tone : "warm";
    const beatCount = Math.min(Math.max(Number(body?.beats) || 4, 2), 8);
    const polish: boolean = body?.polish !== false;
    const isDate = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const from: string | null = isDate(body?.from) ? body.from : null;
    const to: string | null = isDate(body?.to) ? body.to : null;

    const parsed = parseSubject(rawSubject);
    const db = getDB();
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    const mode = prefs?.default_execution_mode || "local_ollama";

    // For an era (from/to), pull that range's real moments by DATE (a chapter
    // should cover its whole era). Otherwise, semantic recall for a free subject.
    const topN = Math.min(beatCount * 6, 30);
    let result: { chunks: any[]; sources: any[] };
    try {
      result = (from && to)
        ? fetchEra(db, from, to, topN)
        : await recall(db, parsed.recallQuery, (t) => ollamaEmbed(t), { topN });
    } catch (e: any) {
      return NextResponse.json({ subject: parsed.subject, story: `⚠️ Couldn't search your memory: ${e.message}. Is Ollama running?`, sources: [], online: false });
    }
    if (result.sources.length === 0) {
      return NextResponse.json({
        subject: parsed.subject, title: defaultTitle(parsed), era: parsed.eraLabel, pov, tone,
        story: "", sources: [], beats: 0, chunksUsed: 0, thin: true,
        gapPrompt: `There's nothing in your memory about “${parsed.subject}” yet — tell me about it and I'll start the chapter.`,
        online: true, mode,
      });
    }

    // One global numbering for the whole chapter; beats are chronological slices.
    const contextStr = result.chunks
      .map((c, i) => `[${i + 1}] (${c.source}${c.date ? ` · ${c.date}` : ""}) ${c.title}: ${c.content}`)
      .join("\n\n");
    const beats = segmentBeats(result.sources, beatCount);

    const voice = voiceInstruction(loadVoiceProfile());
    const sys = beatSystemPrompt({ voice, pov, tone });

    // Continuity: the life-facts true in this era, so chapters don't contradict.
    const known = factsForEra(buildLifeFacts(db), from || undefined, to || undefined);
    const knownBlock = known.length
      ? `\n\nKNOWN FACTS (true in this period — stay consistent, don't contradict, don't invent beyond them):\n${known.join("\n")}`
      : "";

    // Write each beat in order, continuing from the previous.
    const scenes: string[] = [];
    try {
      for (const beat of beats) {
        const focus = beat.map((n) => `[${n}]`).join(", ");
        const prev = scenes.length ? scenes[scenes.length - 1] : "(this is the opening scene — set the chapter in motion)";
        const messages: ChatMessage[] = [
          { role: "system", content: sys },
          { role: "user", content: `SOURCES (the whole chapter's evidence):\n\n${contextStr}${knownBlock}\n\n---\n\nWrite the next scene, focused on these moments: ${focus}.\n\nPREVIOUS SCENE:\n${prev}\n\nWrite this scene now.` },
        ];
        const scene = (await executeChat(messages, mode)).trim();
        if (scene) scenes.push(scene);
      }
    } catch (e: any) {
      return NextResponse.json({ subject: parsed.subject, story: `⚠️ The writer failed [${mode}]: ${e.message}`, sources: result.sources, online: false, mode });
    }

    let story = scenes.join("\n\n");

    // Polish the whole chapter once — craft only, no fact changes.
    let polished = false;
    if (polish && story) {
      try {
        const revised = (await executeChat([
          { role: "system", content: buildCriticSystemPrompt({ voice, tone }) },
          { role: "user", content: `SOURCES:\n\n${contextStr}\n\n---\n\nDRAFT CHAPTER:\n\n${story}\n\nReturn the improved chapter only — keep every [n], change no facts.` },
        ], mode)).trim();
        if (revised.length > 40) { story = revised; polished = true; }
      } catch { /* keep assembled */ }
    }

    const citedNums = new Set((story.match(/\[(\d+)\]/g) || []).map((m) => Number(m.replace(/\D/g, ""))));
    return NextResponse.json({
      subject: parsed.subject,
      title: defaultTitle(parsed),
      era: parsed.eraLabel,
      pov, tone, length: "chapter",
      story,
      sources: result.sources,
      beats: beats.length,
      chunksUsed: result.chunks.length,
      cited: [...citedNums].sort((a, b) => a - b),
      polished,
      online: true,
      mode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, online: false }, { status: 500 });
  }
}
