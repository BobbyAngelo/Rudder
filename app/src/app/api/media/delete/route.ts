import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

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
    const fileRow = db.prepare(`
      SELECT sourceVolume, relativePath 
      FROM media 
      WHERE id = ?
    `).get(id) as { sourceVolume: string, relativePath: string } | undefined;

    if (!fileRow) {
      db.close();
      return NextResponse.json({ error: "Media record not found in index" }, { status: 404 });
    }

    // 2. Safely delete from related/dependent tables first
    db.prepare("DELETE FROM media_faces WHERE media_id = ?").run(id);
    db.prepare("DELETE FROM virtual_album_media WHERE media_id = ?").run(id);

    // 3. Delete from primary media table
    const result = db.prepare("DELETE FROM media WHERE id = ?").run(id);
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
        } catch (fileErr: any) {
          console.error(`Failed to delete physical file at ${resolvedPath}:`, fileErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Media record deleted successfully from index",
      physicalDeleted,
      physicalPath: resolvedPath
    });
  } catch (error: any) {
    console.error("Delete API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
