/* ═══════════════════════════════════════════════════════
   Identity → memory.
   The identity profile (who you are, your values, your milestones) is a
   first-class MEMORY SOURCE. We turn it into RawDocs and index it into the
   same chunk_index every connector feeds — so Ask and the Life Historian
   actually know who "you" are, and "I/me/my" questions resolve.

   Re-index on every profile save: clear the old "identity" chunks, rebuild.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { toChunks, type RawDoc } from "./ingest/enrich";
import { indexChunks, clearSource, type EmbedFn } from "./memory";

interface ProfileRow {
  display_name?: string; full_name?: string; bio?: string; email?: string;
  phone?: string; location?: string; timezone?: string; date_of_birth?: string;
  website?: string;
}
interface ValueRow { id: number; label: string; description?: string; priority?: number; }
interface MilestoneRow { id: number; title: string; description?: string; date?: string; category?: string; }
interface LinkRow { id: number; platform: string; url: string; label?: string; }

/** The user's own name, for tagging identity docs as "about them". */
export function identityName(db: Database.Database): string {
  const p = db.prepare("SELECT display_name, full_name FROM identity_profile WHERE id = 1").get() as ProfileRow | undefined;
  return (p?.display_name || p?.full_name || "").trim() || "You";
}

/** Build the identity memory documents from the profile tables. */
export function buildIdentityDocs(db: Database.Database): RawDoc[] {
  const profile = db.prepare("SELECT * FROM identity_profile WHERE id = 1").get() as ProfileRow | undefined;
  const values = db.prepare("SELECT * FROM identity_values ORDER BY priority ASC").all() as ValueRow[];
  const milestones = db.prepare("SELECT * FROM identity_milestones ORDER BY date DESC").all() as MilestoneRow[];
  const links = db.prepare("SELECT * FROM identity_links ORDER BY id ASC").all() as LinkRow[];

  const docs: RawDoc[] = [];
  const name = (profile?.display_name || profile?.full_name || "").trim() || "the user";

  // 1) The "about me" core doc.
  if (profile) {
    const lines: string[] = [`This is the profile of ${name} — the owner of this Rudder.`];
    if (profile.full_name && profile.full_name !== name) lines.push(`Full name: ${profile.full_name}`);
    if (profile.bio) lines.push(profile.bio);
    if (profile.location) lines.push(`Location: ${profile.location}`);
    if (profile.timezone) lines.push(`Timezone: ${profile.timezone}`);
    if (profile.date_of_birth) lines.push(`Date of birth: ${profile.date_of_birth}`);
    if (profile.email) lines.push(`Email: ${profile.email}`);
    if (profile.website) lines.push(`Website: ${profile.website}`);
    if (links.length) lines.push(`Online: ${links.map((l) => `${l.platform} (${l.url})`).join(", ")}`);
    if (lines.length > 1) {
      docs.push({ source: "identity", sourceId: "identity:profile", title: `About ${name}`, body: lines.join("\n"), people: [name] });
    }
  }

  // 2) Values / principles — one doc (high-signal for aligned reasoning).
  if (values.length) {
    const body = [`What ${name} values and the principles they live by:`, ...values.map((v) => `• ${v.label}${v.description ? ` — ${v.description}` : ""}`)].join("\n");
    docs.push({ source: "identity", sourceId: "identity:values", title: `${name}'s values`, body, people: [name] });
  }

  // 3) Milestones — one dated doc each (seeds the Life Historian's timeline).
  for (const m of milestones) {
    if (!m.title) continue;
    docs.push({
      source: "identity",
      sourceId: `identity:milestone:${m.id}`,
      title: m.title,
      body: `${m.title}${m.description ? ` — ${m.description}` : ""}${m.category ? ` (${m.category})` : ""}`,
      date: m.date || undefined,
      people: [name],
    });
  }

  return docs;
}

/**
 * Re-index the identity into local memory. Best-effort: needs the embed model.
 * Returns the number of chunks (re)written.
 */
export async function indexIdentity(db: Database.Database, embed: EmbedFn): Promise<{ indexed: number; docs: number }> {
  clearSource(db, "identity");
  const docs = buildIdentityDocs(db);
  const chunks = docs.flatMap(toChunks);
  const { indexed } = await indexChunks(db, chunks, embed);
  return { indexed, docs: docs.length };
}
