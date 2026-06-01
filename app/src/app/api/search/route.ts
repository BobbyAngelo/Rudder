import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const DATA_DIR = join(process.cwd(), "..", "data");
const DB_PATH = join(DATA_DIR, "rudder.db");

function loadJSON(subpath: string) {
  const fullPath = join(DATA_DIR, subpath);
  if (!existsSync(fullPath)) return null;
  try { return JSON.parse(readFileSync(fullPath, "utf-8")); } catch { return null; }
}

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

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const results: SearchResult[] = [];

  // 1. People (SQLite)
  try {
    if (existsSync(DB_PATH)) {
      const db = new Database(DB_PATH, { readonly: true });
      const people = db.prepare(
        `SELECT id, name, company, role FROM people WHERE name LIKE ? OR company LIKE ? OR role LIKE ? LIMIT 10`
      ).all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];
      for (const p of people) {
        results.push({
          type: "people",
          title: p.name,
          subtitle: [p.role, p.company].filter(Boolean).join(" · ") || "Contact",
          href: "/people",
          score: p.name.toLowerCase().startsWith(q) ? 10 : 5,
        });
      }
      db.close();
    }
  } catch { /* */ }

  // 2. Writing entries (SQLite)
  try {
    if (existsSync(DB_PATH)) {
      const db = new Database(DB_PATH, { readonly: true });
      const entries = db.prepare(
        `SELECT id, title, mode, word_count FROM journal_entries WHERE title LIKE ? OR content LIKE ? LIMIT 8`
      ).all(`%${q}%`, `%${q}%`) as any[];
      for (const e of entries) {
        results.push({
          type: "writing",
          title: e.title,
          subtitle: `${e.mode} · ${e.word_count}w`,
          href: "/writing",
          score: e.title.toLowerCase().startsWith(q) ? 9 : 4,
        });
      }
      db.close();
    }
  } catch { /* */ }

  // 3. Documents (JSON)
  try {
    const docs = loadJSON("business/documents.json") || [];
    for (const doc of docs) {
      if ((doc.title || "").toLowerCase().includes(q) || (doc.type || "").toLowerCase().includes(q)) {
        results.push({
          type: "business",
          title: doc.title,
          subtitle: `${doc.type} document`,
          href: "/business",
          score: (doc.title || "").toLowerCase().startsWith(q) ? 8 : 3,
        });
      }
    }
  } catch { /* */ }

  // 4. Career data (JSON)
  try {
    const career = loadJSON("writing/career-data.json") || {};
    const timeline = career.timeline || [];
    const productions = career.productions || [];
    for (const t of timeline) {
      if ((t.company || "").toLowerCase().includes(q) || (t.title || "").toLowerCase().includes(q)) {
        results.push({
          type: "career",
          title: t.title || t.company,
          subtitle: [t.company, t.period].filter(Boolean).join(" · "),
          href: "/career",
          score: 4,
        });
      }
    }
    for (const p of productions) {
      if ((p.title || "").toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q)) {
        results.push({
          type: "career",
          title: p.title,
          subtitle: `Production · ${p.client || ""}`,
          href: "/career",
          score: 3,
        });
      }
    }
  } catch { /* */ }

  // 5. Wiki / Docs (markdown files)
  try {
    const docsDir = join(DATA_DIR, "docs");
    if (existsSync(docsDir)) {
      for (const file of readdirSync(docsDir)) {
        if (!file.endsWith(".md")) continue;
        const content = readFileSync(join(docsDir, file), "utf-8");
        const title = file.replace(/_/g, " ").replace(".md", "");
        if (title.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
          results.push({
            type: "wiki",
            title,
            subtitle: `Wiki · ${content.split("\n").length} lines`,
            href: "/wiki",
            score: title.toLowerCase().includes(q) ? 6 : 2,
          });
        }
      }
    }
  } catch { /* */ }

  // 6. Hardware projects (JSON)
  try {
    const hw = loadJSON("business/hardware-registry.json") || {};
    for (const node of (hw.cluster || [])) {
      if (node.name.toLowerCase().includes(q) || node.role.toLowerCase().includes(q)) {
        results.push({
          type: "hardware",
          title: node.name,
          subtitle: `${node.hw} · ${node.role}`,
          href: "/hardware",
          score: 5,
        });
      }
    }
    for (const proj of (hw.projects || [])) {
      if (proj.name.toLowerCase().includes(q) || proj.slug.toLowerCase().includes(q)) {
        results.push({
          type: "hardware",
          title: proj.name,
          subtitle: `Hardware project · ${proj.files} files`,
          href: "/hardware",
          score: 3,
        });
      }
    }
  } catch { /* */ }

  // 7. Properties (JSON)
  try {
    const props = loadJSON("business/properties.json") || {};
    for (const p of (props.properties || [])) {
      if (p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q)) {
        results.push({
          type: "properties",
          title: p.name,
          subtitle: p.tagline,
          href: "/properties",
          score: 4,
        });
      }
    }
  } catch { /* */ }

  // 8. Identity data (JSON)
  try {
    const resume = loadJSON("identity/master-resume.json") || {};
    const resumeStr = JSON.stringify(resume).toLowerCase();
    if (resumeStr.includes(q)) {
      results.push({
        type: "identity",
        title: "Master Resume",
        subtitle: "Identity · Resume data",
        href: "/identity",
        score: 3,
      });
    }
  } catch { /* */ }

  // Sort by score descending, limit 20
  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    results: results.slice(0, 20),
    query: q,
    total: results.length,
  });
}
