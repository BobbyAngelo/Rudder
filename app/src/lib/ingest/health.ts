/* ═══════════════════════════════════════════════════════
   Ingest · Apple Health connector — the sovereign quantified-self.
   Apple's export.xml can be hundreds of MB / millions of <Record>s,
   so we STREAM it (readline, never load it all) and AGGREGATE into
   weekly per-metric summaries. One RawDoc per (metric, week) keeps the
   memory store small while preserving everything recall needs:
   "how did I sleep last week", "average resting heart rate in May".
   Workouts are low-volume + high-value, so each becomes its own doc.

   Zero-dependency. Point it at the unzipped export.xml (or the
   apple_health_export folder). Sovereign — nothing leaves the machine.
   ═══════════════════════════════════════════════════════ */

import { createReadStream, existsSync, statSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";
import type { RawDoc } from "./enrich";

/** Resolve a user path to the actual export.xml. Accepts the file, its
 *  folder, or a parent containing apple_health_export/export.xml. */
export function resolveHealthXml(path: string): string {
  if (!existsSync(path)) throw new Error(`Not found on this machine: ${path}`);
  const st = statSync(path);
  if (st.isFile()) {
    if (/\.zip$/i.test(path)) {
      throw new Error("Unzip the Health export first, then point at apple_health_export/export.xml");
    }
    return path;
  }
  for (const candidate of [join(path, "export.xml"), join(path, "apple_health_export", "export.xml")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`No export.xml found under ${path}. Unzip the Health export and select that folder.`);
}

/** "HKQuantityTypeIdentifierStepCount" → "Step Count". */
export function humanizeType(raw: string): string {
  const t = raw
    .replace(/^HK(Quantity|Category|Workout)TypeIdentifier/, "")
    .replace(/^HKWorkoutActivityType/, "")
    .replace(/^HKDataType/, "");
  return t.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim() || raw;
}

/** Pull double-quoted attributes off a single opening tag. */
function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function isoDay(v?: string): string | undefined {
  const m = v?.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** Monday of the ISO week containing `day` (yyyy-mm-dd in, yyyy-mm-dd out). */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay();              // 0=Sun..6=Sat
  const offset = (dow + 6) % 7;           // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

interface NumAgg { count: number; sum: number; min: number; max: number; unit: string; first: string; last: string; }
interface CatAgg { count: number; values: Record<string, number>; first: string; last: string; }

export interface HealthParseResult {
  docs: RawDoc[];
  records: number;
  workouts: number;
}

/** Stream export.xml → weekly metric summaries + per-workout docs. */
export async function parseHealthXml(xmlPath: string): Promise<HealthParseResult> {
  const num = new Map<string, NumAgg>();   // key: type|weekStart
  const cat = new Map<string, CatAgg>();
  const docs: RawDoc[] = [];
  let records = 0;
  let workouts = 0;

  const rl = createInterface({ input: createReadStream(xmlPath, "utf-8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("<Record ")) {
      const a = attrs(line);
      const day = isoDay(a.startDate || a.creationDate);
      if (!a.type || !day) continue;
      records++;
      const wk = weekStart(day);
      const key = `${a.type}|${wk}`;
      const valNum = Number(a.value);
      if (a.value !== undefined && !Number.isNaN(valNum)) {
        const agg = num.get(key) ?? { count: 0, sum: 0, min: Infinity, max: -Infinity, unit: a.unit || "", first: day, last: day };
        agg.count++; agg.sum += valNum;
        agg.min = Math.min(agg.min, valNum); agg.max = Math.max(agg.max, valNum);
        if (day < agg.first) agg.first = day;
        if (day > agg.last) agg.last = day;
        num.set(key, agg);
      } else {
        const agg = cat.get(key) ?? { count: 0, values: {}, first: day, last: day };
        agg.count++;
        const v = humanizeType(a.value || "value");
        agg.values[v] = (agg.values[v] ?? 0) + 1;
        if (day < agg.first) agg.first = day;
        if (day > agg.last) agg.last = day;
        cat.set(key, agg);
      }
    } else if (trimmed.startsWith("<Workout ")) {
      const a = attrs(line);
      const day = isoDay(a.startDate || a.creationDate);
      if (!day) continue;
      workouts++;
      const activity = humanizeType(a.workoutActivityType || "Workout");
      const parts: string[] = [`When: ${day}`];
      if (a.duration) parts.push(`Duration: ${Math.round(Number(a.duration))} ${a.durationUnit || "min"}`);
      if (a.totalDistance) parts.push(`Distance: ${a.totalDistance} ${a.totalDistanceUnit || ""}`.trim());
      if (a.totalEnergyBurned) parts.push(`Energy: ${Math.round(Number(a.totalEnergyBurned))} ${a.totalEnergyBurnedUnit || "kcal"}`);
      docs.push({
        source: "health",
        sourceId: `workout:${a.startDate || day}:${activity}`,
        title: `Workout: ${activity}`,
        body: parts.join("\n"),
        date: day,
      });
    }
  }

  for (const [key, a] of num) {
    const [type, wk] = key.split("|");
    const name = humanizeType(type);
    const avg = a.sum / a.count;
    const round = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100);
    docs.push({
      source: "health",
      sourceId: `${type}:${wk}`,
      title: `${name} — week of ${wk}`,
      body: [
        `Metric: ${name}`,
        `Week: ${wk} (data ${a.first} to ${a.last})`,
        `Total: ${round(a.sum)} ${a.unit}`.trim(),
        `Daily average: ${round(avg)} ${a.unit}`.trim(),
        `Min ${round(a.min)}, Max ${round(a.max)} ${a.unit}`.trim(),
        `Readings: ${a.count}`,
      ].join("\n"),
      date: wk,
    });
  }

  for (const [key, a] of cat) {
    const [type, wk] = key.split("|");
    const name = humanizeType(type);
    const breakdown = Object.entries(a.values).sort((x, y) => y[1] - x[1]).map(([v, n]) => `${v}: ${n}`).join(", ");
    docs.push({
      source: "health",
      sourceId: `${type}:${wk}`,
      title: `${name} — week of ${wk}`,
      body: [`Metric: ${name}`, `Week: ${wk} (data ${a.first} to ${a.last})`, `Entries: ${a.count}`, breakdown].join("\n"),
      date: wk,
    });
  }

  return { docs, records, workouts };
}

/** Connector entry point: resolve path → stream-parse → RawDoc[]. */
export async function readHealthExport(path: string): Promise<RawDoc[]> {
  const xml = resolveHealthXml(path);
  const { docs } = await parseHealthXml(xml);
  return docs;
}
