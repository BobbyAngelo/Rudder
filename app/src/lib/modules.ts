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
    defaultEnabled: false,
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
    defaultEnabled: true,
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
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["health_metrics", "health_records", "health_providers"],
    emoji: "❤️",
  },

  // ── Operations ──
  {
    id: "memory",
    label: "Memory",
    description: "Everything Rudder remembers — browse and ask your local memory",
    icon: "Brain",
    group: "operations",
    route: "/memory",
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    tables: ["chunk_index"],
    emoji: "🧠",
  },
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
    defaultEnabled: true,
    onboardingSuggested: true,
    status: "active",
    emoji: "🕸️",
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
