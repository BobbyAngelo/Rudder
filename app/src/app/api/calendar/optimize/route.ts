import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Calculate duration in hours between two HH:MM strings
function getDurationHours(startTime: string, endTime: string): number {
  try {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      return 1.0; // fallback default
    }

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diff = endMinutes - startMinutes;
    
    return diff > 0 ? diff / 60 : 1.0;
  } catch {
    return 1.0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDB();

    // 1. Calculate the start and end dates for the 7-day window (today to today + 6 days)
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // 2. Fetch all calendar events in this range
    const events = db.prepare(
      "SELECT * FROM calendar_events WHERE start_date >= ? AND start_date <= ?"
    ).all(startDate, endDate) as any[];

    // 3. Group events by date and calculate total meeting hours per day
    const hoursPerDay: Record<string, number> = {};
    dates.forEach(d => {
      hoursPerDay[d] = 0;
    });

    events.forEach(event => {
      const eventDate = event.start_date;
      if (hoursPerDay[eventDate] !== undefined) {
        if (event.all_day === 1) {
          // All day events count as a flat 1 hour for density calculation
          hoursPerDay[eventDate] += 1.0;
        } else if (event.start_time && event.end_time) {
          hoursPerDay[eventDate] += getDurationHours(event.start_time, event.end_time);
        } else {
          hoursPerDay[eventDate] += 1.0; // default to 1 hour
        }
      }
    });

    // 4. Calculate fatigue scores and inject Focus Shield tasks if needed
    const optimizedDays = dates.map(date => {
      const meetingHours = hoursPerDay[date];
      // Formula: 6 hours of meetings = 100% density fatigue
      const densityScore = Math.min(100, Math.round((meetingHours / 6) * 100));
      let shieldAdded = false;

      // Shield threshold: >= 50% density (i.e. 3 hours of meetings)
      if (densityScore >= 50) {
        // Check if Focus Shield task already exists for this day
        const existing = db.prepare(
          "SELECT id FROM tasks WHERE title LIKE 'Focus Shield%' AND due_date = ?"
        ).get(date);

        if (!existing) {
          db.prepare(`
            INSERT INTO tasks (title, description, status, priority, project_id, due_date, labels, created_at, updated_at)
            VALUES (?, ?, 'todo', 3, 1, ?, '["Focus"]', datetime('now'), datetime('now'))
          `).run(
            "Focus Shield: Protect Focus Hours",
            `Auto - scheduled to safeguard focus hours on a high - density meeting day (${meetingHours.toFixed(1)} hours of meetings).`,
            date
          );
          shieldAdded = true;
        }
      }

      return {
        date,
        meetingHours,
        densityScore,
        shieldAdded
      };
    });

    // 5. Compute global Focus Strength
    const totalDensity = optimizedDays.reduce((sum, day) => sum + day.densityScore, 0);
    const averageDensity = Math.round(totalDensity / 7);
    const globalFocusScore = Math.max(0, 100 - averageDensity);

    return NextResponse.json({
      success: true,
      globalFocusScore,
      optimizedDays
    });
  } catch (err: any) {
    console.error("[api/calendar/optimize] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
