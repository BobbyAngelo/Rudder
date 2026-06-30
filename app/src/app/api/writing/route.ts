import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import {
  getEntry,
  listEntries,
  modeBreakdown,
  createEntry,
  updateEntry,
  deleteEntry,
  type JournalEntryInput,
} from "@/lib/db/writing";

/* ═══════════════════════════════════════════════════════
   /api/writing — Journal entries CRUD

   GET  → Returns entries with optional mode filter
   POST → Creates a new entry
   PUT  → Updates an existing entry
   ═══════════════════════════════════════════════════════ */

interface JournalRequestBody {
  id?: number | string;
  title?: string | null;
  content?: string | null;
  mode?: string | null;
  wpm?: number | null;
  tags?: unknown[] | null;
  parent_id?: number | null;
  meta_json?: string | null;
  is_folder?: number | null;
}

/** Map the parsed request body into the repository input shape. */
function toEntryInput(body: JournalRequestBody): JournalEntryInput {
  return {
    title: body.title,
    content: body.content,
    mode: body.mode,
    wpm: body.wpm,
    tags: body.tags,
    parent_id: body.parent_id !== undefined ? body.parent_id : null,
    meta_json: body.meta_json,
    is_folder: body.is_folder,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "";
    const id = searchParams.get("id") || "";

    // Single entry by ID
    if (id) {
      const entry = getEntry(id);
      return NextResponse.json({ entry });
    }

    const entries = listEntries(mode ? { mode } : {});

    // Mode breakdown
    const modes = modeBreakdown();

    return NextResponse.json({ entries, modes });
  } catch (error) {
    log.error("[api/writing] GET error:", error);
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JournalRequestBody;

    const id = createEntry(toEntryInput(body));

    return NextResponse.json({ id });
  } catch (error) {
    log.error("[api/writing] POST error:", error);
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as JournalRequestBody;

    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    updateEntry(body.id, toEntryInput(body));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/writing] PUT error:", error);
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    deleteEntry(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[api/writing] DELETE error:", error);
    return serverError(error);
  }
}
