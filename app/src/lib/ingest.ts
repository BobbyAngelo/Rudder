import { getDB } from "./db";
import crypto from "crypto";

export interface IngestionPayload {
  source: string;              // e.g., 'google_calendar', 'apple_health', 'manual_command', 'local_cli'
  timestamp: string;           // ISO DateTime string
  classification: "task" | "event" | "health_metric" | "note";
  payload: Record<string, any>;
}

export interface IngestionResult {
  success: boolean;
  insertedId?: string | number;
  duplicate: boolean;
  message: string;
}

/**
 * Computes a sha256 hash of a string.
 */
function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Ingests a payload into the appropriate SQLite table with validation and deduplication.
 */
export function ingestPayload(data: IngestionPayload): IngestionResult {
  const db = getDB();
  const now = new Date().toISOString();
  
  // Basic validation
  if (!data.source || !data.timestamp || !data.classification || !data.payload) {
    return {
      success: false,
      duplicate: false,
      message: "Missing required payload fields: source, timestamp, classification, or payload."
    };
  }

  try {
    const classification = data.classification.toLowerCase();

    // ═══════════════════════════════════════════════════════
    // 1. HEALTH METRICS
    // ═══════════════════════════════════════════════════════
    if (classification === "health_metric") {
      const dateStr = data.payload.date || data.timestamp.split("T")[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return {
          success: false,
          duplicate: false,
          message: "Invalid date format for health metric. Expected YYYY-MM-DD."
        };
      }

      // Check if date already exists in health_metrics
      const existing = db.prepare("SELECT date FROM health_metrics WHERE date = ?").get(dateStr) as { date: string } | undefined;

      if (existing) {
        // Build dynamic update query to only overwrite values provided in payload
        const updates: string[] = [];
        const params: any[] = [];
        const fields = [
          "sleep_hours", "resting_hr", "hrv", "steps", "weight", "mood", "energy", 
          "notes", "blood_pressure_systolic", "blood_pressure_diastolic", 
          "blood_glucose", "temperature"
        ];

        for (const field of fields) {
          if (data.payload[field] !== undefined && data.payload[field] !== null) {
            updates.push(`${field} = ?`);
            params.push(data.payload[field]);
          }
        }

        if (updates.length > 0) {
          params.push(dateStr);
          db.prepare(`
            UPDATE health_metrics 
            SET ${updates.join(", ")} 
            WHERE date = ?
          `).run(...params);

          return {
            success: true,
            duplicate: true, // Tagged as duplicate but merged
            message: `Merged updates for health metrics on date ${dateStr}.`
          };
        }

        return {
          success: true,
          duplicate: true,
          message: `Health metrics for date ${dateStr} already exist. No updates provided.`
        };
      } else {
        // Insert new health metrics row
        const keys = ["date"];
        const placeholders = ["?"];
        const params: any[] = [dateStr];

        const fields = [
          "sleep_hours", "resting_hr", "hrv", "steps", "weight", "mood", "energy", 
          "notes", "blood_pressure_systolic", "blood_pressure_diastolic", 
          "blood_glucose", "temperature"
        ];

        for (const field of fields) {
          if (data.payload[field] !== undefined && data.payload[field] !== null) {
            keys.push(field);
            placeholders.push("?");
            params.push(data.payload[field]);
          }
        }

        const result = db.prepare(`
          INSERT INTO health_metrics (${keys.join(", ")})
          VALUES (${placeholders.join(", ")})
        `).run(...params);

        return {
          success: true,
          insertedId: Number(result.lastInsertRowid),
          duplicate: false,
          message: `Created new health metrics entry for ${dateStr}.`
        };
      }
    }

    // ═══════════════════════════════════════════════════════
    // 2. TASKS
    // ═══════════════════════════════════════════════════════
    if (classification === "task") {
      const title = (data.payload.title || "").trim();
      if (!title) {
        return { success: false, duplicate: false, message: "Task title is required." };
      }

      const due_date = data.payload.due_date || null;
      const description = data.payload.description || "";
      const priority = data.payload.priority !== undefined ? data.payload.priority : 2;
      const project_id = data.payload.project_id || 1; // 1 = Inbox
      const labels = JSON.stringify(data.payload.labels || []);

      // Duplicate check: Same title, due_date and status = 'todo'
      const existingTask = db.prepare(`
        SELECT id FROM tasks 
        WHERE title = ? AND due_date IS ? AND status = 'todo'
      `).get(title, due_date) as { id: number } | undefined;

      if (existingTask) {
        return {
          success: true,
          insertedId: existingTask.id,
          duplicate: true,
          message: `Task "${title}" already exists as incomplete.`
        };
      }

      const result = db.prepare(`
        INSERT INTO tasks (title, description, status, priority, project_id, due_date, due_time, labels, created_at, updated_at)
        VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)
      `).run(title, description, priority, project_id, due_date, data.payload.due_time || null, labels, now, now);

      return {
        success: true,
        insertedId: Number(result.lastInsertRowid),
        duplicate: false,
        message: `Task "${title}" created successfully.`
      };
    }

    // ═══════════════════════════════════════════════════════
    // 3. CALENDAR EVENTS
    // ═══════════════════════════════════════════════════════
    if (classification === "event") {
      const title = (data.payload.title || "").trim();
      if (!title) {
        return { success: false, duplicate: false, message: "Event title is required." };
      }

      const start_date = data.payload.start_date || data.timestamp.split("T")[0];
      const start_time = data.payload.start_time || null;
      const end_date = data.payload.end_date || null;
      const end_time = data.payload.end_time || null;
      const category = data.payload.category || "personal";
      const location = data.payload.location || "";
      const color = data.payload.color || (category === "work" ? "#60a5fa" : category === "health" ? "#f87171" : category === "social" ? "#f472b6" : "#34d399");

      // Duplicate check: Same title, start_date and start_time
      const existingEvent = db.prepare(`
        SELECT id FROM calendar_events 
        WHERE title = ? AND start_date = ? AND (start_time = ? OR (start_time IS NULL AND ? IS NULL))
      `).get(title, start_date, start_time, start_time) as { id: number } | undefined;

      if (existingEvent) {
        return {
          success: true,
          insertedId: existingEvent.id,
          duplicate: true,
          message: `Calendar event "${title}" on ${start_date} already exists.`
        };
      }

      const result = db.prepare(`
        INSERT INTO calendar_events (title, description, start_date, start_time, end_date, end_time, location, color, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, data.payload.description || "", start_date, start_time, end_date, end_time, location, color, category, now, now);

      return {
        success: true,
        insertedId: Number(result.lastInsertRowid),
        duplicate: false,
        message: `Event "${title}" scheduled successfully.`
      };
    }

    // ═══════════════════════════════════════════════════════
    // 4. NOTES / OBSERVATION LEDGER (DEFAULT FALLBACK)
    // ═══════════════════════════════════════════════════════
    const title = data.payload.title || data.payload.content || "Untitled Observation";
    const deterministicId = data.payload.event_id || hashString(`${data.source}-${data.timestamp}-${title}`);

    // Check if event_id already exists in reality_nodes
    const existingNode = db.prepare("SELECT event_id FROM reality_nodes WHERE event_id = ?").get(deterministicId) as { event_id: string } | undefined;

    if (existingNode) {
      return {
        success: true,
        insertedId: deterministicId,
        duplicate: true,
        message: `Observation node ${deterministicId} already logged.`
      };
    }

    db.prepare(`
      INSERT INTO reality_nodes (event_id, when_timestamp, where_context, who_entities, what_classification, why_insight, how_actions, state_vitals, gravity_score, origin_provenance, raw_blob)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deterministicId,
      data.timestamp,
      data.payload.location || data.payload.where || null,
      JSON.stringify(data.payload.people || []),
      classification,
      data.payload.notes || data.payload.insight || null,
      JSON.stringify(data.payload.actions || []),
      JSON.stringify(data.payload.vitals || {}),
      data.payload.gravity || 1,
      data.source,
      JSON.stringify(data.payload)
    );

    return {
      success: true,
      insertedId: deterministicId,
      duplicate: false,
      message: `Observation logged in 10D reality ledger: ${title}.`
    };

  } catch (error: any) {
    console.error("Ingestion error:", error);
    return {
      success: false,
      duplicate: false,
      message: `Ingestion failed: ${error.message}`
    };
  }
}
