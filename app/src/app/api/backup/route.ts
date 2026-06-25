import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { join } from "path";
import { existsSync } from "fs";
import AdmZip from "adm-zip";

export async function GET(req: Request) {
  try {
    // 1. Basic Token Authorization Check (if configured)
    const clientToken = req.headers.get("x-rudder-token") || req.headers.get("X-Rudder-Token") || new URL(req.url).searchParams.get("token");
    const configuredToken = process.env.RUDDER_INGEST_TOKEN;

    if (configuredToken && clientToken !== configuredToken) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid token." },
        { status: 401 }
      );
    }

    // 2. Connect to DB and force WAL checkpoint to sync all transactions to disk
    const db = getDB();
    db.pragma("wal_checkpoint(TRUNCATE)");

    // 3. Define paths
    const DATA_DIR = join(process.cwd(), "..", "data");
    const DB_FILE = join(DATA_DIR, "rudder.db");
    const DOCS_DIR = join(DATA_DIR, "docs");

    if (!existsSync(DB_FILE)) {
      return NextResponse.json({ success: false, message: "Database file not found." }, { status: 500 });
    }

    // 4. Build ZIP file using adm-zip
    const zip = new AdmZip();

    // Add SQLite DB file
    zip.addLocalFile(DB_FILE);

    // Add Docs folder if exists
    if (existsSync(DOCS_DIR)) {
      zip.addLocalFolder(DOCS_DIR, "docs");
    }

    // 5. Generate buffer and return file response
    const zipBuffer = zip.toBuffer();
    const dateStr = new Date().toISOString().split("T")[0];

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="rudder-backup-${dateStr}.zip"`,
        "Content-Length": zipBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error("GET /api/backup Error:", error);
    return NextResponse.json(
      { success: false, message: `Backup failed: ${error.message}` },
      { status: 500 }
    );
  }
}
