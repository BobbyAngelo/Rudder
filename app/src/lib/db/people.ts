/* ═══════════════════════════════════════════════════════
   People repository — typed data access for the `people` table.

   Centralizes the SQL so API routes don't build queries inline. All inputs
   are passed as bound parameters; column lists are fixed string literals,
   never interpolated from user input.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";
import type { PersonRow, SqlParam } from "./types";

export interface PersonListFilter {
  search?: string;
  relationship?: string;
  limit?: number;
  offset?: number;
}

export interface PersonInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  relationship?: string | null;
  notes?: string | null;
  warmth?: number | null;
  linkedin?: string | null;
  website?: string | null;
  address?: string | null;
}

export interface RelationshipCount {
  relationship: string;
  count: number;
}

/** Build the shared WHERE clause for list + count from a filter. */
function buildFilter(filter: PersonListFilter): { clause: string; params: SqlParam[] } {
  let clause = "WHERE 1=1";
  const params: SqlParam[] = [];

  if (filter.search) {
    clause += " AND (name LIKE ? OR email LIKE ? OR company LIKE ?)";
    const pattern = `%${filter.search}%`;
    params.push(pattern, pattern, pattern);
  }
  if (filter.relationship) {
    clause += " AND relationship = ?";
    params.push(filter.relationship);
  }
  return { clause, params };
}

/** List contacts (warmth desc, name asc) with the total matching count. */
export function listPeople(filter: PersonListFilter = {}): {
  people: PersonRow[];
  total: number;
} {
  const db = getDB();
  const { clause, params } = buildFilter(filter);

  const { total } = db
    .prepare(`SELECT COUNT(*) as total FROM people ${clause}`)
    .get(...params) as { total: number };

  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const people = db
    .prepare(`SELECT * FROM people ${clause} ORDER BY warmth DESC, name ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as PersonRow[];

  return { people, total };
}

/** Count of contacts grouped by relationship, most common first. */
export function relationshipBreakdown(): RelationshipCount[] {
  return getDB()
    .prepare(
      "SELECT relationship, COUNT(*) as count FROM people GROUP BY relationship ORDER BY count DESC",
    )
    .all() as RelationshipCount[];
}

/** Insert a new contact; returns the new row id. */
export function createPerson(input: PersonInput): number {
  const result = getDB()
    .prepare(
      `INSERT INTO people (name, email, phone, company, role, relationship, notes, warmth, linkedin, website, address)
       VALUES (@name, @email, @phone, @company, @role, @relationship, @notes, @warmth, @linkedin, @website, @address)`,
    )
    .run({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      role: input.role ?? null,
      relationship: input.relationship || "contact",
      notes: input.notes ?? "",
      // NOTE: create defaults warmth to 10 to match the previous route behavior.
      warmth: input.warmth ?? 10,
      linkedin: input.linkedin ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
    });
  return Number(result.lastInsertRowid);
}

/** Update an existing contact by id. Returns true if a row was changed. */
export function updatePerson(id: number, input: PersonInput): boolean {
  const result = getDB()
    .prepare(
      `UPDATE people SET
         name = @name, email = @email, phone = @phone, company = @company,
         role = @role, relationship = @relationship, notes = @notes, warmth = @warmth,
         linkedin = @linkedin, website = @website, address = @address,
         updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      role: input.role ?? null,
      relationship: input.relationship || "contact",
      notes: input.notes ?? "",
      // NOTE: update defaults warmth to 0 to match the previous route behavior.
      warmth: input.warmth ?? 0,
      linkedin: input.linkedin ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
    });
  return result.changes > 0;
}

/** Delete a contact by id. Returns true if a row was removed. */
export function deletePerson(id: number): boolean {
  const result = getDB().prepare("DELETE FROM people WHERE id = ?").run(id);
  return result.changes > 0;
}
