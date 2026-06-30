/* ═══════════════════════════════════════════════════════
   /api/import/okf — import an external OKF bundle
   POST multipart/form-data with a `file` field (.zip of an OKF bundle).
   Extracts to data/okf-imports/<bundle> so it flows into RAG.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import AdmZip from "adm-zip";
import { join } from "path";
import { writeImportedBundle } from "@/lib/okf-import";

const DATA_DIR = join(process.cwd(), "..", "data");

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Provide an OKF .zip in the `file` field." }, { status: 400 });
    }

    const blob = file as unknown as Blob & { name?: string };
    const buffer = Buffer.from(await blob.arrayBuffer());

    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: "Uploaded file is not a valid zip." }, { status: 400 });
    }

    const entries = zip.getEntries().map(e => ({
      entryName: e.entryName,
      isDirectory: e.isDirectory,
      getData: () => e.getData(),
    }));

    const bundleName = (blob.name || "imported").toString();
    const result = writeImportedBundle(DATA_DIR, bundleName, entries);

    return NextResponse.json({
      ok: true,
      ...result,
      note: "Imported concepts will be embedded and become searchable on the next query.",
    });
  } catch (err) {
    return serverError(err);
  }
}
