import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-error";
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import {
  ensureMediaSchema,
  getMediaTotals,
  getTypeBreakdown,
  getVolumeBreakdown,
  getGeotaggedCount,
  getCityBreakdown,
  getMemoriesCount,
  getYoutubeReadyCount,
  getYoutubeDraftCount,
  getCameraBreakdown,
  getCategoryBreakdown,
  getAlbumBreakdown,
  getRawCount,
  getScreenshotsCount,
  getAiArtCount,
  getFavoriteCount,
  getUnorganizedCount,
  listMediaRecords,
  countMediaRecords,
  listVirtualAlbums,
  listPeopleTags,
  updateMediaRecord,
  findVirtualAlbumByName,
  createVirtualAlbum,
  populateAlbumByCamera,
  populateAlbumByCity,
  addMediaToAlbum,
  removeMediaFromAlbum,
  type MediaListFilter,
  type VirtualAlbumSummaryRow,
  type PersonTagRow,
} from "@/lib/db/media";

export async function GET(req: NextRequest) {
  try {
    const dbPath = join(process.cwd(), "..", "data", "media", "media-index.sqlite");
    const mediaDir = join(process.cwd(), "..", "data", "media");

    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir, { recursive: true });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || "";
    const volume = url.searchParams.get("volume") || "";
    const city = url.searchParams.get("city") || "";
    const category = url.searchParams.get("category") || "";
    const youtubeStatus = url.searchParams.get("youtubeStatus") || "";
    const memory = url.searchParams.get("memory") || "";
    const camera = url.searchParams.get("camera") || "";
    const album = url.searchParams.get("album") || "";
    const rawOnly = url.searchParams.get("rawOnly") || "";
    const virtualAlbum = url.searchParams.get("virtualAlbum") || "";
    const face = url.searchParams.get("face") || "";
    const favorite = url.searchParams.get("favorite") || "";
    const unorganized = url.searchParams.get("unorganized") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "48", 10);
    const offset = (page - 1) * limit;

    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    ensureMediaSchema(db);

    // 1. Total stats
    const totalRow = getMediaTotals(db);

    // 2. Breakdown by type
    const types = getTypeBreakdown(db);

    // 3. Breakdown by volume
    const volumes = getVolumeBreakdown(db);

    // 4. Geotagged count
    const geoCount = getGeotaggedCount(db);

    // 5. Unique cities with geotags
    const cities = getCityBreakdown(db);

    // 6. Memories count (AI Captioned)
    const memoriesCountRow = getMemoriesCount(db);

    // 7. YouTube Export Parity status counts
    const ytReadyRow = getYoutubeReadyCount(db);
    const ytDraftRow = getYoutubeDraftCount(db);

    // 8. Unique cameras list
    const cameras = getCameraBreakdown(db);

    // 9. Categories list
    const categories = getCategoryBreakdown(db);

    // 10. Albums list
    const albums = getAlbumBreakdown(db);

    // 11. RAW count
    const rawCountRow = getRawCount(db);

    // 12. Screenshots count
    const screenshotsCountRow = getScreenshotsCount(db);

    // 13. AI Art count
    const aiArtCountRow = getAiArtCount(db);

    // 14. Favorites count
    const favoriteCountRow = getFavoriteCount(db);

    // 15. Unorganized count
    const unorganizedCountRow = getUnorganizedCount(db);

    const filter: MediaListFilter = {
      q,
      type,
      volume,
      city,
      category,
      youtubeStatus,
      memory,
      camera,
      album,
      rawOnly,
      virtualAlbum,
      face,
      favorite,
      unorganized,
    };

    // Run queries
    const records = listMediaRecords(db, filter, limit, offset);
    const filteredCountRow = countMediaRecords(db, filter);

    // Fetch virtual albums with mapped media count
    let virtualAlbums: VirtualAlbumSummaryRow[] = [];
    try {
      virtualAlbums = listVirtualAlbums(db);
    } catch (e) {
      log.warn(
        "Virtual albums table might not exist yet:",
        e instanceof Error ? e.message : String(e),
      );
    }

    // Fetch unique people face-tags
    let people: PersonTagRow[] = [];
    try {
      people = listPeopleTags(db);
    } catch (e) {
      log.warn(
        "media_faces table might not exist yet:",
        e instanceof Error ? e.message : String(e),
      );
    }

    db.close();

    return NextResponse.json({
      totalFiles: totalRow.totalFiles,
      totalBytes: totalRow.totalBytes,
      types,
      volumes,
      geotagged: geoCount.count,
      cities,
      cameras,
      categories,
      albums,
      virtualAlbums,
      people,
      memoriesCount: memoriesCountRow.count,
      rawCount: rawCountRow.count,
      screenshotsCount: screenshotsCountRow.count,
      aiArtCount: aiArtCountRow.count,
      favoriteCount: favoriteCountRow.count,
      unorganizedCount: unorganizedCountRow.count,
      youtubeReadyCount: ytReadyRow.count,
      youtubeDraftCount: ytDraftRow.count,
      records,
      filteredCount: filteredCountRow.count,
      page,
      limit
    });
  } catch (error) {
    log.error("Media API Error:", error);
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
    }

    const dbPath = join(process.cwd(), "..", "data", "media", "media-index.sqlite");
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: "Media index not found" }, { status: 404 });
    }

    const db = new Database(dbPath);

    const result = updateMediaRecord(db, id, body);
    if (!result.ok) {
      db.close();
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    db.close();

    if (result.changes === 0) {
      return NextResponse.json({ error: "Media record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Media record updated successfully" });
  } catch (error) {
    log.error("Media PATCH Error:", error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const dbPath = join(process.cwd(), "..", "data", "media", "media-index.sqlite");
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: "Media index not found" }, { status: 404 });
    }

    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    if (action === "createAlbum") {
      const { name, description, criteria } = body;
      if (!name) {
        db.close();
        return NextResponse.json({ error: "Album name is required" }, { status: 400 });
      }

      // Check if it already exists
      const existing = findVirtualAlbumByName(db, name);
      if (existing) {
        db.close();
        return NextResponse.json({ error: "An album with this name already exists" }, { status: 400 });
      }

      const newAlbumId = createVirtualAlbum(
        db,
        name,
        description || "",
        JSON.stringify(criteria || {}),
      );

      // Automatically pre-populate media if criteria has filter rules
      if (criteria && (criteria.camera || criteria.city)) {
        try {
          if (criteria.camera) {
            populateAlbumByCamera(db, newAlbumId, criteria.camera);
          } else if (criteria.city) {
            populateAlbumByCity(db, newAlbumId, criteria.city);
          }
        } catch (e) {
          log.error(
            "Failed to pre-populate virtual album media:",
            e instanceof Error ? e.message : String(e),
          );
        }
      }

      db.close();

      return NextResponse.json({
        success: true,
        albumId: newAlbumId,
        message: "Virtual album created successfully"
      });
    }

    if (action === "addMediaToAlbum") {
      const { albumId, albumName, mediaIds } = body;
      if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
        db.close();
        return NextResponse.json({ error: "Media IDs are required" }, { status: 400 });
      }

      let id = albumId;
      if (!id && albumName) {
        const row = findVirtualAlbumByName(db, albumName);
        if (row) {
          id = row.id;
        }
      }

      if (!id) {
        db.close();
        return NextResponse.json({ error: "Virtual album not found" }, { status: 404 });
      }

      addMediaToAlbum(db, id, mediaIds);
      db.close();

      return NextResponse.json({ success: true, message: `Successfully added ${mediaIds.length} items to album` });
    }

    if (action === "removeMediaFromAlbum") {
      const { albumId, albumName, mediaIds } = body;
      if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
        db.close();
        return NextResponse.json({ error: "Media IDs are required" }, { status: 400 });
      }

      let id = albumId;
      if (!id && albumName) {
        const row = findVirtualAlbumByName(db, albumName);
        if (row) {
          id = row.id;
        }
      }

      if (!id) {
        db.close();
        return NextResponse.json({ error: "Virtual album not found" }, { status: 404 });
      }

      removeMediaFromAlbum(db, id, mediaIds);
      db.close();

      return NextResponse.json({ success: true, message: `Successfully removed ${mediaIds.length} items from album` });
    }

    db.close();
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log.error("Media POST Error:", error);
    return serverError(error);
  }
}
