/* ═══════════════════════════════════════════════════════
   API error helper.

   Logs the real error server-side (for the operator) but returns a generic
   message to the client, so internal details — stack hints, file paths, SQL,
   upstream provider errors — never leak across the wire.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { log } from "./logger";

export function serverError(error: unknown, context?: string) {
  const detail = error instanceof Error ? error.message : String(error);
  log.error(`[api${context ? ":" + context : ""}]`, detail);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
