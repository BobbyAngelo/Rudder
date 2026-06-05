/* ═══════════════════════════════════════════════════════
   The act loop — a small natural-date parser.
   Commitments in memory carry their timing in plain language ("I'll follow up
   next week", "send it by Friday", "dinner on the 13th"). To propose a calendar
   event we resolve that phrase to a concrete date — RELATIVE TO WHEN IT WAS
   WRITTEN (the note's own date), because "next week" means next week from then.

   Deliberately small and conservative: it only fires on clear phrases, and the
   caller filters out anything that resolves to the past. Pure + testable.
   ═══════════════════════════════════════════════════════ */

export interface ParsedWhen {
  date: string;   // ISO YYYY-MM-DD
  time?: string;  // HH:MM (24h), when a clock time was stated
  matched: string; // the phrase we recognized, for the rationale
}

const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
/** Next weekday `dow` on/after `ref`. `exclusive` skips today (for "next <day>"). */
function nextDow(ref: Date, dow: number, exclusive = false): Date {
  let delta = (dow - ref.getDay() + 7) % 7;
  if (exclusive && delta === 0) delta = 7;
  return addDays(ref, delta);
}

function parseTime(text: string): string | undefined {
  // "at 3pm", "3:30 pm", "at 15:00", "noon", "midnight"
  if (/\bnoon\b/.test(text)) return "12:00";
  if (/\bmidnight\b/.test(text)) return "00:00";
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return undefined;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const m24 = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (m24) {
    const h = parseInt(m24[1], 10), min = parseInt(m24[2], 10);
    if (h <= 23 && min <= 59) return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return undefined;
}

/** Resolve the first clear date phrase in `text`, relative to `refISO`. */
export function parseWhen(text: string, refISO?: string): ParsedWhen | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const ref = refISO && /^\d{4}-\d{2}-\d{2}$/.test(refISO) ? new Date(refISO + "T00:00:00") : new Date();
  const time = parseTime(t);
  const wrap = (d: Date, matched: string): ParsedWhen => ({ date: toISO(d), time, matched });

  // 1. Month + day ("June 13", "jun 13", "13 june"). Roll to next year if past.
  let m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m && MONTHS[m[1]] !== undefined) {
    const mo = MONTHS[m[1]], day = parseInt(m[2], 10);
    if (day >= 1 && day <= 31) {
      let d = new Date(ref.getFullYear(), mo, day);
      if (d < ref) d = new Date(ref.getFullYear() + 1, mo, day);
      return wrap(d, `${m[1]} ${m[2]}`);
    }
  }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/);
  if (m && MONTHS[m[2]] !== undefined) {
    const mo = MONTHS[m[2]], day = parseInt(m[1], 10);
    if (day >= 1 && day <= 31) {
      let d = new Date(ref.getFullYear(), mo, day);
      if (d < ref) d = new Date(ref.getFullYear() + 1, mo, day);
      return wrap(d, `${m[1]} ${m[2]}`);
    }
  }

  // NOTE: explicit future phrases (next week, a weekday, in N days) are tried
  // BEFORE "today/tomorrow". A note often says "...did X today. I'll do Y next
  // week" — the commitment is the future one, not the past aside.

  // 3. "in N day(s)/week(s)/month(s)"
  m = t.match(/\bin\s+(\d{1,2}|a|an|one|two|three|four)\s+(day|week|month)s?\b/);
  if (m) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
    const n = words[m[1]] ?? parseInt(m[1], 10);
    const mult = m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30;
    return wrap(addDays(ref, n * mult), `in ${m[1]} ${m[2]}${n > 1 ? "s" : ""}`);
  }

  // 4. "next week" / "next month"
  if (/\bnext week\b/.test(t)) return wrap(addDays(ref, 7), "next week");
  if (/\bnext month\b/.test(t)) return wrap(addDays(ref, 30), "next month");

  // 5. weekday. Full names may appear bare; abbreviations require a lead-in
  //    word (by/on/next/this) so "I sat down" / "we may" aren't misread.
  let full = t.match(/\b(next|this|by|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  let abbr = full ? null : t.match(/\b(next|this|by|on)\s+(sun|mon|tues?|wed|thurs?|fri|sat)\b/);
  const wd = full || abbr;
  if (wd && DOW[wd[2]] !== undefined) {
    const exclusive = wd[1] === "next"; // "next friday" means the coming one, not today
    return wrap(nextDow(ref, DOW[wd[2]], exclusive), `${wd[1] ? wd[1] + " " : ""}${wd[2]}`);
  }

  // 6. "the 13th" / "on the 13th" → next occurrence of that day-of-month
  m = t.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    if (day >= 1 && day <= 31) {
      let d = new Date(ref.getFullYear(), ref.getMonth(), day);
      if (d < ref) d = new Date(ref.getFullYear(), ref.getMonth() + 1, day);
      return wrap(d, `the ${m[1]}th`);
    }
  }

  // 7. tomorrow / today / tonight — last, so a future phrase above wins.
  if (/\btomorrow\b/.test(t)) return wrap(addDays(ref, 1), "tomorrow");
  if (/\b(today|tonight)\b/.test(t)) return wrap(ref, "today");

  // A bare time with no date ("at 3pm") isn't enough to schedule.
  return null;
}
