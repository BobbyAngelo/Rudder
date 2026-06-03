/* ═══════════════════════════════════════════════════════
   LinkedIn export connector.
   Sovereign + ToS-clean: parses YOUR OWN "Get a copy of your data"
   archive (Settings → Data Privacy → Get a copy of your data). No
   scraping, no API — just the CSVs you exported, read locally.

   Maps the professional-identity files to memory:
     Profile · Positions · Education · Skills · Certifications
   ═══════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import type { RawDoc } from "./enrich";

/** Minimal RFC-4180 CSV parser → array of row objects keyed by header.
 *  Handles quoted fields with embedded commas, quotes, and newlines. */
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, j) => { o[h] = (r[j] ?? "").trim(); });
      return o;
    });
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** LinkedIn dates come as "Jan 2020", "2020", or ISO. Normalize to yyyy-mm-dd. */
export function liDate(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const monYear = t.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (monYear) {
    const mm = MONTHS[monYear[1].slice(0, 3).toLowerCase()];
    if (mm) return `${monYear[2]}-${mm}-01`;
  }
  const year = t.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01-01`;
  return undefined;
}

function findCsv(dir: string, name: string): string | null {
  const target = `${name}.csv`.toLowerCase();
  try {
    for (const f of readdirSync(dir)) {
      if (f.toLowerCase() === target) return join(dir, f);
    }
  } catch { /* not a dir */ }
  return null;
}

function loadCsv(dir: string, name: string): Record<string, string>[] {
  const p = findCsv(dir, name);
  if (!p) return [];
  try { return parseCsv(readFileSync(p, "utf-8")); } catch { return []; }
}

/** Read a LinkedIn export folder (or a file inside it) into RawDocs. */
export function readLinkedIn(path: string): RawDoc[] {
  let dir: string;
  try { dir = statSync(path).isDirectory() ? path : dirname(path); }
  catch { return []; }

  const docs: RawDoc[] = [];
  const profile = loadCsv(dir, "Profile")[0];
  const name = profile
    ? `${profile["First Name"] || ""} ${profile["Last Name"] || ""}`.trim()
    : "";
  const who = name ? [name] : undefined;

  // ── Profile (single row) ──
  if (profile) {
    const lines: string[] = [];
    if (profile["Headline"]) lines.push(profile["Headline"]);
    if (profile["Summary"]) lines.push(profile["Summary"]);
    if (profile["Industry"]) lines.push(`Industry: ${profile["Industry"]}`);
    const loc = profile["Geo Location"] || profile["Location"];
    if (loc) lines.push(`Location: ${loc}`);
    if (lines.length) {
      docs.push({
        source: "linkedin", sourceId: "linkedin:profile",
        title: `LinkedIn profile${name ? ` — ${name}` : ""}`,
        body: lines.join("\n"), people: who,
      });
    }
  }

  // ── Positions (jobs) ──
  loadCsv(dir, "Positions").forEach((p, i) => {
    const title = p["Title"] || "";
    const company = p["Company Name"] || p["Company"] || "";
    if (!title && !company) return;
    const startRaw = p["Started On"];
    const endRaw = p["Finished On"];
    const lines: string[] = [`${title}${company ? ` at ${company}` : ""}`];
    if (startRaw) lines.push(`${startRaw}${endRaw ? ` – ${endRaw}` : " – Present"}`);
    if (p["Location"]) lines.push(p["Location"]);
    if (p["Description"]) lines.push("", p["Description"]);
    docs.push({
      source: "linkedin", sourceId: `linkedin:position:${i}`,
      title: `${title}${company ? ` — ${company}` : ""}`.trim() || "Position",
      body: lines.join("\n"), date: liDate(startRaw), people: who,
    });
  });

  // ── Education ──
  loadCsv(dir, "Education").forEach((e, i) => {
    const school = e["School Name"] || e["School"] || "";
    if (!school) return;
    const degree = [e["Degree Name"], e["Notes"]].filter(Boolean).join(" — ");
    docs.push({
      source: "linkedin", sourceId: `linkedin:education:${i}`,
      title: school,
      body: [school, degree, e["Activities"]].filter(Boolean).join("\n"),
      date: liDate(e["Start Date"]), people: who,
    });
  });

  // ── Skills (one doc) ──
  const skills = loadCsv(dir, "Skills").map((s) => s["Name"] || s["Skill"] || "").filter(Boolean);
  if (skills.length) {
    docs.push({
      source: "linkedin", sourceId: "linkedin:skills",
      title: "LinkedIn skills", body: `Skills: ${skills.join(", ")}`, people: who,
    });
  }

  // ── Certifications ──
  loadCsv(dir, "Certifications").forEach((c, i) => {
    const n = c["Name"]; if (!n) return;
    docs.push({
      source: "linkedin", sourceId: `linkedin:cert:${i}`,
      title: n, body: [n, c["Authority"], c["Started On"]].filter(Boolean).join(" · "),
      date: liDate(c["Started On"]), people: who,
    });
  });

  return docs;
}
