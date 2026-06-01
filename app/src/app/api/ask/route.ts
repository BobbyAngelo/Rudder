/* ═══════════════════════════════════════════════════════
   /api/ask — Natural-language query over your local memory.
   Sovereign: local embeddings + sqlite-vec recall + grounded LLM.
   Returns { answer, sources } — every answer comes with receipts.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recall } from "@/lib/memory";
import { ollamaEmbed } from "@/lib/ollama";
import { executeChat, ChatMessage } from "@/lib/ai";

const SYSTEM_PROMPT = `You are Rudder, the private intelligence layer of a sovereign personal operating system. Answer the user's question using ONLY the numbered sources below — all drawn from the user's own local data.

Rules:
- Cite the source number in brackets (e.g. [2]) for every fact you state.
- If a fact is not supported by a source, do not state it.
- If the sources don't contain the answer, say exactly: "I couldn't find that in your data."
- Be concise and direct; use the specific names, dates, and numbers from the sources.
- Never invent information or rely on outside knowledge about the user.`;

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Question too short" }, { status: 400 });
    }

    const db = getDB();
    const prefs = db
      .prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1")
      .get() as any;
    const mode = prefs?.default_execution_mode || "local_ollama";

    // Retrieve from local memory (embed → KNN → hybrid re-rank → sources).
    let result;
    try {
      result = await recall(db, question, (t) => ollamaEmbed(t), { topN: 6 });
    } catch (e: any) {
      return NextResponse.json({
        answer: `⚠️ Couldn't search your memory: ${e.message}. Is Ollama running?`,
        sources: [],
        online: false,
      });
    }

    if (result.sources.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find anything relevant in your data. Try rephrasing — or run `npm run demo:seed` to load sample data.",
        sources: [],
        online: true,
      });
    }

    const contextStr = result.chunks
      .map((c, i) => `[${i + 1}] (${c.source}) ${c.title}: ${c.content}`)
      .join("\n\n");

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Sources from your data:\n\n${contextStr}\n\n---\n\nQuestion: ${question}` },
    ];

    let answer = "";
    try {
      answer = await executeChat(messages, mode);
    } catch (modelError: any) {
      return NextResponse.json({
        answer: `⚠️ AI request failed [${mode}]: ${modelError.message}`,
        sources: result.sources,
        online: false,
      });
    }

    return NextResponse.json({
      answer,
      sources: result.sources, // [{ id, source, title, date, sourceId, snippet }] in [1..n] order
      online: true,
      chunksUsed: result.chunks.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, online: false }, { status: 500 });
  }
}
