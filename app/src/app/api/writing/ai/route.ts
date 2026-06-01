import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { executeChat, ChatMessage } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const { action, text, tone } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    let systemPrompt = "";

    switch (action) {
      case "refine":
        systemPrompt = "You are an expert copyeditor. Rewrite the following text to improve grammar, flow, and clarity. Maintain the original meaning and perspective. Return ONLY the edited text, with absolutely no preamble, explanation, or conversational fillers.";
        break;
      case "tone":
        systemPrompt = `You are a master stylist. Rewrite the following text to have a distinctly ${tone || "poetic"} tone. Return ONLY the rewritten text, with absolutely no preamble, explanation, or conversational fillers.`;
        break;
      case "outline":
        systemPrompt = "Analyze the text and produce a clean, structured Markdown outline organizing its primary themes, narratives, and ideas. Return only the Markdown outline with no introductory or concluding chat filler.";
        break;
      case "continue":
        systemPrompt = "You are the co-writer. Continue the narrative or train of thought of the provided text by writing the next 1-2 paragraphs. Maintain the exact same voice, style, and tone. Return ONLY the continuation text, with absolutely no preamble, explanation, or conversational fillers.";
        break;
      case "summarize":
        systemPrompt = "Summarize the following text in a concise, high-impact paragraph. Return ONLY the summary paragraph with no preamble or explanations.";
        break;
      case "prompt":
        systemPrompt = `You are a creative writing coach. Generate a short, compelling creative writing prompt for a writer to kick off a timed writing sprint. The prompt should be 1-2 sentences. Genre or theme: ${tone || "any"}. Do not add any conversational filler.`;
        break;
      case "novel_analyze":
        systemPrompt = "You are a master literary editor. You will analyze a scene or chapter draft and compare it against the provided plot outline and character profiles. Check for character consistency, plot progression, structural pacing, and logical flow. Provide high-impact, actionable, and constructive feedback as a bulleted list. Do not add conversational fillers, greetings, or conclusions.";
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const db = getDB();
    const prefs = db.prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1").get() as any;
    const mode = prefs?.default_execution_mode || "local_ollama";

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ];

    const answer = await executeChat(messages, mode);

    return NextResponse.json({
      result: answer.trim()
    });
  } catch (error: any) {
    console.error("[api/writing/ai] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
