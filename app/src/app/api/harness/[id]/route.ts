import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

interface SourceParam {
  source_type: string;
  source_target_id?: string | null;
  is_active?: number;
  sort_order?: number;
}

/**
 * GET /api/harness/[id]
 * Fetch a single harness configuration and its sources.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDB();
    const id = (await params).id;

    // Fetch config
    const config = db.prepare("SELECT * FROM harness_configs WHERE id = ?").get(id) as any;
    if (!config) {
      return NextResponse.json({ success: false, error: "Harness config not found" }, { status: 404 });
    }

    // Fetch sources
    const sources = db.prepare("SELECT * FROM harness_sources WHERE harness_id = ? ORDER BY sort_order ASC").all(id) as any[];

    return NextResponse.json({ success: true, harness: config, sources });
  } catch (err: any) {
    console.error("[api/harness/[id]] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/harness/[id]
 * Update a harness configuration and its sources.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDB();
    const id = (await params).id;
    const body = await req.json();

    const { name, slug, description = "", system_instructions = "", target_ai = "claude", sources = [] } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: "Name and slug are required" }, { status: 400 });
    }

    // Update config
    const updateConfig = db.prepare(
      `UPDATE harness_configs 
       SET name = ?, slug = ?, description = ?, system_instructions = ?, target_ai = ?, updated_at = datetime('now')
       WHERE id = ?`
    );
    updateConfig.run(name, slug, description, system_instructions, target_ai, id);

    // Update sources: delete old and insert new in a transaction for safety
    const deleteSources = db.prepare("DELETE FROM harness_sources WHERE harness_id = ?");
    const insertSource = db.prepare(
      `INSERT INTO harness_sources (harness_id, source_type, source_target_id, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );

    const runTransaction = db.transaction(() => {
      deleteSources.run(id);
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i] as SourceParam;
        insertSource.run(
          id,
          src.source_type,
          src.source_target_id !== undefined ? src.source_target_id : null,
          src.is_active !== undefined ? src.is_active : 1,
          src.sort_order !== undefined ? src.sort_order : i
        );
      }
    });

    runTransaction();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/harness/[id]] PUT error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/harness/[id]
 * Delete a harness configuration.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDB();
    const id = (await params).id;

    // Delete configuration. SQLite foreign key cascade cleans up sources.
    db.prepare("DELETE FROM harness_configs WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/harness/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
