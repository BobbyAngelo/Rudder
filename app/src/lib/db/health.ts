/* ═══════════════════════════════════════════════════════
   Health repository — typed data access for the health tables
   (health_records, health_metrics, health_providers, health_documents).

   Encapsulates the dashboard/chart analytics plus provider/document/metrics
   CRUD that previously lived inline in the route with pervasive `any`.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";
import { log } from "../logger";
import type {
  HealthProviderRow,
  HealthDocumentRow,
  HealthMetricsRow,
} from "./types";

/* ── Aggregate result shapes ── */
export interface DateRange {
  first: string | null;
  last: string | null;
}
export interface LatestStats {
  steps?: number;
  distance?: string;
  activeEnergy?: number;
  flights?: number;
  heartRate?: number | null;
  date?: string;
}
export interface StepDay {
  date: string;
  steps: number;
}
export interface SleepDay {
  date: string;
  hours: number;
}
export interface TypeCount {
  type: string;
  count: number;
}
export interface TypeSummary extends TypeCount {
  first_date: string;
  last_date: string;
}
export interface SourceSummary {
  source: string;
  count: number;
  first_sync: string;
  last_sync: string;
}
export interface ChartPoint {
  date: string;
  sum_value: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  readings: number;
}

/* ── Providers ── */
export interface HealthProviderInput {
  id?: number;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  portal_url?: string | null;
  notes?: string | null;
  next_appointment?: string | null;
  last_visit?: string | null;
}

export function listProviders(): HealthProviderRow[] {
  return getDB()
    .prepare("SELECT * FROM health_providers ORDER BY specialty, name")
    .all() as HealthProviderRow[];
}

/** Insert or update a provider. Returns the row id (new id on insert). */
export function upsertProvider(input: HealthProviderInput): number {
  const db = getDB();
  const params = {
    name: input.name,
    specialty: input.specialty ?? "",
    phone: input.phone ?? null,
    address: input.address ?? null,
    website: input.website ?? null,
    portal_url: input.portal_url ?? null,
    notes: input.notes ?? "",
    next_appointment: input.next_appointment ?? null,
    last_visit: input.last_visit ?? null,
  };

  if (input.id) {
    db.prepare(
      `UPDATE health_providers SET
         name = @name, specialty = @specialty, phone = @phone,
         address = @address, website = @website, portal_url = @portal_url,
         notes = @notes, next_appointment = @next_appointment,
         last_visit = @last_visit, updated_at = datetime('now')
       WHERE id = @id`,
    ).run({ ...params, id: input.id });
    return input.id;
  }

  const result = db
    .prepare(
      `INSERT INTO health_providers (name, specialty, phone, address, website, portal_url, notes, next_appointment, last_visit)
       VALUES (@name, @specialty, @phone, @address, @website, @portal_url, @notes, @next_appointment, @last_visit)`,
    )
    .run(params);
  return Number(result.lastInsertRowid);
}

export function deleteProvider(id: number): boolean {
  return getDB().prepare("DELETE FROM health_providers WHERE id = ?").run(id).changes > 0;
}

/* ── Documents ── */
export interface HealthDocumentInput {
  id?: number;
  title: string;
  provider?: string | null;
  category?: string | null;
  file_path?: string | null;
  document_date?: string | null;
  notes?: string | null;
  provider_id?: number | string | null;
}

export function upsertDocument(input: HealthDocumentInput): number | undefined {
  const db = getDB();
  const params = {
    title: input.title,
    provider: input.provider ?? "",
    category: input.category ?? "patient_record",
    file_path: input.file_path ?? "",
    document_date: input.document_date ?? null,
    notes: input.notes ?? "",
    provider_id: input.provider_id ? parseInt(String(input.provider_id), 10) : null,
  };

  if (input.id) {
    db.prepare(
      `UPDATE health_documents SET
         title = @title, provider = @provider, category = @category,
         file_path = @file_path, document_date = @document_date,
         notes = @notes, provider_id = @provider_id, updated_at = datetime('now')
       WHERE id = @id`,
    ).run({ ...params, id: input.id });
    return input.id;
  }

  const result = db
    .prepare(
      `INSERT INTO health_documents (title, provider, category, file_path, document_date, notes, provider_id)
       VALUES (@title, @provider, @category, @file_path, @document_date, @notes, @provider_id)`,
    )
    .run(params);
  return Number(result.lastInsertRowid);
}

