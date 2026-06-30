import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { getDB } from "@/lib/db";
import {
  getHarnessConfigBySlug,
  listActiveHarnessSources,
} from "@/lib/db/harness";
import AdmZip from "adm-zip";

/* ── Row shapes for the per-source export tables (local to this route). ── */

interface IdentityProfileRow {
  full_name: string | null;
  display_name: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  date_of_birth: string | null;
  website: string | null;
}

interface IdentityValueRow {
  label: string | null;
  description: string | null;
}

interface CareerTimelineRow {
  title: string | null;
  company: string | null;
  start_date: string | null;
  end_date: string | null;
  division: string | null;
  highlights_json: string | null;
}

interface CareerSkillRow {
  category: string | null;
  skill_name: string | null;
}

interface CareerAwardRow {
  title: string | null;
  project: string | null;
  org: string | null;
  year: string | number | null;
  result: string | null;
}

interface JournalFolderRow {
  title: string;
}

interface JournalDocumentRow {
  title: string;
  content: string | null;
}

interface BrandContextRow {
  brand_name: string | null;
  lora_trigger: string | null;
  color_palette: string | null;
  style_rules: string | null;
  forbidden_tokens: string | null;
}

interface HealthMetricRow {
  date: string | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  steps: number | null;
  mood: number | null;
  energy: number | null;
  notes: string | null;
}

/**
 * Remove em-dashes and replace them with standard hyphens per Robert's strict rules.
 */
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/—/g, " - ")
    .replace(/–/g, " - ");
}

