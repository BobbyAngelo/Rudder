/* ═══════════════════════════════════════════════════════
   Media repository — typed data access for the media-index database.

   The media routes maintain a SEPARATE sqlite file
   (../data/media/media-index.sqlite) opened via `new Database(...)`. These
   repo functions accept an already-open Database handle (matching the route's
   existing connection approach) and centralize the SQL. The main rudder.db
   queries used by the chronicles route (health vitals, narratives, user
   preferences) live here too and use the shared getDB() connection.

   All inputs are passed as bound parameters; column lists and filter clauses
   are fixed string literals — user-supplied keys are never interpolated.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { getDB } from "../db";

/** A value that can be safely bound to a prepared statement placeholder. */
type SqlParam = string | number | bigint | null;

/* ── media-index row shapes ─────────────────────────────── */

/** Aggregate total file count + byte size across the media table. */
export interface MediaTotalsRow {
  totalFiles: number;
  totalBytes: number;
}

/** A `{ count }` scalar result returned by the COUNT(*) queries. */
export interface CountRow {
  count: number;
}

/** Breakdown of media grouped by type. */
export interface TypeBreakdownRow {
  type: string;
  count: number;
  bytes: number;
}

/** Breakdown of media grouped by source volume. */
export interface VolumeBreakdownRow {
  sourceVolume: string;
  count: number;
  bytes: number;
}

/** City/country aggregation for geotagged media. */
export interface CityBreakdownRow {
  city: string;
  country: string | null;
  count: number;
}

/** Camera usage aggregation. */
export interface CameraBreakdownRow {
  camera: string;
  count: number;
}

/** Category aggregation. */
export interface CategoryBreakdownRow {
  category: string;
  count: number;
}

/** Derived album aggregation for photos. */
export interface AlbumBreakdownRow {
  album: string;
  count: number;
}

/** Virtual album summary with mapped media count. */
export interface VirtualAlbumSummaryRow {
  id: number;
  name: string;
  description: string | null;
  criteria_json: string | null;
  count: number;
}

/** Face-tag aggregation (unique people). */
export interface PersonTagRow {
  name: string;
  count: number;
}

/** A single media record returned by the gallery list query. */
export interface MediaRecordRow {
  id: number;
  filename: string | null;
  extension: string | null;
  type: string | null;
  sizeBytes: number | null;
  sourceVolume: string | null;
  relativePath: string | null;
  dateCreated: string | null;
  city: string | null;
  country: string | null;
  camera: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  lat: number | null;
  lng: number | null;
  hasGeo: number | null;
  title: string | null;
  content: string | null;
  userTags: string | null;
  caption: string | null;
  category: string | null;
  license: string | null;
  privacyStatus: string | null;
  madeForKids: number | null;
  favorite: number | null;
  virtualAlbums: string | null;
  faces: string | null;
}

/** Raw media row (SELECT m.*) augmented with concatenated face names. */
export interface MediaWithFacesRow {
  id: number;
  filename: string | null;
  extension: string | null;
  type: string | null;
  sizeBytes: number | null;
  sourceVolume: string | null;
  relativePath: string | null;
  dateCreated: string | null;
  lat: number | null;
  lng: number | null;
  hasGeo: number | null;
  camera: string | null;
  favorite: number | null;
  userTags: string | null;
  city: string | null;
  country: string | null;
  faces: string | null;
  [column: string]: unknown;
}

/** Minimal location row used by the stream route. */
export interface MediaLocationRow {
  sourceVolume: string;
  relativePath: string;
  extension: string;
}

/** Minimal delete-target row used by the delete route. */
export interface MediaDeleteTargetRow {
  sourceVolume: string;
  relativePath: string;
}

/** Filters supported by the media gallery list/count queries. */
export interface MediaListFilter {
  q?: string;
  type?: string;
  volume?: string;
  city?: string;
  category?: string;
  youtubeStatus?: string;
  memory?: string;
  camera?: string;
  album?: string;
  rawOnly?: string;
  virtualAlbum?: string;
  face?: string;
  favorite?: string;
  unorganized?: string;
}

