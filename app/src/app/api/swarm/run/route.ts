import { NextRequest, NextResponse } from "next/server";
import { compileHarnessContext } from "@/lib/harness";
import { ollamaChat, ollamaStatus } from "@/lib/ollama";

// Rule: Zero em-dashes (— or –).
function cleanEmDashes(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ") // em-dash to spaced hyphen
    .replace(/–/g, " - "); // en-dash to spaced hyphen
}

export async function POST(req: NextRequest) {
  try {
    const { slug, prompt, model: requestedModel } = await req.json();

    if (!slug) {
      return NextResponse.json({ success: false, error: "harness slug is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 });
    }

    // Check Ollama status
    const status = await ollamaStatus();
    if (!status.online) {
      return NextResponse.json({
        success: false,
        error: "Local Ollama is offline. Please ensure Ollama is running on RUDDER or CASE."
      }, { status: 503 });
    }

    // Determine the best model to use
    // Preference: requested model, then gemma3:12b, gemma4:12b, then llama3.2:latest, fallback to whatever is available
    let model = "llama3.2:latest";
    if (requestedModel && status.models.includes(requestedModel)) {
      model = requestedModel;
    } else if (status.models.includes("gemma4:12b")) {
      model = "gemma4:12b";
    } else if (status.models.includes("gemma3:12b")) {
      model = "gemma3:12b";
    } else if (status.models.length > 0 && !status.models.includes("llama3.2:latest")) {
      model = status.models[0];
    }

    const logs: string[] = [];
    logs.push(cleanEmDashes(`[System] Initializing Swarm Console Engine using model: ${model} on host: ${status.host}`));

    // Fetch and compile context
    logs.push(cleanEmDashes(`[System] Compiling Context Harness for slug: ${slug}...`));
    let harnessContext;
    try {
      harnessContext = compileHarnessContext(slug);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Failed to compile harness context: ${e.message}` }, { status: 404 });
    }

    logs.push(cleanEmDashes(`[System] Context compiled successfully (~${harnessContext.token_estimate} estimated tokens).`));

    // --- Phase 1: Researcher Agent ---
    logs.push(cleanEmDashes("[Researcher] Analyzing context and setting content strategy..."));
    const researcherSystem = `You are the Researcher Agent in a personal operations swarm.
Your job is to analyze the provided Context Harness (which defines the user's profile, values, professional background, and reference assets) and the user's specific prompt.
Generate a structured, strategic outline and key themes to guide the Writer Agent.
Be analytical, precise, and concise. Ensure the strategy frames problems clearly before jumping into specifics (avoiding the Curse of Knowledge).
IMPORTANT: Never use any em-dashes (— or –). Always use spaced hyphens if needed.`;

    const researcherUser = `Compiled Context:
${harnessContext.compiled_markdown}

User Writing Request:
"${prompt}"

Please outline the strategy and key content points for this draft:`;

    let researcherResponse = "";
    try {
      researcherResponse = await ollamaChat([
        { role: "system", content: researcherSystem },
        { role: "user", content: researcherUser }
      ], model);
      researcherResponse = cleanEmDashes(researcherResponse);
      logs.push(cleanEmDashes("[Researcher] Completed analysis. Strategic Outline:"));
      logs.push(researcherResponse);
    } catch (e: any) {
      console.error("[Researcher] Error:", e);
      return NextResponse.json({ success: false, error: `Researcher failed: ${e.message}`, logs }, { status: 500 });
    }

    // --- Phase 2: Writer Agent ---
    logs.push(cleanEmDashes("[Writer] Composing draft in Robert's voice utilizing research outline..."));
    const writerSystem = `You are the Writer Agent in a personal operations swarm.
Your job is to compose the initial draft based on the Context Harness, the user's prompt, and the Researcher's strategic outline.
Adopt the user's authentic tone, aligned with their core values.
Follow these Steven Pinker guidelines:
- SENSORY CONCRETENESS: Ground all generalizations in concrete, visual examples. Avoid vague abstractions (like "framework", "perspective", "paradigm", "concept", "synergy") unless accompanied by a concrete, visual analogy or example (e.g. "bunny rabbit"). Help the reader "see" what you mean.
- BREVITY: "Brevity is the soul of wit. Omit needless words." Keep sentences punchy, short, and direct.
- EUPHONY: Choose words with natural metrical rhythm and flow. Avoid heavy sibilance (too many "s" sounds).
- ZERO EM-DASHES: Never use em-dashes (— or –). Always use spaced hyphens ( - ) for a break.`;

    const writerUser = `Compiled Context:
${harnessContext.compiled_markdown}

User Writing Request:
"${prompt}"

Researcher's Strategic Outline:
${researcherResponse}

Please compose the draft:`;

    let writerResponse = "";
    try {
      writerResponse = await ollamaChat([
        { role: "system", content: writerSystem },
        { role: "user", content: writerUser }
      ], model);
      writerResponse = cleanEmDashes(writerResponse);
      logs.push(cleanEmDashes("[Writer] Completed initial draft:"));
      logs.push(writerResponse);
    } catch (e: any) {
      console.error("[Writer] Error:", e);
      return NextResponse.json({ success: false, error: `Writer failed: ${e.message}`, logs }, { status: 500 });
    }

    // --- Phase 3: Editor Agent ---
    logs.push(cleanEmDashes("[Editor] Polishing copy and verifying rules (zero em-dashes, concise style)..."));
    const editorSystem = `You are the Editor Agent in a personal operations swarm.
Your job is to refine and polish the Writer's draft.
You must strictly enforce the following rules:
1. Zero em-dashes (— or –). Use spaced hyphens if a pause/break is needed.
2. Short, punchy, rhythmic sentences.
3. Authentic, clean, and direct voice.
4. Concreteness: Check that generalizations are accompanied by concrete, visual examples.
5. Euphony: Clean up sibilance (consecutive "s" sounds) and improve rhythm.
6. Anti-Slop: Eliminate LLM clichés (e.g. "delve", "testament", "tapestry", "moreover", "in conclusion").
Make minimal but high-impact edits.
IMPORTANT: Output ONLY the final polished draft. Do not include any explanations, introduction, closing remarks, or conversational filler.`;

    const editorUser = `User Request:
"${prompt}"

Writer's Draft:
${writerResponse}

Please output the final polished copy now:`;

    let editorResponse = "";
    try {
      editorResponse = await ollamaChat([
        { role: "system", content: editorSystem },
        { role: "user", content: editorUser }
      ], model);
      editorResponse = cleanEmDashes(editorResponse);
      logs.push(cleanEmDashes("[Editor] Completed final polish. Output verified."));
    } catch (e: any) {
      console.error("[Editor] Error:", e);
      return NextResponse.json({ success: false, error: `Editor failed: ${e.message}`, logs }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs,
      draft: editorResponse
    });
  } catch (err: any) {
    console.error("[api/swarm/run] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
