import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import { getDataSource } from "@/lib/db/media";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

interface ScanRequestBody {
  id?: string | number;
  source?: string;
  library_path?: string;
  dry_run?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    let body: ScanRequestBody = {};
    try {
      body = await req.json();
    } catch {
      // Body can be empty
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || body.id;
    const sourceParam = searchParams.get("source") || body.source;
    const libraryPath = searchParams.get("library_path") || body.library_path;
    const dryRun = searchParams.get("dry_run") === "true" || body.dry_run === true;

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
      log.info(`[scan-route] Triggering Apple Photos sync: library=${libraryPath || "default"}, dryRun=${dryRun}`);

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
      const source = getDataSource(id);
      if (!source) {
        return NextResponse.json({ error: `Data source with ID ${id} not found` }, { status: 404 });
      }
      args.push(`${doubleDash}id`, String(id));
      log.info(`[scan-route] Triggering scan for source: ${source.name} (${source.path})`);
    } else {
      log.info(`[scan-route] Triggering scan for all active media folders`);
    }

    // Spawn import.ts media scanner as a detached background process
    const child = spawn("npx", ["tsx", importScriptPath, ...args], {
      cwd: path.join(process.cwd(), ".."),
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    return NextResponse.json({ success: true, message: "Scan successfully triggered in background" });
  } catch (error) {
    log.error("POST /api/media/scan Error:", error);
    return serverError(error);
  }
}
