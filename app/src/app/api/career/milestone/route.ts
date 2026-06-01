import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { company, title, division, startDate, endDate, highlights } = await req.json();

    if (!company || !title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields: company, title, startDate, or endDate" }, { status: 400 });
    }

    const db = getDB();
    const highlightsJson = JSON.stringify(highlights || []);

    const result = db.prepare(`
      INSERT INTO career_timeline (company, title, division, start_date, end_date, highlights_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(company, title, division || null, startDate, endDate, highlightsJson);

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: "Timeline milestone created successfully"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, company, title, division, startDate, endDate, highlights } = await req.json();

    if (!id || !company || !title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields: id, company, title, startDate, or endDate" }, { status: 400 });
    }

    const db = getDB();
    const highlightsJson = JSON.stringify(highlights || []);

    const result = db.prepare(`
      UPDATE career_timeline
      SET company = ?, title = ?, division = ?, start_date = ?, end_date = ?, highlights_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(company, title, division || null, startDate, endDate, highlightsJson, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Timeline milestone updated successfully"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
    }

    const db = getDB();
    const result = db.prepare("DELETE FROM career_timeline WHERE id = ?").run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Timeline milestone deleted successfully"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
