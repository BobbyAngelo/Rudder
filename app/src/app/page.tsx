"use client";

import { ShieldCheck, Plus, Settings, X, Check } from "lucide-react";
import { WidgetAgenda } from "@/components/widgets/WidgetAgenda";
import { WidgetAsk } from "@/components/widgets/WidgetAsk";
import { WidgetOrbit } from "@/components/widgets/WidgetOrbit";
import { WidgetHabits } from "@/components/widgets/WidgetHabits";
import { WidgetHealth } from "@/components/widgets/WidgetHealth";
import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════
   Mission Control — a modular bento dashboard over your local memory.
   ═══════════════════════════════════════════════════════ */

const ALL_WIDGETS = [
  { id: "ask", label: "Ask Rudder", desc: "Search your local memory, with citations", component: WidgetAsk },
  { id: "agenda", label: "Agenda & Tasks", desc: "Upcoming schedule & quick checklist", component: WidgetAgenda },
  { id: "orbit", label: "Knowledge Orbit", desc: "Your memory graph at a glance", component: WidgetOrbit },
  { id: "habits", label: "Habits Checklist", desc: "Interactive checklist of active habits", component: WidgetHabits },
  { id: "health", label: "Biometrics", desc: "Steps, sleep, and heart-rate telemetry", component: WidgetHealth },
];

const DEFAULT_WIDGETS = ["ask", "agenda", "orbit", "health"];

export default function DashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [activeWidgets, setActiveWidgets] = useState<string[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("rudder_dashboard_widgets");
    if (saved) {
      try { setActiveWidgets(JSON.parse(saved)); } catch { setActiveWidgets(DEFAULT_WIDGETS); }
    } else {
      setActiveWidgets(DEFAULT_WIDGETS);
    }
  }, []);

  const toggleWidget = (id: string) => {
    const next = activeWidgets.includes(id) ? activeWidgets.filter((w) => w !== id) : [...activeWidgets, id];
    setActiveWidgets(next);
    localStorage.setItem("rudder_dashboard_widgets", JSON.stringify(next));
  };

  return (
    <div className="page-container flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-8 animate-fade-in pt-8 pb-16">

        {/* ── Greeting ── */}
        <header className="flex items-center justify-between border-b pb-6" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
              <ShieldCheck size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-[-0.03em]" style={{ color: "var(--color-text-primary)" }}>
              {greeting}. Your memory is local and secure.
            </h1>
          </div>
          <button
            onClick={() => setIsManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono uppercase tracking-wider transition-all hover:bg-white/5"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <Settings size={12} /> Manage
          </button>
        </header>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 auto-rows-[160px]">
          {activeWidgets.map((widgetId) => {
            const conf = ALL_WIDGETS.find((w) => w.id === widgetId);
            if (!conf) return null;
            const Widget = conf.component;
            return <Widget key={widgetId} />;
          })}

          <button
            onClick={() => setIsManagerOpen(true)}
            className="col-span-2 md:col-span-2 row-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 mb-0.5"><Plus size={16} /></div>
            <span className="text-[10px] font-mono uppercase tracking-wider">Configure widgets</span>
          </button>
        </div>
      </div>

      {/* ── Widget manager ── */}
      {isManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border flex flex-col p-6 animate-scale-up" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-accent" />
                <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Manage Widgets</h3>
              </div>
              <button onClick={() => setIsManagerOpen(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--color-text-dim)" }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[350px] pr-1">
              {ALL_WIDGETS.map((widget) => {
                const active = activeWidgets.includes(widget.id);
                return (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl transition-all border text-left hover:bg-white/5"
                    style={{ background: active ? "var(--color-surface-elevated)" : "transparent", borderColor: active ? "var(--color-accent)" : "var(--color-border)" }}
                  >
                    <div>
                      <div className="text-[12px] font-bold" style={{ color: "var(--color-text-primary)" }}>{widget.label}</div>
                      <div className="text-[10px] opacity-50 mt-0.5" style={{ color: "var(--color-text-dim)" }}>{widget.desc}</div>
                    </div>
                    <div className="w-5 h-5 rounded-full border flex items-center justify-center transition-all" style={{ borderColor: active ? "var(--color-accent)" : "var(--color-border)", background: active ? "var(--color-accent)" : "transparent" }}>
                      {active && <Check size={10} className="text-black" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setIsManagerOpen(false)} className="w-full py-2.5 bg-accent text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl mt-6 hover:scale-[1.01] transition-transform">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
