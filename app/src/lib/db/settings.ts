/* ═══════════════════════════════════════════════════════
   Settings repository — typed data access for preferences and
   integrations (user_preferences, data_sources, mcp_servers, plus the
   telemetry-device view over reality_nodes).

   Partial-update paths use fixed column allowlists (never request keys) and
   bind every value. The integrations DELETE validates the table name against
   a fixed set centralized here.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

type SqlParam = string | number | bigint | null;

/** Row shape of the singleton `user_preferences` table (see migrations 009 / 013 / 030 / 032). */
export interface UserPreferencesRow {
  id: number;
  theme: string;
  accent_color: string;
  font_family: string;
  font_scale: number;
  border_radius: number;
  sidebar_collapsed: number;
  enabled_modules: string; // JSON-encoded array
  dashboard_layout: string;
  onboarding_completed: number;
  tts_provider: string;
  tts_endpoint: string | null;
  tts_ref_audio: string | null;
  tts_ref_text: string | null;
  comfy_endpoint: string | null;
  avatar_portrait_path: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_pass: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  inbox_sync_enabled: number | null;
  default_execution_mode: string;
  fallback_execution_mode: string;
  updated_at: string;
}

/** Projection of execution + email settings returned by the integrations route. */
export interface ExecutionSettingsRow {
  default_execution_mode: string;
  fallback_execution_mode: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_pass: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  inbox_sync_enabled: number | null;
}

/** Row shape of the `data_sources` table (see migrations 013 / 036). */
export interface DataSourceRow {
  id: number;
  name: string;
  path: string;
  type: string;
  status: string;
  last_scanned: string | null;
  error_message: string | null;
  created_at: string;
}

/** Row shape of the `mcp_servers` table (see migration 013). */
export interface McpServerRow {
  id: number;
  name: string;
  command: string;
  args: string; // JSON-encoded array
  env: string; // JSON-encoded object
  status: string;
  created_at: string;
}

/** A unique telemetry device derived from reality_nodes. */
export interface TelemetryDeviceRow {
  device_id: string;
  last_seen: string;
}

/** Fields updatable via the general preferences PUT (route: /api/preferences). */
export interface PreferencesUpdateInput {
  theme?: unknown;
  accent_color?: unknown;
  font_family?: unknown;
  font_scale?: unknown;
  border_radius?: unknown;
  sidebar_collapsed?: unknown;
  enabled_modules?: unknown;
  dashboard_layout?: unknown;
  onboarding_completed?: unknown;
  default_execution_mode?: unknown;
  fallback_execution_mode?: unknown;
}

/** Columns the /api/preferences PUT may patch, in stable order. */
export const PREFERENCES_UPDATABLE_FIELDS = [
  "theme",
  "accent_color",
  "font_family",
  "font_scale",
  "border_radius",
  "sidebar_collapsed",
  "enabled_modules",
  "dashboard_layout",
  "onboarding_completed",
  "default_execution_mode",
  "fallback_execution_mode",
] as const satisfies readonly (keyof PreferencesUpdateInput)[];

/** Fields updatable via the integrations PUT (execution + email settings). */
export interface ExecutionSettingsUpdateInput {
  default_execution_mode?: SqlParam;
  fallback_execution_mode?: SqlParam;
  imap_host?: SqlParam;
  imap_port?: SqlParam;
  imap_user?: SqlParam;
  imap_pass?: SqlParam;
  smtp_host?: SqlParam;
  smtp_port?: SqlParam;
  smtp_user?: SqlParam;
  smtp_pass?: SqlParam;
  inbox_sync_enabled?: SqlParam;
}

/** Columns the integrations PUT may patch, in stable order. */
export const EXECUTION_SETTINGS_UPDATABLE_FIELDS = [
  "default_execution_mode",
  "fallback_execution_mode",
  "imap_host",
  "imap_port",
  "imap_user",
  "imap_pass",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "inbox_sync_enabled",
] as const satisfies readonly (keyof ExecutionSettingsUpdateInput)[];

/** Tables the integrations DELETE endpoint is allowed to target. */
export const DELETABLE_INTEGRATION_TABLES = ["data_sources", "mcp_servers"] as const;
export type DeletableIntegrationTable = (typeof DELETABLE_INTEGRATION_TABLES)[number];

/** Validate an arbitrary table name against the allowlist. */
export function isDeletableIntegrationTable(
  table: string | null | undefined,
): table is DeletableIntegrationTable {
  return (
    table != null &&
    (DELETABLE_INTEGRATION_TABLES as readonly string[]).includes(table)
  );
}

/* ── Preferences ─────────────────────────────────────── */

