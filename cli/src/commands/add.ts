import chalk from "chalk";
import fs from "fs";
import path from "path";
import { ROOT_DIR } from "../constants.js";
import { openRudderDB } from "../utils/db.js";
import { log } from "../utils/logger.js";
import { parseCommand } from "../../../app/src/lib/nlp.js";

/**
 * Parses and loads environment variables from .env.local at the root directory
 */
function loadEnv() {
  const envPath = path.join(ROOT_DIR, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let val = trimmed.slice(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

export async function addCommand(input: string, options: { port?: string; forceType?: "task" | "event" }) {
  loadEnv();
  const port = options.port || "3000";

  // 1. Parse command
  const parsed = parseCommand(input);

  // Override type if explicitly specified
  if (options.forceType) {
    parsed.type = options.forceType;
  }

  // Enforce zero em-dashes rule
  parsed.title = parsed.title.replace(/—/g, " - ").replace(/–/g, " - ");

  log.info(`Parsed Input:`);
  log.kv("Type", parsed.type);
  log.kv("Title", parsed.title);
  log.kv("Date", parsed.date);
  log.kv("Time", parsed.time || "None");
  log.kv("Category", parsed.category);
  log.br();

  // 2. Prepare payload
  const payload = {
    source: "local_cli",
    timestamp: new Date().toISOString(),
    classification: parsed.type,
    payload: parsed.type === "task" ? {
      title: parsed.title,
      due_date: parsed.date,
      due_time: parsed.time,
      labels: [parsed.category],
      description: "",
      priority: 2,
      project_id: 1, // Inbox
    } : {
      title: parsed.title,
      start_date: parsed.date,
      start_time: parsed.time,
      end_date: null,
      end_time: null,
      category: parsed.category,
      location: "",
      color: parsed.category === "work" ? "#60a5fa" : parsed.category === "health" ? "#f87171" : parsed.category === "social" ? "#f472b6" : "#34d399",
      description: "",
    }
  };

  // 3. Attempt API call
  let success = false;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.RUDDER_INGEST_TOKEN) {
      headers["x-rudder-token"] = process.env.RUDDER_INGEST_TOKEN;
    }

    const res = await fetch(`http://localhost:${port}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json() as any;
      success = true;
      if (data.duplicate) {
        log.info(`${chalk.blue("ℹ")} [API] ${data.message || "Item already exists."}`);
      } else {
        log.success(`[API] ${data.message || "Item created successfully."}`);
      }
    } else {
      const errText = await res.text();
      log.error(`[API] Ingestion failed (${res.status}): ${errText}`);
    }
  } catch (err: any) {
    log.warn(`API connection failed on port ${port}. Falling back to direct database insertion.`);
  }

  // 4. Fallback path (Direct database insert)
  if (!success) {
    try {
      const db = openRudderDB();
      const now = new Date().toISOString();

      if (parsed.type === "task") {
        // Duplicate check
        const existing = db.prepare(`
          SELECT id FROM tasks 
          WHERE title = ? AND due_date IS ? AND status = 'todo'
        `).get(parsed.title, parsed.date) as { id: number } | undefined;

        if (existing) {
          log.info(`${chalk.blue("ℹ")} [DB] Task "${parsed.title}" already exists as incomplete (ID: ${existing.id}).`);
        } else {
          const labelsStr = JSON.stringify([parsed.category]);
          const result = db.prepare(`
            INSERT INTO tasks (title, description, status, priority, project_id, due_date, due_time, labels, created_at, updated_at)
            VALUES (?, '', 'todo', 2, 1, ?, ?, ?, ?, ?)
          `).run(parsed.title, parsed.date, parsed.time, labelsStr, now, now);
          log.success(`[DB] Task "${parsed.title}" created successfully (ID: ${result.lastInsertRowid}).`);
        }
      } else {
        // Event duplicate check
        const existing = db.prepare(`
          SELECT id FROM calendar_events 
          WHERE title = ? AND start_date = ? AND (start_time = ? OR (start_time IS NULL AND ? IS NULL))
        `).get(parsed.title, parsed.date, parsed.time, parsed.time) as { id: number } | undefined;

        if (existing) {
          log.info(`${chalk.blue("ℹ")} [DB] Calendar event "${parsed.title}" on ${parsed.date} already exists (ID: ${existing.id}).`);
        } else {
          const color = parsed.category === "work" ? "#60a5fa" : parsed.category === "health" ? "#f87171" : parsed.category === "social" ? "#f472b6" : "#34d399";
          const result = db.prepare(`
            INSERT INTO calendar_events (title, description, start_date, start_time, end_date, end_time, location, color, category, created_at, updated_at)
            VALUES (?, '', ?, ?, null, null, '', ?, ?, ?, ?)
          `).run(parsed.title, parsed.date, parsed.time, color, parsed.category, now, now);
          log.success(`[DB] Calendar event "${parsed.title}" scheduled successfully (ID: ${result.lastInsertRowid}).`);
        }
      }
      db.close();
    } catch (dbErr: any) {
      log.error(`Database fallback failed: ${dbErr.message}`);
    }
  }
}
