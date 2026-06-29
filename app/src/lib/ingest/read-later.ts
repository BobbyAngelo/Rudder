/* =======================================================================
   Ingest | Read-Later (Pocket / Instapaper) Parser.
   Parses HTML bookmarks and CSV backups from Read-later services.
   ======================================================================= */

import { readFileSync } from "fs";

export interface ReadLaterItem {
  url: string;
  title: string;
  tags: string[];
  timestamp: string; // ISO format
  source: "Pocket" | "Instapaper";
}

/**
 * Parses Pocket HTML export files (ril_export.html)
 */
export function parsePocketHTML(content: string): ReadLaterItem[] {
  const items: ReadLaterItem[] = [];
  const aTagRegex = /<A\s+([^>]+)>(.*?)<\/A>/gi;

  let match;
  while ((match = aTagRegex.exec(content)) !== null) {
    const attrsStr = match[1];
    const rawTitle = match[2] || "Untitled";
    const title = rawTitle.replace(/<[^>]*>/g, "").trim();

    const hrefMatch = attrsStr.match(/HREF="([^"]+)"/i);
    if (!hrefMatch) continue;
    const url = hrefMatch[1];

    // Extract time_added attribute
    let timestamp = new Date().toISOString();
    const timeMatch = attrsStr.match(/TIME_ADDED="(\d+)"/i);
    if (timeMatch) {
      const seconds = parseInt(timeMatch[1], 10);
      try {
        timestamp = new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 19);
      } catch {}
    }

    // Extract tags
    let tags: string[] = [];
    const tagsMatch = attrsStr.match(/TAGS="([^"]*)"/i);
    if (tagsMatch && tagsMatch[1]) {
      tags = tagsMatch[1].split(",").map(t => t.trim()).filter(Boolean);
    }

    items.push({
      url,
      title,
      tags,
      timestamp,
      source: "Pocket"
    });
  }

  return items;
}

/**
 * Parses Instapaper CSV export files (instapaper-export.csv)
 * Format: URL, Title, Selection, Folder, Timestamp
 */
export function parseInstapaperCSV(content: string): ReadLaterItem[] {
  const items: ReadLaterItem[] = [];
  const lines = content.split(/\r?\n/);
  
  // Skip CSV header if present (URL, Title, Selection, Folder, Timestamp)
  const startIndex = lines[0]?.toLowerCase().includes("url") ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser supporting double quotes
    const cells: string[] = [];
    let insideQuote = false;
    let currentCell = "";
    
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cells.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());

    if (cells.length < 2) continue;

    const url = cells[0].replace(/^"|"$/g, "");
    const title = cells[1]?.replace(/^"|"$/g, "") || "Untitled";
    const folder = cells[3]?.replace(/^"|"$/g, "") || "";
    const timeStr = cells[4]?.replace(/^"|"$/g, "");

    let timestamp = new Date().toISOString();
    if (timeStr) {
      const seconds = parseInt(timeStr, 10);
      if (!isNaN(seconds)) {
        try {
          timestamp = new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 19);
        } catch {}
      }
    }

    const tags = folder ? [folder.toLowerCase()] : [];

    items.push({
      url,
      title,
      tags,
      timestamp,
      source: "Instapaper"
    });
  }

  return items;
}

/**
 * Read and detect parser based on file type
 */
export function readReadLaterFile(filePath: string): ReadLaterItem[] {
  const content = readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".csv")) {
    return parseInstapaperCSV(content);
  } else {
    return parsePocketHTML(content);
  }
}
