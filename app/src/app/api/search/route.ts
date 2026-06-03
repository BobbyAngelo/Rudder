/* ═══════════════════════════════════════════════════════
   /api/search — fast lexical search across your local store.
   Covers the on-thesis surfaces: your memory (chunk_index) and people.
   Read-only; resilient if the DB isn't ready.
   ═══════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const DATA_DIR = join(process.cwd(), "..", "data");
const DB_PATH = join(DATA_DIR, "rudder.db");

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [], query: q });

  const results: SearchResult[] = [];
  if (!existsSync(DB_PATH)) return NextResponse.json({ results, query: q, total: 0 });

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // People
    try {
      const people = db
        .prepare(`SELECT id, name, company, role FROM people WHERE name LIKE ? OR company LIKE ? OR role LIKE ? LIMIT 8`)
        .all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];
      for (const p of people) {
        results.push({
          type: "people",
          title: p.name,
          subtitle: [p.role, p.company].filter(Boolean).join(" · ") || "Contact",
          href: "/people",
          score: String(p.name).toLowerCase().startsWith(q) ? 10 : 5,
        });
      }
    } catch { /* table may not exist yet */ }

    // Memory (indexed chunks)
    try {
      const mem = db
        .prepare(`SELECT chunk_id, source, title, date FROM chunk_index WHERE title LIKE ? OR content LIKE ? LIMIT 12`)
        .all(`%${q}%`, `%${q}%`) as any[];
      for (const m of mem) {
        results.push({
          type: "memory",
          title: m.title || "(untitled)",
          subtitle: [m.source, m.date].filter(Boolean).join(" · "),
          href: "/memory",
          score: String(m.title || "").toLowerCase().startsWith(q) ? 8 : 4,
        });
      }
    } catch { /* memory not initialized yet */ }

    db.close();
  } catch { /* db locked / not ready */ }

  results.sort((a, b) => b.score - a.score);
  return NextResponse.json({ results: results.slice(0, 20), query: q, total: results.length });
}