export function deleteDocument(id: number): boolean {
  return getDB().prepare("DELETE FROM health_documents WHERE id = ?").run(id).changes > 0;
}

/* ── Manual daily metrics (vitals) ── */
export interface HealthMetricsInput {
  date?: string;
  sleep_hours?: string | number | null;
  resting_hr?: string | number | null;
  hrv?: string | number | null;
  steps?: string | number | null;
  weight?: string | number | null;
  mood?: string | number | null;
  energy?: string | number | null;
  notes?: string | null;
  blood_pressure_systolic?: string | number | null;
  blood_pressure_diastolic?: string | number | null;
  blood_glucose?: string | number | null;
  temperature?: string | number | null;
}

function num(value: string | number | null | undefined, kind: "int" | "float"): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = kind === "int" ? parseInt(String(value), 10) : parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

/** Upsert the daily vitals row for a date (one row per day). */
export function upsertMetrics(input: HealthMetricsInput): void {
  const db = getDB();
  const date = input.date || new Date().toISOString().split("T")[0];
  const params = {
    date,
    sleep_hours: num(input.sleep_hours, "float"),
    resting_hr: num(input.resting_hr, "int"),
    hrv: num(input.hrv, "int"),
    steps: num(input.steps, "int"),
    weight: num(input.weight, "float"),
    mood: num(input.mood, "int"),
    energy: num(input.energy, "int"),
    notes: input.notes || "",
    blood_pressure_systolic: num(input.blood_pressure_systolic, "int"),
    blood_pressure_diastolic: num(input.blood_pressure_diastolic, "int"),
    blood_glucose: num(input.blood_glucose, "float"),
    temperature: num(input.temperature, "float"),
  };

  const existing = db.prepare("SELECT id FROM health_metrics WHERE date = ?").get(date);
  if (existing) {
    db.prepare(
      `UPDATE health_metrics SET
         sleep_hours = @sleep_hours, resting_hr = @resting_hr, hrv = @hrv,
         steps = @steps, weight = @weight, mood = @mood, energy = @energy, notes = @notes,
         blood_pressure_systolic = @blood_pressure_systolic,
         blood_pressure_diastolic = @blood_pressure_diastolic,
         blood_glucose = @blood_glucose, temperature = @temperature,
         created_at = datetime('now')
       WHERE date = @date`,
    ).run(params);
  } else {
    db.prepare(
      `INSERT INTO health_metrics (
         date, sleep_hours, resting_hr, hrv, steps, weight, mood, energy, notes,
         blood_pressure_systolic, blood_pressure_diastolic, blood_glucose, temperature
       ) VALUES (
         @date, @sleep_hours, @resting_hr, @hrv, @steps, @weight, @mood, @energy, @notes,
         @blood_pressure_systolic, @blood_pressure_diastolic, @blood_glucose, @temperature
       )`,
    ).run(params);
  }
}

/* ── Records analytics ── */
export function recordTypes(): TypeSummary[] {
  return getDB()
    .prepare(
      `SELECT type, COUNT(*) as count, MIN(date) as first_date, MAX(date) as last_date
       FROM health_records GROUP BY type ORDER BY count DESC`,
    )
    .all() as TypeSummary[];
}

export interface HealthDashboard {
  totalRecords: number;
  dateRange: DateRange;
  latestStats: LatestStats;
  weekSteps: StepDay[];
  monthSteps: StepDay[];
  recentSleep: SleepDay[];
  typeBreakdown: TypeCount[];
  providers: HealthProviderRow[];
  documents: HealthDocumentRow[];
  sources: SourceSummary[];
  dataSources: Record<string, unknown>[];
  latestMetrics: HealthMetricsRow | null;
}

