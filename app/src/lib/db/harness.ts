/* ═══════════════════════════════════════════════════════
   Harness repository — typed data access for the context-harness tables
   (`harness_configs` and `harness_sources`).

   Centralizes the harness SQL so API routes don't build queries inline. All
   inputs are passed as bound parameters; column lists are fixed string
   literals, never interpolated from user input.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

export interface HarnessConfigRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  system_instructions: string;
  target_ai: string;
  created_at: string;
  updated_at: string;
}

export interface HarnessSourceRow {
  id: number;
  harness_id: number;
  source_type: string;
  source_target_id: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

/** A config row enriched with its count of active sources. */
export interface HarnessConfigWithCount extends HarnessConfigRow {
  sourcesCount: number;
}

/** Source payload accepted when creating/updating a harness config. */
export interface HarnessSourceInput {
  source_type: string;
  source_target_id?: string | null;
  is_active?: number;
  sort_order?: number;
}

export interface HarnessConfigInput {
  name: string;
  slug: string;
  description?: string;
  system_instructions?: string;
  target_ai?: string;
}

/** List every harness config (id asc), each enriched with its active source count. */
export function listHarnessConfigs(): HarnessConfigWithCount[] {
  const db = getDB();
  const configs = db
    .prepare("SELECT * FROM harness_configs ORDER BY id ASC")
    .all() as HarnessConfigRow[];

  const countStmt = db.prepare(
    "SELECT COUNT(*) as count FROM harness_sources WHERE harness_id = ? AND is_active = 1",
  );

  return configs.map((c) => {
    const row = countStmt.get(c.id) as { count: number } | undefined;
    return { ...c, sourcesCount: row?.count ?? 0 };
  });
}

/** Fetch a single config by id, or undefined when none matches. */
export function getHarnessConfigById(id: string | number): HarnessConfigRow | undefined {
  return getDB()
    .prepare("SELECT * FROM harness_configs WHERE id = ?")
    .get(id) as HarnessConfigRow | undefined;
}

/** Fetch a single config by slug, or undefined when none matches. */
export function getHarnessConfigBySlug(slug: string): HarnessConfigRow | undefined {
  return getDB()
    .prepare("SELECT * FROM harness_configs WHERE slug = ?")
    .get(slug) as HarnessConfigRow | undefined;
}

/** List sources for a harness config, sort_order asc. */
export function listHarnessSources(harnessId: string | number): HarnessSourceRow[] {
  return getDB()
    .prepare("SELECT * FROM harness_sources WHERE harness_id = ? ORDER BY sort_order ASC")
    .all(harnessId) as HarnessSourceRow[];
}

/** List only the active sources for a harness config, sort_order asc. */
export function listActiveHarnessSources(harnessId: string | number): HarnessSourceRow[] {
  return getDB()
    .prepare(
      "SELECT * FROM harness_sources WHERE harness_id = ? AND is_active = 1 ORDER BY sort_order ASC",
    )
    .all(harnessId) as HarnessSourceRow[];
}

/**
 * Insert a new config plus any provided sources; returns the new config id.
 * Sources default sort_order to their array index when omitted.
 */
export function createHarnessConfig(
  input: HarnessConfigInput,
  sources: HarnessSourceInput[] = [],
): number {
  const db = getDB();

  const result = db
    .prepare(
      `INSERT INTO harness_configs (name, slug, description, system_instructions, target_ai)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.slug,
      input.description ?? "",
      input.system_instructions ?? "",
      input.target_ai ?? "claude",
    );

  const newId = result.lastInsertRowid;

  if (sources.length > 0) {
    const insertSource = db.prepare(
      `INSERT INTO harness_sources (harness_id, source_type, source_target_id, sort_order)
       VALUES (?, ?, ?, ?)`,
    );
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      insertSource.run(
        newId,
        src.source_type,
        src.source_target_id !== undefined ? src.source_target_id : null,
        src.sort_order ?? i,
      );
    }
  }

  return Number(newId);
}

/**
 * Update a config and atomically replace all its sources (delete + re-insert).
 * Sources default is_active to 1 and sort_order to their array index when omitted.
 */
export function updateHarnessConfig(
  id: string | number,
  input: HarnessConfigInput,
  sources: HarnessSourceInput[] = [],
): void {
  const db = getDB();

  const updateConfig = db.prepare(
    `UPDATE harness_configs
     SET name = ?, slug = ?, description = ?, system_instructions = ?, target_ai = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const deleteSources = db.prepare("DELETE FROM harness_sources WHERE harness_id = ?");
  const insertSource = db.prepare(
    `INSERT INTO harness_sources (harness_id, source_type, source_target_id, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const runTransaction = db.transaction(() => {
    updateConfig.run(
      input.name,
      input.slug,
      input.description ?? "",
      input.system_instructions ?? "",
      input.target_ai ?? "claude",
      id,
    );
    deleteSources.run(id);
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      insertSource.run(
        id,
        src.source_type,
        src.source_target_id !== undefined ? src.source_target_id : null,
        src.is_active !== undefined ? src.is_active : 1,
        src.sort_order !== undefined ? src.sort_order : i,
      );
    }
  });

  runTransaction();
}

/** Delete a config by id; cascades to its sources via SQLite foreign keys. */
export function deleteHarnessConfig(id: string | number): void {
  getDB().prepare("DELETE FROM harness_configs WHERE id = ?").run(id);
}
