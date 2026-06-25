/* =======================================================================
   Ingest | Todoist CSV Parser.
   Parses tasks from exported Todoist CSV files.
   ======================================================================= */

import { readFileSync } from "fs";

export interface ParsedTodoistTask {
  title: string;
  description: string;
  priority: number; // 0=none, 1=low, 2=medium, 3=high, 4=urgent
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:MM
}

export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal || row.length > 0) {
    row.push(currentVal);
    lines.push(row);
  }

  return lines;
}

export function parseTodoistCSV(csvContent: string): ParsedTodoistTask[] {
  const rows = parseCSV(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toUpperCase());
  const tasks: ParsedTodoistTask[] = [];

  const contentIdx = headers.indexOf("CONTENT");
  const descIdx = headers.indexOf("DESCRIPTION");
  const priorityIdx = headers.indexOf("PRIORITY");
  const dateIdx = headers.indexOf("DATE") !== -1 ? headers.indexOf("DATE") : headers.indexOf("DUE_DATE");

  if (contentIdx === -1) {
    throw new Error("Invalid Todoist CSV: Missing 'CONTENT' column header.");
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= contentIdx || !row[contentIdx]) continue;

    const title = row[contentIdx].trim();
    const description = descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : "";
    
    // Parse priority: Todoist uses 1 (normal) to 4 (very high/urgent)
    let priority = 0;
    if (priorityIdx !== -1 && row[priorityIdx]) {
      const pVal = parseInt(row[priorityIdx].trim(), 10);
      if (pVal === 4) priority = 4; // urgent
      else if (pVal === 3) priority = 3; // high
      else if (pVal === 2) priority = 2; // medium
      else if (pVal === 1) priority = 1; // low
    }

    // Parse date/time
    let due_date: string | null = null;
    let due_time: string | null = null;

    if (dateIdx !== -1 && row[dateIdx]) {
      const dateStr = row[dateIdx].trim();
      // Match formats: YYYY-MM-DD or YYYY-MM-DD HH:MM
      const dateOnlyMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})$/);
      const dateTimeMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);

      if (dateTimeMatch) {
        due_date = dateTimeMatch[1];
        due_time = dateTimeMatch[2];
      } else if (dateOnlyMatch) {
        due_date = dateOnlyMatch[1];
      } else {
        // Try passing it to Date parser
        try {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            due_date = parsed.toISOString().slice(0, 10);
            if (dateStr.includes(":") || dateStr.includes("t") || dateStr.includes("T")) {
              due_time = parsed.toTimeString().slice(0, 5);
            }
          }
        } catch {
          // ignore invalid date strings
        }
      }
    }

    tasks.push({
      title,
      description,
      priority,
      due_date,
      due_time
    });
  }

  return tasks;
}

export function readTodoistCSVFile(filePath: string): ParsedTodoistTask[] {
  const content = readFileSync(filePath, "utf-8");
  return parseTodoistCSV(content);
}
