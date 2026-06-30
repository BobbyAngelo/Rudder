"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Users,
  Heart,
  BookOpen,
  DollarSign,
  Briefcase,
  Globe,
  Lightbulb,
  PenTool,
  Film,
  Workflow,
  Cpu,
  BarChart3,
  BookMarked,
  CheckSquare,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  Trophy,
  Settings,
  Plus,
  Target,
  Image,
  Video,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import { MODULE_REGISTRY, getModulesByGroup, type RudderModule } from "@/lib/modules";

/* ═══════════════════════════════════════════════════════
   Icon Map — maps string names from the registry to components
   ═══════════════════════════════════════════════════════ */
const ICON_MAP: Record<string, ComponentType<{ size?: number | string }>> = {
  User, Users, Heart, BookOpen, DollarSign, Briefcase,
  Globe, Lightbulb, PenTool, Film, Workflow, Cpu,
  BarChart3, BookMarked, Trophy, CheckSquare, CalendarDays,
  Target, Image, Video,
};

function getIcon(name: string, size = 15) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return null;
  return <IconComponent size={size} />;
}

/* ═══════════════════════════════════════════════════════
   Navigation Groups — built dynamically from module registry
   ═══════════════════════════════════════════════════════ */
interface NavGroup {
  label: string;
  color: string;
  modules: RudderModule[];
}

function buildNavGroups(enabledModules: string[]): NavGroup[] {
  const groups = getModulesByGroup();
  const result: NavGroup[] = [];

  for (const [, group] of Object.entries(groups)) {
    const enabledInGroup = group.modules.filter((m) => enabledModules.includes(m.id));
    if (enabledInGroup.length > 0) {
      result.push({
        label: group.label,
        color: group.color,
        modules: enabledInGroup,
      });
    }
  }

  return result;
}

export function Sidebar() {
  const pathname = usePathname();
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");

  // Load preferences
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          setEnabledModules(data.enabled_modules || []);
          if (data.theme) {
            setTheme(data.theme);
            if (data.theme === "light") {
              document.documentElement.classList.add("light");
            } else {
              document.documentElement.classList.remove("light");
            }
          }
        } else {
          // Fallback: show defaults if API not ready yet
          setEnabledModules(MODULE_REGISTRY.filter((m) => m.defaultEnabled).map((m) => m.id));
        }
      } catch {
        setEnabledModules(MODULE_REGISTRY.filter((m) => m.defaultEnabled).map((m) => m.id));
      }
      setLoading(false);
    }
    loadPrefs();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme })
      });
      window.dispatchEvent(new CustomEvent("theme-change", { detail: nextTheme }));
    } catch (err) {
      console.error("Failed to save theme preference", err);
    }
  };

  // Build navigation from enabled modules
  const navGroups = buildNavGroups(enabledModules);

  return (
    <>
    <aside
      className="w-[240px] shrink-0 flex flex-col h-screen border-r overflow-hidden"
      style={{
        background: "var(--color-sidebar-bg)",
        borderColor: "var(--color-sidebar-border)",
      }}
    >
      {/* ── Header ── */}
      <div className="h-14 flex items-center px-4 shrink-0 border-b" style={{ borderColor: "var(--color-sidebar-border)" }}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
            style={{
              background: "var(--color-accent-dim)",
              color: "var(--color-accent)",
              border: "1px solid rgba(52, 211, 153, 0.2)",
            }}
          >
            R
          </div>
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Rudder
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>
            1.0
          </span>
        </Link>
        <div className="flex-1" />
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
          style={{ color: "var(--color-text-dim)" }}
          title="Search (⌘K)"
        >
          <Search size={14} />
        </button>
      </div>

      {/* ── Dashboard Link ── */}
      <div className="px-2 pt-3 pb-1">
        <SidebarLink
          href="/"
          label="Mission Control"
          icon={<LayoutDashboard size={15} />}
          active={pathname === "/"}
        />
      </div>

      {/* ── Navigation Groups (data-driven) ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <div className="px-2 py-4">
            <div className="h-3 rounded animate-pulse mb-2" style={{ background: "var(--color-surface-elevated)", width: "60%" }} />
            <div className="h-3 rounded animate-pulse mb-2" style={{ background: "var(--color-surface-elevated)", width: "80%" }} />
            <div className="h-3 rounded animate-pulse" style={{ background: "var(--color-surface-elevated)", width: "50%" }} />
          </div>
        ) : (
          <>
            {navGroups.map((group) => (
              <CollapsibleGroup
                key={group.label}
                label={group.label}
                color={group.color}
                defaultOpen
              >
                {group.modules.map((mod) => (
                  <SidebarLink
                    key={mod.route}
                    href={mod.route}
                    label={mod.label}
                    icon={getIcon(mod.icon)}
                    active={pathname === mod.route || pathname.startsWith(mod.route + "/")}
                  />
                ))}
              </CollapsibleGroup>
            ))}

            {/* ── Manage Modules ── */}
            <div className="pt-2 mt-2 border-t" style={{ borderColor: "var(--color-sidebar-border)" }}>
              <SidebarLink
                href="/settings/modules"
                label="Manage Modules"
                icon={<Plus size={15} />}
                active={pathname === "/settings/modules"}
                subtle
              />
            </div>
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div 
        className="shrink-0 border-t px-2 py-1.5 flex items-center justify-between gap-1" 
        style={{ borderColor: "var(--color-sidebar-border)" }}
      >
        <div className="flex-1">
          <SidebarLink
            href="/settings"
            label="Settings"
            icon={<Settings size={15} />}
            active={pathname.startsWith("/settings")}
          />
        </div>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
    </>
  );
}

/* ── Collapsible Group ── */
function CollapsibleGroup({
  label,
  color,
  defaultOpen = true,
  children,
}: {
  label: string;
  color: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-2 py-1.5 transition-colors rounded-md group"
      >
        <span style={{ color: "var(--color-text-dim)" }}>
          {isOpen ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
        </span>
        <span
          className="text-[13px] font-semibold uppercase tracking-wider transition-colors group-hover:opacity-100"
          style={{ color, opacity: 0.9 }}
        >
          {label}
        </span>
      </button>
      {isOpen && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

/* ── Sidebar Link ── */
function SidebarLink({
  href,
  label,
  icon,
  active,
  subtle,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-all duration-150 group ${
        active ? "font-medium" : ""
      }`}
      style={{
        background: active ? "var(--color-surface-elevated)" : "transparent",
        color: active
          ? "var(--color-text-primary)"
          : subtle
            ? "var(--color-text-muted)"
            : "var(--color-text-dim)",
        opacity: subtle && !active ? 0.7 : 1,
      }}
    >
      <span
        className="transition-colors"
        style={{
          color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
        }}
      >
        {icon}
      </span>
      <span className="group-hover:text-text-primary transition-colors">{label}</span>
    </Link>
  );
}
