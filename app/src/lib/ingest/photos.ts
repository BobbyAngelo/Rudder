/* ═══════════════════════════════════════════════════════
   Ingest · Photos connector (Google Photos / Takeout).
   Photos are the richest life-story source there is — times, places, and the
   people you were with. This reads the sidecar JSON metadata that Google
   Takeout writes next to each image (no image decoding, no cloud, no face
   model), and aggregates it BY DAY so a year of photos becomes a readable
   timeline instead of thousands of chunks.

   Sovereign + export-based: you export your own Google Photos via Takeout;
   Rudder parses the metadata locally. source = "photos".
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { RawDoc } from "./enrich";
import { ignoredName } from "./ignore";

export interface PhotoMeta {
  date?: string;        // ISO yyyy-mm-dd
  caption?: string;     // a real description (not a filename)
  people: string[];     // named faces, when present
  lat?: number;
  lng?: number;
}

const isFilename = (s: string) => /\.(jpe?g|png|heic|gif|mp4|mov|webp|tiff?)$/i.test(s.trim());

/** Parse one Google Takeout photo-sidecar object → PhotoMeta (null if not a photo sidecar). */
export function parsePhotoSidecar(obj: any): PhotoMeta | null {
  if (!obj || typeof obj !== "object") return null;
  const ts = obj.photoTakenTime?.timestamp ?? obj.creationTime?.timestamp;
  if (!ts) return null; // not a photo/video sidecar

  const secs = Number(ts);
  const date = Number.isFinite(secs) && secs > 0 ? new Date(secs * 1000).toISOString().slice(0, 10) : undefined;

  const desc = (obj.description || "").toString().trim();
  const title = (obj.title || "").toString().trim();
  const caption = desc || (title && !isFilename(title) ? title : "");

  const people = Array.isArray(obj.people)
    ? obj.people.map((p: any) => (p?.name || "").toString().trim()).filter(Boolean)
    : [];

  let lat: number | undefined, lng: number | undefined;
  const geo = obj.geoData ?? obj.geoDataExif;
  if (geo && (geo.latitude || geo.longitude)) {
    const la = Number(geo.latitude), lo = Number(geo.longitude);
    if (la || lo) { lat = la; lng = lo; }
  }

  return { date, caption: caption || undefined, people, lat, lng };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Aggregate per-photo metadata into one RawDoc per day. */
export function aggregatePhotos(metas: PhotoMeta[]): RawDoc[] {
  const byDay = new Map<string, PhotoMeta[]>();
  for (const m of metas) {
    if (!m.date) continue;
    (byDay.get(m.date) ?? byDay.set(m.date, []).get(m.date)!).push(m);
  }

  const docs: RawDoc[] = [];
  for (const [date, items] of byDay) {
    const people = [...new Set(items.flatMap((i) => i.people))];
    const captions = [...new Set(items.map((i) => i.caption).filter(Boolean) as string[])].slice(0, 12);
    const geo = items.find((i) => i.lat != null);

    const lines = [`${items.length} photo${items.length === 1 ? "" : "s"}.`];
    if (people.length) lines.push(`With: ${people.join(", ")}`);
    if (geo) lines.push(`Location: ${round(geo.lat!)}, ${round(geo.lng!)}`);
    if (captions.length) lines.push("", ...captions.map((c) => `- ${c}`));

    docs.push({
      source: "photos",
      sourceId: `day:${date}`,
      title: `Photos — ${date}`,
      body: lines.join("\n"),
      date,
      people: people.length ? people : undefined,
    });
  }
  return docs.sort((a, b) => (a.date! < b.date! ? 1 : -1));
}

/** Read a Google Takeout (or Google Photos) folder → one RawDoc per day. */
export function readPhotos(dir: string): RawDoc[] {
  const sidecars: string[] = [];
  const walk = (d: string) => {
    let entries: string[] = [];
    try { entries = readdirSync(d); } catch { return; }
    for (const name of entries) {
      if (ignoredName(name)) continue;
      const full = join(d, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith(".json")) sidecars.push(full);
    }
  };
  walk(dir);

  const metas: PhotoMeta[] = [];
  for (const f of sidecars) {
    try {
      const m = parsePhotoSidecar(JSON.parse(readFileSync(f, "utf-8")));
      if (m) metas.push(m);
    } catch { /* not JSON / not a sidecar — skip */ }
  }
  return aggregatePhotos(metas);
}
