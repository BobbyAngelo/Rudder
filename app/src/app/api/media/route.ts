import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

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
    db.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        filename TEXT,
        type TEXT,
        sizeBytes INTEGER,
        camera TEXT,
        city TEXT,
        dateCreated TEXT,
        favorite INTEGER DEFAULT 0,
        category TEXT,
        volume TEXT,
        youtubeStatus TEXT,
        unorganized INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS media_faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_id INTEGER,
        name TEXT,
        FOREIGN KEY(media_id) REFERENCES media(id)
      );
      CREATE TABLE IF NOT EXISTS virtual_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        criteria_json TEXT
      );
      CREATE TABLE IF NOT EXISTS virtual_album_media (
        album_id INTEGER,
        media_id INTEGER,
        PRIMARY KEY(album_id, media_id),
        FOREIGN KEY(album_id) REFERENCES virtual_albums(id),
        FOREIGN KEY(media_id) REFERENCES media(id)
      );
    `);

    // 1. Total stats
    const totalRow = db.prepare(`
      SELECT 
        COUNT(*) as totalFiles, 
        SUM(sizeBytes) as totalBytes
      FROM media
    `).get() as { totalFiles: number, totalBytes: number };

    // 2. Breakdown by type
    const types = db.prepare(`
      SELECT type, COUNT(*) as count, SUM(sizeBytes) as bytes
      FROM media 
      WHERE type IS NOT NULL
      GROUP BY type
    `).all();

    // 3. Breakdown by volume
    const volumes = db.prepare(`
      SELECT sourceVolume, COUNT(*) as count, SUM(sizeBytes) as bytes
      FROM media
      WHERE sourceVolume IS NOT NULL
      GROUP BY sourceVolume
      ORDER BY bytes DESC
      LIMIT 10
    `).all();

    // 4. Geotagged count
    const geoCount = db.prepare(`
      SELECT COUNT(*) as count FROM media WHERE hasGeo = 1
    `).get() as { count: number };

    // 5. Unique cities with geotags
    const cities = db.prepare(`
      SELECT city, country, COUNT(*) as count
      FROM media
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city, country
      ORDER BY count DESC, city ASC
    `).all();

    // 6. Memories count (AI Captioned)
    const memoriesCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE title IS NOT NULL AND title != '' AND content IS NOT NULL AND content != ''
    `).get() as { count: number };

    // 7. YouTube Export Parity status counts
    const ytReadyRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'video' 
        AND title IS NOT NULL AND title != '' 
        AND caption IS NOT NULL AND caption != '' 
        AND content IS NOT NULL AND content != '' 
        AND userTags IS NOT NULL AND userTags != '' 
        AND category IS NOT NULL AND category != ''
    `).get() as { count: number };

    const ytDraftRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'video' 
        AND (title IS NULL OR title = '' 
          OR caption IS NULL OR caption = '' 
          OR content IS NULL OR content = '' 
          OR userTags IS NULL OR userTags = '' 
          OR category IS NULL OR category = '')
    `).get() as { count: number };

    // 8. Unique cameras list
    const cameras = db.prepare(`
      SELECT camera, COUNT(*) as count
      FROM media
      WHERE camera IS NOT NULL AND camera != ''
      GROUP BY camera
      ORDER BY count DESC
      LIMIT 12
    `).all();

    // 9. Categories list
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM media
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC
    `).all();

    // 10. Albums list
    const albums = db.prepare(`
      SELECT * FROM (
        SELECT 
          CASE 
            WHEN relativePath LIKE '04_MEDIA/photos/consolidated/%' 
            THEN SUBSTR(relativePath, 30, 4)
            WHEN INSTR(SUBSTR(relativePath, 17), '/') > 0 
            THEN SUBSTR(SUBSTR(relativePath, 17), 1, INSTR(SUBSTR(relativePath, 17), '/') - 1)
            ELSE SUBSTR(relativePath, 17)
          END as album,
          COUNT(*) as count
        FROM media
        WHERE type = 'photo'
        GROUP BY album
      ) WHERE album != 'RAW_Masters' AND album != 'Screenshots' AND album != 'AI_Art'
      ORDER BY 
        CASE WHEN album BETWEEN '1000' AND '3000' THEN 1 ELSE 2 END ASC,
        CASE WHEN album BETWEEN '1000' AND '3000' THEN album END DESC,
        album ASC
    `).all();

    // 11. RAW count
    const rawCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'photo' AND LOWER(extension) IN ('.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rwl', '.pef', '.raw')
    `).get() as { count: number };

    // 12. Screenshots count
    const screenshotsCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'photo' AND (relativePath LIKE '04_MEDIA/photos/Screenshots/%' OR isScreenshot = 1 OR category = 'screenshot')
    `).get() as { count: number };

    // 13. AI Art count
    const aiArtCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'photo' AND relativePath LIKE '04_MEDIA/photos/AI_Art/%'
    `).get() as { count: number };

    // 14. Favorites count
    const favoriteCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'photo' AND favorite = 1
    `).get() as { count: number };

    // 15. Unorganized count
    const unorganizedCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM media 
      WHERE type = 'photo' 
        AND id NOT IN (SELECT media_id FROM virtual_album_media)
        AND relativePath NOT LIKE '04_MEDIA/photos/RAW_Masters/%'
        AND relativePath NOT LIKE '04_MEDIA/photos/Screenshots/%'
        AND relativePath NOT LIKE '04_MEDIA/photos/AI_Art/%'
        AND isScreenshot != 1
        AND (category IS NULL OR (category != 'screenshot' AND category != 'meme'))
    `).get() as { count: number };

    // Build the dynamic query for retrieving the media records
    let querySelect = `
      SELECT 
        id, filename, extension, type, sizeBytes, sourceVolume, relativePath,
        dateCreated, city, country, camera, width, height, duration, lat, lng, hasGeo,
        title, content, userTags, caption, category, license, privacyStatus, madeForKids, favorite,
        (SELECT GROUP_CONCAT(va.name) FROM virtual_albums va JOIN virtual_album_media vam ON va.id = vam.album_id WHERE vam.media_id = media.id) as virtualAlbums,
        (SELECT GROUP_CONCAT(mf.name) FROM media_faces mf WHERE mf.media_id = media.id) as faces
      FROM media
      WHERE 1=1
    `;
    let queryCount = `
      SELECT COUNT(*) as count
      FROM media
      WHERE 1=1
    `;

    const params: any[] = [];

    if (q) {
      const searchPattern = `%${q}%`;
      const searchFilter = ` AND (filename LIKE ? OR city LIKE ? OR country LIKE ? OR userTags LIKE ? OR content LIKE ?)`;
      querySelect += searchFilter;
      queryCount += searchFilter;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (type) {
      querySelect += ` AND type = ?`;
      queryCount += ` AND type = ?`;
      params.push(type);
    }

    if (volume) {
      querySelect += ` AND sourceVolume = ?`;
      queryCount += ` AND sourceVolume = ?`;
      params.push(volume);
    }

    if (city) {
      querySelect += ` AND city = ?`;
      queryCount += ` AND city = ?`;
      params.push(city);
    }

    if (category) {
      querySelect += ` AND category = ?`;
      queryCount += ` AND category = ?`;
      params.push(category);
    }

    if (youtubeStatus === "ready") {
      const condition = ` AND type = 'video' AND title IS NOT NULL AND title != '' AND caption IS NOT NULL AND caption != '' AND content IS NOT NULL AND content != '' AND userTags IS NOT NULL AND userTags != '' AND category IS NOT NULL AND category != ''`;
      querySelect += condition;
      queryCount += condition;
    } else if (youtubeStatus === "draft") {
      const condition = ` AND type = 'video' AND (title IS NULL OR title = '' OR caption IS NULL OR caption = '' OR content IS NULL OR content = '' OR userTags IS NULL OR userTags = '' OR category IS NULL OR category = '')`;
      querySelect += condition;
      queryCount += condition;
    }

    if (memory === "true") {
      const condition = ` AND title IS NOT NULL AND title != '' AND content IS NOT NULL AND content != ''`;
      querySelect += condition;
      queryCount += condition;
    }

    if (camera) {
      querySelect += ` AND camera = ?`;
      queryCount += ` AND camera = ?`;
      params.push(camera);
    }

    if (album) {
      if (album === "Screenshots") {
        querySelect += ` AND (relativePath LIKE '04_MEDIA/photos/Screenshots/%' OR isScreenshot = 1 OR category = 'screenshot')`;
        queryCount += ` AND (relativePath LIKE '04_MEDIA/photos/Screenshots/%' OR isScreenshot = 1 OR category = 'screenshot')`;
      } else {
        const isYear = /^\d{4}$/.test(album);
        if (isYear) {
          querySelect += ` AND relativePath LIKE '04_MEDIA/photos/consolidated/' || ? || '/%'`;
          queryCount += ` AND relativePath LIKE '04_MEDIA/photos/consolidated/' || ? || '/%'`;
          params.push(album);
        } else {
          querySelect += ` AND relativePath LIKE '04_MEDIA/photos/' || ? || '/%'`;
          queryCount += ` AND relativePath LIKE '04_MEDIA/photos/' || ? || '/%'`;
          params.push(album);
        }
      }
    }

    if (rawOnly === "true") {
      querySelect += ` AND LOWER(extension) IN ('.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rwl', '.pef', '.raw')`;
      queryCount += ` AND LOWER(extension) IN ('.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rwl', '.pef', '.raw')`;
    }

    if (virtualAlbum) {
      const filter = ` AND id IN (
        SELECT media_id FROM virtual_album_media 
        WHERE album_id = (SELECT id FROM virtual_albums WHERE name = ?)
      )`;
      querySelect += filter;
      queryCount += filter;
      params.push(virtualAlbum);
    }

    if (face) {
      const filter = ` AND id IN (
        SELECT media_id FROM media_faces WHERE name = ?
      )`;
      querySelect += filter;
      queryCount += filter;
      params.push(face);
    }

    if (favorite === "true") {
      querySelect += ` AND favorite = 1`;
      queryCount += ` AND favorite = 1`;
    }

    if (unorganized === "true") {
      const filter = ` AND id NOT IN (SELECT media_id FROM virtual_album_media)`;
      querySelect += filter;
      queryCount += filter;
    }

    // Isolate dynamic screenshots, RAW masters, and AI generated art from everyday timeline by default
    if (type === "photo" && !album && !virtualAlbum && !category && !rawOnly && !volume && !city && !camera && !face && favorite !== "true") {
      const cond = ` AND relativePath NOT LIKE '04_MEDIA/photos/RAW_Masters/%'
                     AND relativePath NOT LIKE '04_MEDIA/photos/Screenshots/%'
                     AND relativePath NOT LIKE '04_MEDIA/photos/AI_Art/%'
                     AND isScreenshot != 1
                     AND (category IS NULL OR (category != 'screenshot' AND category != 'meme'))`;
      querySelect += cond;
      queryCount += cond;
    }

    // Sorting by dateCreated DESC, then id DESC
    querySelect += ` ORDER BY dateCreated DESC, id DESC LIMIT ? OFFSET ?`;
    const countParams = [...params];
    params.push(limit, offset);

    // Run queries
    const records = db.prepare(querySelect).all(...params);
    const filteredCountRow = db.prepare(queryCount).get(...countParams) as { count: number };

    // Fetch virtual albums with mapped media count
    let virtualAlbums: any[] = [];
    try {
      virtualAlbums = db.prepare(`
        SELECT va.id, va.name, va.description, va.criteria_json, COUNT(vam.media_id) as count
        FROM virtual_albums va
        LEFT JOIN virtual_album_media vam ON va.id = vam.album_id
        GROUP BY va.id
        ORDER BY va.name ASC
      `).all();
    } catch (e: any) {
      console.warn("Virtual albums table might not exist yet:", e.message);
    }

    // Fetch unique people face-tags
    let people: any[] = [];
    try {
      people = db.prepare(`
        SELECT name, COUNT(media_id) as count
        FROM media_faces
        GROUP BY name
        ORDER BY count DESC
        LIMIT 24
      `).all();
    } catch (e: any) {
      console.warn("media_faces table might not exist yet:", e.message);
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
  } catch (error: any) {
    console.error("Media API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    
    // Build dynamic update query to prevent overwriting omitted fields with null
    const fieldsToUpdate: string[] = [];
    const params: any[] = [];
    
    const updatableFields = [
      "title", "content", "userTags", "caption", "category",
      "license", "privacyStatus", "madeForKids", "favorite"
    ];
    
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        fieldsToUpdate.push(`${field} = ?`);
        params.push(body[field]);
      }
    }
    
    if (fieldsToUpdate.length === 0) {
      db.close();
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    
    fieldsToUpdate.push("updatedAt = datetime('now')");
    params.push(id);
    
    const query = `
      UPDATE media 
      SET ${fieldsToUpdate.join(", ")}
      WHERE id = ?
    `;
    
    const result = db.prepare(query).run(...params);
    db.close();

    if (result.changes === 0) {
      return NextResponse.json({ error: "Media record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Media record updated successfully" });
  } catch (error: any) {
    console.error("Media PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      const existing = db.prepare("SELECT id FROM virtual_albums WHERE name = ?").get(name);
      if (existing) {
        db.close();
        return NextResponse.json({ error: "An album with this name already exists" }, { status: 400 });
      }

      const stmt = db.prepare(`
        INSERT INTO virtual_albums (name, description, criteria_json)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, description || "", JSON.stringify(criteria || {}));
      const newAlbumId = result.lastInsertRowid;

      // Automatically pre-populate media if criteria has filter rules
      if (criteria && (criteria.camera || criteria.city)) {
        let populateQuery = "";
        let param = "";
        if (criteria.camera) {
          populateQuery = "INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) SELECT ?, id FROM media WHERE camera = ?";
          param = criteria.camera;
        } else if (criteria.city) {
          populateQuery = "INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) SELECT ?, id FROM media WHERE city = ?";
          param = criteria.city;
        }

        if (populateQuery) {
          try {
            db.prepare(populateQuery).run(newAlbumId, param);
          } catch (e: any) {
            console.error("Failed to pre-populate virtual album media:", e.message);
          }
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
        const row = db.prepare("SELECT id FROM virtual_albums WHERE name = ?").get(albumName) as { id: number } | undefined;
        if (row) {
          id = row.id;
        }
      }

      if (!id) {
        db.close();
        return NextResponse.json({ error: "Virtual album not found" }, { status: 404 });
      }

      const insertStmt = db.prepare("INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) VALUES (?, ?)");
      const insertMany = db.transaction((ids: number[]) => {
        for (const mediaId of ids) {
          insertStmt.run(id, mediaId);
        }
      });
      insertMany(mediaIds);
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
        const row = db.prepare("SELECT id FROM virtual_albums WHERE name = ?").get(albumName) as { id: number } | undefined;
        if (row) {
          id = row.id;
        }
      }

      if (!id) {
        db.close();
        return NextResponse.json({ error: "Virtual album not found" }, { status: 404 });
      }

      const deleteStmt = db.prepare("DELETE FROM virtual_album_media WHERE album_id = ? AND media_id = ?");
      const deleteMany = db.transaction((ids: number[]) => {
        for (const mediaId of ids) {
          deleteStmt.run(id, mediaId);
        }
      });
      deleteMany(mediaIds);
      db.close();

      return NextResponse.json({ success: true, message: `Successfully removed ${mediaIds.length} items from album` });
    }

    db.close();
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Media POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

