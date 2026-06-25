import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { executeChat, ChatMessage } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const { action, text, tone } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const STEVEN_PINKER_RULES = `
Strictly enforce these Steven Pinker writing style guidelines:
1. CURSE OF KNOWLEDGE: Put yourself in the reader's shoes. Introduce problems and context before jumping into specifics. Avoid insular academic/industry jargon. Write for an intellectually curious outsider.
2. SENSORY CONCRETENESS: "Generalizations without examples are useless." Ground abstractions (like "framework", "perspective", "paradigm", "concept", "synergy") with a concrete, visual analogy or example (e.g. "bunny rabbit"). Help the reader "see" what you mean.
3. BREVITY: "Brevity is the soul of wit. Omit needless words." Keep sentences punchy, short, and direct. Avoid padding.
4. EUPHONY & RHYTHM: Create a natural metrical rhythm. Avoid heavy sibilance (consecutive "s" sounds). Use subtle alliterations for flow.
5. ZERO EM-DASHES: Never use em-dashes (— or –). Always use spaced hyphens ( - ) for a break.
6. ANTI-SLOP: Avoid LLM cliches (e.g. "delve", "testament", "tapestry", "moreover", "in conclusion"). Return ONLY the final text with absolutely no greetings, preamble, explanations, or concluding remarks.
`;

    let systemPrompt = "";

    switch (action) {
      case "refine":
        systemPrompt = "You are an expert copyeditor. Rewrite the following text to improve grammar, flow, and clarity. Maintain the original meaning and perspective. " + STEVEN_PINKER_RULES;
        break;
      case "tone":
        systemPrompt = `You are a master stylist. Rewrite the following text to have a distinctly ${tone || "poetic"} tone. ` + STEVEN_PINKER_RULES;
        break;
      case "outline":
        systemPrompt = "Analyze the text and produce a clean, structured Markdown outline organizing its primary themes, narratives, and ideas. Return only the Markdown outline with no introductory or concluding chat filler. Enforce zero em-dashes.";
        break;
      case "continue":
        systemPrompt = "You are the co-writer. Continue the narrative or train of thought of the provided text by writing the next 1-2 paragraphs. Maintain the exact same voice, style, and tone. " + STEVEN_PINKER_RULES;
        break;
      case "summarize":
        systemPrompt = "Summarize the following text in a concise, high-impact paragraph. " + STEVEN_PINKER_RULES;
        break;
      case "prompt":
        systemPrompt = `You are a creative writing coach. Generate a short, compelling creative writing prompt for a writer to kick off a timed writing sprint. The prompt should be 1-2 sentences. Genre or theme: ${tone || "any"}. Do not add any conversational filler.`;
        break;
      case "novel_analyze":
        systemPrompt = "You are a master literary editor. You will analyze a scene or chapter draft and compare it against the provided plot outline and character profiles. Check for character consistency, plot progression, structural pacing, and logical flow. Provide high-impact, actionable, and constructive feedback as a bulleted list. Do not add conversational fillers, greetings, or conclusions.";
        break;
      case "copywrite":
        systemPrompt = `You are a master copywriter trained in Harry Dry's simple communication style.
Rewrite the following text to make it extremely clear, compelling, and persuasive.
Enforce these three rules for every single sentence:
1. CAN I VISUALIZE IT? Replace abstract phrasing with concrete, visual words. Zoom in until you have a concrete, tangible image. (E.g., "supermodels in London and dads in Ohio" instead of "pretty people in big cities and old people in non-big cities").
2. CAN I FALSIFY IT? Do not use vague, subjective adjectives (e.g. "great", "innovative", "funny"). Instead, point to facts, numbers, or actions (e.g. "works in finance", "points to the 50-year chart"). "Don't talk, only point."
3. CAN NOBODY ELSE SAY THIS? Position it so it is bespoke to this specific product/creator and cannot be easily copied by a competitor.

Enforce sibilance cleanup, metrical rhythm, zero em-dashes, and strict brevity. Return ONLY the polished copywriting draft with no preamble, explanations, or introductory/concluding filler.`;
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
