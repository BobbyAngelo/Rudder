/* =======================================================================
   Ingest | iCalendar (.ics) parser.
   Parses calendar events from standard ICS files.
   ======================================================================= */

import { readFileSync } from "fs";

export interface ParsedCalendarEvent {
  title: string;
  description: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: number;
  location: string;
  recurrence_rule: string | null;
  uid: string;
}

function unescapeICS(val: string): string {
  return val
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseICSDateTime(val: string) {
  const cleanVal = val.trim();
  const matchDate = cleanVal.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (matchDate) {
    return {
      date: `${matchDate[1]}-${matchDate[2]}-${matchDate[3]}`,
      time: null,
      allDay: 1
    };
  }
  const matchDateTime = cleanVal.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (matchDateTime) {
    return {
      date: `${matchDateTime[1]}-${matchDateTime[2]}-${matchDateTime[3]}`,
      time: `${matchDateTime[4]}:${matchDateTime[5]}`,
      allDay: 0
    };
  }
  return null;
}

export function parseICS(content: string): ParsedCalendarEvent[] {
  const rawLines = content.split(/\r?\n/);
  const lines: string[] = [];
  
  // Unfold folded lines
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

  const events: ParsedCalendarEvent[] = [];
  let currentEvent: Partial<ParsedCalendarEvent> | null = null;
  let inEvent = false;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "BEGIN" && value.toUpperCase() === "VEVENT") {
      currentEvent = {
        title: "Untitled Event",
        description: "",
        start_date: "",
        start_time: null,
        end_date: null,
        end_time: null,
        all_day: 0,
        location: "",
        recurrence_rule: null,
        uid: ""
      };
      inEvent = true;
      continue;
    }

    if (key === "END" && value.toUpperCase() === "VEVENT") {
      if (currentEvent && currentEvent.start_date) {
        events.push(currentEvent as ParsedCalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
      continue;
    }

    if (inEvent && currentEvent) {
      switch (key) {
        case "SUMMARY":
          currentEvent.title = unescapeICS(value);
          break;
        case "DESCRIPTION":
          currentEvent.description = unescapeICS(value);
          break;
        case "LOCATION":
          currentEvent.location = unescapeICS(value);
          break;
        case "UID":
          currentEvent.uid = value.trim();
          break;
        case "RRULE":
          currentEvent.recurrence_rule = value.trim();
          break;
        case "DTSTART": {
          const parsed = parseICSDateTime(value);
          if (parsed) {
            currentEvent.start_date = parsed.date;
            currentEvent.start_time = parsed.time;
            currentEvent.all_day = parsed.allDay;
          }
          break;
        }
        case "DTEND": {
          const parsed = parseICSDateTime(value);
          if (parsed) {
            currentEvent.end_date = parsed.date;
            currentEvent.end_time = parsed.time;
          }
          break;
        }
      }
    }
  }

  return events;
}

export function readICSFile(filePath: string): ParsedCalendarEvent[] {
  const content = readFileSync(filePath, "utf-8");
  return parseICS(content);
}
