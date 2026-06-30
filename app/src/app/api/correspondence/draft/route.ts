import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { getCorrespondence } from "@/lib/db/correspondence";
import { compileHarnessContext, type CompiledHarness } from "@/lib/harness";
import { ollamaChat, ollamaStatus } from "@/lib/ollama";

// Helper to remove any em-dashes from strings
function cleanEmDashes(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ")
    .replace(/–/g, " - ");
}

export async function POST(req: NextRequest) {
  try {
    const bodyData = await req.json();
    const { messageId, harnessSlug } = bodyData;

    if (!messageId || !harnessSlug) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: messageId, harnessSlug"
      }, { status: 400 });
    }

    // 1. Fetch message from database
    const message = getCorrespondence(messageId);
    if (!message) {
      return NextResponse.json({ success: false, error: "Correspondence message not found" }, { status: 404 });
    }

    // 2. Check Ollama status
    const status = await ollamaStatus();
    if (!status.online) {
      return NextResponse.json({
        success: false,
        error: "Local Ollama is offline. Cannot generate draft replies."
      }, { status: 503 });
    }

    // Prefer llama3.2:latest for speed in drafting
    const model = status.models.includes("llama3.2:latest") ? "llama3.2:latest" : (status.models[0] || "llama3.2:latest");

    // 3. Compile context harness
    let harnessContext: CompiledHarness;
    try {
      harnessContext = compileHarnessContext(harnessSlug);
    } catch {
      return NextResponse.json({ success: false, error: `Failed to compile harness context` }, { status: 404 });
    }

    // 4. Invoke Ollama to generate reply draft
    const systemPrompt = `You are a Executive Writing Assistant.
Your job is to draft a reply to the incoming message on behalf of Sovereign User.
Use the provided Context Harness (which contains Robert's profile, bio, email, and values) to adopt his authentic voice.
Robert's voice characteristics: Professional, clear, concise, direct, and action-oriented. Keep it brief.
Format the output as a clean message reply. Do not include any intros/outros, conversational filler, or greetings that aren't part of the email itself.
IMPORTANT: Never use any em-dashes (— or –). Always use spaced hyphens if needed.`;

    const userPrompt = `Compiled Context Guidelines:
${harnessContext.compiled_markdown}

Message to Reply To:
From: ${message.sender}
Subject: ${message.subject || "No Subject"}
Platform: ${message.platform}
Body:
${message.body}

Write a direct, professional reply draft matching Robert's voice:`;

    const rawDraft = await ollamaChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], model);

    const polishedDraft = cleanEmDashes(rawDraft);

    return NextResponse.json({
      success: true,
      draft: polishedDraft,
      model,
      harness_slug: harnessSlug
    });
  } catch (err) {
    log.error("[api/correspondence/draft] POST error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
