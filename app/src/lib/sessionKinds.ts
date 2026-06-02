/* ═══════════════════════════════════════════════════════
   Session kinds — the Apple-Health-style "workout type" picker,
   but for capturing life. Start a session → pick a kind → record →
   tag → send to the brain (POST /api/ingest).

   This is the single source of truth every capture client mirrors
   (laptop /capture page today; phone, esp32, e-paper pendant later).
   Adding a type is one entry here — the same one-entry-in-a-registry
   pattern as connectors.
   ═══════════════════════════════════════════════════════ */

export interface SessionKind {
  id: string;
  label: string;
  /** lucide-react icon name (mapped to a component on the client). */
  icon: string;
  /** Prompt for attendees up front (social kinds) vs skip straight to record (solo kinds). */
  promptsForPeople: boolean;
  /** Solo/sensitive kinds default to private. */
  defaultPrivacy: "private" | "normal";
  /** Hints the UI/firmware to expect a long recording. */
  longForm?: boolean;
  /** One-line helper shown under the tile. */
  hint?: string;
}

export const SESSION_KINDS: SessionKind[] = [
  // ── Social — usually about who was there ──
  { id: "meeting",      label: "Meeting",      icon: "Users",         promptsForPeople: true,  defaultPrivacy: "normal",  hint: "Group sync or standup" },
  { id: "call",         label: "1:1 / Call",   icon: "Phone",         promptsForPeople: true,  defaultPrivacy: "normal",  hint: "Phone or video" },
  { id: "conversation", label: "Conversation", icon: "MessageSquare", promptsForPeople: true,  defaultPrivacy: "normal",  hint: "In-person, casual" },
  { id: "interview",    label: "Interview",    icon: "Mic",           promptsForPeople: true,  defaultPrivacy: "normal",  longForm: true },

  // ── Solo / creative — fast, no people prompt ──
  { id: "idea",         label: "Idea",         icon: "Lightbulb",     promptsForPeople: false, defaultPrivacy: "private", hint: "Quick voice memo" },
  { id: "brainstorm",   label: "Brainstorm",   icon: "Brain",         promptsForPeople: false, defaultPrivacy: "private" },
  { id: "journal",      label: "Journal",      icon: "NotebookPen",   promptsForPeople: false, defaultPrivacy: "private", hint: "Reflection, private" },

  // ── Learning — long-form ──
  { id: "lecture",      label: "Lecture",      icon: "GraduationCap", promptsForPeople: false, defaultPrivacy: "normal",  longForm: true },
  { id: "study",        label: "Study",        icon: "BookMarked",    promptsForPeople: false, defaultPrivacy: "normal" },

  // ── Life / admin ──
  { id: "appointment",  label: "Appointment",  icon: "CalendarDays",  promptsForPeople: false, defaultPrivacy: "private", hint: "Doctor, service, etc." },
  { id: "errand",       label: "Errand",       icon: "MapPin",        promptsForPeople: false, defaultPrivacy: "normal" },
  { id: "family",       label: "Family",       icon: "Heart",         promptsForPeople: true,  defaultPrivacy: "private" },

  // ── Escape hatch (Apple's "Other") ──
  { id: "other",        label: "Other",        icon: "CircleDot",     promptsForPeople: false, defaultPrivacy: "normal" },
];

export function getSessionKind(id: string | undefined | null): SessionKind | undefined {
  if (!id) return undefined;
  return SESSION_KINDS.find((k) => k.id === id);
}
