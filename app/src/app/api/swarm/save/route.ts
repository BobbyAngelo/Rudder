import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Rule: Zero em-dashes (— or –).
function cleanEmDashes(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ") // em-dash to spaced hyphen
    .replace(/–/g, " - "); // en-dash to spaced hyphen
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { title, content, mode = "journal", tags = ["swarm", "draft"] } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: "Content is required to save a draft." }, { status: 400 });
    }

    // Enforce title fallback
    if (!title) {
      const nowStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      title = `Swarm Draft - ${nowStr}`;
    }

    // Clean em-dashes
    title = cleanEmDashes(title);
    content = cleanEmDashes(content);

    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    const db = getDB();
    const result = db.prepare(`
      INSERT INTO journal_entries (title, content, mode, word_count, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      title,
      content,
      mode,
      wordCount,
      JSON.stringify(tags)
    );

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
      title,
      wordCount
    });
  } catch (err: any) {
    console.error("[api/swarm/save] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
