import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
import { getMediaDeleteTarget, deleteMediaRecord } from "@/lib/db/media";

export async function DELETE(req: NextRequest) {
  try {
    const { id, deletePhysical } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
    }

    const dbPath = join(process.cwd(), "..", "data", "media", "media-index.sqlite");
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: "Media index database not found" }, { status: 404 });
    }

    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");

    // 1. Fetch file path details to enable physical file deletion
    const fileRow = getMediaDeleteTarget(db, id);

    if (!fileRow) {
      db.close();
      return NextResponse.json({ error: "Media record not found in index" }, { status: 404 });
    }

    // 2 & 3. Delete dependent face/album rows first, then the primary media row
    deleteMediaRecord(db, id);
    db.close();

    let physicalDeleted = false;
    let resolvedPath = "";

    // 4. If requested, delete physical file from disk
    if (deletePhysical && fileRow) {
      const resolvePath = (vol: string, rel: string): string => {
        if (vol.startsWith("/")) {
          return join(vol, rel);
        }
        const volumesPath = join("/Volumes", vol, rel);
        if (existsSync(volumesPath)) {
          return volumesPath;
        }
        const localPath = join(process.cwd(), "..", "data", "media", vol, rel);
        if (existsSync(localPath)) {
          return localPath;
        }
        return join(process.cwd(), "..", "data", "media", rel);
      };

      resolvedPath = resolvePath(fileRow.sourceVolume, fileRow.relativePath);
      
      if (existsSync(resolvedPath)) {
        try {
          unlinkSync(resolvedPath);
          physicalDeleted = true;
        } catch (fileErr) {
          log.error(
            `Failed to delete physical file at ${resolvedPath}:`,
            fileErr instanceof Error ? fileErr.message : String(fileErr),
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Media record deleted successfully from index",
      physicalDeleted,
      physicalPath: resolvedPath
    });
  } catch (error) {
    log.error("Delete API Error:", error);
    return serverError(error);
  }
}
