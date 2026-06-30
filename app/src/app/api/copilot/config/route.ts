import { NextResponse } from "next/server";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured in .env.local" }, { status: 404 });
    }
    return NextResponse.json({ geminiApiKey: key });
  } catch (error) {
    log.error("[api/copilot/config] GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve configuration" }, { status: 500 });
  }
}
