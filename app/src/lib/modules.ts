/**
 * Rudder Module Registry
 * 
 * Single source of truth for all available modules.
 * The sidebar, onboarding wizard, and settings page all read from this.
 * 
 * Users enable/disable modules via preferences — the sidebar
 * only shows what they've turned on.
 */

export interface RudderModule {
  /** Unique identifier — matches the route path */
  id: string;
  /** Display name */
  label: string;
  /** One-line description for onboarding/settings */
  description: string;
  /** Lucide icon name (rendered dynamically in components) */
  icon: string;
  /** Navigation group */
  group: "life" | "operations" | "creative" | "infrastructure";
  /** Route path */
  route: string;
  /** Whether this module is enabled by default for new users */
  defaultEnabled: boolean;
  /** Suggested for onboarding — appears on the "pick your modules" screen */
  onboardingSuggested: boolean;
  /** Status badge */
  status: "active" | "beta" | "scaffold" | "coming-soon";
  /** Optional: data table names this module owns (for stats) */
  tables?: string[];
  /** Optional: emoji for the onboarding card */
  emoji?: string;
}

/**
 * All available Rudder modules.
 * 
 * To add a new module:
 * 1. Add it here
 * 2. Create the route in app/src/app/[id]/page.tsx
 * 3. Create the API route in app/src/app/api/[id]/route.ts
 * 4. Add any migrations to db.ts
 */
export const MODULE_REGISTRY: RudderModule[] = [
  // ── Life & Identity ──
  {
    id: "identity",
    label: "Identity",
    description: "Your personal profile, values, milestones, and life data",
    icon: "User",
    group: "life",
    route: "/identity",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["identity_profile", "identity_values", "identity_milestones", "identity_links"],
    emoji: "🪞",
  },
  {
    id: "people",
    label: "People",
    description: "Contact directory and relationship management",
    icon: "Users",
    group: "life",
    route: "/people",
    defaultEnabled: false,
    onboardingSuggested: true,
    status: "active",
    tables: ["people"],
    emoji: "👥",
  },
  {
    id: "health",
    label: "Health",
    description: "Biometrics, vitality tracking, doctors, meds, and body data",
    icon: "Heart",
    group: "life",
    route: "/health",
    defaultEnabled: false,
    onboardingSuggested: true,
    status: "active",
    tables: ["health_metrics", "health_records", "health_providers"],
    emoji: "❤️",
  },

  {
    id: "biographer",
    label: "Biographer",
    description: "Your AI layer — local models or API keys that run the show",
    icon: "BookOpen",
    group: "life",
    route: "/biographer",
    defaultEnabled: false,
    onboardingSuggested: false,
    status: "active",
    emoji: "🤖",
  },

  // ── Operations ──
  {
    id: "schedule",
    label: "Schedule",
    description: "Tasks, calendar, events, and daily planning",
    icon: "CalendarDays",
    group: "operations",
    route: "/planner",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["tasks", "task_projects", "task_labels", "calendar_events"],
    emoji: "📅",
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    description: "Visual relationship network of people, events, and ideas",
    icon: "Workflow",
    group: "operations",
    route: "/graph",
    defaultEnabled: false,
    onboardingSuggested: true,
    status: "active",
    emoji: "🕸️",
  },
  {
    id: "career",
    label: "Career Hub",
    description: "Sovereign career vault, timeline, and real-time Gemini Live Interview Copilot",
    icon: "Briefcase",
    group: "operations",
    route: "/career",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    emoji: "💼",
  },
  {
    id: "harness",
    label: "Harness",
    description: "Build custom AI context packages to bypass the friction tax",
    icon: "Target",
    group: "operations",
    route: "/harness",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["harness_configs", "harness_sources"],
    emoji: "🎯",
  },

  // ── Creative Engines ──
  {
    id: "writing",
    label: "Writing",
    description: "Word processor, journal, and long-form composition",
    icon: "PenTool",
    group: "creative",
    route: "/writing",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["journal_entries"],
    emoji: "✍️",
  },
  {
    id: "pala",
    label: "Notes",
    description: "Voice-driven sovereign note puck and tag engine",
    icon: "BookMarked",
    group: "creative",
    route: "/pala",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["journal_entries"],
    emoji: "🎙️",
  },
  // NOTE: FLOW was removed from Rudder on 2026-05-29 and split into its own
  // repository (see SPLIT_FLOW.md). Rudder no longer surfaces the /flow route,
  // the api/flow endpoints, or the taste_library/brand_contexts tables.
  {
    id: "photos",
    label: "Photos",
    description: "Sovereign photo catalog, iPhoto sync, and memories feed",
    icon: "Image",
    group: "creative",
    route: "/media?view=photos",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    emoji: "🖼️",
  },
  {
    id: "videos",
    label: "Videos",
    description: "YouTube theater feed, video scanner, and player queue",
    icon: "Video",
    group: "creative",
    route: "/media?view=videos",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    emoji: "📺",
  },

  // ── Infrastructure ──
  {
    id: "hardware",
    label: "Hardware",
    description: "Your devices, exo cluster, and home compute fleet",
    icon: "Cpu",
    group: "infrastructure",
    route: "/hardware",
    defaultEnabled: false,
    onboardingSuggested: false,
    status: "active",
    tables: ["hardware_projects"],
    emoji: "🔧",
  },
];

/** Get modules grouped by their navigation group */
export function getModulesByGroup() {
  const groups = {
    life: { label: "Life & Identity", color: "var(--color-section-identity)", modules: [] as RudderModule[] },
    operations: { label: "Operations", color: "var(--color-section-ops)", modules: [] as RudderModule[] },
    creative: { label: "Creative Engines", color: "var(--color-section-creative)", modules: [] as RudderModule[] },
    infrastructure: { label: "Infrastructure", color: "var(--color-section-infra)", modules: [] as RudderModule[] },
  };

  for (const mod of MODULE_REGISTRY) {
    groups[mod.group].modules.push(mod);
  }

  return groups;
}

/** Get default enabled module IDs */
export function getDefaultEnabledModules(): string[] {
  return MODULE_REGISTRY.filter((m) => m.defaultEnabled).map((m) => m.id);
}

/** Get module by ID */
export function getModuleById(id: string): RudderModule | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}
