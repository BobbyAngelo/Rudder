/* ═══════════════════════════════════════════════════════
   /api/ingest — the universal push door for all inputs.
   Any device/app (typewriter, Strava bridge, watch) POSTs here.

   Auth: if RUDDER_INGEST_TOKEN is set, require it (Bearer or
   x-ingest-token header). Local + sovereign — nothing leaves the box.

   Modes:
     • application/json   → { source, text, title?, date?, id?, people? }
                            or { items: [ ...same... ] }   (batch)
     • multipart/form-data → field "audio" (a file) [+ source/title/date/kind/people]
                            → transcribed via WHISPER_URL, then ingested
                            ("people" = comma-separated or JSON array)
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { pushDocs, type PushItem } from "@/lib/ingest/push";
import { ollamaEmbed } from "@/lib/ollama";
import { transcribeAudio } from "@/lib/transcribe";

const embed = (t: string) => ollamaEmbed(t);

function authorized(request: Request): boolean {
  const token = process.env.RUDDER_INGEST_TOKEN;
  if (!token) return true; // no token configured → allow (local dev)
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = request.headers.get("x-ingest-token")?.trim();
  return bearer === token || header === token;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDB();
  const ct = request.headers.get("content-type") || "";

  try {
    let items: PushItem[] = [];

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio") as File | null;
      if (!file) return NextResponse.json({ error: "No 'audio' file" }, { status: 400 });
      const text = await transcribeAudio(Buffer.from(await file.arrayBuffer()), file.name || "audio.wav");

      // people may arrive as a JSON array or a comma-separated string
      const peopleRaw = (form.get("people") as string) || "";
      let people: string[] | undefined;
      if (peopleRaw.trim()) {
        try {
          const parsed = JSON.parse(peopleRaw);
          people = Array.isArray(parsed) ? parsed.map(String) : undefined;
        } catch {
          people = peopleRaw.split(",").map((p) => p.trim()).filter(Boolean);
        }
      }

      items = [{
        source: (form.get("source") as string) || "capture",
        title: (form.get("title") as string) || undefined,
        date: (form.get("date") as string) || undefined,
        kind: (form.get("kind") as string) || undefined,
        people: people && people.length ? people : undefined,
        text,
      }];
    } else {
      const body = await request.json();
      items = Array.isArray(body.items) ? body.items : [body];
    }

    items = items.filter((i) => i && typeof i.text === "string" && i.text.trim());
    if (items.length === 0) {
      return NextResponse.json({ error: "Nothing to ingest (empty text/audio)" }, { status: 400 });
    }

    const result = await pushDocs(db, items, embed);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