/**
 * GET /api/harness/export
 * Parameters: ?slug=linkedin-ghostwriter
 * Outputs a ZIP stream containing files corresponding to the Information Hierarchy.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug is required" }, { status: 400 });
    }

    const db = getDB();

    // 1. Fetch config
    const config = getHarnessConfigBySlug(slug);
    if (!config) {
      return NextResponse.json({ success: false, error: "Harness not found" }, { status: 404 });
    }

    // 2. Fetch active sources
    const sources = listActiveHarnessSources(config.id);

    const zip = new AdmZip();

    // Add Base Role/System instructions
    zip.addFile(
      "0_system_role_instructions.md",
      Buffer.from(`# SYSTEM ROLE & INSTRUCTIONS\n\n${cleanText(config.system_instructions)}`, "utf-8")
    );

    // 3. Process each source to its own file in the ZIP
    for (const source of sources) {
      switch (source.source_type) {
        case "identity_profile": {
          const profile = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get() as
            | IdentityProfileRow
            | undefined;
          if (profile) {
            const md =
              `# TIER 1: IDENTITY & CORE PROFILE\n\n` +
              `- **Full Name**: ${cleanText(profile.full_name)}\n` +
              `- **Display Name**: ${cleanText(profile.display_name)}\n` +
              `- **Bio**: ${cleanText(profile.bio)}\n` +
              `- **Email**: ${cleanText(profile.email)}\n` +
              `- **Phone**: ${cleanText(profile.phone)}\n` +
              `- **Location**: ${cleanText(profile.location)} (Timezone: ${cleanText(profile.timezone)})\n` +
              `- **DOB**: ${profile.date_of_birth || "Not specified"}\n` +
              `- **Website**: ${cleanText(profile.website)}\n`;
            zip.addFile("tier1_core_profile.md", Buffer.from(md, "utf-8"));
          }
          break;
        }

        case "identity_values": {
          const values = db
            .prepare("SELECT * FROM identity_values ORDER BY priority ASC, id ASC")
            .all() as IdentityValueRow[];
          if (values.length > 0) {
            const md =
              `# TIER 1: CORE VALUES & PHILOSOPHY\n\n` +
              values.map((v) => `- **${cleanText(v.label)}**: ${cleanText(v.description)}`).join("\n") + "\n";
            zip.addFile("tier1_core_values.md", Buffer.from(md, "utf-8"));
          }
          break;
        }

        case "career_timeline": {
          const jobs = db
            .prepare("SELECT * FROM career_timeline ORDER BY start_date DESC")
            .all() as CareerTimelineRow[];
          if (jobs.length > 0) {
            const md =
              `# TIER 1: PROFESSIONAL EXPERIENCE\n\n` +
              jobs.map((j) => {
                let highlights = "";
                try {
                  const parsed = JSON.parse(j.highlights_json || "[]");
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    highlights = "\n" + parsed.map((h) => `  * ${cleanText(h)}`).join("\n");
                  }
                } catch { /* */ }
                return `- **${cleanText(j.title)}** at **${cleanText(j.company)}** (${j.start_date} to ${j.end_date})${j.division ? `\n  * Division: ${cleanText(j.division)}` : ""}${highlights}`;
              }).join("\n\n") + "\n";
            zip.addFile("tier1_professional_experience.md", Buffer.from(md, "utf-8"));
          }
          break;
        }

        case "career_skills": {
          const skills = db
            .prepare("SELECT * FROM career_skills ORDER BY category ASC, skill_name ASC")
            .all() as CareerSkillRow[];
          if (skills.length > 0) {
            const grouped: Record<string, string[]> = {};
            for (const s of skills) {
              const cat = cleanText(s.category);
              if (!grouped[cat]) grouped[cat] = [];
              grouped[cat].push(cleanText(s.skill_name));
            }
            const md =
              `# TIER 1: CORE SKILLS & EXPERTISE\n\n` +
              Object.entries(grouped)
                .map(([cat, list]) => `- **${cat.toUpperCase()}**: ${list.join(", ")}`)
                .join("\n") + "\n";
            zip.addFile("tier1_core_skills.md", Buffer.from(md, "utf-8"));
          }
          break;
        }

        case "career_awards": {
          const awards = db
            .prepare("SELECT * FROM career_awards ORDER BY year DESC")
            .all() as CareerAwardRow[];
          if (awards.length > 0) {
            const md =
              `# TIER 1: AWARDS & RECOGNITIONS\n\n` +
              awards.map((a) => `- **${cleanText(a.title)}** for *${cleanText(a.project)}* by ${cleanText(a.org)} (${a.year}) - Status: ${cleanText(a.result)}`).join("\n") + "\n";
            zip.addFile("tier1_awards_recognitions.md", Buffer.from(md, "utf-8"));
          }
          break;
        }

        case "writing_folder": {
          const folderId = source.source_target_id;
          if (folderId) {
            const folder = db
              .prepare("SELECT title FROM journal_entries WHERE id = ? AND is_folder = 1")
              .get(folderId) as JournalFolderRow | undefined;
            const documents = db.prepare(
              "SELECT title, content FROM journal_entries WHERE parent_id = ? AND is_folder = 0 ORDER BY updated_at DESC"
            ).all(folderId) as JournalDocumentRow[];

            const folderTitle = folder ? folder.title : `Folder_${folderId}`;
            const cleanFolderTitle = folderTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");

            if (documents.length > 0) {
              for (const doc of documents) {
                const cleanDocTitle = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "untitled";
                const filePath = `reference_documents_${cleanFolderTitle}/${cleanDocTitle}.md`;
                const fileContent = `# ${cleanText(doc.title)}\n\n${cleanText(doc.content)}`;
                zip.addFile(filePath, Buffer.from(fileContent, "utf-8"));
              }
            }
          }
          break;
        }

        case "brand_context": {
          const brandName = source.source_target_id;
          if (brandName) {
            const brand = db
              .prepare("SELECT * FROM brand_contexts WHERE brand_name = ?")
              .get(brandName) as BrandContextRow | undefined;
            if (brand) {
              let styleRules = "";
              let forbiddenTokens = "";
              try {
                styleRules = JSON.parse(brand.style_rules || "[]").join(", ");
              } catch {
                styleRules = brand.style_rules ?? "";
              }
              try {
                forbiddenTokens = JSON.parse(brand.forbidden_tokens || "[]").join(", ");
              } catch {
                forbiddenTokens = brand.forbidden_tokens ?? "";
              }

              const md =
                `# TIER 2: BRAND CONTEXT (${cleanText(brand.brand_name)})\n\n` +
                `- **LoRA Trigger**: ${cleanText(brand.lora_trigger)}\n` +
                `- **Color Palette**: ${cleanText(brand.color_palette)}\n` +
                `- **Style Guidelines**: ${cleanText(styleRules)}\n` +
                `- **Forbidden Elements**: ${cleanText(forbiddenTokens)}\n`;
              zip.addFile(`tier2_brand_context_${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`, Buffer.from(md, "utf-8"));
            }
          }
          break;
        }

        case "health_vitals": {
          const metrics = db
            .prepare("SELECT * FROM health_metrics ORDER BY date DESC LIMIT 7")
            .all() as HealthMetricRow[];
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
                ].filter(Boolean).join(", ");
                return `- **${m.date}**: ${vitals}. ${m.notes ? `Notes: ${cleanText(m.notes)}` : ""}`;
              }).join("\n");
            const md = `# TIER 2: RECENT BIOMETRIC STATE (7-DAY TREND)\n\n${list}\n`;
            zip.addFile("tier2_recent_biometrics.md", Buffer.from(md, "utf-8"));
          }
          break;
        }
      }
    }

    const zipBuffer = zip.toBuffer();

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=harness_${slug}.zip`,
      },
    });
  } catch (err) {
    log.error("[api/harness/export] GET error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
