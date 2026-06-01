/* ═══════════════════════════════════════════════════════
   Demo dataset — a coherent fictional life ("Alex Rivera") so a
   stranger can try recall with zero setup. Dates are computed
   relative to `now` so temporal queries ("this week") always work.
   This is sample data only — never real personal data.
   ═══════════════════════════════════════════════════════ */

import type { Chunk } from "./retrieval";

function isoOffset(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildDemoChunks(now: Date = new Date()): (Chunk & { id: string })[] {
  const D = (n: number) => isoOffset(now, n);
  return [
    // ── People ──
    { id: "p-sarah", source: "people", title: "Sarah Chen", content: "Sarah Chen — product designer at Northwind, close friend since the 2021 design conference. Loves climbing and pour-over coffee.", people: ["Sarah Chen"] },
    { id: "p-marcus", source: "people", title: "Marcus Webb", content: "Marcus Webb — attorney specializing in startup contracts and intellectual property. Referred by Dana; very responsive.", people: ["Marcus Webb"] },
    { id: "p-patel", source: "people", title: "Dr. Patel", content: "Anjali Patel — primary care physician at Bay Medical Group. Annual physical usually in spring.", people: ["Anjali Patel"] },
    { id: "p-dana", source: "people", title: "Dana Rivera", content: "Dana Rivera — my manager at Acme. Direct, supportive, prefers async updates. Quarterly reviews.", people: ["Dana Rivera"] },
    { id: "p-mom", source: "people", title: "Mom", content: "Mom — lives in Sacramento. Calls on Sundays. Birthday in October.", people: ["Mom"] },

    // ── Calendar ──
    { id: "cal-coffee", source: "calendar", title: "Coffee with Sarah", content: "Coffee with Sarah Chen at Blue Bottle. Talked about her Figma offer and a Tahoe trip in July.", date: D(-3), people: ["Sarah Chen"] },
    { id: "cal-dentist", source: "calendar", title: "Dentist cleaning", content: "Routine dental cleaning with Dr. Lee.", date: D(2) },
    { id: "cal-1on1", source: "calendar", title: "1:1 with Dana", content: "Weekly 1:1 with Dana Rivera — review the Q3 roadmap and the hiring plan.", date: D(3), people: ["Dana Rivera"] },
    { id: "cal-standup", source: "calendar", title: "Team standup", content: "Daily standup with the Acme engineering team.", date: D(0) },
    { id: "cal-dinner", source: "calendar", title: "Anniversary dinner", content: "Anniversary dinner at Rivoli, 7pm. Reservation under Alex.", date: D(5) },

    // ── Tasks ──
    { id: "task-gift", source: "tasks", title: "Buy anniversary gift", content: "Find an anniversary gift — partner loved the ceramics studio downtown.", date: D(4) },
    { id: "task-callmom", source: "tasks", title: "Call Mom", content: "Call Mom about the weekend visit and her doctor's appointment.", date: D(2), people: ["Mom"] },
    { id: "task-taxes", source: "tasks", title: "File quarterly taxes", content: "Send Q2 estimated taxes to the accountant before the deadline.", date: D(20) },
    { id: "task-passport", source: "tasks", title: "Renew passport", content: "Passport expires this year — renew before the Tahoe and Lisbon trips.", date: D(10) },
    { id: "task-contract", source: "tasks", title: "Review vendor contract", content: "Have Marcus look over the new vendor contract for IP and liability terms.", date: D(1), people: ["Marcus Webb"] },

    // ── Notes / writing ──
    { id: "note-tahoe", source: "writing", title: "Tahoe trip plan", content: "Planning a Tahoe trip in July with Sarah and the climbing group. Need to book a cabin and rent gear." },
    { id: "note-career", source: "writing", title: "Career reflection", content: "Feeling ready for more scope at Acme. Want to lead the platform team. Should raise it with Dana at the next 1:1." },
    { id: "note-idea", source: "writing", title: "Side project idea", content: "Idea: a local-first journal that summarizes your week and surfaces what needs attention — all on your own machine." },
    { id: "note-gratitude", source: "writing", title: "Gratitude", content: "Grateful this week for the climb with Sarah, a calm work week, and finally sleeping better." },

    // ── Health ──
    { id: "health-sleep", source: "health", title: "Sleep", content: "Sleep averaging 7.1 hours over the last 30 days — up from 6.2 last month. Trending in the right direction." },
    { id: "health-runs", source: "health", title: "Running", content: "Ran 18 miles this week across 3 runs. Resting heart rate down to 54 bpm." },
  ];
}
