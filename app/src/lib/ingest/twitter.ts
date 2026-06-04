/* ═══════════════════════════════════════════════════════
   X / Twitter archive connector.
   Sovereign + ToS-clean: parses YOUR OWN archive (Settings → Download an
   archive of your data), read locally. No API, no scraping.

   X archive files are JavaScript, not JSON — each is
     window.YTD.tweets.part0 = [ ... ]
   so we strip the assignment prefix and parse the array.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { RawDoc } from "./enrich";

/** Strip the `window.YTD.<x>.partN = ` prefix and parse the JSON array. */
export function parseTwitterJs(text: string): any[] | null {
  const i = text.indexOf("[");
  if (i < 0) return null;
  try {
    const parsed = JSON.parse(text.slice(i));
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

/** Twitter date ("Tue Jun 02 09:00:00 +0000 2026") or ISO → yyyy-mm-dd. */
function toISO(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function parseTweets(arr: any[]): RawDoc[] {
  const docs: RawDoc[] = [];
  arr.forEach((row, idx) => {
    const t = row?.tweet || row;
    if (!t) return;
    const text = unescape(t.full_text || t.text || "").trim();
    if (!text) return;
    if (/^RT @/.test(text)) return; // skip retweets (other people's content)
    docs.push({
      source: "twitter",
      sourceId: `twitter:tweet:${t.id_str || t.id || idx}`,
      title: text.split("\n")[0].slice(0, 80) || "Tweet",
      body: text,
      date: toISO(t.created_at),
    });
  });
  return docs;
}

export function parseDMs(arr: any[]): RawDoc[] {
  const docs: RawDoc[] = [];
  arr.forEach((row, idx) => {
    const conv = row?.dmConversation;
    if (!conv || !Array.isArray(conv.messages)) return;
    const msgs = conv.messages
      .map((m: any) => m?.messageCreate)
      .filter((m: any) => m && typeof m.text === "string");
    if (!msgs.length) return;
    const lines = msgs.slice(0, 80).map((m: any) => unescape(m.text));
    const latest = msgs.map((m: any) => m.createdAt).filter(Boolean).sort().pop();
    docs.push({
      source: "twitter",
      sourceId: `twitter:dm:${conv.conversationId || idx}`,
      title: "Direct message conversation",
      body: lines.join("\n").slice(0, 4000),
      date: toISO(latest),
    });
  });
  return docs;
}

const TWEET_FILES = ["tweets.js", "tweet.js"];
const DM_FILES = ["direct-messages.js", "direct-message.js"];

function findFile(dir: string, names: string[]): string | null {
  for (const d of [dir, join(dir, "data")]) {
    let entries: string[] = [];
    try { entries = readdirSync(d); } catch { continue; }
    for (const f of entries) {
      if (names.some((n) => f.toLowerCase() === n.toLowerCase())) return join(d, f);
    }
  }
  return null;
}

/** Read an X/Twitter archive folder (or a file inside it) into RawDocs. */
export function readTwitter(path: string): RawDoc[] {
  let dir: string;
  try { dir = statSync(path).isDirectory() ? path : join(path, ".."); }
  catch { return []; }

  const docs: RawDoc[] = [];
  const tweetsFile = findFile(dir, TWEET_FILES);
  if (tweetsFile) {
    const arr = parseTwitterJs(readFileSync(tweetsFile, "utf8"));
    if (arr) docs.push(...parseTweets(arr));
  }
  const dmFile = findFile(dir, DM_FILES);
  if (dmFile) {
    const arr = parseTwitterJs(readFileSync(dmFile, "utf8"));
    if (arr) docs.push(...parseDMs(arr));
  }
  return docs;
}
