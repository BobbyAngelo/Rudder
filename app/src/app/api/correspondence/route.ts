import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ollamaChat, ollamaStatus } from "@/lib/ollama";

// Helper to remove any em-dashes from strings
function cleanEmDashes(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ")
    .replace(/–/g, " - ");
}

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const direction = searchParams.get("direction");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = "SELECT * FROM correspondence";
    const params: any[] = [];
    const conditions: string[] = [];

    if (platform) {
      conditions.push("platform = ?");
      params.push(platform);
    }
    if (direction) {
      conditions.push("direction = ?");
      params.push(direction);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error("[api/correspondence] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDB();
    const bodyData = await req.json();
    const { sender, recipient, subject, body, platform, direction, created_at } = bodyData;

    if (!sender || !recipient || !body || !platform || !direction) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: sender, recipient, body, platform, direction"
      }, { status: 400 });
    }

    let decisionLog = "";

    // Extract decisions for incoming correspondence if Ollama is online
    if (direction === "incoming") {
      const status = await ollamaStatus();
      if (status.online) {
        // Prefer llama3.2:latest for speed in correspondence extraction
        const model = status.models.includes("llama3.2:latest") ? "llama3.2:latest" : (status.models[0] || "llama3.2:latest");
        
        const systemPrompt = `You are an Operations Analyst Agent.
Analyze the incoming message and extract:
1. A 1-sentence summary of the message.
2. Action items (bullet points) and who is responsible.
3. Rationale/context (why this is important or urgent).

Keep it extremely concise. Do not use conversational filler or intros/outros.
IMPORTANT: Never use any em-dashes (— or –). Always use spaced hyphens if needed.`;

        const userPrompt = `Message details:
Platform: ${platform}
Sender: ${sender}
Subject: ${subject || "No Subject"}
Body:
${body}

Extract the summary, action items, and rationale:`;

        try {
          const resText = await ollamaChat([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ], model);
          decisionLog = cleanEmDashes(resText);
        } catch (e: any) {
          console.warn("[api/correspondence] Ollama extraction failed, proceeding without it:", e.message);
        }
      }
    }

    const insertQuery = `
      INSERT INTO correspondence (sender, recipient, subject, body, platform, direction, decision_log, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const timestamp = created_at || new Date().toISOString();
    const result = db.prepare(insertQuery).run(
      sender,
      recipient,
      subject || null,
      body,
      platform,
      direction,
      decisionLog || null,
      timestamp
    );

    const newId = result.lastInsertRowid;
    const insertedRow = db.prepare("SELECT * FROM correspondence WHERE id = ?").get(newId);

    return NextResponse.json({ success: true, data: insertedRow });
  } catch (err: any) {
    console.error("[api/correspondence] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
