import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { executeChat, ChatMessage, condenseHistory } from "@/lib/ai";

const INTERVIEWER_PROMPT = `You are an expert biographer and interviewer. You are conducting an interview with Sovereign User to extract his daily journal entries, memories, or thoughts.
Your goal is to ask ONE thought-provoking, open-ended question at a time to keep him talking. Do not ask a list of questions.
Keep your responses very brief, conversational, and inquisitive. You are just a guiding presence, not the focus.`;

export async function POST(request: Request) {
  try {
    const { history } = await request.json(); // Array of { role: 'user' | 'assistant', content: string }

    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "Invalid history format" }, { status: 400 });
    }

    const db = getDB();
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as { default_execution_mode?: string } | undefined;
    const mode = prefs?.default_execution_mode || "local_ollama";

    const messages: ChatMessage[] = condenseHistory([
      { role: "system", content: INTERVIEWER_PROMPT },
      ...history
    ], 5);

    const answer = await executeChat(messages, mode);

    return NextResponse.json({
      answer,
      online: true,
      mode
    });
  } catch {
    return NextResponse.json({ error: "Internal server error", online: false }, { status: 500 });
  }
}
