import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { serverError } from "@/lib/api-error";
import { getDB } from "@/lib/db";

interface CountRow {
  count: number;
}

interface LastSyncRow {
  last_scanned: string | null;
}

export async function GET() {
  try {
    const db = getDB();

    // Reality Ledger count
    const ledger = db.prepare("SELECT COUNT(*) as count FROM reality_nodes").get() as CountRow | undefined;

    // Data sources count
    const sources = db.prepare("SELECT COUNT(*) as count FROM data_sources WHERE status = 'active'").get() as CountRow | undefined;

    // People count
    const people = db.prepare("SELECT COUNT(*) as count FROM people").get() as CountRow | undefined;

    // Journal entries count
    const journal = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get() as CountRow | undefined;

    // Tasks counts
    const tasksTodo = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'todo'").get() as CountRow | undefined;
    const tasksInProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'").get() as CountRow | undefined;
    const tasksDone = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'").get() as CountRow | undefined;

    // Last sync time
    const lastSync = db.prepare("SELECT MAX(last_scanned) as last_scanned FROM data_sources").get() as LastSyncRow | undefined;

    // Health records count
    const healthRecords = db.prepare("SELECT COUNT(*) as count FROM health_records").get() as CountRow | undefined;

    // Database file size
    const dbPath = path.join(process.cwd(), "..", "data", "rudder.db");
    let dbSize = 0;
    try { dbSize = fs.statSync(dbPath).size; } catch {}

    return NextResponse.json({
      ledger_count: ledger?.count ?? 0,
      data_sources: sources?.count ?? 0,
      people_count: people?.count ?? 0,
      journal_count: journal?.count ?? 0,
      health_records: healthRecords?.count ?? 0,
      tasks: {
        todo: tasksTodo?.count ?? 0,
        in_progress: tasksInProgress?.count ?? 0,
        done: tasksDone?.count ?? 0,
      },
      last_sync: lastSync?.last_scanned ?? null,
      db_size_bytes: dbSize,
    });
  } catch (error) {
    return serverError(error);
  }
}
