import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  listHabits,
  listHabitLogs,
  listHabitValues,
  createHabit,
  updateHabit,
  deleteHabit,
  type HabitInput,
  type HabitUpdateInput,
} from "@/lib/db/habits";

export async function GET() {
  try {
    const habits = listHabits();
    const logs = listHabitLogs();
    const values = listHabitValues();

    return NextResponse.json({ habits, logs, values });
  } catch (err) {
    log.error("GET /api/habits Error:", err);
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as HabitInput;

    const id = createHabit(data);

    return NextResponse.json({ id, ...data });
  } catch (err) {
    log.error("POST /api/habits Error:", err);
    return serverError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const data = (await req.json()) as HabitUpdateInput;

    updateHabit(data);

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("PUT /api/habits Error:", err);
    return serverError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "No ID" }, { status: 400 });

    deleteHabit(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("DELETE /api/habits Error:", err);
    return serverError(err);
  }
}
