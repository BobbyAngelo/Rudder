import { NextRequest, NextResponse } from "next/server";
import { statSync, createReadStream, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import Database from "better-sqlite3";

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif"
};

function resolveMediaPath(sourceVolume: string, relativePath: string): string {
  if (sourceVolume.startsWith("/")) {
    return join(sourceVolume, relativePath);
  }
  
  // Try standard /Volumes mount
  const volumesPath = join("/Volumes", sourceVolume, relativePath);
  if (existsSync(volumesPath)) {
    return volumesPath;
  }
  
  // Fallback: check under data/media
  const localDataPath = join(process.cwd(), "..", "data", "media", sourceVolume, relativePath);
  if (existsSync(localDataPath)) {
    return localDataPath;
  }

  // Try direct relative path under data/media
  const directLocalPath = join(process.cwd(), "..", "data", "media", relativePath);
  if (existsSync(directLocalPath)) {
    return directLocalPath;
  }

  return volumesPath;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const mediaId = url.searchParams.get("id");
    if (!mediaId) {
      return NextResponse.json({ error: "Media ID parameter is required" }, { status: 400 });
    }

    const dbPath = join(process.cwd(), "..", "data", "media", "media-index.sqlite");
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: "Media index not found" }, { status: 404 });
    }

    const db = new Database(dbPath, { readonly: true });
    const fileRow = db.prepare(`
      SELECT sourceVolume, relativePath, extension 
      FROM media 
      WHERE id = ?
    `).get(mediaId) as { sourceVolume: string, relativePath: string, extension: string } | undefined;
    db.close();

    if (!fileRow) {
      return NextResponse.json({ error: "Media record not found in index" }, { status: 404 });
    }

    const filePath = resolveMediaPath(fileRow.sourceVolume, fileRow.relativePath);

    let stats;
    try {
      stats = statSync(filePath);
    } catch {
      return NextResponse.json({ error: `File not found on disk at: ${filePath}` }, { status: 404 });
    }

    if (!stats.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const ext = fileRow.extension?.toLowerCase() || filePath.split(".").pop()?.toLowerCase() || "";
    let targetFilePath = filePath;
    let contentType = MIME_TYPES[ext] || "application/octet-stream";
    let fileSize = stats.size;

    const RAW_EXTS = new Set(["dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rwl", "pef", "raw"]);
    if (RAW_EXTS.has(ext)) {
      const cacheDir = join(process.cwd(), "..", "data", "media", ".previews");
      const cachePath = join(cacheDir, `${mediaId}.jpg`);
      
      let cacheExists = false;
      try {
        if (!existsSync(cacheDir)) {
          mkdirSync(cacheDir, { recursive: true });
        }
        cacheExists = existsSync(cachePath);
      } catch (err) {
        console.error("Cache directory access error:", err);
      }

      if (!cacheExists) {
        try {
          // Run sips to convert the raw file to a 2048px max dimension JPEG
          execSync(`sips -s format jpeg -Z 2048 "${filePath}" --out "${cachePath}"`, { stdio: "ignore" });
          cacheExists = existsSync(cachePath);
        } catch (err) {
          console.error(`Sips conversion failed for RAW file: ${filePath}`, err);
        }
      }

      if (cacheExists) {
        targetFilePath = cachePath;
        contentType = "image/jpeg";
        try {
          const cachedStats = statSync(cachePath);
          fileSize = cachedStats.size;
        } catch (err) {
          console.error("Failed to stat cached preview", err);
        }
      }
    }

    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = createReadStream(targetFilePath, { start, end });

      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk: any) => controller.enqueue(new Uint8Array(chunk)));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunksize),
          "Content-Type": contentType,
        },
      });
    } else {
      const fileStream = createReadStream(targetFilePath);
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk: any) => controller.enqueue(new Uint8Array(chunk)));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          "Content-Length": String(fileSize),
          "Content-Type": contentType,
        },
      });
    }
  } catch (error: any) {
    console.error("Stream API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
