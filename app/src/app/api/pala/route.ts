import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// API Route for Sovereign Pala Note
// Zero double-hyphens in comments or code

export async function GET(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
      return NextResponse.json({ entry });
    }

    let entries = db.prepare(
      "SELECT id, title, content, mode, word_count, tags, created_at, updated_at FROM journal_entries WHERE mode = 'pala' ORDER BY created_at DESC"
    ).all();

    // Auto-seed if empty
    if (entries.length === 0) {
      console.log("[api/pala] Seeding initial premium notes...");
      const starterNotes = [
        {
          title: "Sovereign AI Vision",
          content: "We must build high-fidelity voice interfaces locally. All voice recordings should live on RUDDER and KIPP, with Whisper running locally. No subscriptions, no telemetry.",
          tags: ["Idea", "Design"]
        },
        {
          title: "Ranger v5.0 Printing",
          content: "Configure the print bed for high-grade black PETG. Shaving 1mm off the internal battery shelf clearance will perfectly isolate the LiPo pack.",
          tags: ["Task", "Hardware"]
        },
        {
          title: "Reflections on Pala Note",
          content: "Pala Note should feel like writing in a premium physical notebook. Soft cream backgrounds, warm dark text, and elegant serif layouts.",
          tags: ["Journal", "Pala"]
        }
      ];

      for (const n of starterNotes) {
        db.prepare(
          `INSERT INTO journal_entries (title, content, mode, word_count, tags)
           VALUES (?, ?, 'pala', ?, ?)`
        ).run(
          n.title,
          n.content,
          n.content.split(/\s+/).filter(w => w.length > 0).length,
          JSON.stringify(n.tags)
        );
      }

      // Re-fetch
      entries = db.prepare(
        "SELECT id, title, content, mode, word_count, tags, created_at, updated_at FROM journal_entries WHERE mode = 'pala' ORDER BY created_at DESC"
      ).all();
    }

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("[api/pala] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();

    const content = body.content || "";
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    const result = db.prepare(
      `INSERT INTO journal_entries (title, content, mode, word_count, tags)
       VALUES (@title, @content, 'pala', @word_count, @tags)`
    ).run({
      title: body.title || "Untitled Note",
      content: content,
      word_count: wordCount,
      tags: JSON.stringify(body.tags || []),
    });

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    console.error("[api/pala] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    db.prepare("DELETE FROM journal_entries WHERE id = ? AND mode = 'pala'").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/pala] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const existing = db.prepare("SELECT * FROM journal_entries WHERE id = ? AND mode = 'pala'").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const title = body.title !== undefined ? body.title : existing.title;
    const content = body.content !== undefined ? body.content : existing.content;
    const tags = body.tags !== undefined ? JSON.stringify(body.tags) : existing.tags;
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    db.prepare(
      `UPDATE journal_entries 
       SET title = ?, content = ?, tags = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND mode = 'pala'`
    ).run(title, content, tags, wordCount, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/pala] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
