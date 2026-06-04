/* ═══════════════════════════════════════════════════════
   Meta (Facebook / Instagram) export connector.
   Sovereign + ToS-clean: parses YOUR OWN "Download Your Information"
   export (request it in JSON), read locally. No API, no scraping —
   Meta's Graph API can't read your own timeline, and scraping is banned.

   Meta's export format varies across FB/IG and versions, so this is a
   shape-detecting JSON walker: it finds posts/comments and message threads
   wherever they live in the folder, and fixes Meta's well-known UTF-8
   mojibake (bytes double-encoded as latin1).
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { RawDoc } from "./enrich";

/** Meta exports double-encode UTF-8 as latin1 (e.g. "café" → "cafÃ©"). Repair it. */
export function fixMetaText(s: unknown): string {
  if (typeof s !== "string" || !s) return typeof s === "string" ? s : "";
  try {
    // Only re-decode strings that look mojibake'd, to avoid mangling clean ones.
    if (/[Â-Ã][-¿]/.test(s)) {
      return Buffer.from(s, "latin1").toString("utf8");
    }
  } catch { /* fall through */ }
  return s;
}

/** Unix seconds OR ms → ISO yyyy-mm-dd. */
function toISO(t?: number): string | undefined {
  if (!t || typeof t !== "number") return undefined;
  const ms = t > 1e12 ? t : t * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** Pull readable text out of a post/comment item (FB + IG shapes). */
function postText(item: any): string {
  const parts: string[] = [];
  if (typeof item.title === "string") parts.push(item.title);
  if (typeof item.post === "string") parts.push(item.post);
  if (Array.isArray(item.data)) for (const d of item.data) if (typeof d?.post === "string") parts.push(d.post);
  if (Array.isArray(item.media)) for (const m of item.media) if (typeof m?.title === "string") parts.push(m.title);
  return parts.map(fixMetaText).filter(Boolean).join("\n").trim();
}

function itemTimestamp(item: any): number | undefined {
  if (typeof item.timestamp === "number") return item.timestamp;
  if (typeof item.creation_timestamp === "number") return item.creation_timestamp;
  if (Array.isArray(item.media) && typeof item.media[0]?.creation_timestamp === "number") return item.media[0].creation_timestamp;
  return undefined;
}

/** Turn one parsed JSON object into RawDocs (a message thread, or posts/comments). */
export function parseMetaJson(json: any, fileLabel: string): RawDoc[] {
  const docs: RawDoc[] = [];

  // 1) A message thread: { participants, messages: [{sender_name, timestamp_ms, content}] }
  if (json && Array.isArray(json.messages) && (json.participants || json.thread_path)) {
    const participants = (json.participants || []).map((p: any) => fixMetaText(p?.name)).filter(Boolean);
    const msgs = json.messages.filter((m: any) => typeof m?.content === "string");
    if (msgs.length) {
      const lines = msgs.slice(0, 80).reverse()
        .map((m: any) => `${fixMetaText(m.sender_name)}: ${fixMetaText(m.content)}`);
      const latest = Math.max(0, ...json.messages.map((m: any) => Number(m.timestamp_ms) || 0));
      docs.push({
        source: "meta",
        sourceId: `meta:thread:${json.thread_path || fileLabel}`,
        title: `Conversation with ${participants.join(", ") || "someone"}`,
        body: lines.join("\n").slice(0, 4000),
        date: toISO(latest),
        people: participants.slice(0, 10),
      });
    }
    return docs;
  }

  // 2) Posts / comments: an array (or an object whose value is an array) of timestamped items.
  const arrays: any[][] = [];
  if (Array.isArray(json)) arrays.push(json);
  else if (json && typeof json === "object") for (const v of Object.values(json)) if (Array.isArray(v)) arrays.push(v as any[]);

  for (const arr of arrays) {
    arr.forEach((item: any, i: number) => {
      if (!item || typeof item !== "object") return;
      const text = postText(item);
      if (!text) return;
      docs.push({
        source: "meta",
        sourceId: `meta:${fileLabel}:${i}`,
        title: text.split("\n")[0].slice(0, 80) || "Post",
        body: text,
        date: toISO(itemTimestamp(item)),
      });
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

/** Read a Meta DYI export folder (or a file inside it) into RawDocs. */
export function readMeta(path: string): RawDoc[] {
  let dir: string;
  try { dir = statSync(path).isDirectory() ? path : join(path, ".."); }
  catch { return []; }

  const files: string[] = [];
  walkJson(dir, files);

  const docs: RawDoc[] = [];
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(f, "utf8"));
      const label = f.slice(dir.length + 1).replace(/[/\\]/g, "-").replace(/\.json$/i, "");
      docs.push(...parseMetaJson(json, label));
    } catch { /* skip unreadable/unknown json */ }
  }
  return docs;
}
