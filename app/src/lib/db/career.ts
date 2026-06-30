/* ═══════════════════════════════════════════════════════
   Career repository — typed data access for the career_* tables.

   Centralizes the SQL for the career hub feature (timeline, skills, awards,
   original IP, job applications) so API routes don't build queries inline.
   All inputs are passed as bound parameters; column lists are fixed string
   literals, never interpolated from user input.
   ═══════════════════════════════════════════════════════ */

import { getDB } from "../db";

type SqlParam = string | number | bigint | null;

/* ── Row interfaces (mirror the 023_career_hub migration schema) ── */

export interface CareerTimelineRow {
  id: number;
  company: string;
  title: string;
  division: string | null;
  start_date: string;
  end_date: string;
  highlights_json: string;
  updated_at: string;
  created_at: string;
}

export interface CareerSkillRow {
  id: number;
  category: string;
  skill_name: string;
  created_at: string;
}

export interface CareerAwardRow {
  id: number;
  award_type: string;
  title: string;
  project: string;
  org: string;
  year: number | null;
  result: string;
  created_at: string;
}

export interface CareerOriginalIpRow {
  id: number;
  title: string;
  format: string;
  pitched_to: string | null;
  status: string;
  created_at: string;
}

export interface CareerJobApplicationRow {
  id: number;
  company: string;
  role: string;
  year: string;
  docs_json: string;
  created_at: string;
}

/* ── Seed input shapes (parsed from the legacy career-data.json) ── */

export interface TimelineSeedInput {
  company: string;
  title: string;
  division?: string | null;
  start: string;
  end: string;
  highlights?: unknown[];
}

export interface SkillSeedInput {
  category: string;
  skill_name: string;
}

export interface AwardSeedInput {
  award_type: string;
  title: string;
  project: string;
  org: string;
  year: number | null;
  result: string;
}

export interface OriginalIpSeedInput {
  title: string;
  format: string;
  pitched_to?: string | null;
  status: string;
}

export interface JobApplicationSeedInput {
  company: string;
  role: string;
  year: string;
  docs?: unknown[];
}

/* ── Timeline write inputs ── */

export interface TimelineCreateInput {
  company: string;
  title: string;
  division?: string | null;
  startDate: string;
  endDate: string;
  highlights?: unknown[];
}

export interface TimelineUpdateInput {
  company: string;
  title: string;
  division?: string | null;
  startDate: string;
  endDate: string;
  highlights?: unknown[];
}

/* ── Reads ── */

/** Count of timeline entries; used to decide whether seeding is needed. */
export function countTimeline(): number {
  const { count } = getDB()
    .prepare("SELECT COUNT(*) as count FROM career_timeline")
    .get() as { count: number };
  return count;
}

/** All timeline entries, most recent start_date first. */
export function listTimeline(): CareerTimelineRow[] {
  return getDB()
    .prepare("SELECT * FROM career_timeline ORDER BY start_date DESC")
    .all() as CareerTimelineRow[];
}

export function listSkills(): CareerSkillRow[] {
  return getDB().prepare("SELECT * FROM career_skills").all() as CareerSkillRow[];
}

export function listAwards(): CareerAwardRow[] {
  return getDB().prepare("SELECT * FROM career_awards").all() as CareerAwardRow[];
}

export function listOriginalIp(): CareerOriginalIpRow[] {
  return getDB()
    .prepare("SELECT * FROM career_original_ip")
    .all() as CareerOriginalIpRow[];
}

export function listJobApplications(): CareerJobApplicationRow[] {
  return getDB()
    .prepare("SELECT * FROM career_job_applications")
    .all() as CareerJobApplicationRow[];
}

/* ── Seeding ── */

/** Insert a timeline entry from legacy seed data. */
export function seedTimeline(item: TimelineSeedInput): void {
  getDB()
    .prepare(
      `INSERT INTO career_timeline (company, title, division, start_date, end_date, highlights_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.company,
      item.title,
      item.division ?? null,
      item.start,
      item.end,
      JSON.stringify(item.highlights ?? []),
    );
}

/** Insert a skill from legacy seed data, ignoring duplicates. */
export function seedSkill(input: SkillSeedInput): void {
  getDB()
    .prepare(
      `INSERT OR IGNORE INTO career_skills (category, skill_name) VALUES (?, ?)`,
    )
    .run(input.category, input.skill_name);
}

/** Insert an award from legacy seed data. */
export function seedAward(input: AwardSeedInput): void {
  getDB()
    .prepare(
      `INSERT INTO career_awards (award_type, title, project, org, year, result)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.award_type,
      input.title,
      input.project,
      input.org,
      input.year,
      input.result,
    );
}

/** Insert an original-IP entry from legacy seed data, ignoring duplicates. */
export function seedOriginalIp(input: OriginalIpSeedInput): void {
  getDB()
    .prepare(
      `INSERT OR IGNORE INTO career_original_ip (title, format, pitched_to, status)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.title, input.format, input.pitched_to ?? null, input.status);
}

/** Insert a job application from legacy seed data. */
export function seedJobApplication(input: JobApplicationSeedInput): void {
  getDB()
    .prepare(
      `INSERT INTO career_job_applications (company, role, year, docs_json)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.company, input.role, input.year, JSON.stringify(input.docs ?? []));
}

/* ── Timeline milestone CRUD ── */

/** Insert a new timeline milestone; returns the new row id. */
export function createTimelineMilestone(input: TimelineCreateInput): number {
  const result = getDB()
    .prepare(
      `INSERT INTO career_timeline (company, title, division, start_date, end_date, highlights_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.company,
      input.title,
      input.division || null,
      input.startDate,
      input.endDate,
      JSON.stringify(input.highlights ?? []),
    );
  return Number(result.lastInsertRowid);
}

/** Update a timeline milestone by id. Returns true if a row was changed. */
export function updateTimelineMilestone(
  id: number,
  input: TimelineUpdateInput,
): boolean {
  const params: SqlParam[] = [
    input.company,
    input.title,
    input.division || null,
    input.startDate,
    input.endDate,
    JSON.stringify(input.highlights ?? []),
    id,
  ];
  const result = getDB()
    .prepare(
      `UPDATE career_timeline
       SET company = ?, title = ?, division = ?, start_date = ?, end_date = ?, highlights_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(...params);
  return result.changes > 0;
}

/** Delete a timeline milestone by id. Returns true if a row was removed. */
export function deleteTimelineMilestone(id: number): boolean {
  return (
    getDB().prepare("DELETE FROM career_timeline WHERE id = ?").run(id).changes >
    0
  );
}
