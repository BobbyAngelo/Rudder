import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();
    
    // Get top 3 pending tasks
    const tasks = db.prepare("SELECT title as name, status, priority FROM tasks WHERE status != 'completed' ORDER BY priority DESC, created_at DESC LIMIT 3").all();
    
    // Get next 3 calendar events (mocking query as calendar_events might need date parsing, just grabbing latest for now)
    const events = db.prepare("SELECT title as name, start_time as time FROM calendar_events ORDER BY start_time ASC LIMIT 3").all();

    return NextResponse.json({ tasks, events });
  } catch (error: any) {
    return NextResponse.json({ tasks: [], events: [], error: error.message });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const db = getDB();
    const now = new Date().toISOString();
    
    const info = db.prepare(`
      INSERT INTO tasks (title, status, priority, created_at, updated_at) 
      VALUES (?, 'todo', 2, ?, ?)
    `).run(name, now, now);

    return NextResponse.json({ success: true, id: info.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
