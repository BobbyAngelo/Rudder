/* ═══════════════════════════════════════════════════════
   /api/export/okf — Open Knowledge Format export
   GET → downloads a .zip OKF bundle of your knowledge.

   Query params (all default true except where noted):
     identity, career, notes, graph  (set to "0" to exclude)
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { buildOKFBundle } from "@/lib/okf";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const on = (k: string) => searchParams.get(k) !== "0";

    const files = buildOKFBundle({
      includeIdentity: on("identity"),
      includeCareer: on("career"),
      includeNotes: on("notes"),
      includeGraph: on("graph"),
    });

    if (!files.length) {
      return NextResponse.json(
        { error: "No exportable knowledge found. Populate Rudder first." },
        { status: 404 }
      );
    }

    const zip = new AdmZip();
    for (const f of files) {
      zip.addFile(f.path, Buffer.from(f.content, "utf-8"));
    }
    const buffer = zip.toBuffer();

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="rudder-okf-${date}.zip"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
