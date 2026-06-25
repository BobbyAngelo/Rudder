import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Non-negotiable: Standard hyphens, colons, or parentheses only. Zero em-dashes.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { triggerEvent, payload } = body;

    if (!triggerEvent || !payload) {
      return NextResponse.json({ error: "Missing triggerEvent or payload" }, { status: 400 });
    }

    const db = getDB();

    if (triggerEvent === "BOOKING_CREATED") {
      const { title, description, startTime, endTime, location, uid, attendees } = payload;

      if (!title || !startTime) {
        return NextResponse.json({ error: "Missing booking title or startTime" }, { status: 400 });
      }

      // Parse date and time from ISO strings
      // e.g. "2026-05-29T20:00:00.000Z" -> "2026-05-29" and "20:00"
      const startParts = startTime.split("T");
      const startDate = startParts[0];
      const startTimeVal = startParts[1] ? startParts[1].substring(0, 5) : null;

      const endParts = endTime ? endTime.split("T") : [];
      const endDate = endParts[0] || startDate;
      const endTimeVal = endParts[1] ? endParts[1].substring(0, 5) : null;

      // Compile detailed description including attendees list
      let attendeeList = "";
      if (Array.isArray(attendees) && attendees.length > 0) {
        attendeeList = "\n\nAttendees:\n" + attendees.map((a: any) => `  - ${a.name || "Unknown"} (${a.email || "No email"})`).join("\n");
      }

      const fullDescription = `${description || ""}${attendeeList}\n\nCal.com UID: ${uid}`;

      // Insert event into local database
      db.prepare(`
        INSERT INTO calendar_events 
        (title, description, start_date, start_time, end_date, end_time, all_day, location, color, category, linked_people, linked_task_id)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, '#60a5fa', 'work', '[]', NULL)
      `).run(
        `[Cal] ${title}`,
        fullDescription,
        startDate,
        startTimeVal,
        endDate,
        endTimeVal,
        location || "Online"
      );

      console.log(`[cal.com webhook] Synced BOOKING_CREATED: ${title} (${uid})`);
      return NextResponse.json({ success: true, action: "BOOKING_CREATED", uid });
    } 
    
    else if (triggerEvent === "BOOKING_CANCELLED") {
      const { uid } = payload;

      if (!uid) {
        return NextResponse.json({ error: "Missing uid in cancellation payload" }, { status: 400 });
      }

      // Delete the booking by scanning for the Cal.com UID inside description
      const result = db.prepare(`
        DELETE FROM calendar_events 
        WHERE description LIKE ?
      `).run(`%Cal.com UID: ${uid}%`);

      console.log(`[cal.com webhook] Synced BOOKING_CANCELLED: Deleted ${result.changes} records for UID (${uid})`);
      return NextResponse.json({ success: true, action: "BOOKING_CANCELLED", uid, deletedCount: result.changes });
    }

    return NextResponse.json({ message: `Trigger event '${triggerEvent}' ignored.` });

  } catch (err: any) {
    console.error("[cal.com webhook] Synchronization error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
