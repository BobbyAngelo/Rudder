/* ═══════════════════════════════════════════════════════
   RAG Pipeline — Retrieval Augmented Generation
   Builds context from sovereign data for LLM queries
   ═══════════════════════════════════════════════════════ */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { getDB } from "./db";
import type { Chunk } from "./retrieval";

// Re-export so existing consumers (api/ask, api/chat) keep importing from "@/lib/rag".
export type { Chunk } from "./retrieval";
export { retrieveChunks } from "./retrieval";

const DATA_DIR = join(process.cwd(), "..", "data");

function loadJSON(subpath: string) {
  const fullPath = join(DATA_DIR, subpath);
  if (!existsSync(fullPath)) return null;
  try { return JSON.parse(readFileSync(fullPath, "utf-8")); } catch { return null; }
}

/**
 * Build all chunks from sovereign data (in-memory, on-demand)
 * This avoids needing a separate embeddings DB for now.
 * ~1,500 chunks, fast to build on each request.
 */
export function buildContextChunks(): Chunk[] {
  const chunks: Chunk[] = [];

  try {
    const db = getDB();

    // 1. People
    try {
      const people = db.prepare("SELECT name, company, title, notes FROM people LIMIT 400").all() as any[];
      for (const p of people) {
        chunks.push({
          source: "people",
          title: p.name,
          content: `Contact: ${p.name}. ${p.title ? `Title: ${p.title}.` : ""} ${p.company ? `Company: ${p.company}.` : ""} ${p.notes ? `Notes: ${p.notes}` : ""}`.trim(),
        });
      }
    } catch { /* */ }

    // 1b. Tasks
    try {
      const tasks = db.prepare("SELECT title, description, status, priority, due_date, due_time FROM tasks LIMIT 200").all() as any[];
      for (const t of tasks) {
        chunks.push({
          source: "tasks",
          title: t.title,
          content: `Task: ${t.title}. Status: ${t.status}. Priority: ${t.priority}. ${t.due_date ? `Due: ${t.due_date} ${t.due_time || ''}` : ""} ${t.description ? `Desc: ${t.description}` : ""}`.trim(),
        });
      }
    } catch { /* */ }

    // 1c. Calendar Events
    try {
      const events = db.prepare("SELECT title, description, start_date, start_time, location, category FROM calendar_events LIMIT 200").all() as any[];
      for (const e of events) {
        chunks.push({
          source: "calendar",
          title: e.title,
          content: `Event: ${e.title}. Date: ${e.start_date} ${e.start_time || ''}. Category: ${e.category}. ${e.location ? `Location: ${e.location}.` : ""} ${e.description ? `Desc: ${e.description}` : ""}`.trim(),
        });
      }
    } catch { /* */ }

    // 1d. Reality Nodes
    try {
      const nodes = db.prepare("SELECT origin_provenance, artifact_id, what_classification, when_timestamp, where_context, why_insight, raw_blob FROM reality_nodes ORDER BY when_timestamp DESC LIMIT 150").all() as any[];
      for (const n of nodes) {
        let content = `Event [${n.what_classification}] on ${n.when_timestamp}. Location: ${n.where_context || 'Unknown'}. Insight: ${n.why_insight || 'None'}`;
        let title = n.what_classification;

        // Parse folder sync nodes (indexed files)
        if (n.origin_provenance && n.origin_provenance.startsWith("rudder_sync")) {
          try {
            const blob = JSON.parse(n.raw_blob || "{}");
            if (blob.filename) {
              title = blob.filename;
              const sizeStr = blob.size ? (blob.size < 1024 * 1024 ? `${Math.round(blob.size / 1024)} KB` : `${(blob.size / (1024 * 1024)).toFixed(1)} MB`) : "unknown size";
              content = `File "${blob.filename}" (${blob.extension || 'unknown ext'}, ${sizeStr}) located at "${n.artifact_id || blob.dir}". Classified as "${n.what_classification}". Modified on ${n.when_timestamp}.`;
            }
          } catch { /* fallback */ }
        }

        chunks.push({
          source: "ledger",
          title,
          content: content.trim(),
        });
      }
    } catch { /* */ }

  } catch { /* DB error */ }


  // 2. Career
  try {
    const career = loadJSON("writing/career-data.json") || {};
    for (const t of (career.timeline || [])) {
      chunks.push({
        source: "career",
        title: `${t.title} at ${t.company}`,
        content: `Career: ${t.title} at ${t.company}. Period: ${t.period || ""}. ${t.description || ""}`.trim(),
      });
    }
    for (const p of (career.productions || [])) {
      chunks.push({
        source: "career",
        title: p.title || "Production",
        content: `Production: ${p.title}. Client: ${p.client || ""}. Role: ${p.role || ""}. Year: ${p.year || ""}. ${p.description || ""}`.trim(),
      });
    }
  } catch { /* */ }

  // 3. Documents
  try {
    const docs = loadJSON("business/documents.json") || [];
    for (const d of docs) {
      chunks.push({
        source: "business",
        title: d.title,
        content: `Document: ${d.title}. Type: ${d.type}. Date: ${d.date || ""}. Format: ${d.format || ""}.`.trim(),
      });
    }
  } catch { /* */ }

  // 4. Wiki docs (markdown)
  try {
    const docsDir = join(DATA_DIR, "docs");
    if (existsSync(docsDir)) {
      for (const file of readdirSync(docsDir)) {
        if (!file.endsWith(".md")) continue;
        const content = readFileSync(join(docsDir, file), "utf-8");
        if (!content.trim()) continue;
        const title = file.replace(/_/g, " ").replace(".md", "");
        // Split into paragraph chunks (~500 chars each)
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
        for (const para of paragraphs) {
          chunks.push({
            source: "wiki",
            title,
            content: `Wiki (${title}): ${para.trim()}`,
          });
        }
      }
    }
  } catch { /* */ }

  // 5. Life story
  try {
    const story = loadJSON("writing/life_story.json") || {};
    for (const ch of (story.sections || [])) {
      chunks.push({
        source: "biographer",
        title: `Life Story: ${ch.title}`,
        content: `Life Story Chapter "${ch.title}": ${ch.content}`,
      });
    }
  } catch { /* */ }

  // 6. Identity
  try {
    const resume = loadJSON("identity/master-resume.json");
    if (resume) {
      const sections = resume.sections || resume.experience || [];
      const formatToMarkdown = (obj: any): string => {
        if (typeof obj === "string") return obj;
        if (typeof obj !== "object" || !obj) return String(obj);
        return Object.entries(obj)
          .map(([k, v]) => `* ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join('\n');
      };
      
      if (Array.isArray(sections)) {
        for (const s of sections) {
          const text = formatToMarkdown(s);
          chunks.push({ source: "identity", title: "Resume", content: `Resume:\n${text.slice(0, 500)}` });
        }
      } else {
        const text = formatToMarkdown(resume);
        chunks.push({ source: "identity", title: "Resume", content: `Resume:\n${text.slice(0, 1000)}` });
      }
    }
  } catch { /* */ }

  // 7. Hardware
  try {
    const hw = loadJSON("business/hardware-registry.json") || {};
    for (const n of (hw.cluster || [])) {
      chunks.push({
        source: "hardware",
        title: n.name,
        content: `Cluster node: ${n.name}. Hardware: ${n.hw}. IP: ${n.ip}. Role: ${n.role}. User: ${n.user}. Status: ${n.status}.`,
      });
    }
    for (const p of (hw.projects || [])) {
      chunks.push({
        source: "hardware",
        title: p.name,
        content: `Hardware project: ${p.name}. Slug: ${p.slug}. Files: ${p.files}. Status: ${p.status}.`,
      });
    }
  } catch { /* */ }

  // 8. Properties
  try {
    const props = loadJSON("business/properties.json") || {};
    for (const p of (props.properties || [])) {
      chunks.push({
        source: "properties",
        title: p.name,
        content: `Property: ${p.name}. URL: ${p.url || ""}. Tagline: ${p.tagline || ""}. Status: ${p.status || ""}.`,
      });
    }
  } catch { /* */ }

  // 9. Health summary (aggregate, not 352K rows)
  try {
    const healthDB = join(DATA_DIR, "health/health-ledger.sqlite");
    if (existsSync(healthDB)) {
      const db = new Database(healthDB, { readonly: true });
      try {
        const summary = db.prepare(`
          SELECT type, COUNT(*) as count, 
                 ROUND(AVG(CAST(value AS REAL)), 1) as avg_val,
                 MIN(date) as first, MAX(date) as last
          FROM health_metrics 
          GROUP BY type 
          ORDER BY count DESC 
          LIMIT 20
        `).all() as any[];
        for (const s of summary) {
          chunks.push({
            source: "health",
            title: `Health: ${s.type}`,
            content: `Health metric "${s.type}": ${s.count} records, average value ${s.avg_val}, range ${s.first} to ${s.last}.`,
          });
        }
      } catch { /* table might not exist */ }
      db.close();
    }
  } catch { /* */ }

  return chunks;
}
