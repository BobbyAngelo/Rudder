import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/**
 * GET /api/harness
 * Returns all harness configurations.
 */
export async function GET() {
  try {
    const db = getDB();
    const configs = db.prepare("SELECT * FROM harness_configs ORDER BY id ASC").all() as any[];

    // Include sources count for each
    const enriched = configs.map((c) => {
      const sourcesCount = db
        .prepare("SELECT COUNT(*) as count FROM harness_sources WHERE harness_id = ? AND is_active = 1")
        .get(c.id) as any;
      return {
        ...c,
        sourcesCount: sourcesCount?.count || 0,
      };
    });

    return NextResponse.json({ success: true, harnesses: enriched });
  } catch (err: any) {
    console.error("[api/harness] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/harness
 * Create a new harness configuration.
 */
export async function POST(req: NextRequest) {
  try {
    const db = getDB();
    const body = await req.json();

    const { name, description = "", system_instructions = "", target_ai = "claude", sources = [] } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    // Auto-generate slug
    const slug = body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const insertConfig = db.prepare(
      `INSERT INTO harness_configs (name, slug, description, system_instructions, target_ai)
       VALUES (?, ?, ?, ?, ?)`
    );

    const result = insertConfig.run(name, slug, description, system_instructions, target_ai);
    const newId = result.lastInsertRowid;

    // Insert sources if provided
    if (Array.isArray(sources) && sources.length > 0) {
      const insertSource = db.prepare(
        `INSERT INTO harness_sources (harness_id, source_type, source_target_id, sort_order)
         VALUES (?, ?, ?, ?)`
      );

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        insertSource.run(newId, src.source_type, src.source_target_id !== undefined ? src.source_target_id : null, src.sort_order || i);
      }
    }

    return NextResponse.json({ success: true, id: newId, slug });
  } catch (err: any) {
    console.error("[api/harness] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
