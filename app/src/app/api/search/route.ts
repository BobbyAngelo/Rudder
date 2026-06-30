import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const DATA_DIR = join(process.cwd(), "..", "data");
const DB_PATH = join(DATA_DIR, "rudder.db");

interface SearchIndexRow {
  origin_id: string;
  origin_table: string;
  title: string;
  content: string | null;
  tags: string;
  rank: number;
}

interface BusinessDoc {
  title?: string;
  type?: string;
}

interface CareerTimelineEntry {
  title?: string;
  company?: string;
  period?: string;
  role?: string;
}

interface CareerProduction {
  title?: string;
  client?: string;
}

interface CareerData {
  timeline?: CareerTimelineEntry[];
  productions?: CareerProduction[];
}

interface HardwareNode {
  name?: string;
  hw?: string;
  role?: string;
}

interface HardwareProject {
  name?: string;
  files?: number;
}

interface HardwareData {
  cluster?: HardwareNode[];
  projects?: HardwareProject[];
}

interface PropertyEntry {
  name?: string;
  tagline?: string;
}

interface PropertiesData {
  properties?: PropertyEntry[];
}

let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 10000; // Debounce file index sync to every 10 seconds

/**
 * Clean and escape terms for SQLite FTS5 syntax
 */
function cleanSearchQuery(q: string): string {
  // Replace symbols that might cause FTS5 syntax errors
  const clean = q.replace(/["'\\\/*:|~+<>]/g, " ").trim();
  const terms = clean.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";
  
  // Format as prefix queries joined by AND (e.g. "patent* AND dis*")
  return terms.map(term => `"${term}"*`).join(" AND ");
}

/**
 * Index Markdown wiki files and static JSON files in FTS5 search table
 */
function syncStaticFiles(db: Database.Database) {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL_MS) {
    return; // Skip syncing if within interval
  }

  // Clear existing entries for file-based tables
  db.prepare(`
    DELETE FROM search_index 
    WHERE origin_table IN ('wiki', 'business', 'career', 'hardware', 'properties', 'identity')
  `).run();

  // 1. Index Wiki Documents (Markdown)
  try {
    const docsDir = join(DATA_DIR, "docs");
    if (existsSync(docsDir)) {
      for (const file of readdirSync(docsDir)) {
        if (!file.endsWith(".md")) continue;
        const content = readFileSync(join(docsDir, file), "utf-8");
        const title = file.replace(/_/g, " ").replace(".md", "");
        
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'wiki', ?, ?, '[]')
        `).run(file, title, content);
      }
    }
  } catch (err) {
    log.error("FTS5 sync: Failed to index wiki:", err);
  }

  // 2. Index Business Documents (JSON)
  try {
    const docsPath = join(DATA_DIR, "business/documents.json");
    if (existsSync(docsPath)) {
      const docs = (JSON.parse(readFileSync(docsPath, "utf-8")) || []) as BusinessDoc[];
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'business', ?, ?, '[]')
        `).run(`doc_${i}`, doc.title || "Untitled Document", `${doc.type || ""} document`);
      }
    }
  } catch { /* */ }

  // 3. Index Career data (JSON)
  try {
    const careerPath = join(DATA_DIR, "writing/career-data.json");
    if (existsSync(careerPath)) {
      const career = (JSON.parse(readFileSync(careerPath, "utf-8")) || {}) as CareerData;
      const timeline = career.timeline || [];
      const productions = career.productions || [];
      
      for (let i = 0; i < timeline.length; i++) {
        const t = timeline[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'career', ?, ?, '[]')
        `).run(`timeline_${i}`, t.title || t.company, [t.company, t.period, t.role].filter(Boolean).join(" · "));
      }
      for (let i = 0; i < productions.length; i++) {
        const p = productions[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'career', ?, ?, '[]')
        `).run(`prod_${i}`, p.title, `Production · ${p.client || ""}`);
      }
    }
  } catch { /* */ }

  // 4. Index Hardware projects (JSON)
  try {
    const hwPath = join(DATA_DIR, "business/hardware-registry.json");
    if (existsSync(hwPath)) {
      const hw = (JSON.parse(readFileSync(hwPath, "utf-8")) || {}) as HardwareData;
      const cluster = hw.cluster || [];
      const projects = hw.projects || [];
      
      for (let i = 0; i < cluster.length; i++) {
        const node = cluster[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'hardware', ?, ?, '[]')
        `).run(`node_${i}`, node.name, `${node.hw || ""} · ${node.role || ""}`);
      }
      for (let i = 0; i < projects.length; i++) {
        const proj = projects[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'hardware', ?, ?, '[]')
        `).run(`proj_${i}`, proj.name, `Hardware project · ${proj.files || 0} files`);
      }
    }
  } catch { /* */ }

  // 5. Index Properties (JSON)
  try {
    const propsPath = join(DATA_DIR, "business/properties.json");
    if (existsSync(propsPath)) {
      const props = (JSON.parse(readFileSync(propsPath, "utf-8")) || {}) as PropertiesData;
      const properties = props.properties || [];
      for (let i = 0; i < properties.length; i++) {
        const p = properties[i];
        db.prepare(`
          INSERT INTO search_index (origin_id, origin_table, title, content, tags)
          VALUES (?, 'properties', ?, ?, '[]')
        `).run(`prop_${i}`, p.name, p.tagline || "");
      }
    }
  } catch { /* */ }

  // 6. Index Identity Master Resume (JSON)
  try {
    const resumePath = join(DATA_DIR, "identity/master-resume.json");
    if (existsSync(resumePath)) {
      const resume = JSON.parse(readFileSync(resumePath, "utf-8")) || {};
      const resumeStr = JSON.stringify(resume);
      db.prepare(`
        INSERT INTO search_index (origin_id, origin_table, title, content, tags)
        VALUES ('master_resume', 'identity', 'Master Resume', ?, '[]')
      `).run(resumeStr.slice(0, 1000));
    }
  } catch { /* */ }

  lastSyncTime = now;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const cleanQuery = cleanSearchQuery(q);
  if (!cleanQuery) {
    return NextResponse.json({ results: [], query: q });
  }

  try {
    if (!existsSync(DB_PATH)) {
      return NextResponse.json({ results: [], error: "Database not initialized" }, { status: 500 });
    }

    const db = new Database(DB_PATH);
    
    // Sync static files into index
    syncStaticFiles(db);

    // Query unified search index using SQLite FTS5 MATCH
    const rows = db.prepare(`
      SELECT origin_id, origin_table, title, content, tags, rank
      FROM search_index 
      WHERE search_index MATCH ? 
      ORDER BY rank 
      LIMIT 20
    `).all(cleanQuery) as SearchIndexRow[];

    const results: Array<{
      type: string;
      title: string;
      subtitle: string;
      href: string;
    }> = [];

    for (const row of rows) {
      let type = row.origin_table;
      let href = "/";
      let subtitle = row.content || "";

      // Clean HTML tags and markdown markers if present
      subtitle = subtitle.replace(/[#*`_\[\]]/g, "").trim();

      // Normalize return values
      if (type === "journal_entries") {
        type = "writing";
        href = `/writing?id=${row.origin_id}`;
        subtitle = `Journal · ${subtitle.slice(0, 50)}...`;
      } else if (type === "tasks") {
        type = "schedule";
        href = "/planner";
        subtitle = `Task · ${subtitle.slice(0, 50) || "Action Item"}`;
      } else if (type === "calendar_events") {
        type = "schedule";
        href = "/planner";
        subtitle = `Calendar Event · ${subtitle.slice(0, 50)}`;
      } else if (type === "people") {
        type = "people";
        href = "/people";
        subtitle = subtitle.slice(0, 50);
      } else if (type === "wiki") {
        type = "wiki";
        href = `/wiki?file=${encodeURIComponent(row.origin_id)}`;
        subtitle = `Wiki · ${subtitle.slice(0, 50)}...`;
      } else if (type === "business") {
        href = "/business";
        subtitle = `Business Document`;
      } else if (type === "career") {
        href = "/career";
        subtitle = `Career · ${subtitle.slice(0, 50)}`;
      } else if (type === "hardware") {
        href = "/hardware";
        subtitle = `Hardware · ${subtitle.slice(0, 50)}`;
      } else if (type === "properties") {
        href = "/properties";
        subtitle = `Property · ${subtitle.slice(0, 50)}`;
      } else if (type === "identity") {
        href = "/identity";
        subtitle = `Identity · ${subtitle.slice(0, 50)}`;
      }

      results.push({
        type,
        title: row.title,
        subtitle,
        href
      });
    }

    db.close();

    return NextResponse.json({
      results,
      query: q,
      total: results.length
    });

  } catch (error) {
    log.error("Unified search failed:", error);
    return NextResponse.json({ results: [], error: "Internal server error" }, { status: 500 });
  }
}
