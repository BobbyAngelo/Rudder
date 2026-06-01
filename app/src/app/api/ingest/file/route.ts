/* ═══════════════════════════════════════════════════════
   /api/ingest/file — the universal drop door (uploads).
   Drag any file(s) in → parse → enrich → index, locally.
   Multipart form-data, field "files" (one or many).

   Text formats always work; pdf/docx/images need their optional
   parser installed (a missing one is reported per-file, not fatal).
   Token-gated by RUDDER_INGEST_TOKEN when set (same as /api/ingest).
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseFileBuffer, isSupported } from "@/lib/ingest/parse";
import { pushDocs, type PushItem } from "@/lib/ingest/push";
import { ollamaEmbed } from "@/lib/ollama";

const embed = (t: string) => ollamaEmbed(t);

function authorized(request: Request): boolean {
  const token = process.env.RUDDER_INGEST_TOKEN;
  if (!token) return true;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = request.headers.get("x-ingest-token")?.trim();
  return bearer === token || header === token;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const uploaded = [...form.getAll("files"), ...form.getAll("file")].filter(
      (f): f is File => f instanceof File
    );
    if (uploaded.length === 0) {
      return NextResponse.json({ error: "No files uploaded (field 'files')" }, { status: 400 });
    }

    const items: PushItem[] = [];
    const skipped: { file: string; reason: string }[] = [];

    for (const file of uploaded) {
      if (!isSupported(file.name)) {
        skipped.push({ file: file.name, reason: "unsupported type" });
        continue;
      }
      try {
        const parsed = await parseFileBuffer(Buffer.from(await file.arrayBuffer()), file.name);
        if (!parsed) { skipped.push({ file: file.name, reason: "empty or no text" }); continue; }
        items.push({ source: "files", id: file.name, title: parsed.title, text: parsed.body });
      } catch (e: unknown) {
        skipped.push({ file: file.name, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "Nothing ingestable", skipped }, { status: 400 });
    }

    const db = getDB();
    const { indexed, skipped: unchanged, chunks, docs } = await pushDocs(db, items, embed);
    return NextResponse.json({ ok: true, docs, chunks, indexed, unchanged, skipped });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
