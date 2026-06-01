/* ═══════════════════════════════════════════════════════
   Ingest · enrich — the quality core of the ingest engine.
   Turns a raw document into well-formed Chunks with the
   structured metadata recall depends on: stable id, date,
   people/entities, and a link back to the source.

   Source-agnostic on purpose — every connector reuses this.
   ═══════════════════════════════════════════════════════ */

import type { Chunk } from "../retrieval";

export interface RawDoc {
  source: string;     // connector id, e.g. "markdown"
  sourceId: string;   // stable id within the source, e.g. relative file path
  title: string;
  body: string;
  date?: string;      // ISO yyyy-mm-dd if known (e.g. from frontmatter)
  people?: string[];  // known entities (e.g. from frontmatter)
  link?: string;      // optional URI back to the original
}

const MAX_CHARS = 1200; // target chunk size; keeps embeddings focused

/** First ISO (yyyy-mm-dd) or "Month DD, YYYY" date found in text, normalized to ISO. */
export function extractDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  const m = text.toLowerCase().match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const key = Object.keys(months).find((mm) => mm.startsWith(m[1].slice(0, 3)));
    if (key) return `${m[3]}-${months[key]}-${m[2].padStart(2, "0")}`;
  }
  return undefined;
}

/** Obsidian-style [[wikilinks]] and @mentions → entity/people tags. */
export function extractEntities(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) out.add(m[1].trim());
  for (const m of text.matchAll(/(?:^|\s)@([A-Za-z][\w-]{1,30})/g)) out.add(m[1].trim());
  return [...out];
}

/** Split markdown/plaintext into sections by headings, then size-limit each. */
export function splitSections(body: string): { heading?: string; text: string }[] {
  const lines = body.split(/\r?\n/);
  const sections: { heading?: string; text: string }[] = [];
  let heading: string | undefined;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading, text });
    buf = [];
  };
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { flush(); heading = h[1].trim(); } else { buf.push(line); }
  }
  flush();

  // Size-limit: pack paragraphs to <= MAX_CHARS, then hard-split anything
  // still oversized (a giant single paragraph, table, or minified blob).
  const out: { heading?: string; text: string }[] = [];
  for (const s of sections) {
    const pieces: string[] = [];
    let cur = "";
    for (const para of s.text.split(/\n\s*\n/)) {
      if ((cur + "\n\n" + para).length > MAX_CHARS && cur) { pieces.push(cur.trim()); cur = para; }
      else { cur = cur ? `${cur}\n\n${para}` : para; }
    }
    if (cur.trim()) pieces.push(cur.trim());
    for (const p of pieces) {
      if (p.length <= MAX_CHARS) out.push({ heading: s.heading, text: p });
      else for (const h of hardSplit(p, MAX_CHARS)) out.push({ heading: s.heading, text: h });
    }
  }
  return out;
}

/** Force-split text that has no paragraph breaks, preferring whitespace boundaries. */
function hardSplit(text: string, max: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      const ws = text.lastIndexOf(" ", end);
      if (ws > i + max * 0.6) end = ws; // break at a space if reasonably close
    }
    const piece = text.slice(i, end).trim();
    if (piece) out.push(piece);
    i = end;
  }
  return out;
}

/** Turn a raw document into enriched, indexable chunks. */
export function toChunks(doc: RawDoc): Chunk[] {
  const sections = splitSections(doc.body);
  const baseDate = doc.date ?? extractDate(doc.body);
  const basePeople = new Set(doc.people ?? []);

  return sections.map((sec, i) => {
    const people = new Set(basePeople);
    for (const e of extractEntities(sec.text)) people.add(e);
    return {
      id: `${doc.source}:${doc.sourceId}#${i}`,
      sourceId: doc.sourceId,
      source: doc.source,
      title: sec.heading ? `${doc.title} — ${sec.heading}` : doc.title,
      content: sec.text,
      date: baseDate ?? extractDate(sec.text),
      people: people.size ? [...people] : undefined,
    };
  });
}
