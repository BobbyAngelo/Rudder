/* ═══════════════════════════════════════════════════════
   Database row types.

   These mirror the SQLite schema in lib/db.ts. Repository modules under
   lib/db/ return these typed shapes instead of `any`, so callers (API routes)
   get real type-checking on column names and value types.
   ═══════════════════════════════════════════════════════ */

/** A value that can be safely bound to a prepared statement placeholder. */
export type SqlParam = string | number | bigint | null;

/** Row shape of the `tasks` table (see migrations 010 / 035). */
export interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: number;
  project_id: number | null;
  parent_id: number | null;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  sort_order: number;
  is_recurring: number;
  recurrence_rule: string | null;
  labels: string; // JSON-encoded array of label ids
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of the `task_projects` table (see migration 010). */
export interface TaskProjectRow {
  id: number;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

/** Row shape of the `calendar_events` table (see migration 011). */
export interface CalendarEventRow {
  id: number;
  title: string;
  description: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: number;
  location: string;
  color: string;
  category: string;
  is_recurring: number;
  recurrence_rule: string | null;
  reminder_minutes: number | null;
  linked_people: string; // JSON-encoded array of people ids
  linked_task_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of the `health_providers` table (see migration 008). */
export interface HealthProviderRow {
  id: number;
  name: string;
  specialty: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  portal_url: string | null;
  notes: string;
  next_appointment: string | null;
  last_visit: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of the `health_documents` table (see migrations 016 / 018). */
export interface HealthDocumentRow {
  id: number;
  title: string;
  provider: string;
  category: string;
  file_path: string;
  document_date: string | null;
  notes: string;
  provider_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of the `health_metrics` table (see migrations 005 / 017). */
export interface HealthMetricsRow {
  id: number;
  date: string;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  steps: number | null;
  weight: number | null;
  mood: number | null;
  energy: number | null;
  notes: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  blood_glucose: number | null;
  temperature: number | null;
  created_at: string;
}

/** Row shape of the `people` table (see migrations 004 / 019). */
export interface PersonRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  relationship: string;
  notes: string;
  last_contact: string | null;
  warmth: number | null;
  linkedin: string | null;
  website: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}
