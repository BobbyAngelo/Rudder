/* ═══════════════════════════════════════════════════════
   /api/connectors — manage + sync data sources.
   GET  → list connectors
   POST → { action: "add" | "sync" | "remove", ... }
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { listConnectors, addConnector, syncConnector, removeConnector } from "@/lib/connectors";
import { ollamaEmbed } from "@/lib/ollama";

const embed = (t: string) => ollamaEmbed(t);

export async function GET() {
  try {
    const db = getDB();
    return NextResponse.json({ connectors: listConnectors(db) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDB();
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "add") {
      // Accept either a full config object or a bare path (back-compat).
      const config = body.config || { path: body.path, ...(body.exclude ? { exclude: body.exclude } : {}) };
      const connector = addConnector(db, body.type || "markdown", config);
      const result = await syncConnector(db, connector.id, embed);
      return NextResponse.json({ ok: true, connector, ...result });
    }
    if (action === "sync") {
      const result = await syncConnector(db, body.id, embed);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "remove") {
      removeConnector(db, body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
