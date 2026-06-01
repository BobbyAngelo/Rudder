import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();
    
    const habits = db.prepare(`
      SELECT 
        h.*,
        v.label as value_label
      FROM habits h
      LEFT JOIN identity_values v ON h.linked_value_id = v.id
      ORDER BY h.created_at ASC
    `).all();

    const logs = db.prepare(`
      SELECT habit_id, date, status, notes
      FROM habit_logs
      ORDER BY date DESC
    `).all();

    const values = db.prepare(`
      SELECT id, label, description FROM identity_values ORDER BY priority ASC
    `).all();

    return NextResponse.json({ habits, logs, values });
  } catch (err: any) {
    console.error("GET /api/habits Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDB();
    const data = await req.json();

    const stmt = db.prepare(`
      INSERT INTO habits (title, description, frequency, linked_value_id, color, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.title,
      data.description || "",
      data.frequency || "daily",
      data.linked_value_id || null,
      data.color || "#60a5fa",
      data.icon || "Target"
    );

    return NextResponse.json({ id: result.lastInsertRowid, ...data });
  } catch (err: any) {
    console.error("POST /api/habits Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDB();
    const data = await req.json();

    const stmt = db.prepare(`
      UPDATE habits 
      SET title = ?, description = ?, frequency = ?, linked_value_id = ?, color = ?, icon = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      data.title,
      data.description || "",
      data.frequency || "daily",
      data.linked_value_id || null,
      data.color || "#60a5fa",
      data.icon || "Target",
      data.id
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/habits Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "No ID" }, { status: 400 });

    db.prepare("DELETE FROM habits WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/habits Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
