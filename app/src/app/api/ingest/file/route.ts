import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { getDB } from "@/lib/db";
import { parseFile } from "@/lib/ingest/parse";
import { invalidateContextChunks } from "@/lib/rag";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type || "application/octet-stream";

    const parseResult = await parseFile(buffer, fileName, mimeType);

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.error,
        missingDependency: parseResult.missingDependency,
        installCommand: parseResult.installCommand
      }, { status: 200 }); // return 200 so UI can handle the missing dependency display gracefully
    }

    const text = parseResult.text || "";
    
    // Save to reality_nodes
    const db = getDB();
    const textHash = crypto.createHash("sha256").update(text + fileName).digest("hex").slice(0, 16);
    const eventId = `file-${textHash}`;
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    const existing = db.prepare("SELECT event_id FROM reality_nodes WHERE event_id = ?").get(eventId);

    if (!existing) {
      db.prepare(`
        INSERT INTO reality_nodes (
          event_id, when_timestamp, where_context, who_entities, what_classification, 
          why_insight, how_actions, state_vitals, gravity_score, origin_provenance, raw_blob
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        now,
        fileName,
        "[]",
        "file-upload",
        text.slice(0, 200),
        JSON.stringify(["parse", "upload"]),
        "{}",
        1,
        "user-upload",
        text
      );
    }

    invalidateContextChunks();
    return NextResponse.json({
      success: true,
      eventId,
      fileName,
      message: "File ingested successfully as observation node."
    });
  } catch (error) {
    log.error("File ingestion error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "Failed to ingest file." },
      { status: 500 }
    );
  }
}
