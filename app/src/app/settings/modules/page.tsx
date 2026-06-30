"use client";

import { useState, useEffect } from "react";
import { MODULE_REGISTRY, getModulesByGroup, type RudderModule } from "@/lib/modules";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ModuleManagerPage() {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const groups = getModulesByGroup();

  // Load current preferences
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          setEnabledModules(data.enabled_modules || []);
        }
      } catch {
        // Use defaults on failure
        setEnabledModules(MODULE_REGISTRY.filter((m) => m.defaultEnabled).map((m) => m.id));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function toggleModule(id: string) {
    const updated = enabledModules.includes(id)
      ? enabledModules.filter((m) => m !== id)
      : [...enabledModules, id];

    setEnabledModules(updated);
    setSaving(true);

    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_modules: updated }),
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="animate-pulse space-y-4">
            <div className="h-8 rounded" style={{ background: "var(--color-surface-elevated)", width: "30%" }} />
            <div className="h-4 rounded" style={{ background: "var(--color-surface-elevated)", width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content space-y-8 animate-fade-in" style={{ maxWidth: 680 }}>

        {/* ── Header ── */}
        <header className="space-y-1">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-[12px] mb-3 transition-opacity hover:opacity-80"
            style={{ color: "var(--color-text-dim)" }}
          >
            <ArrowLeft size={12} /> Settings
          </Link>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Modules
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Manage modules to expand your engine. The system will automatically recommend modules as you connect more data sources.
          </p>
        </header>

        {/* ── Summary ── */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
            <span className="font-medium">{enabledModules.length}</span>
            <span style={{ color: "var(--color-text-dim)" }}> of {MODULE_REGISTRY.length} modules enabled</span>
          </span>
          {lastSaved && (
            <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>
              {saving ? "Saving..." : `Saved ${lastSaved}`}
            </span>
          )}
        </div>

        {/* ── Module Groups ── */}
        <div className="space-y-8">
          {Object.entries(groups).map(([key, group]) => (
            <div key={key}>
              <h3
                className="text-[11px] font-medium uppercase tracking-wider mb-3 px-1"
                style={{ color: group.color, opacity: 0.8 }}
              >
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.modules.map((mod) => (
                  <ModuleRow
                    key={mod.id}
                    module={mod}
                    enabled={enabledModules.includes(mod.id)}
                    onToggle={() => toggleModule(mod.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Module Toggle Row ── */
function ModuleRow({
  module,
  enabled,
  onToggle,
}: {
  module: RudderModule;
  enabled: boolean;
  onToggle: () => void;
}) {
  const statusColors: Record<string, string> = {
    active: "#34d399",
    beta: "#fbbf24",
    scaffold: "#94a3b8",
    "coming-soon": "#64748b",
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
      style={{
        background: enabled ? "var(--color-surface-elevated)" : "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span className="text-lg shrink-0">{module.emoji}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {module.label}
          </span>
          {module.status !== "active" && (
            <span
              className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: `${statusColors[module.status]}15`,
                color: statusColors[module.status],
              }}
            >
              {module.status}
            </span>
          )}
        </div>
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-dim)" }}
        >
          {module.description}
        </span>
      </div>

      {/* Toggle switch */}
      <button
        onClick={onToggle}
        className="w-10 h-[22px] rounded-full p-0.5 transition-all duration-200 shrink-0"
        style={{
          background: enabled ? "var(--color-accent)" : "var(--color-border)",
        }}
      >
        <div
          className="w-[18px] h-[18px] rounded-full transition-all duration-200"
          style={{
            background: "#fff",
            transform: enabled ? "translateX(18px)" : "translateX(0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}