/** Columns a client is allowed to patch via updateMediaRecord, in stable order. */
export const MEDIA_UPDATABLE_FIELDS = [
  "title",
  "content",
  "userTags",
  "caption",
  "category",
  "license",
  "privacyStatus",
  "madeForKids",
  "favorite",
] as const;

export type MediaUpdatableField = (typeof MEDIA_UPDATABLE_FIELDS)[number];

const RAW_EXT_SQL_LIST =
  "('.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rwl', '.pef', '.raw')";

type Db = Database.Database;

/* ── media-index schema bootstrap ───────────────────────── */

/** Ensure the core media-index tables exist on the given handle. */
export function ensureMediaSchema(db: Db): void {
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
}

/* ── dashboard aggregates (media-index) ─────────────────── */

export function getMediaTotals(db: Db): MediaTotalsRow {
  return db
    .prepare(`SELECT COUNT(*) as totalFiles, SUM(sizeBytes) as totalBytes FROM media`)
    .get() as MediaTotalsRow;
}

export function getTypeBreakdown(db: Db): TypeBreakdownRow[] {
  return db
    .prepare(
      `SELECT type, COUNT(*) as count, SUM(sizeBytes) as bytes
       FROM media
       WHERE type IS NOT NULL
       GROUP BY type`,
    )
    .all() as TypeBreakdownRow[];
}

export function getVolumeBreakdown(db: Db): VolumeBreakdownRow[] {
  return db
    .prepare(
      `SELECT sourceVolume, COUNT(*) as count, SUM(sizeBytes) as bytes
       FROM media
       WHERE sourceVolume IS NOT NULL
       GROUP BY sourceVolume
       ORDER BY bytes DESC
       LIMIT 10`,
    )
    .all() as VolumeBreakdownRow[];
}

export function getGeotaggedCount(db: Db): CountRow {
  return db.prepare(`SELECT COUNT(*) as count FROM media WHERE hasGeo = 1`).get() as CountRow;
}

export function getCityBreakdown(db: Db): CityBreakdownRow[] {
  return db
    .prepare(
      `SELECT city, country, COUNT(*) as count
       FROM media
       WHERE city IS NOT NULL AND city != ''
       GROUP BY city, country
       ORDER BY count DESC, city ASC`,
    )
    .all() as CityBreakdownRow[];
}

export function getMemoriesCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE title IS NOT NULL AND title != '' AND content IS NOT NULL AND content != ''`,
    )
    .get() as CountRow;
}

export function getYoutubeReadyCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'video'
         AND title IS NOT NULL AND title != ''
         AND caption IS NOT NULL AND caption != ''
         AND content IS NOT NULL AND content != ''
         AND userTags IS NOT NULL AND userTags != ''
         AND category IS NOT NULL AND category != ''`,
    )
    .get() as CountRow;
}

export function getYoutubeDraftCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'video'
         AND (title IS NULL OR title = ''
           OR caption IS NULL OR caption = ''
           OR content IS NULL OR content = ''
           OR userTags IS NULL OR userTags = ''
           OR category IS NULL OR category = '')`,
    )
    .get() as CountRow;
}

export function getCameraBreakdown(db: Db): CameraBreakdownRow[] {
  return db
    .prepare(
      `SELECT camera, COUNT(*) as count
       FROM media
       WHERE camera IS NOT NULL AND camera != ''
       GROUP BY camera
       ORDER BY count DESC
       LIMIT 12`,
    )
    .all() as CameraBreakdownRow[];
}

export function getCategoryBreakdown(db: Db): CategoryBreakdownRow[] {
  return db
    .prepare(
      `SELECT category, COUNT(*) as count
       FROM media
       WHERE category IS NOT NULL AND category != ''
       GROUP BY category
       ORDER BY count DESC`,
    )
    .all() as CategoryBreakdownRow[];
}

export function getAlbumBreakdown(db: Db): AlbumBreakdownRow[] {
  return db
    .prepare(
      `SELECT * FROM (
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
        album ASC`,
    )
    .all() as AlbumBreakdownRow[];
}

export function getRawCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'photo' AND LOWER(extension) IN ${RAW_EXT_SQL_LIST}`,
    )
    .get() as CountRow;
}

