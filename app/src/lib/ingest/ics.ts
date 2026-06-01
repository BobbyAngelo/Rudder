/* ═══════════════════════════════════════════════════════
   Ingest · Calendar (iCalendar / .ics) connector.
   Zero-dependency parser for the format Apple Calendar, Google
   Calendar, Fastmail, etc. all export. Each VEVENT becomes a
   RawDoc with a real date + attendee people-tags, so it feeds the
   temporal + entity backbone the hybrid retriever already uses
   ("what's on this week", "last time I met Jane").

   Sovereign-first: ingests exported .ics files locally. Live
   CalDAV/Google sync is a future enhancement on top of this.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename } from "path";
import type { RawDoc } from "./enrich";

export interface ICalEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;   // ISO yyyy-mm-dd (date portion)
  end?: string;     // ISO yyyy-mm-dd
  organizer?: string;
  attendees: string[];
}

interface Prop { name: string; params: Record<string, string>; value: string; }

/** RFC 5545 line unfolding: a CRLF (or LF) followed by space/tab continues the previous line. */
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** Unescape iCalendar TEXT values (\n \, \; \\). */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Parse one property line into { name, params, value }. */
function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = left.split(";");
  const name = segs[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq > 0) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

/** Date value (20260601 or 20260601T090000Z or with TZID) → ISO yyyy-mm-dd. */
function toISODate(value: string): string | undefined {
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** A person label from ORGANIZER/ATTENDEE: prefer CN, else the email local-part. */
function personFrom(prop: Prop): string | undefined {
  if (prop.params.CN) return prop.params.CN.trim();
  const email = prop.value.replace(/^mailto:/i, "").trim();
  if (!email) return undefined;
  const local = email.split("@")[0];
  return local.replace(/[._]+/g, " ").trim() || email;
}

/** Parse an .ics document into events. */
export function parseICS(text: string): ICalEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const events: ICalEvent[] = [];
  let cur: ICalEvent | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === "BEGIN:VEVENT") { cur = { attendees: [] }; continue; }
    if (line.toUpperCase() === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;

    const prop = parseLine(line);
    if (!prop) continue;
    switch (prop.name) {
      case "UID": cur.uid = prop.value.trim(); break;
      case "SUMMARY": cur.summary = unescapeText(prop.value); break;
      case "DESCRIPTION": cur.description = unescapeText(prop.value); break;
      case "LOCATION": cur.location = unescapeText(prop.value); break;
      case "DTSTART": cur.start = toISODate(prop.value); break;
      case "DTEND": cur.end = toISODate(prop.value); break;
      case "ORGANIZER": cur.organizer = personFrom(prop); break;
      case "ATTENDEE": { const p = personFrom(prop); if (p) cur.attendees.push(p); break; }
    }
  }
  return events;
}

/** Turn one event into a RawDoc the enrich pipeline can chunk. */
export function eventToRawDoc(ev: ICalEvent, sourceId: string): RawDoc | null {
  const summary = ev.summary?.trim();
  if (!summary && !ev.description) return null;

  const people = [...new Set([ev.organizer, ...ev.attendees].filter(Boolean) as string[])];
  const lines: string[] = [];
  if (ev.start) lines.push(`When: ${ev.start}${ev.end && ev.end !== ev.start ? ` to ${ev.end}` : ""}`);
  if (ev.location) lines.push(`Where: ${ev.location}`);
  if (people.length) lines.push(`With: ${people.join(", ")}`);
  if (ev.description) lines.push("", ev.description);

  return {
    source: "calendar",
    sourceId: ev.uid || `${sourceId}:${ev.start ?? ""}:${summary ?? ""}`,
    title: summary || "(untitled event)",
    body: lines.join("\n").trim(),
    date: ev.start,
    people: people.length ? people : undefined,
  };
}

function collectIcsFiles(path: string, excludes: string[]): string[] {
  const st = statSync(path);
  if (st.isFile()) return /\.ics$/i.test(path) ? [path] : [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      if (excludes.some((ex) => full.includes(ex))) continue;
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.ics$/i.test(name)) out.push(full);
    }
  };
  walk(path);
  return out;
}

/** Read a single .ics file or a folder of them into RawDoc[] (one per event). */
export function readCalendar(path: string, excludes: string[] = []): RawDoc[] {
  const files = collectIcsFiles(path, excludes);
  const docs: RawDoc[] = [];
  for (const full of files) {
    const sourceId = statSync(path).isFile() ? basename(full) : relative(path, full);
    const events = parseICS(readFileSync(full, "utf-8"));
    for (const ev of events) {
      const doc = eventToRawDoc(ev, sourceId);
      if (doc) { doc.link = `file://${full}`; docs.push(doc); }
    }
  }
  return docs;
}
