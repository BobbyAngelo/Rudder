import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body can be empty
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || body.id;
    const sourceParam = searchParams.get("source") || body.source;
    const libraryPath = searchParams.get("library_path") || body.library_path;
    const dryRun = searchParams.get("dry_run") === "true" || body.dry_run === true;
    const db = getDB();

    const importScriptPath = path.join(process.cwd(), "..", "scripts", "import.ts");
    if (!fs.existsSync(importScriptPath)) {
      return NextResponse.json({ error: `Scanner script launcher not found at ${importScriptPath}` }, { status: 500 });
    }

    const doubleDash = "-".repeat(2);

    if (sourceParam === "apple") {
      const args = ["apple-photos"];
      if (libraryPath) {
        args.push(`${doubleDash}library`, libraryPath);
      }
      if (dryRun) {
        args.push(`${doubleDash}dry-run`);
      }
      console.log(`[scan-route] Triggering Apple Photos sync: library=${libraryPath || "default"}, dryRun=${dryRun}`);

      const child = spawn("npx", ["tsx", importScriptPath, ...args], {
        cwd: path.join(process.cwd(), ".."),
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      return NextResponse.json({ success: true, message: "Apple Photos sync successfully triggered in background" });
    }

    const args = ["media"];

    if (id) {
      const source = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id) as any;
      if (!source) {
        return NextResponse.json({ error: `Data source with ID ${id} not found` }, { status: 404 });
      }
      args.push(`${doubleDash}id`, id);
      console.log(`[scan-route] Triggering scan for source: ${source.name} (${source.path})`);
    } else {
      console.log(`[scan-route] Triggering scan for all active media folders`);
    }

    // Spawn import.ts media scanner as a detached background process
    const child = spawn("npx", ["tsx", importScriptPath, ...args], {
      cwd: path.join(process.cwd(), ".."),
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    return NextResponse.json({ success: true, message: "Scan successfully triggered in background" });
  } catch (error: any) {
    console.error("POST /api/media/scan Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
