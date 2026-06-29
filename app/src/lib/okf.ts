/* ═══════════════════════════════════════════════════════
   OKF Exporter — Open Knowledge Format (v0.1)
   https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf

   Emits Rudder's knowledge as a portable, vendor-neutral bundle:
   a directory of markdown files with YAML frontmatter, cross-linked
   with normal markdown links, plus index.md files for progressive
   disclosure. "Just files" — any agent or human can consume it, no
   SDK, no platform lock-in.

   Scope (privacy-conscious): Identity, Career, Notes, and a
   Knowledge Graph overview. People contacts and Health data are
   intentionally excluded from shareable exports.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "./db";

const OKF_VERSION = "0.1";

export interface OKFFile {
  path: string;     // relative path within the bundle, e.g. "career/index.md"
  content: string;
}

interface Concept {
  path: string;            // relative file path, must end in .md (not index.md)
  type: string;            // REQUIRED OKF frontmatter field
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  timestamp?: string;      // ISO 8601
  body?: string;           // markdown body (below frontmatter)
}

/* ── Helpers ── */

// Robert's rule: no em-dashes anywhere in generated text.
function clean(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/—/g, " - ").replace(/–/g, " - ");
}

export function slugify(input: string): string {
  return (input || "untitled")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function yamlString(v: string): string {
  // Quote if it contains characters that would break simple YAML.
  if (/[:#\[\]{}",&*?|<>=!%@`]/.test(v) || /^\s|\s$/.test(v)) {
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return v;
}

function frontmatter(c: Concept): string {
  const lines: string[] = ["---", `type: ${yamlString(clean(c.type))}`];
  if (c.title) lines.push(`title: ${yamlString(clean(c.title))}`);
  if (c.description) lines.push(`description: ${yamlString(clean(c.description))}`);
  if (c.resource) lines.push(`resource: ${yamlString(c.resource)}`);
  if (c.tags && c.tags.length) {
    lines.push(`tags: [${c.tags.map(t => yamlString(clean(t))).join(", ")}]`);
  }
  if (c.timestamp) lines.push(`timestamp: ${toIso(c.timestamp)}`);
  lines.push("---");
  return lines.join("\n");
}

function toIso(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function renderConcept(c: Concept): string {
  return `${frontmatter(c)}\n\n${clean(c.body || "").trim()}\n`;
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/**
 * Generate index.md files for the root and every directory that
 * contains concepts, listing immediate children as markdown links
 * (OKF progressive-disclosure convention).
 */
function buildIndexes(concepts: Concept[]): OKFFile[] {
  // Collect every directory in the tree (including ancestors).
  const dirs = new Set<string>([""]);
  for (const c of concepts) {
    let d = dirOf(c.path);
    while (d) {
      dirs.add(d);
      d = dirOf(d);
    }
  }

  // A concept may itself occupy a directory's index.md (a reserved
  // filename). Don't auto-generate a duplicate for those directories.
  const conceptIndexPaths = new Set(
    concepts.filter(c => c.path.endsWith("/index.md") || c.path === "index.md").map(c => c.path)
  );

  const indexes: OKFFile[] = [];
  for (const dir of dirs) {
    const prefix = dir ? dir + "/" : "";
    if (conceptIndexPaths.has(`${prefix}index.md`)) continue;

    // Immediate child concept files in this directory (excluding any
    // concept that is itself an index.md).
    const childConcepts = concepts.filter(
      c => dirOf(c.path) === dir && !c.path.endsWith("/index.md") && c.path !== "index.md"
    );
    // Immediate child subdirectories.
    const childDirs = new Set<string>();
    for (const d of dirs) {
      if (d === dir || !d) continue;
      if (dirOf(d) === dir) childDirs.add(d);
    }

    const title = dir === "" ? "Rudder Knowledge Bundle" : titleCase(dir.split("/").pop() || dir);
    const lines: string[] = [
      frontmatter({
        path: `${prefix}index.md`,
        type: dir === "" ? "Knowledge Bundle" : "Index",
        title,
        description: dir === ""
          ? "An Open Knowledge Format bundle exported from Rudder, a sovereign personal operating system."
          : `Index of ${title}.`,
        timestamp: new Date().toISOString(),
      }),
      "",
      `# ${title}`,
      "",
    ];

    if (dir === "") {
      lines.push(
        `This bundle conforms to the Open Knowledge Format (OKF) v${OKF_VERSION}.`,
        "Each concept is a single markdown file; its path is its identity.",
        "",
      );
    }

    if (childDirs.size > 0) {
      lines.push("## Sections", "");
      for (const d of [...childDirs].sort()) {
        const name = titleCase(d.split("/").pop() || d);
        lines.push(`- [${name}](/${d}/index.md)`);
      }
      lines.push("");
    }

    if (childConcepts.length > 0) {
      lines.push("## Concepts", "");
      for (const c of childConcepts.sort((a, b) => (a.title || a.path).localeCompare(b.title || b.path))) {
        const label = clean(c.title || c.path.split("/").pop() || c.path);
        const desc = c.description ? ` - ${clean(c.description)}` : "";
        lines.push(`- [${label}](/${c.path})${desc}`);
      }
      lines.push("");
    }

    indexes.push({ path: `${prefix}index.md`, content: lines.join("\n") });
  }

  return indexes;
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/* ── Concept collectors (per module) ── */

function collectIdentity(db: any, concepts: Concept[]) {
  try {
    const p = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get() as any;
    if (p && (p.full_name || p.display_name || p.bio)) {
      concepts.push({
        path: "identity/profile.md",
        type: "Identity Profile",
        title: p.full_name || p.display_name || "Profile",
        description: p.bio ? p.bio.slice(0, 140) : "Personal identity profile.",
        resource: p.website || undefined,
        timestamp: p.updated_at,
        tags: ["identity"],
        body: [
          p.bio ? `${p.bio}\n` : "",
          "## Details",
          "",
          p.display_name ? `- Display name: ${p.display_name}` : "",
          p.location ? `- Location: ${p.location}` : "",
          p.timezone ? `- Timezone: ${p.timezone}` : "",
          p.website ? `- Website: ${p.website}` : "",
        ].filter(Boolean).join("\n"),
      });
    }
  } catch { /* table absent */ }

  try {
    const values = db.prepare("SELECT * FROM identity_values ORDER BY priority ASC").all() as any[];
    for (const v of values) {
      concepts.push({
        path: `identity/values/${slugify(v.label)}.md`,
        type: "Value",
        title: v.label,
        description: v.description ? v.description.slice(0, 140) : `Core value: ${v.label}.`,
        timestamp: v.created_at,
        tags: ["identity", "value"],
        body: v.description || `A core value: ${v.label}.`,
      });
    }
  } catch { /* */ }

  try {
    const ms = db.prepare("SELECT * FROM identity_milestones ORDER BY date DESC").all() as any[];
    for (const m of ms) {
      concepts.push({
        path: `identity/milestones/${slugify(m.title)}.md`,
        type: "Milestone",
        title: m.title,
        description: m.description ? m.description.slice(0, 140) : undefined,
        timestamp: m.date || m.created_at,
        tags: ["identity", "milestone", m.category].filter(Boolean),
        body: [m.description || "", m.date ? `\nDate: ${m.date}` : ""].join("\n").trim(),
      });
    }
  } catch { /* */ }

  try {
    const links = db.prepare("SELECT * FROM identity_links").all() as any[];
    if (links.length) {
      concepts.push({
        path: "identity/links.md",
        type: "Links",
        title: "Online Presence",
        description: "Public profiles and links.",
        tags: ["identity", "links"],
        body: links.map(l => `- [${l.label || l.platform}](${l.url})`).join("\n"),
      });
    }
  } catch { /* */ }
}

function collectCareer(db: any, concepts: Concept[]) {
  try {
    const tl = db.prepare("SELECT * FROM career_timeline ORDER BY start_date DESC").all() as any[];
    for (const t of tl) {
      const highlights = safeParseArray(t.highlights_json);
      concepts.push({
        path: `career/timeline/${slugify(`${t.title}-${t.company}`)}.md`,
        type: "Career Position",
        title: `${t.title} at ${t.company}`,
        description: `${t.title}${t.division ? `, ${t.division}` : ""} at ${t.company}.`,
        timestamp: t.updated_at || t.start_date,
        tags: ["career", t.company].filter(Boolean),
        body: [
          `**${t.title}** at **${t.company}**${t.division ? ` (${t.division})` : ""}`,
          `Period: ${t.start_date} to ${t.end_date}`,
          highlights.length ? "\n## Highlights\n" : "",
          ...highlights.map(h => `- ${h}`),
        ].filter(Boolean).join("\n"),
      });
    }
  } catch { /* */ }

  try {
    const skills = db.prepare("SELECT * FROM career_skills ORDER BY category, skill_name").all() as any[];
    if (skills.length) {
      const byCat: Record<string, string[]> = {};
      for (const s of skills) (byCat[s.category] ||= []).push(s.skill_name);
      const body = Object.entries(byCat)
        .map(([cat, list]) => `## ${titleCase(cat)}\n\n${list.map(s => `- ${s}`).join("\n")}`)
        .join("\n\n");
      concepts.push({
        path: "career/skills.md",
        type: "Skill Set",
        title: "Skills",
        description: "Professional skills grouped by category.",
        tags: ["career", "skills"],
        body,
      });
    }
  } catch { /* */ }

  try {
    const awards = db.prepare("SELECT * FROM career_awards ORDER BY year DESC").all() as any[];
    for (const a of awards) {
      concepts.push({
        path: `career/awards/${slugify(`${a.title}-${a.year || ""}`)}.md`,
        type: "Award",
        title: a.title,
        description: `${a.result} - ${a.org}${a.year ? ` (${a.year})` : ""}.`,
        timestamp: a.year ? `${a.year}-01-01` : a.created_at,
        tags: ["career", "award", a.award_type].filter(Boolean),
        body: `**${a.title}**\n\nProject: ${a.project}\nOrganization: ${a.org}\nResult: ${a.result}${a.year ? `\nYear: ${a.year}` : ""}`,
      });
    }
  } catch { /* */ }

  try {
    const ips = db.prepare("SELECT * FROM career_original_ip ORDER BY title").all() as any[];
    for (const ip of ips) {
      concepts.push({
        path: `career/ip/${slugify(ip.title)}.md`,
        type: "Original IP",
        title: ip.title,
        description: `${ip.format}, status: ${ip.status}.`,
        tags: ["career", "ip", ip.format].filter(Boolean),
        body: `**${ip.title}** (${ip.format})\n\nStatus: ${ip.status}${ip.pitched_to ? `\nPitched to: ${ip.pitched_to}` : ""}`,
      });
    }
  } catch { /* */ }
}

function collectNotes(db: any, concepts: Concept[]): Map<string, string> {
  // Map note title -> slug, so [[wikilinks]] can be rewritten to OKF links.
  const titleToSlug = new Map<string, string>();
  let notes: any[] = [];
  try {
    notes = db.prepare(
      "SELECT id, title, content, tags, created_at, updated_at FROM journal_entries WHERE COALESCE(is_folder, 0) = 0 AND TRIM(content) != ''"
    ).all() as any[];
  } catch {
    try {
      notes = db.prepare("SELECT id, title, content, tags, created_at, updated_at FROM journal_entries WHERE TRIM(content) != ''").all() as any[];
    } catch { notes = []; }
  }

  const used = new Set<string>();
  for (const n of notes) {
    let slug = slugify(n.title);
    while (used.has(slug)) slug = `${slug}-${n.id}`;
    used.add(slug);
    titleToSlug.set((n.title || "").toLowerCase(), slug);
  }

  for (const n of notes) {
    const slug = titleToSlug.get((n.title || "").toLowerCase())!;
    // Rewrite Zettelkasten [[Title]] links into OKF cross-links.
    const body = clean(n.content).replace(/\[\[([^\]]+)\]\]/g, (_m, p1) => {
      const target = titleToSlug.get(String(p1).toLowerCase());
      return target ? `[${p1}](/notes/${target}.md)` : String(p1);
    });
    concepts.push({
      path: `notes/${slug}.md`,
      type: "Note",
      title: n.title || "Untitled",
      description: clean(n.content).replace(/[#*`>\-]/g, "").trim().slice(0, 140) || undefined,
      timestamp: n.updated_at || n.created_at,
      tags: ["note", ...safeParseArray(n.tags)],
      body,
    });
  }

  return titleToSlug;
}

function collectKnowledgeGraph(db: any, concepts: Concept[], noteSlugs: Map<string, string>) {
  const valueLinks: string[] = [];
  const projectLines: string[] = [];

  try {
    const values = db.prepare("SELECT label FROM identity_values ORDER BY priority ASC").all() as any[];
    for (const v of values) valueLinks.push(`- holds value [${v.label}](/identity/values/${slugify(v.label)}.md)`);
  } catch { /* */ }

  try {
    const projects = db.prepare("SELECT name FROM task_projects ORDER BY name").all() as any[];
    for (const p of projects) projectLines.push(`- drives project **${p.name}**`);
  } catch { /* */ }

  const noteCount = noteSlugs.size;

  const body = [
    "This is a markdown representation of Rudder's knowledge graph, centered on the user (Self).",
    "Person and health nodes are intentionally omitted from shareable exports.",
    "",
    "## Self",
    "",
    ...valueLinks,
    ...projectLines,
    noteCount ? `- authored ${noteCount} cross-linked [notes](/notes/index.md)` : "",
    "",
  ].filter(Boolean).join("\n");

  concepts.push({
    path: "knowledge-graph/index.md",
    type: "Knowledge Graph",
    title: "Knowledge Graph",
    description: "Relationship overview connecting identity, values, projects, and notes.",
    timestamp: new Date().toISOString(),
    tags: ["graph"],
    body,
  });
}

/* ── Public API ── */

export interface BuildOptions {
  includeIdentity?: boolean;
  includeCareer?: boolean;
  includeNotes?: boolean;
  includeGraph?: boolean;
}

const DEFAULTS: Required<BuildOptions> = {
  includeIdentity: true,
  includeCareer: true,
  includeNotes: true,
  includeGraph: true,
};

/**
 * Build a complete, conformant OKF bundle from the Rudder database.
 * Returns an array of { path, content } files ready to write to disk
 * or stream into a zip.
 *
 * `db` is injectable for testing; defaults to the app database.
 */
export function buildOKFBundle(options: BuildOptions = {}, db: any = getDB()): OKFFile[] {
  const opts = { ...DEFAULTS, ...options };
  const concepts: Concept[] = [];

  if (opts.includeIdentity) collectIdentity(db, concepts);
  if (opts.includeCareer) collectCareer(db, concepts);

  let noteSlugs = new Map<string, string>();
  if (opts.includeNotes) noteSlugs = collectNotes(db, concepts);
  if (opts.includeGraph) collectKnowledgeGraph(db, concepts, noteSlugs);

  // Render concept files + auto-generated index files.
  const files: OKFFile[] = concepts.map(c => ({ path: c.path, content: renderConcept(c) }));
  files.push(...buildIndexes(concepts));

  // Stable ordering: indexes first within a dir, then alphabetical.
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
