import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import { toggleHabitLog, type HabitLogInput } from "@/lib/db/habits";

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as HabitLogInput;

    // Toggle behavior: if it exists, delete it. If not, insert it.
    const result = toggleHabitLog(data);

    return NextResponse.json({ success: true, action: result.action });
  } catch (err) {
    log.error("POST /api/habits/log Error:", err);
    return serverError(err);
  }
}
