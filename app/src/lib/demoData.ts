/* ═══════════════════════════════════════════════════════
   Demo dataset — a coherent fictional life ("Tom Bennett") so anyone can try
   Rudder with zero setup. Like the friend everyone started with, Tom is the
   built-in sample life: a photographer-turned-founder in Austin, with people,
   a calendar, a decade of history, and a few loose threads.

   Dates are computed relative to `now` so:
     • "this week" / recency queries always work,
     • the act loop's surfacer lights up the day you run it —
         - ON THIS DAY: events anchored to today's month-day in past years,
         - GONE QUIET: friends last mentioned 8–10 months ago,
         - OPEN LOOP: commitments written in the last few days.

   This is sample data only — never real personal data.
   ═══════════════════════════════════════════════════════ */

import type { Chunk } from "./retrieval";

function isoOffset(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's month-day, but `yearsAgo` years in the past — for "on this day". */
function sameDayYearsAgo(now: Date, yearsAgo: number): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
}

/** A fixed past date relative to the current year — for life-history eras. */
function yearsAgoOn(now: Date, yearsAgo: number, mmdd: string): string {
  return `${now.getFullYear() - yearsAgo}-${mmdd}`;
}

export function buildDemoChunks(now: Date = new Date()): (Chunk & { id: string })[] {
  const D = (n: number) => isoOffset(now, n);
  const Y = (n: number, mmdd: string) => yearsAgoOn(now, n, mmdd);

  return [
    // ── People ──
    { id: "p-jordan", source: "people", title: "Jordan Cole", content: "Jordan Cole — my partner. A landscape architect, calm and funny. We moved in together three years ago. Loves farmers markets and bad sci-fi.", people: ["Jordan Cole"] },
    { id: "p-maya", source: "people", title: "Maya Bennett", content: "Maya Bennett — my younger sister, lives in Sacramento near Mom. Nurse. We talk most Sundays.", people: ["Maya Bennett"] },
    { id: "p-sam", source: "people", title: "Sam Okafor", content: "Sam Okafor — my co-founder at the studio. Handles the engineering; I handle the lens and the clients. Met at a hackathon.", people: ["Sam Okafor"] },
    { id: "p-diego", source: "people", title: "Diego Alvarez", content: "Diego Alvarez — best friend since college at UT Austin. Road-trip partner. Moved to Denver a while back. We always say we'll do the Big Bend trip again.", people: ["Diego Alvarez"] },
    { id: "p-priya", source: "people", title: "Priya Nair", content: "Priya Nair — my first boss at the agency and still my mentor. Taught me to charge what the work is worth.", people: ["Priya Nair"] },
    { id: "p-mom", source: "people", title: "Mom", content: "Linda — my mom, in Sacramento. Sunday phone calls. Birthday in October. Worries, lovingly.", people: ["Linda Bennett"] },

    // ── This week: calendar (recent, relative to now) ──
    { id: "cal-market", source: "calendar", title: "Farmers market with Jordan", content: "Saturday market with Jordan Cole — picked peaches and talked about the launch party guest list.", date: D(-2), people: ["Jordan Cole"] },
    { id: "cal-standup", source: "calendar", title: "Studio standup", content: "Morning standup with Sam Okafor — beta feedback triage and the press list for launch.", date: D(0), people: ["Sam Okafor"] },
    { id: "cal-shoot", source: "calendar", title: "Client shoot — Habaneros", content: "Photo shoot for the Habaneros restaurant rebrand. Golden hour on South Congress.", date: D(1) },
    { id: "cal-launch", source: "calendar", title: "App launch party", content: "Launch party for the studio's photo app at the East Side gallery. 6pm. Need final headcount.", date: D(9), people: ["Sam Okafor", "Jordan Cole"] },
    { id: "cal-sunday", source: "calendar", title: "Call Maya & Mom", content: "Sunday call with Maya and Mom. Maya's starting a new ward; Mom wants photos.", date: D(4), people: ["Maya Bennett", "Linda Bennett"] },

    // ── This week: tasks (some are OPEN LOOPS the surfacer should catch) ──
    { id: "task-caterer", source: "tasks", title: "Follow up with caterer", content: "Met the caterer for the launch party today. I'll follow up with them next week about the final headcount and the vegetarian options.", date: D(-4), people: [] },
    { id: "task-deck", source: "tasks", title: "Send Sam the deck", content: "I need to send Sam the revised investor deck by Friday — he's reviewing before we share it.", date: D(-2), people: ["Sam Okafor"] },
    { id: "task-passport", source: "tasks", title: "Renew passport", content: "Passport expires this year. Renew it before the Lisbon trip with Jordan in the fall.", date: D(12), people: ["Jordan Cole"] },
    { id: "task-prints", source: "tasks", title: "Order gallery prints", content: "Order the large-format prints for the launch show. The lab needs three days.", date: D(3) },

    // ── Notes / writing ──
    { id: "note-launch", source: "writing", title: "Why this app", content: "The whole point of the app: your photos stay yours, on your own machine. No cloud landlord. Building the thing I wished existed." },
    { id: "note-doubt", source: "writing", title: "Founder doubt", content: "Some weeks the studio feels too small to matter. Then a client cries at their gallery wall and I remember why. Keep going." },
    { id: "note-gratitude", source: "writing", title: "Gratitude", content: "Grateful this week: peaches with Jordan, Sam's patience, and the light on South Congress at 7pm." },

    // ── GONE QUIET: friends last heard from months ago ──
    { id: "old-diego", source: "writing", title: "Catch-up with Diego", content: "Called Diego for the first time in too long. He's settled in Denver now. We swore we'd finally do the Big Bend road trip this year. I miss him.", date: D(-300), people: ["Diego Alvarez"] },
    { id: "old-priya", source: "calendar", title: "Lunch with Priya", content: "Lunch with Priya, my mentor. She told me to raise the studio's rates and stop apologizing for them. Haven't talked since.", date: D(-240), people: ["Priya Nair"] },

    // ── ON THIS DAY: anchored to today's month-day in past years ──
    { id: "otd-gallery", source: "calendar", title: "First gallery show — Neon & Rain", content: "Opening night of my first solo gallery show, 'Neon & Rain', on South Congress. Sold four prints. Diego drove down from Denver to be there. One of the best nights of my life.", date: sameDayYearsAgo(now, 5), people: ["Diego Alvarez"] },
    { id: "otd-leap", source: "writing", title: "Quit the agency", content: "Gave notice at the agency today to go full-time on photography. Terrifying and completely right. Priya said she'd send me my first three clients.", date: sameDayYearsAgo(now, 8), people: ["Priya Nair"] },

    // ── Life history (eras for the Life Historian / book) ──
    { id: "life-hs", source: "writing", title: "Graduated high school", content: "Graduated high school in Sacramento. Spent the summer shooting skate videos with a borrowed camera and decided that was the whole point of everything.", date: Y(18, "06-12") },
    { id: "life-college", source: "writing", title: "Started at UT Austin", content: "First week at UT Austin. Met Diego in a dorm hallway argument about cameras. Austin felt like a city built for exactly the person I wanted to become.", date: Y(14, "08-25"), people: ["Diego Alvarez"] },
    { id: "life-grad", source: "writing", title: "First job at the agency", content: "Graduated and took a job at a small ad agency under Priya. Long hours, real craft. Learned how to light a face and how to talk to a client.", date: Y(12, "09-03"), people: ["Priya Nair"] },
    { id: "life-solo", source: "writing", title: "Moved into the South Austin place", content: "Signed the lease on the little house in South Austin. First time living alone. Built a darkroom in the second bedroom.", date: Y(9, "04-15") },
    { id: "life-studio", source: "writing", title: "Founded the studio with Sam", content: "Sam and I shook hands and started the studio. A camera, a laptop, and a stubborn idea: photography plus software you actually own.", date: Y(6, "02-10"), people: ["Sam Okafor"] },
    { id: "life-jordan", source: "writing", title: "Met Jordan", content: "Met Jordan at a friend's rooftop thing. We talked about cities and light until everyone else left. I called Maya the next morning and said: this one's different.", date: Y(5, "10-02"), people: ["Jordan Cole", "Maya Bennett"] },
    { id: "life-moved-in", source: "writing", title: "Moved in with Jordan", content: "Jordan moved into the South Austin house. We turned the darkroom back into a real room. Worth it.", date: Y(3, "05-20"), people: ["Jordan Cole"] },
    { id: "life-beta", source: "writing", title: "Launched the app beta", content: "Shipped the first private beta of the photo app. Sam stayed up until 3am fixing the importer. We watched the first stranger's photos land — local, private, theirs.", date: Y(1, "11-08"), people: ["Sam Okafor"] },

    // ── Health ──
    { id: "health-sleep", source: "health", title: "Sleep", content: "Sleep averaging 7.0 hours over the last month — up from 6.1. The earlier wind-down with Jordan is working.", date: D(-1) },
    { id: "health-runs", source: "health", title: "Running the Lady Bird trail", content: "Ran the Lady Bird Lake loop three times this week, 19 miles total. Resting heart rate down to 56.", date: D(-1) },
  ];
}

