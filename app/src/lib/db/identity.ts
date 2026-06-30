/* ═══════════════════════════════════════════════════════
   Identity repository — typed data access for the identity_* tables.

   Centralizes SQL for identity_profile (singleton), identity_values,
   identity_milestones, and identity_links. The profile patch path uses a
   fixed column allowlist (never request keys) and binds every value.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

type SqlParam = string | number | bigint | null;

/** Row shape of the singleton `identity_profile` table (see migration 001). */
export interface IdentityProfileRow {
  id: number;
  display_name: string;
  full_name: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  website: string;
  updated_at: string;
}

/** Row shape of the `identity_values` table (see migration 001). */
export interface IdentityValueRow {
  id: number;
  label: string;
  description: string;
  priority: number;
  created_at: string;
}

/** Row shape of the `identity_milestones` table (see migration 001). */
export interface IdentityMilestoneRow {
  id: number;
  title: string;
  description: string;
  date: string | null;
  category: string;
  created_at: string;
}

/** Row shape of the `identity_links` table (see migration 001). */
export interface IdentityLinkRow {
  id: number;
  platform: string;
  url: string;
  label: string;
  created_at: string;
}

/** Partial patch for the singleton profile row. */
export interface IdentityProfileUpdateInput {
  display_name?: string;
  full_name?: string;
  bio?: string;
  email?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  date_of_birth?: string | null;
  avatar_url?: string | null;
  website?: string;
}

export interface IdentityValueInput {
  label: string;
  description?: string | null;
  priority?: number | null;
}

export interface IdentityMilestoneInput {
  title: string;
  description?: string | null;
  date?: string | null;
  category?: string | null;
}

export interface IdentityLinkInput {
  platform: string;
  url: string;
  label?: string | null;
}

/** Columns a client is allowed to patch on identity_profile, in stable order. */
export const IDENTITY_PROFILE_UPDATABLE_FIELDS = [
  "display_name",
  "full_name",
  "bio",
  "email",
  "phone",
  "location",
  "timezone",
  "date_of_birth",
  "avatar_url",
  "website",
] as const satisfies readonly (keyof IdentityProfileUpdateInput)[];

/** Fetch the singleton profile row (id = 1). */
export function getProfile(): IdentityProfileRow | undefined {
  return getDB()
    .prepare("SELECT * FROM identity_profile WHERE id = 1")
    .get() as IdentityProfileRow | undefined;
}

/** Values ordered by priority ascending. */
export function listValues(): IdentityValueRow[] {
  return getDB()
    .prepare("SELECT * FROM identity_values ORDER BY priority ASC")
    .all() as IdentityValueRow[];
}

/** Milestones ordered by date descending. */
export function listMilestones(): IdentityMilestoneRow[] {
  return getDB()
    .prepare("SELECT * FROM identity_milestones ORDER BY date DESC")
    .all() as IdentityMilestoneRow[];
}

/** Links ordered by id ascending. */
export function listLinks(): IdentityLinkRow[] {
  return getDB()
    .prepare("SELECT * FROM identity_links ORDER BY id ASC")
    .all() as IdentityLinkRow[];
}

/**
 * Patch the singleton profile. Only allowlisted fields present in the patch
 * are written; column names come from the fixed allowlist, never request keys.
 * Returns true if any field was updated.
 */
export function updateProfile(patch: IdentityProfileUpdateInput): boolean {
  const sets: string[] = [];
  const params: Record<string, SqlParam> = {};

  for (const field of IDENTITY_PROFILE_UPDATABLE_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === undefined) continue;
    sets.push(`${field} = @${field}`);
    params[field] = value;
  }

  if (sets.length === 0) return false;

  sets.push("updated_at = datetime('now')");
  getDB()
    .prepare(`UPDATE identity_profile SET ${sets.join(", ")} WHERE id = 1`)
    .run(params);
  return true;
}

/** Delete all values rows (used for full replacement). */
export function clearValues(): void {
  getDB().prepare("DELETE FROM identity_values").run();
}

/** Insert one value row. */
export function insertValue(input: IdentityValueInput): void {
  getDB()
    .prepare(
      "INSERT INTO identity_values (label, description, priority) VALUES (@label, @description, @priority)",
    )
    .run({
      label: input.label,
      description: input.description || "",
      priority: input.priority || 0,
    });
}

/** Delete all milestone rows (used for full replacement). */
export function clearMilestones(): void {
  getDB().prepare("DELETE FROM identity_milestones").run();
}

/** Insert one milestone row. */
export function insertMilestone(input: IdentityMilestoneInput): void {
  getDB()
    .prepare(
      "INSERT INTO identity_milestones (title, description, date, category) VALUES (@title, @description, @date, @category)",
    )
    .run({
      title: input.title,
      description: input.description || "",
      date: input.date || null,
      category: input.category || "life",
    });
}

/** Delete all link rows (used for full replacement). */
export function clearLinks(): void {
  getDB().prepare("DELETE FROM identity_links").run();
}

/** Insert one link row. */
export function insertLink(input: IdentityLinkInput): void {
  getDB()
    .prepare(
      "INSERT INTO identity_links (platform, url, label) VALUES (@platform, @url, @label)",
    )
    .run({
      platform: input.platform,
      url: input.url,
      label: input.label || "",
    });
}
