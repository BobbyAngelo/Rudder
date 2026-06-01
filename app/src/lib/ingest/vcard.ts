/* ═══════════════════════════════════════════════════════
   Ingest · Contacts (vCard / .vcf) connector.
   Zero-dependency parser for the format macOS Contacts, Google
   Contacts, and most address books export. Each VCARD becomes a
   RawDoc tagged with the contact's name as a people-entity — the
   backbone that makes people-aware recall ("what's Jane's role",
   "who do I know at Acme") work.
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename } from "path";
import type { RawDoc } from "./enrich";

export interface VCard {
  fn?: string;          // formatted name
  org?: string;
  title?: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  urls: string[];
  note?: string;
  bday?: string;        // ISO yyyy-mm-dd if parseable
}

interface Prop { name: string; params: Record<string, string>; value: string; }

/** vCard line unfolding (same folding rule as iCalendar). */
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = left.split(";");
  // Property name may carry a group prefix ("item1.EMAIL") — strip it.
  const name = segs[0].split(".").pop()!.toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq > 0) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
    else params[seg.toUpperCase()] = "";   // bare type param (e.g. "WORK")
  }
  return { name, params, value };
}

/** Join a structured value (";"-separated components) into readable text. */
function joinStructured(value: string): string {
  return value.split(";").map((s) => unescape(s)).filter(Boolean).join(", ");
}

/** Parse a .vcf document into one or more cards. */
export function parseVCards(text: string): VCard[] {
  const lines = unfold(text).split(/\r?\n/);
  const cards: VCard[] = [];
  let cur: VCard | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VCARD") { cur = { emails: [], phones: [], addresses: [], urls: [] }; continue; }
    if (upper === "END:VCARD") { if (cur) cards.push(cur); cur = null; continue; }
    if (!cur) continue;

    const prop = parseLine(line);
    if (!prop) continue;
    switch (prop.name) {
      case "FN": cur.fn = unescape(prop.value); break;
      case "N": if (!cur.fn) cur.fn = joinStructured(prop.value); break; // fallback if no FN
      case "ORG": cur.org = joinStructured(prop.value); break;
      case "TITLE": cur.title = unescape(prop.value); break;
      case "EMAIL": { const e = prop.value.trim(); if (e) cur.emails.push(e); break; }
      case "TEL": { const t = prop.value.trim(); if (t) cur.phones.push(t); break; }
      case "ADR": { const a = joinStructured(prop.value); if (a) cur.addresses.push(a); break; }
      case "URL": { const u = prop.value.trim(); if (u) cur.urls.push(u); break; }
      case "NOTE": cur.note = unescape(prop.value); break;
      case "BDAY": { const m = prop.value.match(/(\d{4})-?(\d{2})-?(\d{2})/); if (m) cur.bday = `${m[1]}-${m[2]}-${m[3]}`; break; }
    }
  }
  return cards;
}

/** Turn one card into a RawDoc, with the contact name as a people-tag. */
export function cardToRawDoc(card: VCard, sourceId: string, index: number): RawDoc | null {
  const name = card.fn?.trim();
  if (!name) return null;

  const lines: string[] = [];
  if (card.title || card.org) lines.push([card.title, card.org].filter(Boolean).join(" at "));
  if (card.emails.length) lines.push(`Email: ${card.emails.join(", ")}`);
  if (card.phones.length) lines.push(`Phone: ${card.phones.join(", ")}`);
  if (card.addresses.length) lines.push(`Address: ${card.addresses.join("; ")}`);
  if (card.urls.length) lines.push(`Links: ${card.urls.join(", ")}`);
  if (card.bday) lines.push(`Birthday: ${card.bday}`);
  if (card.note) lines.push("", card.note);

  return {
    source: "contacts",
    sourceId: `${sourceId}#${index}:${name}`,
    title: name,
    body: lines.join("\n").trim() || name,
    people: [name],
  };
}

function collectVcfFiles(path: string, excludes: string[]): string[] {
  const st = statSync(path);
  if (st.isFile()) return /\.vcf$/i.test(path) ? [path] : [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      if (excludes.some((ex) => full.includes(ex))) continue;
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.vcf$/i.test(name)) out.push(full);
    }
  };
  walk(path);
  return out;
}

/** Read a single .vcf file or a folder of them into RawDoc[] (one per contact). */
export function readContacts(path: string, excludes: string[] = []): RawDoc[] {
  const files = collectVcfFiles(path, excludes);
  const isFile = statSync(path).isFile();
  const docs: RawDoc[] = [];
  for (const full of files) {
    const sourceId = isFile ? basename(full) : relative(path, full);
    const cards = parseVCards(readFileSync(full, "utf-8"));
    cards.forEach((card, i) => {
      const doc = cardToRawDoc(card, sourceId, i);
      if (doc) { doc.link = `file://${full}`; docs.push(doc); }
    });
  }
  return docs;
}
