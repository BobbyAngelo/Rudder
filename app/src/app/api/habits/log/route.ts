import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const db = getDB();
    const data = await req.json();
    
    // Toggle behavior: if it exists, delete it. If not, insert it.
    const existing = db.prepare(`
      SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?
    `).get(data.habit_id, data.date) as any;

    if (existing) {
      db.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existing.id);
      return NextResponse.json({ success: true, action: "removed" });
    } else {
      const stmt = db.prepare(`
        INSERT INTO habit_logs (habit_id, date, status, notes)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(data.habit_id, data.date, data.status || "completed", data.notes || "");
      return NextResponse.json({ success: true, action: "added" });
    }
  } catch (err: any) {
    console.error("POST /api/habits/log Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