/* ── Identity: who Tom is, so "I/me/my" resolves and the act loop's
   "gone quiet" signal has relationships to watch. ── */

export interface DemoIdentity {
  profile: Record<string, string>;
  values: { label: string; description: string; priority: number }[];
  milestones: { title: string; description: string; date: string; category: string }[];
  links: { platform: string; url: string; label: string }[];
  relationships: { name: string; relation: string; note: string; priority: number }[];
}

export function buildDemoIdentity(now: Date = new Date()): DemoIdentity {
  const Y = (n: number, mmdd: string) => yearsAgoOn(now, n, mmdd);
  return {
    profile: {
      display_name: "Tom",
      full_name: "Tom Bennett",
      headline: "Photographer & founder — building a local-first photo studio in Austin",
      bio: "Photographer turned founder. I run a two-person studio in Austin with Sam, building photography software you actually own. Grew up in Sacramento, came to Austin for school and never left. Happiest at golden hour with a client who's about to see themselves clearly for the first time.",
      operating_manual: "Direct but kind. I think in pictures, so show me, don't just tell me. I commit slowly and then completely. Mornings are for craft, afternoons for people. If something's wrong, say it plainly — I'd rather fix it than be comfortable.",
      goals: "Launch the photo app and get the first thousand people who own their memories. Keep the studio small and the work great. Finally take the Big Bend trip with Diego. Spend more unhurried time with Jordan.",
      location: "Austin, Texas",
      timezone: "America/Chicago",
      email: "tom@bennettstudio.example",
      website: "bennettstudio.example",
    },
    values: [
      { label: "Craft over hype", description: "Make the work good enough that it doesn't need to shout.", priority: 0 },
      { label: "Own your own stuff", description: "Your photos, your memories, your machine. No landlords.", priority: 1 },
      { label: "Show up for people", description: "Slow to commit, then all the way in.", priority: 2 },
    ],
    milestones: [
      { title: "Graduated high school in Sacramento", description: "Where the camera habit started.", date: Y(18, "06-12"), category: "education" },
      { title: "Started at UT Austin", description: "Met Diego. Fell for the city.", date: Y(14, "08-25"), category: "education" },
      { title: "First job at the agency under Priya", description: "Learned the craft and the business.", date: Y(12, "09-03"), category: "career" },
      { title: "Went full-time on photography", description: "Quit the agency. Terrifying, right.", date: sameDayYearsAgo(now, 8), category: "career" },
      { title: "First gallery show — Neon & Rain", description: "South Congress. Sold four prints.", date: sameDayYearsAgo(now, 5), category: "career" },
      { title: "Founded the studio with Sam", description: "Photography plus software you own.", date: Y(6, "02-10"), category: "career" },
      { title: "Met Jordan", description: "Rooftop, cities and light.", date: Y(5, "10-02"), category: "personal" },
      { title: "Launched the app beta", description: "First strangers' photos, local and private.", date: Y(1, "11-08"), category: "career" },
    ],
    links: [
      { platform: "instagram", url: "https://instagram.com/example", label: "@tom.shoots" },
      { platform: "github", url: "https://github.com/example", label: "bennett-studio" },
    ],
    relationships: [
      { name: "Jordan Cole", relation: "partner", note: "Landscape architect. Three years in.", priority: 0 },
      { name: "Maya Bennett", relation: "sister", note: "Nurse in Sacramento. Sunday calls.", priority: 1 },
      { name: "Sam Okafor", relation: "co-founder", note: "The engineer half of the studio.", priority: 2 },
      { name: "Linda Bennett", relation: "mom", note: "Sacramento. October birthday.", priority: 3 },
      { name: "Diego Alvarez", relation: "best friend", note: "College. In Denver now. Big Bend trip pending.", priority: 4 },
      { name: "Priya Nair", relation: "mentor", note: "First boss at the agency.", priority: 5 },
    ],
  };
}
