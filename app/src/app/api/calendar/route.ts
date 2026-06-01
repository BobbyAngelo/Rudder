import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

/* ═══════════════════════════════════════════════════════
   Calendar API
   
   GET    /api/calendar?month=YYYY-MM  — Events for a month
   POST   /api/calendar               — Create event
   PUT    /api/calendar?id=X           — Update event
   DELETE /api/calendar?id=X           — Delete event
   ═══════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const db = getDB();
    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // YYYY-MM
    const start = url.searchParams.get("start"); // YYYY-MM-DD
    const end = url.searchParams.get("end");     // YYYY-MM-DD

    let query: string;
    let params: any[];

    if (start && end) {
      // Range query
      query = "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ? ORDER BY start_date, start_time";
      params = [start, end];
    } else if (month) {
      // Month query — get events for entire month + overflow
      const [year, mon] = month.split("-").map(Number);
      const firstDay = `${year}-${String(mon).padStart(2, "0")}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const lastDate = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ? ORDER BY start_date, start_time";
      params = [firstDay, lastDate];
    } else {
      // Default: next 30 days
      const today = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      query = "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ? ORDER BY start_date, start_time";
      params = [today, future];
    }

    const events = db.prepare(query).all(...params);

    // Parse JSON fields
    const parsed = (events as any[]).map((e) => ({
      ...e,
      linked_people: JSON.parse(e.linked_people || "[]"),
    }));

    return NextResponse.json({ events: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDB();

    const {
      title, description, start_date, start_time, end_date, end_time,
      all_day, location, color, category, linked_people, linked_task_id,
    } = body;

    if (!title?.trim() || !start_date) {
      return NextResponse.json({ error: "title and start_date required" }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO calendar_events 
      (title, description, start_date, start_time, end_date, end_time, all_day, location, color, category, linked_people, linked_task_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description || "",
      start_date,
      start_time || null,
      end_date || null,
      end_time || null,
      all_day ? 1 : 0,
      location || "",
      color || "#34d399",
      category || "personal",
      JSON.stringify(linked_people || []),
      linked_task_id || null,
    );

    const event = db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(event, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json();
    const db = getDB();

    const allowedFields = [
      "title", "description", "start_date", "start_time", "end_date", "end_time",
      "all_day", "location", "color", "category", "is_recurring", "recurrence_rule",
      "reminder_minutes", "linked_people", "linked_task_id",
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        const value = typeof body[field] === "object" ? JSON.stringify(body[field]) : body[field];
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(parseInt(id));

    db.prepare(`UPDATE calendar_events SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const event = db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(parseInt(id));
    return NextResponse.json(event);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = getDB();
    db.prepare("DELETE FROM calendar_events WHERE id = ?").run(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
