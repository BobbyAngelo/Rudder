/* ═══════════════════════════════════════════════════════
   /api/ask — Natural Language Query Endpoint
   Sovereign AI: Ollama + RAG over local data
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildContextChunks, retrieveChunks } from "@/lib/rag";
import { executeChat, ChatMessage } from "@/lib/ai";

const SYSTEM_PROMPT = `You are Rudder AI, the intelligence layer of a sovereign personal operating system. You answer questions using ONLY the context provided below. If the context doesn't contain enough information to fully answer, say so honestly.

Rules:
- Be concise and direct
- Use specific names, dates, numbers from the context
- Format lists with bullet points when helpful
- Never make up information not in the context
- If asked about health data, mention the metric type and averages
- If asked about people, mention their company and role if available
- If asked about schedule or tasks, list the most relevant events or todos`;

export async function POST(request: Request) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Question too short" }, { status: 400 });
    }

    const db = getDB();
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    const mode = prefs?.default_execution_mode || "local_ollama";

    // Build context
    const allChunks = buildContextChunks();
    const relevant = retrieveChunks(allChunks, question, 15);

    if (relevant.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant data in your system for that question. Try rephrasing or being more specific.",
        sources: [],
        online: true,
        totalChunks: allChunks.length,
      });
    }

    const contextStr = relevant
      .map((c, i) => `[${i + 1}] (${c.source}) ${c.content}`)
      .join("\n\n");

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context from sovereign data (${relevant.length} relevant records found from ${allChunks.length} total):\n\n${contextStr}\n\n---\n\nQuestion: ${question}`,
      },
    ];

    let answer = "";
    try {
      answer = await executeChat(messages, mode);
    } catch (modelError: any) {
      return NextResponse.json({
        answer: `⚠️ AI Request Failed [${mode}]: ${modelError.message}`,
        sources: [],
        online: false,
      });
    }

    const sources = [...new Set(relevant.map(c => c.source))];

    return NextResponse.json({
      answer,
      sources,
      online: true,
      chunksUsed: relevant.length,
      totalChunks: allChunks.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, online: false }, { status: 500 });
  }
}
