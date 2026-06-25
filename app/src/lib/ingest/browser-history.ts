/* =======================================================================
   Ingest | Browser History SQLite Parser.
   Reads local Chrome, Arc, or Firefox SQLite history databases read-only
   from a copy to avoid locking.
   ======================================================================= */

import Database from "better-sqlite3";
import { existsSync, copyFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

export interface RawDoc {
  source: string;
  sourceId?: string;
  title: string;
  body: string;
  date?: string; // ISO datetime
  link?: string;
}

function chromeTimeToISO(chromeTime: number): string {
  // Microseconds since Jan 1, 1601
  const ms = Math.floor(chromeTime / 1000) - 11644473600000;
  try {
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }
}

function firefoxTimeToISO(firefoxTime: number): string {
  // Microseconds since Jan 1, 1970
  const ms = Math.floor(firefoxTime / 1000);
  try {
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }
}

export function readBrowserHistory(historyPath: string, limit: number = 1000): RawDoc[] {
  if (!existsSync(historyPath)) {
    throw new Error(`Browser history file not found: ${historyPath}`);
  }

  // Generate a safe unique temp path
  const tempDbFile = join(
    tmpdir(),
    `rudder_browser_history_${randomBytes(6).toString("hex")}.db`
  );

  copyFileSync(historyPath, tempDbFile);

  try {
    const historyDb = new Database(tempDbFile, { readonly: true });
    
    // Sniff schema
    const tables = historyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const isChromeLike = tables.some((t) => t.name === "visits");
    const isFirefoxLike = tables.some((t) => t.name === "moz_historyvisits");

    let docs: RawDoc[] = [];

    if (isChromeLike) {
      const rows = historyDb.prepare(`
        SELECT v.id, u.url, u.title, v.visit_time 
        FROM visits v 
        JOIN urls u ON v.url = u.id 
        ORDER BY v.visit_time DESC 
        LIMIT ?
      `).all(limit) as { id: number; url: string; title: string | null; visit_time: number }[];

      docs = rows.map((r) => {
        const title = r.title || "Untitled Page";
        return {
          source: "browser",
          sourceId: `browser-visit-${r.id}`,
          title,
          body: `${title}\n${r.url}`,
          date: chromeTimeToISO(r.visit_time),
          link: r.url,
        };
      });
    } else if (isFirefoxLike) {
      const rows = historyDb.prepare(`
        SELECT v.id, p.url, p.title, v.visit_date 
        FROM moz_historyvisits v 
        JOIN moz_places p ON v.place_id = p.id 
        ORDER BY v.visit_date DESC 
        LIMIT ?
      `).all(limit) as { id: number; url: string; title: string | null; visit_date: number }[];

      docs = rows.map((r) => {
        const title = r.title || "Untitled Page";
        return {
          source: "browser",
          sourceId: `browser-visit-${r.id}`,
          title,
          body: `${title}\n${r.url}`,
          date: firefoxTimeToISO(r.visit_date),
          link: r.url,
        };
      });
    } else {
      throw new Error("Unknown browser history database schema.");
    }

    historyDb.close();
    try {
      unlinkSync(tempDbFile);
    } catch {
      // Ignore cleanup error
    }

    return docs;
  } catch (error) {
    try {
      if (existsSync(tempDbFile)) {
        unlinkSync(tempDbFile);
      }
    } catch {
      // Ignore cleanup error
    }
    throw error;
  }
}
