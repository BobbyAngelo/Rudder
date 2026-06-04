/* ═══════════════════════════════════════════════════════
   Google Takeout connector.
   Sovereign + ToS-clean: parses YOUR OWN Google Takeout export
   (takeout.google.com), read locally. No API, no scraping.

   Takeout activity is high-volume (searches, watches, page visits), so we
   AGGREGATE BY DAY — one memory document per day ("what you did online that
   day") instead of 50k tiny chunks. Shape-detecting, so it handles My
   Activity / YouTube history (arrays of {title,time}) and Chrome history
   ({"Browser History":[…]}) wherever they live in the export.

   (Contacts and Calendar from Takeout already work via the .vcf / .ics
   connectors — point those at the exported files.)
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { RawDoc } from "./enrich";

export interface Activity { date: string; text: string; }

function isoDate(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** My Activity + YouTube history share this shape: [{ header, title, titleUrl, time, subtitles }]. */
export function parseActivityArray(arr: any[]): Activity[] {
  const out: Activity[] = [];
  for (const item of arr) {
    if (!item || typeof item.title !== "string") continue;
    const date = isoDate(item.time);
    if (!date) continue;
    let text = item.title.trim();
    if (Array.isArray(item.subtitles) && item.subtitles[0]?.name) text += ` — ${item.subtitles[0].name}`;
    if (text) out.push({ date, text });
  }
  return out;
}

/** Chrome history: { "Browser History": [{ title, url, time_usec }] }. */
export function parseChromeHistory(json: any): Activity[] {
  const arr = json?.["Browser History"];
  if (!Array.isArray(arr)) return [];
  const out: Activity[] = [];
  for (const v of arr) {
    const usec = Number(v?.time_usec);
    if (!usec) continue;
    const d = new Date(usec / 1000);
    if (isNaN(d.getTime())) continue;
    const title = (v.title || "").toString().trim();
    if (title) out.push({ date: d.toISOString().slice(0, 10), text: `Visited ${title}` });
  }
  return out;
}

/** Group all activity into one memory document per day. */
export function aggregateByDay(records: Activity[], perDayCap = 50): RawDoc[] {
  const byDay = new Map<string, string[]>();
  for (const r of records) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date)!.push(r.text);
  }
  const docs: RawDoc[] = [];
  for (const [date, items] of byDay) {
    const lines = items.slice(0, perDayCap);
    const extra = items.length > perDayCap ? `\n…and ${items.length - perDayCap} more` : "";
    docs.push({
      source: "google",
      sourceId: `google:${date}`,
      title: `Online activity — ${date}`,
      body: `On ${date}:\n${lines.join("\n")}${extra}`,
      date,
    });
  }
  return docs;
}

function walkJson(dir: string, out: string[], depth = 0): void {
  if (depth > 8) return;
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walkJson(full, out, depth + 1);
    else if (name.toLowerCase().endsWith(".json")) out.push(full);
  }
}

/** Read a Google Takeout folder (or a file inside it) into per-day RawDocs. */
export function readGoogleTakeout(path: string): RawDoc[] {
  let dir: string;
  try { dir = statSync(path).isDirectory() ? path : join(path, ".."); }
  catch { return []; }

  const files: string[] = [];
  walkJson(dir, files);

  const records: Activity[] = [];
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(f, "utf8"));
      if (Array.isArray(json)) records.push(...parseActivityArray(json));
      else if (json && json["Browser History"]) records.push(...parseChromeHistory(json));
    } catch { /* skip unreadable / unrecognized json */ }
  }
  return aggregateByDay(records);
}
