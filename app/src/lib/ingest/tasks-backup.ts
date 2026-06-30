import * as crypto from "crypto";
import { log } from "../logger";

/* =======================================================================
   Ingest | Generic Tasks JSON Backup Parser.
   Parses Todoist and Google Tasks JSON exports.
   ======================================================================= */

export interface ParsedTask {
  externalId: string;
  title: string;
  description: string;
  status: "todo" | "done";
  priority: number; // 0=none, 1=low, 2=medium, 3=high, 4=urgent
  dueDate: string | null; // YYYY-MM-DD
}

interface RawTaskItem {
  id?: string | number;
  content?: string;
  title?: string;
  description?: string;
  notes?: string;
  checked?: boolean | number;
  status?: string;
  priority?: number;
  due?: string | { date?: string };
}

export function parseTasksBackup(jsonContent: string): ParsedTask[] {
  const parsedTasks: ParsedTask[] = [];
  let data: unknown;

  try {
    data = JSON.parse(jsonContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`[tasks-backup] Failed to parse JSON: ${message}`);
    return [];
  }

  // Helper to hash string for external ID if missing
  const getHashId = (val: string) => crypto.createHash("sha256").update(val).digest("hex").slice(0, 16);

  // 1. Detect Todoist format: usually a raw array of task items
  if (Array.isArray(data)) {
    log.info(`[tasks-backup] Ingesting Todoist array backup (${data.length} items)...`);
    for (const item of data as RawTaskItem[]) {
      if (!item || (!item.content && !item.title)) continue;

      const title = (item.content || item.title || "").trim();
      const description = (item.description || "").trim();
      const isCompleted = item.checked === true || item.checked === 1 || item.status === "completed";
      const status = isCompleted ? "done" : "todo";

      // Todoist priority ranges 1 (none) to 4 (high/urgent)
      const priority = typeof item.priority === "number" ? Math.min(4, Math.max(0, item.priority)) : 1;

      // Extract due date: format can be YYYY-MM-DD or date object
      let dueDate: string | null = null;
      if (item.due) {
        if (typeof item.due === "string") {
          dueDate = item.due.split("T")[0];
        } else if (item.due.date && typeof item.due.date === "string") {
          dueDate = item.due.date.split("T")[0];
        }
      }

      const externalId = item.id ? `todoist-${item.id}` : `todoist-${getHashId(title + (dueDate || ""))}`;

      parsedTasks.push({
        externalId,
        title,
        description,
        status,
        priority,
        dueDate
      });
    }
  } 
  // 2. Detect Google Tasks format: object containing { kind: "tasks#tasks", items: [...] }
  else if (data && typeof data === "object") {
    const obj = data as { items?: unknown; tasks?: unknown };
    const items = obj.items || obj.tasks || [];
    if (Array.isArray(items)) {
      log.info(`[tasks-backup] Ingesting Google Tasks backup (${items.length} items)...`);
      for (const item of items as RawTaskItem[]) {
        if (!item || (!item.title && !item.content)) continue;

        const title = (item.title || item.content || "").trim();
        const description = (item.notes || item.description || "").trim();
        const isCompleted = item.status === "completed" || item.checked === true || item.checked === 1;
        const status = isCompleted ? "done" : "todo";
        const priority = 1; // Google Tasks does not have native priority mappings, default to low

        let dueDate: string | null = null;
        if (item.due && typeof item.due === "string") {
          dueDate = item.due.split("T")[0];
        }

        const externalId = item.id ? `google-${item.id}` : `google-${getHashId(title + (dueDate || ""))}`;

        parsedTasks.push({
          externalId,
          title,
          description,
          status,
          priority,
          dueDate
        });
      }
    }
  }

  return parsedTasks;
}
