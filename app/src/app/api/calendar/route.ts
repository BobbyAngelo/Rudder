import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import {
  listEventsBetween,
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEventCreateInput,
  type CalendarEventUpdateInput,
} from "@/lib/db/calendar";

/* ═══════════════════════════════════════════════════════
   Calendar API

   GET    /api/calendar?month=YYYY-MM  — Events for a month
   POST   /api/calendar               — Create event
   PUT    /api/calendar?id=X           — Update event
   DELETE /api/calendar?id=X           — Delete event
   ═══════════════════════════════════════════════════════ */

/** Resolve the [start, end] date window from the request's query params. */
function resolveRange(url: URL): { start: string; end: string } {
  const month = url.searchParams.get("month"); // YYYY-MM
  const start = url.searchParams.get("start"); // YYYY-MM-DD
  const end = url.searchParams.get("end"); // YYYY-MM-DD

  if (start && end) return { start, end };

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const firstDay = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const lastDate = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start: firstDay, end: lastDate };
  }

  // Default: next 30 days.
  return {
    start: new Date().toISOString().split("T")[0],
    end: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  };
}

export async function GET(req: NextRequest) {
  try {
    const { start, end } = resolveRange(new URL(req.url));
    const events = listEventsBetween(start, end).map((e) => ({
      ...e,
      linked_people: JSON.parse(e.linked_people || "[]") as number[],
    }));

    return NextResponse.json({ events });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CalendarEventCreateInput>;

    if (!body.title?.trim() || !body.start_date) {
      return NextResponse.json({ error: "title and start_date required" }, { status: 400 });
    }

    const event = createEvent(body as CalendarEventCreateInput);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = (await req.json()) as CalendarEventUpdateInput;
    const result = updateEvent(id, body);

    if (!result.ok) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }
    return NextResponse.json(result.event ?? null);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    deleteEvent(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