export function getScreenshotsCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'photo' AND (relativePath LIKE '04_MEDIA/photos/Screenshots/%' OR isScreenshot = 1 OR category = 'screenshot')`,
    )
    .get() as CountRow;
}

export function getAiArtCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'photo' AND relativePath LIKE '04_MEDIA/photos/AI_Art/%'`,
    )
    .get() as CountRow;
}

export function getFavoriteCount(db: Db): CountRow {
  return db
    .prepare(`SELECT COUNT(*) as count FROM media WHERE type = 'photo' AND favorite = 1`)
    .get() as CountRow;
}

export function getUnorganizedCount(db: Db): CountRow {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM media
       WHERE type = 'photo'
         AND id NOT IN (SELECT media_id FROM virtual_album_media)
         AND relativePath NOT LIKE '04_MEDIA/photos/RAW_Masters/%'
         AND relativePath NOT LIKE '04_MEDIA/photos/Screenshots/%'
         AND relativePath NOT LIKE '04_MEDIA/photos/AI_Art/%'
         AND isScreenshot != 1
         AND (category IS NULL OR (category != 'screenshot' AND category != 'meme'))`,
    )
    .get() as CountRow;
}

/* ── gallery list + count (media-index) ─────────────────── */

/**
 * Build the shared dynamic WHERE clause for the gallery list + count queries.
 * Filter conditions are fixed literals; user-supplied values are bound.
 */
function buildMediaFilter(filter: MediaListFilter): { clause: string; params: SqlParam[] } {
  let clause = "";
  const params: SqlParam[] = [];

  const {
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
  } = filter;

  if (q) {
    const searchPattern = `%${q}%`;
    clause += ` AND (filename LIKE ? OR city LIKE ? OR country LIKE ? OR userTags LIKE ? OR content LIKE ?)`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (type) {
    clause += ` AND type = ?`;
    params.push(type);
  }

  if (volume) {
    clause += ` AND sourceVolume = ?`;
    params.push(volume);
  }

  if (city) {
    clause += ` AND city = ?`;
    params.push(city);
  }

  if (category) {
    clause += ` AND category = ?`;
    params.push(category);
  }

  if (youtubeStatus === "ready") {
    clause += ` AND type = 'video' AND title IS NOT NULL AND title != '' AND caption IS NOT NULL AND caption != '' AND content IS NOT NULL AND content != '' AND userTags IS NOT NULL AND userTags != '' AND category IS NOT NULL AND category != ''`;
  } else if (youtubeStatus === "draft") {
    clause += ` AND type = 'video' AND (title IS NULL OR title = '' OR caption IS NULL OR caption = '' OR content IS NULL OR content = '' OR userTags IS NULL OR userTags = '' OR category IS NULL OR category = '')`;
  }

  if (memory === "true") {
    clause += ` AND title IS NOT NULL AND title != '' AND content IS NOT NULL AND content != ''`;
  }

  if (camera) {
    clause += ` AND camera = ?`;
    params.push(camera);
  }

  if (album) {
    if (album === "Screenshots") {
      clause += ` AND (relativePath LIKE '04_MEDIA/photos/Screenshots/%' OR isScreenshot = 1 OR category = 'screenshot')`;
    } else {
      const isYear = /^\d{4}$/.test(album);
      if (isYear) {
        clause += ` AND relativePath LIKE '04_MEDIA/photos/consolidated/' || ? || '/%'`;
        params.push(album);
      } else {
        clause += ` AND relativePath LIKE '04_MEDIA/photos/' || ? || '/%'`;
        params.push(album);
      }
    }
  }

  if (rawOnly === "true") {
    clause += ` AND LOWER(extension) IN ${RAW_EXT_SQL_LIST}`;
  }

  if (virtualAlbum) {
    clause += ` AND id IN (
      SELECT media_id FROM virtual_album_media
      WHERE album_id = (SELECT id FROM virtual_albums WHERE name = ?)
    )`;
    params.push(virtualAlbum);
  }

  if (face) {
    clause += ` AND id IN (
      SELECT media_id FROM media_faces WHERE name = ?
    )`;
    params.push(face);
  }

  if (favorite === "true") {
    clause += ` AND favorite = 1`;
  }

  if (unorganized === "true") {
    clause += ` AND id NOT IN (SELECT media_id FROM virtual_album_media)`;
  }

  // Isolate dynamic screenshots, RAW masters, and AI generated art from the
  // everyday timeline by default.
  if (
    type === "photo" &&
    !album &&
    !virtualAlbum &&
    !category &&
    !rawOnly &&
    !volume &&
    !city &&
    !camera &&
    !face &&
    favorite !== "true"
  ) {
    clause += ` AND relativePath NOT LIKE '04_MEDIA/photos/RAW_Masters/%'
                AND relativePath NOT LIKE '04_MEDIA/photos/Screenshots/%'
                AND relativePath NOT LIKE '04_MEDIA/photos/AI_Art/%'
                AND isScreenshot != 1
                AND (category IS NULL OR (category != 'screenshot' AND category != 'meme'))`;
  }

  return { clause, params };
}

/** Paginated gallery records matching the given filter. */
export function listMediaRecords(
  db: Db,
  filter: MediaListFilter,
  limit: number,
  offset: number,
): MediaRecordRow[] {
  const { clause, params } = buildMediaFilter(filter);
  const query = `
    SELECT
      id, filename, extension, type, sizeBytes, sourceVolume, relativePath,
      dateCreated, city, country, camera, width, height, duration, lat, lng, hasGeo,
      title, content, userTags, caption, category, license, privacyStatus, madeForKids, favorite,
      (SELECT GROUP_CONCAT(va.name) FROM virtual_albums va JOIN virtual_album_media vam ON va.id = vam.album_id WHERE vam.media_id = media.id) as virtualAlbums,
      (SELECT GROUP_CONCAT(mf.name) FROM media_faces mf WHERE mf.media_id = media.id) as faces
    FROM media
    WHERE 1=1${clause}
    ORDER BY dateCreated DESC, id DESC LIMIT ? OFFSET ?
  `;
  return db.prepare(query).all(...params, limit, offset) as MediaRecordRow[];
}

/** Count of gallery records matching the given filter. */
export function countMediaRecords(db: Db, filter: MediaListFilter): CountRow {
  const { clause, params } = buildMediaFilter(filter);
  const query = `SELECT COUNT(*) as count FROM media WHERE 1=1${clause}`;
  return db.prepare(query).get(...params) as CountRow;
}

/** Virtual albums with their mapped media count. */
export function listVirtualAlbums(db: Db): VirtualAlbumSummaryRow[] {
  return db
    .prepare(
      `SELECT va.id, va.name, va.description, va.criteria_json, COUNT(vam.media_id) as count
       FROM virtual_albums va
       LEFT JOIN virtual_album_media vam ON va.id = vam.album_id
       GROUP BY va.id
       ORDER BY va.name ASC`,
    )
    .all() as VirtualAlbumSummaryRow[];
}

/** Unique people face-tags ordered by frequency. */
export function listPeopleTags(db: Db): PersonTagRow[] {
  return db
    .prepare(
      `SELECT name, COUNT(media_id) as count
       FROM media_faces
       GROUP BY name
       ORDER BY count DESC
       LIMIT 24`,
    )
    .all() as PersonTagRow[];
}

/* ── single-record metadata updates (media-index) ───────── */

export type UpdateMediaResult =
  | { ok: true; changes: number }
  | { ok: false; reason: "no_fields" };

/**
 * Partially update a media record. Only fields present in `patch` and on the
 * fixed allowlist are written; column names come from the allowlist, never
 * from request keys, and every value is bound.
 */
export function updateMediaRecord(
  db: Db,
  id: number | string,
  patch: Record<string, unknown>,
): UpdateMediaResult {
  const fieldsToUpdate: string[] = [];
  const params: SqlParam[] = [];

  for (const field of MEDIA_UPDATABLE_FIELDS) {
    if (patch[field] !== undefined) {
      fieldsToUpdate.push(`${field} = ?`);
      params.push(patch[field] as SqlParam);
    }
  }

  if (fieldsToUpdate.length === 0) {
    return { ok: false, reason: "no_fields" };
  }

  fieldsToUpdate.push("updatedAt = datetime('now')");
  params.push(id as SqlParam);

  const result = db
    .prepare(`UPDATE media SET ${fieldsToUpdate.join(", ")} WHERE id = ?`)
    .run(...params);
  return { ok: true, changes: result.changes };
}

/* ── virtual album management (media-index) ─────────────── */

export function findVirtualAlbumByName(db: Db, name: string): { id: number } | undefined {
  return db.prepare("SELECT id FROM virtual_albums WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
}

/** Insert a virtual album; returns the new row id. */
export function createVirtualAlbum(
  db: Db,
  name: string,
  description: string,
  criteriaJson: string,
): number | bigint {
  const result = db
    .prepare(
      `INSERT INTO virtual_albums (name, description, criteria_json) VALUES (?, ?, ?)`,
    )
    .run(name, description, criteriaJson);
  return result.lastInsertRowid;
}

/** Pre-populate a virtual album by camera match. */
export function populateAlbumByCamera(
  db: Db,
  albumId: number | bigint,
  camera: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) SELECT ?, id FROM media WHERE camera = ?",
  ).run(albumId, camera);
}

/** Pre-populate a virtual album by city match. */
export function populateAlbumByCity(
  db: Db,
  albumId: number | bigint,
  city: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) SELECT ?, id FROM media WHERE city = ?",
  ).run(albumId, city);
}

/** Add a batch of media ids to a virtual album within a single transaction. */
export function addMediaToAlbum(
  db: Db,
  albumId: number,
  mediaIds: number[],
): void {
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO virtual_album_media (album_id, media_id) VALUES (?, ?)",
  );
  const insertMany = db.transaction((ids: number[]) => {
    for (const mediaId of ids) {
      insertStmt.run(albumId, mediaId);
    }
  });
  insertMany(mediaIds);
}

/** Remove a batch of media ids from a virtual album within a single transaction. */
export function removeMediaFromAlbum(
  db: Db,
  albumId: number,
  mediaIds: number[],
): void {
  const deleteStmt = db.prepare(
    "DELETE FROM virtual_album_media WHERE album_id = ? AND media_id = ?",
  );
  const deleteMany = db.transaction((ids: number[]) => {
    for (const mediaId of ids) {
      deleteStmt.run(albumId, mediaId);
    }
  });
  deleteMany(mediaIds);
}

/* ── chronicles support (media-index reads) ─────────────── */

/** All media with a dateCreated, augmented with concatenated face names. */
export function listMediaWithFaces(db: Db): MediaWithFacesRow[] {
  return db
    .prepare(
      `SELECT m.*,
              (SELECT GROUP_CONCAT(name) FROM media_faces WHERE media_id = m.id) as faces
       FROM media m
       WHERE dateCreated IS NOT NULL
       ORDER BY dateCreated ASC`,
    )
    .all() as MediaWithFacesRow[];
}

/* ── stream + delete lookups (media-index) ──────────────── */

/** Resolve the source volume / relative path / extension for a media id. */
export function getMediaLocation(
  db: Db,
  id: number | string,
): MediaLocationRow | undefined {
  return db
    .prepare(`SELECT sourceVolume, relativePath, extension FROM media WHERE id = ?`)
    .get(id) as MediaLocationRow | undefined;
}

/** Resolve the source volume / relative path for a media id (delete target). */
export function getMediaDeleteTarget(
  db: Db,
  id: number | string,
): MediaDeleteTargetRow | undefined {
  return db
    .prepare(`SELECT sourceVolume, relativePath FROM media WHERE id = ?`)
    .get(id) as MediaDeleteTargetRow | undefined;
}

/** Delete a media row and its dependent face/album rows. Returns changes count. */
export function deleteMediaRecord(db: Db, id: number | string): number {
  db.prepare("DELETE FROM media_faces WHERE media_id = ?").run(id);
  db.prepare("DELETE FROM virtual_album_media WHERE media_id = ?").run(id);
  return db.prepare("DELETE FROM media WHERE id = ?").run(id).changes;
}

/* ── main rudder.db reads/writes (chronicles + scan) ────── */

/** Day vitals (sleep/hr/hrv) from health_metrics for a given date. */
export interface DayVitalsRow {
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
}

export function getDayVitals(date: string): DayVitalsRow | undefined {
  return getDB()
    .prepare(`SELECT sleep_hours, resting_hr, hrv FROM health_metrics WHERE date = ?`)
    .get(date) as DayVitalsRow | undefined;
}

/** A chronicle narrative record (subset returned to the route). */
export interface ChronicleNarrativeRow {
  id: number;
  essence: string;
  ai_narrative: string;
  manual_prose: string;
}

export function getChronicleNarrative(
  journeyId: string,
  dayIndex: number,
): Pick<ChronicleNarrativeRow, "essence" | "ai_narrative" | "manual_prose"> | undefined {
  return getDB()
    .prepare(
      `SELECT essence, ai_narrative, manual_prose
       FROM chronicle_narratives
       WHERE journey_id = ? AND day_index = ?`,
    )
    .get(journeyId, dayIndex) as
    | Pick<ChronicleNarrativeRow, "essence" | "ai_narrative" | "manual_prose">
    | undefined;
}

export function getChronicleNarrativeFull(
  journeyId: string,
  dayIndex: number,
): ChronicleNarrativeRow | undefined {
  return getDB()
    .prepare(
      `SELECT id, essence, ai_narrative, manual_prose
       FROM chronicle_narratives
       WHERE journey_id = ? AND day_index = ?`,
    )
    .get(journeyId, dayIndex) as ChronicleNarrativeRow | undefined;
}

export function updateChronicleNarrative(
  id: number,
  essence: string,
  aiNarrative: string,
  manualProse: string,
): void {
  getDB()
    .prepare(
      `UPDATE chronicle_narratives SET
         essence = ?,
         ai_narrative = ?,
         manual_prose = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(essence, aiNarrative, manualProse, id);
}

export function insertChronicleNarrative(
  journeyId: string,
  dayIndex: number,
  essence: string,
  aiNarrative: string,
  manualProse: string,
): void {
  getDB()
    .prepare(
      `INSERT INTO chronicle_narratives (journey_id, day_index, essence, ai_narrative, manual_prose)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(journeyId, dayIndex, essence, aiNarrative, manualProse);
}

/** The user's default AI execution mode preference. */
export function getDefaultExecutionMode(): { default_execution_mode: string | null } | undefined {
  return getDB()
    .prepare("SELECT default_execution_mode FROM user_preferences WHERE id = 1")
    .get() as { default_execution_mode: string | null } | undefined;
}

/** A data source row (subset used by the scan route). */
export interface DataSourceRow {
  id: number;
  name: string;
  path: string;
  type: string;
  status: string;
  last_scanned: string | null;
  created_at: string;
  error_message?: string | null;
}

export function getDataSource(id: number | string): DataSourceRow | undefined {
  return getDB()
    .prepare("SELECT * FROM data_sources WHERE id = ?")
    .get(id) as DataSourceRow | undefined;
}