export function dashboard(): HealthDashboard {
  const db = getDB();

  const totalRecords = (
    db.prepare("SELECT COUNT(*) as cnt FROM health_records").get() as { cnt: number }
  ).cnt;

  const dateRange = db
    .prepare("SELECT MIN(date) as first, MAX(date) as last FROM health_records")
    .get() as DateRange;

  const latestDate = (
    db.prepare("SELECT date FROM health_records ORDER BY date DESC LIMIT 1").get() as
      | { date: string }
      | undefined
  )?.date;

  const sumFor = (type: string, date: string): number => {
    const row = db
      .prepare("SELECT SUM(value) as total FROM health_records WHERE type = ? AND date = ?")
      .get(type, date) as { total: number | null };
    return row?.total ?? 0;
  };

  const latestStats: LatestStats = {};
  if (latestDate) {
    latestStats.steps = Math.round(sumFor("StepCount", latestDate));
    latestStats.distance = (sumFor("Distance", latestDate) * 0.000621371).toFixed(1);
    latestStats.activeEnergy = Math.round(sumFor("ActiveEnergy", latestDate));
    latestStats.flights = Math.round(sumFor("FlightsClimbed", latestDate));
    const hr = db
      .prepare("SELECT value FROM health_records WHERE type = 'HeartRate' ORDER BY start_date DESC LIMIT 1")
      .get() as { value: number | null } | undefined;
    latestStats.heartRate = hr?.value ? Math.round(hr.value) : null;
    latestStats.date = latestDate;
  }

  const weekSteps = db
    .prepare(
      `SELECT date, SUM(value) as steps FROM health_records
       WHERE type = 'StepCount' GROUP BY date ORDER BY date DESC LIMIT 7`,
    )
    .all() as StepDay[];

  const monthSteps = db
    .prepare(
      `SELECT date, steps FROM (
         SELECT date, SUM(value) as steps FROM health_records
         WHERE type = 'StepCount' GROUP BY date ORDER BY date DESC LIMIT 30
       ) ORDER BY date ASC`,
    )
    .all() as StepDay[];

  const recentSleep = db
    .prepare(
      `SELECT date, SUM((julianday(end_date) - julianday(start_date)) * 24) as hours
       FROM health_records WHERE type = 'SleepAnalysis'
       GROUP BY date ORDER BY date DESC LIMIT 14`,
    )
    .all() as SleepDay[];

  const typeBreakdown = db
    .prepare("SELECT type, COUNT(*) as count FROM health_records GROUP BY type ORDER BY count DESC")
    .all() as TypeCount[];

  const providers = listProviders();

  let documents: HealthDocumentRow[] = [];
  try {
    documents = db
      .prepare("SELECT * FROM health_documents ORDER BY document_date DESC, provider")
      .all() as HealthDocumentRow[];
  } catch (e) {
    log.debug("[health] documents table unavailable:", e instanceof Error ? e.message : e);
  }

  const sources = db
    .prepare(
      `SELECT source, COUNT(*) as count, MIN(date) as first_sync, MAX(date) as last_sync
       FROM health_records GROUP BY source ORDER BY count DESC`,
    )
    .all() as SourceSummary[];

  let dataSources: Record<string, unknown>[] = [];
  try {
    dataSources = db.prepare("SELECT * FROM data_sources").all() as Record<string, unknown>[];
  } catch (e) {
    log.debug("[health] data_sources table unavailable:", e instanceof Error ? e.message : e);
  }

  let latestMetrics: HealthMetricsRow | null = null;
  try {
    latestMetrics =
      (db.prepare("SELECT * FROM health_metrics ORDER BY date DESC LIMIT 1").get() as
        | HealthMetricsRow
        | undefined) ?? null;
  } catch (e) {
    log.debug("[health] health_metrics table unavailable:", e instanceof Error ? e.message : e);
  }

  return {
    totalRecords,
    dateRange,
    latestStats,
    weekSteps,
    monthSteps,
    recentSleep,
    typeBreakdown,
    providers,
    documents,
    sources,
    dataSources,
    latestMetrics,
  };
}

export function chart(type: string, days: number): { type: string; days: number; data: ChartPoint[] } {
  const db = getDB();
  const maxDate = (
    db.prepare("SELECT MAX(date) as max_date FROM health_records WHERE type = ?").get(type) as
      | { max_date: string | null }
      | undefined
  )?.max_date;

  let data: ChartPoint[] = [];
  if (maxDate) {
    data = db
      .prepare(
        `SELECT date, SUM(value) as sum_value, AVG(value) as avg_value,
                MIN(value) as min_value, MAX(value) as max_value, COUNT(*) as readings
         FROM health_records
         WHERE type = ? AND date >= date(?, '-' || ? || ' days')
         GROUP BY date ORDER BY date`,
      )
      .all(type, maxDate, days) as ChartPoint[];
  }

  return { type, days, data };
}
