/* =======================================================================
   Ingest | Netscape Bookmarks HTML Parser.
   Parses standard HTML bookmark exports.
   ======================================================================= */

import { readFileSync } from "fs";

export interface ParsedBookmark {
  url: string;
  title: string;
  addDate: string | null; // ISO datetime
}

export function parseBookmarks(htmlContent: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  const bookmarkRegex = /<A\s+[^>]*HREF="([^"]+)"[^>]*>(.*?)<\/A>/gi;

  let match;
  while ((match = bookmarkRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    const rawTitle = match[2] || "Untitled Bookmark";
    const fullTag = match[0];

    // Clean title (remove HTML tags inside title if any)
    const title = rawTitle.replace(/<[^>]*>/g, "").trim();

    // Extract ADD_DATE if exists
    let addDate: string | null = null;
    const addDateMatch = fullTag.match(/ADD_DATE="(\d+)"/i);
    if (addDateMatch) {
      const seconds = parseInt(addDateMatch[1], 10);
      // ADD_DATE might be in seconds or milliseconds depending on browser
      const ms = seconds > 10000000000 ? seconds : seconds * 1000;
      try {
        addDate = new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
      } catch {
        addDate = null;
      }
    }

    bookmarks.push({ url, title, addDate });
  }

  return bookmarks;
}

export function readBookmarksFile(filePath: string): ParsedBookmark[] {
  const content = readFileSync(filePath, "utf-8");
  return parseBookmarks(content);
}
