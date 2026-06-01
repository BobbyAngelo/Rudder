import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   /api/writing — Journal entries CRUD
   
   GET  → Returns entries with optional mode filter
   POST → Creates a new entry
   PUT  → Updates an existing entry
   ═══════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "";
    const id = searchParams.get("id") || "";

    // Single entry by ID
    if (id) {
      const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
      return NextResponse.json({ entry });
    }

    let query = "SELECT id, title, mode, word_count, wpm, tags, parent_id, meta_json, is_folder, created_at, updated_at FROM journal_entries WHERE 1=1";
    const params: any[] = [];

    if (mode) {
      query += " AND mode = ?";
      params.push(mode);
    }

    query += " ORDER BY is_folder DESC, updated_at DESC";
    const entries = db.prepare(query).all(...params);

    // Mode breakdown
    const modes = db
      .prepare("SELECT mode, COUNT(*) as count FROM journal_entries GROUP BY mode ORDER BY count DESC")
      .all();

    return NextResponse.json({ entries, modes });
  } catch (error: any) {
    console.error("[api/writing] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();

    const content = body.content || "";
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    const result = db
      .prepare(
        `INSERT INTO journal_entries (title, content, mode, word_count, wpm, tags, parent_id, meta_json, is_folder)
         VALUES (@title, @content, @mode, @word_count, @wpm, @tags, @parent_id, @meta_json, @is_folder)`
      )
      .run({
        title: body.title || "Untitled",
        content,
        mode: body.mode || "journal",
        word_count: wordCount,
        wpm: body.wpm || null,
        tags: JSON.stringify(body.tags || []),
        parent_id: body.parent_id !== undefined ? body.parent_id : null,
        meta_json: body.meta_json || "{}",
        is_folder: body.is_folder || 0,
      });

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    console.error("[api/writing] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDB();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const content = body.content || "";
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    db.prepare(
      `UPDATE journal_entries 
       SET title = @title, content = @content, mode = @mode, 
           word_count = @word_count, wpm = @wpm, tags = @tags,
           parent_id = @parent_id, meta_json = @meta_json, is_folder = @is_folder,
           updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id: body.id,
      title: body.title || "Untitled",
      content,
      mode: body.mode || "journal",
      word_count: wordCount,
      wpm: body.wpm || null,
      tags: JSON.stringify(body.tags || []),
      parent_id: body.parent_id !== undefined ? body.parent_id : null,
      meta_json: body.meta_json || "{}",
      is_folder: body.is_folder || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/writing] PUT error:", error);
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

    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/writing] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

