import { getDB } from "./db";

interface HarnessConfigRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  target_ai: string;
  system_instructions: string;
}

interface HarnessSourceRow {
  id: number;
  harness_id: number;
  source_type: string;
  source_target_id: string | null;
  is_active: number;
  sort_order: number;
}

interface IdentityProfileRow {
  full_name: string;
  display_name: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  date_of_birth: string | null;
  website: string;
}

interface IdentityValueRow {
  label: string;
  description: string;
}

interface CareerTimelineRow {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  division: string | null;
  highlights_json: string | null;
}

interface CareerSkillRow {
  category: string;
  skill_name: string;
}

interface CareerAwardRow {
  title: string;
  project: string;
  org: string;
  year: number | null;
  result: string;
}

interface JournalDocRow {
  title: string;
  content: string;
}

interface JournalItemRow {
  title: string;
  content: string;
  is_folder: number;
}

interface BrandContextRow {
  brand_name: string;
  lora_trigger: string | null;
  color_palette: string | null;
  style_rules: string | null;
  forbidden_tokens: string | null;
}

interface HealthMetricRow {
  date: string;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  steps: number | null;
  mood: number | null;
  energy: number | null;
  notes: string | null;
}

export interface CompiledHarness {
  id: number;
  name: string;
  slug: string;
  description: string;
  target_ai: string;
  system_instructions: string;
  compiled_markdown: string;
  token_estimate: number;
}

/**
 * Remove em-dashes and replace them with standard hyphens per Robert's strict rules.
 */
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ") // em-dash to spaced hyphen
    .replace(/–/g, " - "); // en-dash to spaced hyphen
}

/**
 * Compiles context for a specific harness config by querying and assembling
 * active data sources from the database.
 */
