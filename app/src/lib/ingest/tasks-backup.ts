import * as crypto from "crypto";

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

export function parseTasksBackup(jsonContent: string): ParsedTask[] {
  const parsedTasks: ParsedTask[] = [];
  let data: any;

  try {
    data = JSON.parse(jsonContent);
  } catch (err: any) {
    console.error(`[tasks-backup] Failed to parse JSON: ${err.message}`);
    return [];
  }

  // Helper to hash string for external ID if missing
  const getHashId = (val: string) => crypto.createHash("sha256").update(val).digest("hex").slice(0, 16);

  // 1. Detect Todoist format: usually a raw array of task items
  if (Array.isArray(data)) {
    console.log(`[tasks-backup] Ingesting Todoist array backup (${data.length} items)...`);
    for (const item of data) {
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
    const items = data.items || data.tasks || [];
    if (Array.isArray(items)) {
      console.log(`[tasks-backup] Ingesting Google Tasks backup (${items.length} items)...`);
      for (const item of items) {
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
