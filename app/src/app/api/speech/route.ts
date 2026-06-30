import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { generateSpeech } from "@/lib/tts";

/* ═══════════════════════════════════════════════════════
   Speech API Endpoint — Generates audio buffer for text
   ═══════════════════════════════════════════════════════ */

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text parameter is required and must be a string." },
        { status: 400 }
      );
    }

    const audioBuffer = await generateSpeech({ text });
    
    // Return raw audio bytes directly to the caller
    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (err) {
    log.error("[speech-route] Error generating speech:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Voice synthesis failed" },
      { status: 500 }
    );
  }
}
