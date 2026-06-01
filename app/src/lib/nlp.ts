export interface ParsedCommand {
  type: "task" | "event";
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  category: "personal" | "work" | "health" | "social";
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

export function parseCommand(input: string): ParsedCommand {
  let text = input.trim();
  
  // 1. Extract category hashtags (#work, #personal, #health, #social)
  let category: "personal" | "work" | "health" | "social" = "personal";
  const categoryMatch = text.match(/#(work|personal|health|social)\b/i);
  if (categoryMatch) {
    category = categoryMatch[1].toLowerCase() as any;
    text = text.replace(categoryMatch[0], "");
  }

  // 2. Determine type (task or event)
  let type: "task" | "event" = "task";
  let isExplicitTask = false;
  let isExplicitEvent = false;

  if (/^(todo|task|t):/i.test(text)) {
    isExplicitTask = true;
    text = text.replace(/^(todo|task|t):\s*/i, "");
  } else if (/^(meet|call|event|e):/i.test(text)) {
    isExplicitEvent = true;
    text = text.replace(/^(meet|call|event|e):\s*/i, "");
  }

  // 3. Extract time if present (e.g. at 3pm, at 3:30 pm, at 15:00, 3pm, 15:30)
  let time: string | null = null;
  // Match patterns like "at 3:30pm", "at 3pm", "at 15:00", "3pm", "13:45"
  const timeRegex = /(?:\bat\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  
  // Let's be careful not to match random numbers like "buy 3 apples".
  // A match is valid if it has "am/pm", a colon (e.g. "13:30"), or is preceded by "at ".
  let timeMatch = text.match(timeRegex);
  
  if (timeMatch) {
    const fullMatch = timeMatch[0];
    const hourStr = timeMatch[1];
    const minStr = timeMatch[2] || "00";
    const ampm = timeMatch[3];
    
    const hasColon = !!timeMatch[2];
    const hasAmpm = !!ampm;
    const hasAt = fullMatch.toLowerCase().startsWith("at");
    
    // Validate if it looks like a real time description
    if (hasAmpm || hasColon || hasAt) {
      let hour = parseInt(hourStr);
      const minute = parseInt(minStr);
      
      if (ampm) {
        if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
        if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
      }
      
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        text = text.replace(fullMatch, "");
        type = "event"; // presence of time defaults it to event unless explicit task
      }
    }
  }

  // 4. Extract date
  const now = new Date();
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check for relative keywords
  let dateFound = false;
  
  // "today" / "tonight"
  if (/\b(today|tonight)\b/i.test(text)) {
    text = text.replace(/\b(today|tonight)\b/i, "");
    dateFound = true;
  }
  // "tomorrow"
  else if (/\btomorrow\b/i.test(text)) {
    targetDate.setDate(targetDate.getDate() + 1);
    text = text.replace(/\btomorrow\b/i, "");
    dateFound = true;
  }
  // "in X days"
  else {
    const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1]);
      targetDate.setDate(targetDate.getDate() + days);
      text = text.replace(inDaysMatch[0], "");
      dateFound = true;
    }
  }

  // Check for weekday names (e.g. "on friday", "next monday", "this saturday")
  if (!dateFound) {
    const weekdayMatch = text.match(/\b(?:on\s+|next\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
    if (weekdayMatch) {
      const dayName = weekdayMatch[1].toLowerCase();
      const targetDay = WEEKDAYS[dayName];
      const currentDay = now.getDay();
      
      let diff = (targetDay - currentDay + 7) % 7;
      
      // If user says "next [day]" and diff is small, or if diff is 0 (it is today but they want next week)
      const isNext = weekdayMatch[0].toLowerCase().startsWith("next");
      if (isNext) {
        diff = diff === 0 ? 7 : diff + 7;
      } else if (diff === 0 && now.getHours() > 18) {
        // If it's late today and they say "on Friday" on a Friday, assume next week
        diff = 7;
      }
      
      targetDate.setDate(targetDate.getDate() + diff);
      text = text.replace(weekdayMatch[0], "");
      dateFound = true;
    }
  }

  // Check for month names and dates (e.g. "May 25", "on 12 June", "Jan 1st")
  if (!dateFound) {
    const monthDateMatch = text.match(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i) ||
                       text.match(/\b(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
                       
    if (monthDateMatch) {
      let dayVal = 1;
      let monthStr = "";
      
      if (isNaN(Number(monthDateMatch[1]))) {
        // format: month day
        monthStr = monthDateMatch[1].toLowerCase();
        dayVal = parseInt(monthDateMatch[2]);
      } else {
        // format: day month
        dayVal = parseInt(monthDateMatch[1]);
        monthStr = monthDateMatch[2].toLowerCase();
      }
      
      const monthIdx = MONTHS[monthStr];
      if (monthIdx !== undefined) {
        targetDate.setMonth(monthIdx);
        targetDate.setDate(dayVal);
        
        // If date is in the past, roll to next year
        if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          targetDate.setFullYear(now.getFullYear() + 1);
        }
        
        text = text.replace(monthDateMatch[0], "");
        dateFound = true;
      }
    }
  }

  // Clean up title: remove duplicate spaces and prep words like "on", "by", "at" at the end
  let title = text
    .replace(/\s+/g, " ")
    .replace(/\b(on|by|at|for)\s*$/i, "")
    .trim();

  // Final type adjustment:
  if (isExplicitTask) {
    type = "task";
  } else if (isExplicitEvent) {
    type = "event";
  } else {
    // If not explicit, search for event indicator words
    const eventWords = /\b(meet|call|lunch|dinner|coffee|meeting|flight|dentist|appointment|class|party|concert|game|reservation)\b/i;
    if (eventWords.test(title) || time) {
      type = "event";
    } else {
      type = "task";
    }
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dateStr = String(targetDate.getDate()).padStart(2, "0");
  
  return {
    type,
    title: title || "Untitled Item",
    date: `${year}-${month}-${dateStr}`,
    time,
    category
  };
}