export function compileHarnessContext(slug: string): CompiledHarness {
  const db = getDB();

  // 1. Fetch config
  const config = db.prepare("SELECT * FROM harness_configs WHERE slug = ?").get(slug) as HarnessConfigRow | undefined;
  if (!config) {
    throw new Error(`Harness config not found for slug: ${slug}`);
  }

  // 2. Fetch active sources
  const sources = db.prepare(
    "SELECT * FROM harness_sources WHERE harness_id = ? AND is_active = 1 ORDER BY sort_order ASC"
  ).all(config.id) as HarnessSourceRow[];

  const markdownParts: string[] = [];

  // Add System Instructions at the top
  markdownParts.push(`# SYSTEM ROLE & INSTRUCTIONS\n${cleanText(config.system_instructions)}`);

  // 3. Compile each source type
  for (const source of sources) {
    switch (source.source_type) {
      case "identity_profile": {
        const profile = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get() as IdentityProfileRow | undefined;
        if (profile) {
          markdownParts.push(
            `# TIER 1: IDENTITY & CORE PROFILE\n` +
            `- **Full Name**: ${cleanText(profile.full_name)}\n` +
            `- **Display Name**: ${cleanText(profile.display_name)}\n` +
            `- **Bio**: ${cleanText(profile.bio)}\n` +
            `- **Email**: ${cleanText(profile.email)}\n` +
            `- **Phone**: ${cleanText(profile.phone)}\n` +
            `- **Location**: ${cleanText(profile.location)} (Timezone: ${cleanText(profile.timezone)})\n` +
            `- **DOB**: ${profile.date_of_birth || "Not specified"}\n` +
            `- **Website**: ${cleanText(profile.website)}`
          );
        }
        break;
      }

      case "identity_values": {
        const values = db.prepare("SELECT * FROM identity_values ORDER BY priority ASC, id ASC").all() as IdentityValueRow[];
        if (values.length > 0) {
          const valueList = values
            .map((v) => `- **${cleanText(v.label)}**: ${cleanText(v.description)}`)
            .join("\n");
          markdownParts.push(`# TIER 1: CORE VALUES & PHILOSOPHY\n${valueList}`);
        }
        break;
      }

      case "career_timeline": {
        const jobs = db.prepare("SELECT * FROM career_timeline ORDER BY start_date DESC").all() as CareerTimelineRow[];
        if (jobs.length > 0) {
          const jobList = jobs
            .map((j) => {
              let highlights = "";
              try {
                const parsed = JSON.parse(j.highlights_json || "[]") as unknown;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  highlights = "\n" + parsed.map((h) => `  * ${cleanText(String(h))}`).join("\n");
                }
              } catch {
                /* fallback */
              }
              return (
                `- **${cleanText(j.title)}** at **${cleanText(j.company)}** (${j.start_date} to ${j.end_date})${
                  j.division ? `\n  * Division: ${cleanText(j.division)}` : ""
                }${highlights}`
              );
            })
            .join("\n\n");
          markdownParts.push(`# TIER 1: PROFESSIONAL EXPERIENCE\n${jobList}`);
        }
        break;
      }

      case "career_skills": {
        const skills = db.prepare("SELECT * FROM career_skills ORDER BY category ASC, skill_name ASC").all() as CareerSkillRow[];
        if (skills.length > 0) {
          // Group by category
          const grouped: Record<string, string[]> = {};
          for (const s of skills) {
            const cat = cleanText(s.category);
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(cleanText(s.skill_name));
          }
          const skillList = Object.entries(grouped)
            .map(([cat, list]) => `- **${cat.toUpperCase()}**: ${list.join(", ")}`)
            .join("\n");
          markdownParts.push(`# TIER 1: CORE SKILLS & EXPERTISE\n${skillList}`);
        }
        break;
      }

      case "career_awards": {
        const awards = db.prepare("SELECT * FROM career_awards ORDER BY year DESC").all() as CareerAwardRow[];
        if (awards.length > 0) {
          const awardList = awards
            .map(
              (a) =>
                `- **${cleanText(a.title)}** for *${cleanText(a.project)}* by ${cleanText(a.org)} (${a.year}) - Status: ${cleanText(a.result)}`
            )
            .join("\n");
          markdownParts.push(`# TIER 1: AWARDS & RECOGNITIONS\n${awardList}`);
        }
        break;
      }

      case "writing_folder": {
        const folderId = source.source_target_id;
        if (folderId) {
          const folder = db.prepare("SELECT title FROM journal_entries WHERE id = ? AND is_folder = 1").get(folderId) as { title: string } | undefined;
          const documents = db.prepare(
            "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
          ).all(folderId) as JournalDocRow[];

          const folderTitle = folder ? folder.title : `Folder ID ${folderId}`;
          if (documents.length > 0) {
            const docsList = documents
              .map((d) => `## Document: ${cleanText(d.title)}\n${cleanText(d.content)}`)
              .join("\n\n");
            markdownParts.push(`# TIER 2: REFERENCE DOCUMENTS (${cleanText(folderTitle)})\n${docsList}`);
          }
        }
        break;
      }

      case "doing_about_me": {
        const targetId = source.source_target_id;
        if (targetId) {
          const item = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(targetId) as JournalItemRow | undefined;
          if (item) {
            if (item.is_folder === 1) {
              const documents = db.prepare(
                "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
              ).all(targetId) as JournalDocRow[];
              if (documents.length > 0) {
                const docsList = documents
                  .map((d) => `## Profile Document: ${cleanText(d.title)}\n${cleanText(d.content)}`)
                  .join("\n\n");
                markdownParts.push(`# TIER 1: ABOUT ME (PROFILE & PREFERENCES) - ${cleanText(item.title)}\n${docsList}`);
              }
            } else {
              markdownParts.push(`# TIER 1: ABOUT ME (PROFILE & PREFERENCES) - ${cleanText(item.title)}\n${cleanText(item.content)}`);
            }
          }
        }
        break;
      }

      case "doing_frameworks": {
        const targetId = source.source_target_id;
        if (targetId) {
          const item = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(targetId) as JournalItemRow | undefined;
          if (item) {
            if (item.is_folder === 1) {
              const documents = db.prepare(
                "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
              ).all(targetId) as JournalDocRow[];
              if (documents.length > 0) {
                const docsList = documents
                  .map((d) => `## Framework SOP: ${cleanText(d.title)}\n${cleanText(d.content)}`)
                  .join("\n\n");
                markdownParts.push(`# TIER 2: SOVEREIGN FRAMEWORKS (SOPS) - ${cleanText(item.title)}\n${docsList}`);
              }
            } else {
              markdownParts.push(`# TIER 2: SOVEREIGN FRAMEWORKS (SOPS) - ${cleanText(item.title)}\n${cleanText(item.content)}`);
            }
          }
        }
        break;
      }

      case "doing_examples": {
        const targetId = source.source_target_id;
        if (targetId) {
          const item = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(targetId) as JournalItemRow | undefined;
          if (item) {
            if (item.is_folder === 1) {
              const documents = db.prepare(
                "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
              ).all(targetId) as JournalDocRow[];
              if (documents.length > 0) {
                const docsList = documents
                  .map((d) => `## Benchmarks Example: ${cleanText(d.title)}\n${cleanText(d.content)}`)
                  .join("\n\n");
                markdownParts.push(`# TIER 2: ALIGNMENT EXAMPLES (GOOD & BAD) - ${cleanText(item.title)}\n${docsList}`);
              }
            } else {
              markdownParts.push(`# TIER 2: ALIGNMENT EXAMPLES (GOOD & BAD) - ${cleanText(item.title)}\n${cleanText(item.content)}`);
            }
          }
        }
        break;
      }

      case "doing_knowledge_base": {
        const targetId = source.source_target_id;
        if (targetId) {
          const item = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(targetId) as JournalItemRow | undefined;
          if (item) {
            if (item.is_folder === 1) {
              const documents = db.prepare(
                "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
              ).all(targetId) as JournalDocRow[];
              if (documents.length > 0) {
                const docsList = documents
                  .map((d) => `## Reference Document: ${cleanText(d.title)}\n${cleanText(d.content)}`)
                  .join("\n\n");
                markdownParts.push(`# TIER 3: KNOWLEDGE BASE - ${cleanText(item.title)}\n${docsList}`);
              }
            } else {
              markdownParts.push(`# TIER 3: KNOWLEDGE BASE - ${cleanText(item.title)}\n${cleanText(item.content)}`);
            }
          }
        }
        break;
      }

      case "doing_knowledge_map": {
        const targetId = source.source_target_id;
        if (targetId) {
          const item = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(targetId) as JournalItemRow | undefined;
          if (item) {
            if (item.is_folder === 1) {
              const documents = db.prepare(
                "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
              ).all(targetId) as JournalDocRow[];
              if (documents.length > 0) {
                const docsList = documents
                  .map((d) => `## Schema/Index: ${cleanText(d.title)}\n${cleanText(d.content)}`)
                  .join("\n\n");
                markdownParts.push(`# TIER 3: KNOWLEDGE MAP & INDEX - ${cleanText(item.title)}\n${docsList}`);
              }
            } else {
              markdownParts.push(`# TIER 3: KNOWLEDGE MAP & INDEX - ${cleanText(item.title)}\n${cleanText(item.content)}`);
            }
          }
        }
        break;
      }

      case "brand_context": {
        const brandName = source.source_target_id;
        if (brandName) {
          const brand = db.prepare("SELECT * FROM brand_contexts WHERE brand_name = ?").get(brandName) as BrandContextRow | undefined;
          if (brand) {
            let styleRules = "";
            let forbiddenTokens = "";
            try {
              styleRules = (JSON.parse(brand.style_rules || "[]") as string[]).join(", ");
            } catch {
              styleRules = brand.style_rules || "";
            }
            try {
              forbiddenTokens = (JSON.parse(brand.forbidden_tokens || "[]") as string[]).join(", ");
            } catch {
              forbiddenTokens = brand.forbidden_tokens || "";
            }

            markdownParts.push(
              `# TIER 2: BRAND CONTEXT (${cleanText(brand.brand_name)})\n` +
              `- **LoRA Trigger**: ${cleanText(brand.lora_trigger)}\n` +
              `- **Color Palette**: ${cleanText(brand.color_palette)}\n` +
              `- **Style Guidelines**: ${cleanText(styleRules)}\n` +
              `- **Forbidden Elements**: ${cleanText(forbiddenTokens)}`
            );
          }
        }
        break;
      }

      case "health_vitals": {
        const metrics = db.prepare("SELECT * FROM health_metrics ORDER BY date DESC LIMIT 7").all() as HealthMetricRow[];
        if (metrics.length > 0) {
          const list = metrics
            .map((m) => {
              const vitals = [
                m.sleep_hours !== null ? `Sleep: ${m.sleep_hours.toFixed(1)}h` : null,
                m.resting_hr !== null ? `Resting HR: ${m.resting_hr} bpm` : null,
                m.hrv !== null ? `HRV: ${m.hrv} ms` : null,
                m.steps !== null ? `Steps: ${m.steps}` : null,
                m.mood !== null ? `Mood: ${m.mood}/10` : null,
                m.energy !== null ? `Energy: ${m.energy}/10` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return `- **${m.date}**: ${vitals}. ${m.notes ? `Notes: ${cleanText(m.notes)}` : ""}`;
            })
            .join("\n");
          markdownParts.push(`# TIER 2: RECENT BIOMETRIC STATE (7-DAY TREND)\n${list}`);
        }
        break;
      }
    }
  }

  const compiled_markdown = markdownParts.join("\n\n---\n\n");

  // Token count estimator: words * 1.35 is generally extremely close to cl100k_base tokens.
  const wordCount = compiled_markdown.split(/\s+/).filter((w) => w.length > 0).length;
  const token_estimate = Math.ceil(wordCount * 1.35);

  return {
    id: config.id,
    name: config.name,
    slug: config.slug,
    description: config.description,
    target_ai: config.target_ai,
    system_instructions: config.system_instructions,
    compiled_markdown,
    token_estimate,
  };
}
