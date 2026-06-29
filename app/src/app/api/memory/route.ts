/* ═══════════════════════════════════════════════════════
   /api/memory — Mem0 Long-Term Memory Management
   GET    ?q=...   search memories (omit q to list all)
   POST   { messages | text }   add a memory
   DELETE ?id=...  remove a memory
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import {
  searchMemory,
  getAllMemories,
  addMemory,
  deleteMemory,
  memoryAvailable,
} from "@/lib/mem0";

export async function GET(request: Request) {
  const available = await memoryAvailable();
  if (!available) {
    return NextResponse.json({ available: false, memories: [] });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const memories = q ? await searchMemory(q) : await getAllMemories();
  return NextResponse.json({ available: true, count: memories.length, memories });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages)
      ? body.messages
      : body?.text
        ? [{ role: "user" as const, content: String(body.text) }]
        : null;

    if (!messages) {
      return NextResponse.json({ error: "Provide `messages` array or `text` string" }, { status: 400 });
    }

    await addMemory(messages);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing `id`" }, { status: 400 });
  }
  const ok = await deleteMemory(id);
  return NextResponse.json({ ok });
}
