import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseCommand } from "@/lib/nlp";

// Helper to calculate duration in hours between two HH:MM strings
function getDurationHours(startTime: string, endTime: string): number {
  try {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 1.0;
    const diff = (endH * 60 + endM) - (startH * 60 + startM);
    return diff > 0 ? diff / 60 : 1.0;
  } catch {
    return 1.0;
  }
}

export async function GET() {
  try {
    const db = getDB();
    
    // Get top 3 pending tasks
    const tasks = db.prepare("SELECT title as name, status, priority FROM tasks WHERE status != 'completed' ORDER BY priority DESC, created_at DESC LIMIT 3").all();
    
    // Get next 3 calendar events (sorted by start date and time)
    const events = db.prepare(`
      SELECT title as name, start_date as date, start_time as time, category 
      FROM calendar_events 
      WHERE start_date >= date('now')
      ORDER BY start_date ASC, coalesce(start_time, '23:59') ASC 
      LIMIT 3
    `).all();

    // Calculate Focus Score (density of next 7 days)
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const rangeEvents = db.prepare(
      "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ?"
    ).all(startDate, endDate) as any[];

    const hoursPerDay: Record<string, number> = {};
    dates.forEach(d => { hoursPerDay[d] = 0; });

    rangeEvents.forEach(event => {
      const eventDate = event.start_date;
      if (hoursPerDay[eventDate] !== undefined) {
        if (event.all_day === 1) {
          hoursPerDay[eventDate] += 1.0;
        } else if (event.start_time && event.end_time) {
          hoursPerDay[eventDate] += getDurationHours(event.start_time, event.end_time);
        } else {
          hoursPerDay[eventDate] += 1.0;
        }
      }
    });

    let totalDensity = 0;
    dates.forEach(date => {
      const meetingHours = hoursPerDay[date];
      const densityScore = Math.min(100, Math.round((meetingHours / 6) * 100));
      totalDensity += densityScore;
    });

    const averageDensity = Math.round(totalDensity / 7);
    const globalFocusScore = Math.max(0, 100 - averageDensity);

    return NextResponse.json({ tasks, events, globalFocusScore });
  } catch (error: any) {
    return NextResponse.json({ tasks: [], events: [], globalFocusScore: 100, error: error.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const db = getDB();
    const now = new Date().toISOString();
    
    // Parse the natural language command
    const parsed = parseCommand(name);

    // Enforce zero em-dashes rule
    parsed.title = parsed.title.replace(/—/g, " - ").replace(/–/g, " - ");

    let insertedId: number | string = 0;
    const type = parsed.type;

    if (type === "task") {
      const labelsStr = JSON.stringify([parsed.category]);
      const result = db.prepare(`
        INSERT INTO tasks (title, description, status, priority, project_id, due_date, due_time, labels, created_at, updated_at)
        VALUES (?, '', 'todo', 2, 1, ?, ?, ?, ?, ?)
      `).run(parsed.title, parsed.date, parsed.time, labelsStr, now, now);
      insertedId = Number(result.lastInsertRowid);
    } else {
      const color = parsed.category === "work" ? "#60a5fa" : parsed.category === "health" ? "#f87171" : parsed.category === "social" ? "#f472b6" : "#34d399";
      const result = db.prepare(`
        INSERT INTO calendar_events (title, description, start_date, start_time, end_date, end_time, location, color, category, created_at, updated_at)
        VALUES (?, '', ?, ?, null, null, '', ?, ?, ?, ?)
      `).run(parsed.title, parsed.date, parsed.time, color, parsed.category, now, now);
      insertedId = Number(result.lastInsertRowid);
    }

    return NextResponse.json({ success: true, type, id: insertedId, title: parsed.title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
