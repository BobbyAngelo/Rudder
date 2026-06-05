/* ═══════════════════════════════════════════════════════
   The act loop — the daily loop (Phase 4).
   So your desk is already full when you sit down, Rudder runs the generators
   on a daily rhythm. The work is cheap and offline: the surface and schedule
   generators are pure database reads, so this needs no model and no network.

   It can run two ways, and they cooperate:
     • automatically when you open the Desk (if it hasn't run today), and
     • from a cron/launchd job (scripts/daily-scan.ts) so it happens even when
       the app is closed.
   A once-a-day guard (last_scan_at) keeps it from re-running needlessly; the
   dedupe index means a repeat is harmless anyway.
   ═══════════════════════════════════════════════════════ */

import type Database from "better-sqlite3";
import { generateAll, type ActContext } from "./registry";
import { insert } from "./store";

export interface ScanResult {
  added: number;       // genuinely new proposals inserted
  proposed: number;    // total proposals the generators offered
  ranAt: string;       // ISO timestamp of this scan
  alreadyToday: boolean; // true if skipped because it already ran today
}

/** The embed fn generators receive. Surface + schedule ignore it, so a no-op
    is fine for the daily path; pass a real one if a future generator needs it. */
const noopEmbed = async () => [] as number[];

function lastScan(db: Database.Database): string | null {
  try {
    const r = db.prepare("SELECT last_scan_at FROM user_preferences WHERE id = 1").get() as { last_scan_at?: string } | undefined;
    return r?.last_scan_at || null;
  } catch { return null; }
}

function stampScan(db: Database.Database, iso: string) {
  db.prepare("INSERT OR IGNORE INTO user_preferences (id) VALUES (1)").run();
  db.prepare("UPDATE user_preferences SET last_scan_at = ? WHERE id = 1").run(iso);
}

/** Has a scan already run on the same calendar day as `now`? */
export function scannedToday(db: Database.Database, now: Date = new Date()): boolean {
  const last = lastScan(db);
  return !!last && last.slice(0, 10) === now.toISOString().slice(0, 10);
}

/**
 * Fill the desk. Skips if it already ran today unless `force` (the manual
 * "Scan now" always forces). Returns what changed.
 */
export async function runDailyScan(
  db: Database.Database,
  opts: { force?: boolean; now?: Date; embed?: ActContext["embed"] } = {},
): Promise<ScanResult> {
  const now = opts.now ?? new Date();
  const ranAt = now.toISOString();

  if (!opts.force && scannedToday(db, now)) {
    return { added: 0, proposed: 0, ranAt: lastScan(db) || ranAt, alreadyToday: true };
  }

  const drafts = await generateAll({ db, embed: opts.embed ?? noopEmbed, now });
  let added = 0;
  for (const d of drafts) {
    if (insert(db, d) !== null) added++;
  }

  stampScan(db, ranAt);
  return { added, proposed: drafts.length, ranAt, alreadyToday: false };
}

export { lastScan };
