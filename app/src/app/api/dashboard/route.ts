import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const db = getDB();

    // Reality Ledger count
    const ledger = db.prepare("SELECT COUNT(*) as count FROM reality_nodes").get() as any;

    // Data sources count
    const sources = db.prepare("SELECT COUNT(*) as count FROM data_sources WHERE status = 'active'").get() as any;

    // People count
    const people = db.prepare("SELECT COUNT(*) as count FROM people").get() as any;

    // Journal entries count
    const journal = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get() as any;

    // Tasks counts
    const tasksTodo = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'todo'").get() as any;
    const tasksInProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'").get() as any;
    const tasksDone = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'").get() as any;

    // Last sync time
    const lastSync = db.prepare("SELECT MAX(last_scanned) as last_scanned FROM data_sources").get() as any;

    // Health records count
    const healthRecords = db.prepare("SELECT COUNT(*) as count FROM health_records").get() as any;

    // Database file size
    const fs = require("fs");
    const path = require("path");
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