/** Fetch the singleton preferences row (id = 1). */
export function getPreferences(): UserPreferencesRow | undefined {
  return getDB()
    .prepare("SELECT * FROM user_preferences WHERE id = 1")
    .get() as UserPreferencesRow | undefined;
}

/**
 * Patch the singleton preferences row. Object-valued fields are JSON-encoded.
 * Column names come from the fixed allowlist. Returns true if a field was set.
 */
export function updatePreferences(patch: PreferencesUpdateInput): boolean {
  const updates: string[] = [];
  const values: SqlParam[] = [];

  for (const field of PREFERENCES_UPDATABLE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    updates.push(`${field} = ?`);
    values.push(
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : (value as SqlParam),
    );
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = datetime('now')");
  values.push(1); // WHERE id = 1
  getDB()
    .prepare(`UPDATE user_preferences SET ${updates.join(", ")} WHERE id = ?`)
    .run(...values);
  return true;
}

/* ── Integrations: data sources ──────────────────────── */

/** Data sources, newest first. */
export function listDataSources(): DataSourceRow[] {
  return getDB()
    .prepare("SELECT * FROM data_sources ORDER BY created_at DESC")
    .all() as DataSourceRow[];
}

export interface DataSourceInput {
  name: string;
  path: string;
  source_type?: string | null;
}

/** Insert a data source; returns the new row id. */
export function createDataSource(input: DataSourceInput): number | bigint {
  const info = getDB()
    .prepare(
      "INSERT INTO data_sources (name, path, type) VALUES (@name, @path, @source_type)",
    )
    .run({
      name: input.name,
      path: input.path,
      source_type: input.source_type || "folder",
    });
  return info.lastInsertRowid;
}

/* ── Integrations: MCP servers ───────────────────────── */

/** MCP servers, newest first. */
export function listMcpServers(): McpServerRow[] {
  return getDB()
    .prepare("SELECT * FROM mcp_servers ORDER BY created_at DESC")
    .all() as McpServerRow[];
}

export interface McpServerInput {
  name: string;
  command: string;
  args?: unknown;
  env?: unknown;
}

/** Insert an MCP server; args/env are JSON-encoded. Returns the new row id. */
export function createMcpServer(input: McpServerInput): number | bigint {
  const info = getDB()
    .prepare(
      "INSERT INTO mcp_servers (name, command, args, env) VALUES (@name, @command, @args, @env)",
    )
    .run({
      name: input.name,
      command: input.command,
      args: JSON.stringify(input.args || []),
      env: JSON.stringify(input.env || {}),
    });
  return info.lastInsertRowid;
}

/* ── Integrations: execution settings ────────────────── */

/** The execution + email settings projection used by the integrations GET. */
export function getExecutionSettings(): ExecutionSettingsRow | undefined {
  return getDB()
    .prepare(
      `SELECT
         default_execution_mode, fallback_execution_mode,
         imap_host, imap_port, imap_user, imap_pass,
         smtp_host, smtp_port, smtp_user, smtp_pass,
         inbox_sync_enabled
       FROM user_preferences
       WHERE id = 1`,
    )
    .get() as ExecutionSettingsRow | undefined;
}

/**
 * Patch execution + email settings on the singleton preferences row.
 * Column names come from the fixed allowlist; every value is bound.
 * Returns true if a field was updated.
 */
export function updateExecutionSettings(patch: ExecutionSettingsUpdateInput): boolean {
  const updates: string[] = [];
  const params: Record<string, SqlParam> = {};

  for (const field of EXECUTION_SETTINGS_UPDATABLE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    updates.push(`${field} = @${field}`);
    params[field] = value;
  }

  if (updates.length === 0) return false;

  getDB()
    .prepare(`UPDATE user_preferences SET ${updates.join(", ")} WHERE id = 1`)
    .run(params);
  return true;
}

/* ── Integrations: telemetry devices ─────────────────── */

/** Unique telemetry devices derived from the reality_nodes event log. */
export function listTelemetryDevices(): TelemetryDeviceRow[] {
  return getDB()
    .prepare(
      `SELECT DISTINCT origin_provenance as device_id, MAX(when_timestamp) as last_seen
       FROM reality_nodes
       WHERE what_classification = 'Device Telemetry'
       GROUP BY origin_provenance
       ORDER BY last_seen DESC`,
    )
    .all() as TelemetryDeviceRow[];
}

/* ── Integrations: deletion ──────────────────────────── */

/**
 * Delete a row from an integration table by id. The table name is validated
 * against a fixed allowlist before being interpolated into the statement.
 */
export function deleteIntegrationRow(
  table: DeletableIntegrationTable,
  id: SqlParam,
): boolean {
  return getDB().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
}
