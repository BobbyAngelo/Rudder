/* ═══════════════════════════════════════════════════════
   Ingest · parse — the universal-drop file dispatcher.
   Turns any supported file (a path or an uploaded buffer) into a
   { title, body } pair, which enrich.toChunks() takes from there.

   Text formats (txt/md/html/csv/json/…) are parsed with ZERO
   dependencies — they always work, sovereign and offline.

   Binary formats (pdf/docx/images) are OPTIONAL: parsed via a
   lazily-loaded library, with a clear "install X" message if it's
   absent. The engine degrades gracefully — a missing PDF lib never
   breaks ingesting the rest of a folder.
   ═══════════════════════════════════════════════════════ */

import { basename, extname } from "path";

export interface ParsedFile {
  title: string;
  body: string;
}

// Extensions handled with no external dependency.
const TEXT_EXTS = new Set([
  ".txt", ".text", ".log", ".md", ".markdown", ".mdx",
  ".html", ".htm", ".xml", ".csv", ".tsv", ".json", ".rtf",
]);

// Extensions that need an optional library (lazy-loaded on first use).
const PDF_EXTS = new Set([".pdf"]);
const DOCX_EXTS = new Set([".docx"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);

export function isSupported(filename: string): boolean {
  const e = extname(filename).toLowerCase();
  return TEXT_EXTS.has(e) || PDF_EXTS.has(e) || DOCX_EXTS.has(e) || IMAGE_EXTS.has(e);
}

/** Human-readable list of what the drop door accepts (for UI/help). */
export const SUPPORTED_LABEL =
  "txt, md, html, csv, tsv, json, rtf · pdf, docx · images (OCR)";

// ── Zero-dependency text helpers ─────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

/** Strip an HTML/XML document down to readable text. Conservative, no deps. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|head|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z#0-9]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Turn delimited rows into readable "col: value" lines so they embed well. */
function tableToText(raw: string, delim: string): string {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return "";
  const header = lines[0].split(delim).map((h) => h.trim());
  const looksLikeHeader = header.every((h) => h && !/^\d+([.,]\d+)?$/.test(h));
  const rows = looksLikeHeader ? lines.slice(1) : lines;
  return rows
    .map((line) => {
      const cells = line.split(delim);
      if (looksLikeHeader) {
        return header.map((h, i) => `${h}: ${(cells[i] ?? "").trim()}`).filter((s) => !s.endsWith(": ")).join("; ");
      }
      return cells.map((c) => c.trim()).join(" | ");
    })
    .filter(Boolean)
    .join("\n");
}

/** Flatten JSON into "key: value" lines (arrays/objects walked recursively). */
function jsonToText(raw: string): string {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return raw; }
  const out: string[] = [];
  const walk = (val: unknown, prefix: string) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) { val.forEach((v, i) => walk(v, `${prefix}[${i}]`)); return; }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) walk(v, prefix ? `${prefix}.${k}` : k);
      return;
    }
    out.push(`${prefix}: ${String(val)}`);
  };
  walk(data, "");
  return out.join("\n");
}

/** Strip RTF control words to plain text (good enough; no deps). */
function rtfToText(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*[^}]*\}/g, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Optional binary-format loaders ───────────────────────
// A runtime-computed specifier keeps the bundler/typechecker from
// hard-resolving these — they're truly optional.

async function loadOptional(pkg: string): Promise<any> {
  try {
    const specifier = pkg; // non-literal: not statically resolved
    return await import(specifier);
  } catch {
    throw new Error(
      `This file type needs an optional dependency. Install it to enable it:\n  npm i ${pkg}`
    );
  }
}

async function parsePdf(buf: Buffer): Promise<string> {
  const mod = await loadOptional("pdf-parse");
  const pdf = mod.default ?? mod;
  const { text } = await pdf(buf);
  return (text || "").trim();
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mod = await loadOptional("mammoth");
  const mammoth = mod.default ?? mod;
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return (value || "").trim();
}

async function parseImage(buf: Buffer): Promise<string> {
  const mod = await loadOptional("tesseract.js");
  const tesseract = mod.default ?? mod;
  const { data } = await tesseract.recognize(buf, "eng");
  return (data?.text || "").trim();
}

// ── Dispatcher ───────────────────────────────────────────

/**
 * Parse a file (by buffer + name) into { title, body }.
 * Returns null for unsupported types or empty content (caller skips it).
 */
export async function parseFileBuffer(buf: Buffer, filename: string): Promise<ParsedFile | null> {
  const ext = extname(filename).toLowerCase();
  const title = basename(filename, extname(filename));
  let body = "";

  if (ext === ".html" || ext === ".htm" || ext === ".xml") {
    body = htmlToText(buf.toString("utf-8"));
  } else if (ext === ".csv") {
    body = tableToText(buf.toString("utf-8"), ",");
  } else if (ext === ".tsv") {
    body = tableToText(buf.toString("utf-8"), "\t");
  } else if (ext === ".json") {
    body = jsonToText(buf.toString("utf-8"));
  } else if (ext === ".rtf") {
    body = rtfToText(buf.toString("utf-8"));
  } else if (TEXT_EXTS.has(ext)) {
    body = buf.toString("utf-8").trim();
  } else if (PDF_EXTS.has(ext)) {
    body = await parsePdf(buf);
  } else if (DOCX_EXTS.has(ext)) {
    body = await parseDocx(buf);
  } else if (IMAGE_EXTS.has(ext)) {
    body = await parseImage(buf);
  } else {
    return null; // unsupported
  }

  body = body.trim();
  return body ? { title, body } : null;
}
