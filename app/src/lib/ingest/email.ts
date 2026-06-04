/* ═══════════════════════════════════════════════════════
   Email (.mbox) connector.
   Sovereign + ToS-clean: parses your OWN mail export — Gmail Takeout,
   Apple Mail, Thunderbird, anything that exports mbox. Streamed line by
   line so a multi-GB archive never blows memory. No API, no scraping.

   Each message → a RawDoc (subject, from/to, decoded body, date, people).
   Handles folded headers, RFC-2047 encoded-word subjects, quoted-printable
   and base64 bodies, multipart (extracts text/plain, falls back to html),
   and skips Spam/Trash via X-Gmail-Labels.
   ═══════════════════════════════════════════════════════ */

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { htmlToText } from "./parse";
import type { RawDoc } from "./enrich";

export interface EmailParseOpts {
  /** X-Gmail-Labels substrings to skip (default: Spam, Trash). */
  skipLabels?: string[];
  /** Cap body length for embedding (default 4000 chars). */
  maxBodyChars?: number;
  /** Safety cap on messages (default 0 = unlimited). */
  maxMessages?: number;
}

const DEFAULT_SKIP = ["Spam", "Trash"];

/** Parse header lines (handles folding) into a lowercased map + body start index. */
export function parseHeaders(lines: string[]): { headers: Record<string, string>; bodyStart: number } {
  const headers: Record<string, string> = {};
  let lastKey = "";
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") { i++; break; } // blank line ends the header block
    if (/^[ \t]/.test(line) && lastKey) {
      headers[lastKey] += " " + line.trim(); // folded continuation
    } else {
      const m = line.match(/^([!-9;-~]+):[ \t]?(.*)$/); // "Name: value"
      if (m) { lastKey = m[1].toLowerCase(); headers[lastKey] = m[2]; }
    }
  }
  return { headers, bodyStart: i };
}

/** Decode RFC-2047 encoded-words (=?charset?B/Q?text?=) in a header value. */
export function decodeEncodedWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_full, _charset, enc, text) => {
    try {
      if (String(enc).toUpperCase() === "B") {
        return Buffer.from(text, "base64").toString("utf8");
      }
      const qp = String(text)
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(qp, "binary").toString("utf8");
    } catch { return text; }
  });
}

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

function decodeTransfer(body: string, encoding?: string): string {
  const e = (encoding || "").toLowerCase().trim();
  if (e === "base64") {
    try { return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { return body; }
  }
  if (e === "quoted-printable") return decodeQuotedPrintable(body);
  return body;
}

/** Extract readable text from a (possibly multipart) body. */
export function extractText(headers: Record<string, string>, bodyLines: string[]): string {
  const ct = headers["content-type"] || "text/plain";
  const mp = ct.match(/multipart\/[^;]+;[\s\S]*?boundary="?([^";\r\n]+)"?/i);

  if (mp) {
    const boundary = mp[1];
    const parts: string[][] = [];
    let cur: string[] = [];
    let started = false;
    for (const line of bodyLines) {
      if (line === `--${boundary}` || line === `--${boundary}--`) {
        if (started) parts.push(cur);
        cur = []; started = true;
      } else if (started) {
        cur.push(line);
      }
    }
    let html = "";
    for (const part of parts) {
      const { headers: ph, bodyStart } = parseHeaders(part);
      const pct = ph["content-type"] || "";
      if (/multipart/i.test(pct)) {
        const inner = extractText(ph, part.slice(bodyStart));
        if (inner.trim()) return inner.trim();
      }
      const pbody = decodeTransfer(part.slice(bodyStart).join("\n"), ph["content-transfer-encoding"]);
      if (/text\/plain/i.test(pct) && pbody.trim()) return pbody.trim();
      if (/text\/html/i.test(pct) && !html) html = htmlToText(pbody);
    }
    return html.trim();
  }

  const raw = decodeTransfer(bodyLines.join("\n"), headers["content-transfer-encoding"]);
  if (/text\/html/i.test(ct)) return htmlToText(raw).trim();
  return raw.trim();
}

function emailDate(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** Pull display names (or emails) out of From/To headers. */
export function emailPeople(...vals: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (!v) continue;
    for (const addr of v.split(",")) {
      const name = addr.match(/^\s*"?([^"<]+?)"?\s*</);
      const email = addr.match(/<([^>]+)>/) || addr.match(/([^\s,]+@[^\s,]+)/);
      const label = (name?.[1] || email?.[1] || "").trim();
      if (label && !out.includes(label)) out.push(label);
    }
  }
  return out;
}

/** One message's lines → a RawDoc (or null if skipped/empty). */
export function messageToRawDoc(lines: string[], index: number, opts: EmailParseOpts = {}): RawDoc | null {
  const { headers, bodyStart } = parseHeaders(lines);

  const skip = opts.skipLabels ?? DEFAULT_SKIP;
  const labels = (headers["x-gmail-labels"] || "").toLowerCase();
  if (skip.some((s) => labels.includes(s.toLowerCase()))) return null;

  const subject = decodeEncodedWords(headers["subject"] || "").trim();
  const from = decodeEncodedWords(headers["from"] || "").trim();
  const to = decodeEncodedWords(headers["to"] || "").trim();

  let body = extractText(headers, lines.slice(bodyStart));
  if (!subject && !body.trim()) return null;
  const cap = opts.maxBodyChars ?? 4000;
  if (body.length > cap) body = body.slice(0, cap) + "…";

  const head: string[] = [];
  if (from) head.push(`From: ${from}`);
  if (to) head.push(`To: ${to}`);
  const fullBody = (head.length ? head.join("\n") + "\n\n" : "") + body;

  const id = headers["message-id"]?.replace(/[<>]/g, "").trim() || `m${index}`;
  return {
    source: "email",
    sourceId: `email:${id}`,
    title: subject || "(no subject)",
    body: fullBody.trim(),
    date: emailDate(headers["date"]),
    people: emailPeople(from, to).slice(0, 10),
  };
}

/** Stream an mbox file into RawDocs (one per message). */
export async function readEmailMbox(path: string, opts: EmailParseOpts = {}): Promise<RawDoc[]> {
  const docs: RawDoc[] = [];
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  const max = opts.maxMessages ?? 0;
  let cur: string[] = [];
  let index = 0;

  const flush = () => {
    if (cur.length) {
      const doc = messageToRawDoc(cur, index++, opts);
      if (doc) docs.push(doc);
    }
    cur = [];
  };

  for await (const line of rl) {
    if (/^From /.test(line)) {          // mbox message separator
      flush();
      if (max && docs.length >= max) { cur = []; break; }
    } else {
      cur.push(line);
    }
  }
  flush();
  return docs;
}
