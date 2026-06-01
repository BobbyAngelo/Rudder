"use client";

import { MessageSquare, MonitorPlay, Folders, User, ChevronRight, ShieldCheck, Plus, Settings, X, Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { WidgetAgenda } from "@/components/widgets/WidgetAgenda";
import { WidgetAsk } from "@/components/widgets/WidgetAsk";
import { WidgetFleet } from "@/components/widgets/WidgetFleet";
import { WidgetOrbit } from "@/components/widgets/WidgetOrbit";
import { WidgetHabits } from "@/components/widgets/WidgetHabits";
import { WidgetWriting } from "@/components/widgets/WidgetWriting";
import { WidgetHealth } from "@/components/widgets/WidgetHealth";
import { WidgetNCI } from "@/components/widgets/WidgetNCI";
import Link from "next/link";
import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════
   Modular Bento Box Dashboard
   Allows dynamic toggling and ordering of widgets.
   ═══════════════════════════════════════════════════════ */

const ALL_WIDGETS = [
  { id: "ask", label: "Ask Rudder", desc: "Sovereign AI reality nodes search", component: WidgetAsk },
  { id: "agenda", label: "Agenda & Tasks", desc: "Upcoming schedule & quick checklist", component: WidgetAgenda },
  { id: "fleet", label: "Fleet Status", desc: "Cluster hardware telemetry nodes", component: WidgetFleet },
  { id: "orbit", label: "Sovereign Orbit", desc: "Knowledge graph database metrics", component: WidgetOrbit },
  { id: "habits", label: "Habits Checklist", desc: "Interactive checklist of active habits", component: WidgetHabits },
  { id: "writing", label: "Zenith Writing", desc: "Goals tracking & recent draft shortcuts", component: WidgetWriting },
  { id: "health", label: "Biometrics Telemetry", desc: "Steps, sleep, and heart rate telemetry", component: WidgetHealth },
  { id: "nci", label: "NCI Reframing", desc: "Neuro-cognitive biometric alignment", component: WidgetNCI },
];

export default function DashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [stats, setStats] = useState<any>(null);
  
  // Modularity states
  const [activeWidgets, setActiveWidgets] = useState<string[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setStats).catch(() => {});
    
    // Load active widgets from localstorage
    const saved = localStorage.getItem("rudder_dashboard_widgets");
    if (saved) {
      try {
        setActiveWidgets(JSON.parse(saved));
      } catch {
        setActiveWidgets(["ask", "agenda", "fleet", "orbit"]);
      }
    } else {
      setActiveWidgets(["ask", "agenda", "fleet", "orbit"]);
    }
  }, []);

  const toggleWidget = (id: string) => {
    let nextWidgets;
    if (activeWidgets.includes(id)) {
      nextWidgets = activeWidgets.filter(w => w !== id);
    } else {
      nextWidgets = [...activeWidgets, id];
    }
    setActiveWidgets(nextWidgets);
    localStorage.setItem("rudder_dashboard_widgets", JSON.stringify(nextWidgets));
  };

  const ledgerCount = stats?.ledger_count ?? 0;
  const isExpert = ledgerCount > 500;
  const isNewUser = stats !== null && ledgerCount === 0;

  return (
    <div className="page-container flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-8 animate-fade-in pt-8 pb-16">
        
        {/* ── Security & Greeting ── */}
        <header className="flex items-center justify-between border-b pb-6" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
              <ShieldCheck size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-[-0.03em]" style={{ color: "var(--color-text-primary)" }}>
              {greeting}. The Vault is Secure.
            </h1>
          </div>

          <button 
            onClick={() => setIsManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono uppercase tracking-wider transition-all hover:bg-white/5 active:scale-98"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <Settings size={12} /> Manage Bento
          </button>
        </header>

        {/* ── Bento Box Grid ── */}
        {!isNewUser && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 auto-rows-[160px]">
            {activeWidgets.map(widgetId => {
              const widgetConf = ALL_WIDGETS.find(w => w.id === widgetId);
              if (!widgetConf) return null;
              const WidgetComponent = widgetConf.component;
              return <WidgetComponent key={widgetId} />;
            })}

            {/* Quick Add Bento Cell */}
            <button 
              onClick={() => setIsManagerOpen(true)}
              className="col-span-2 md:col-span-2 row-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-colors hover:bg-white/5" 
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 mb-0.5">
                <Plus size={16} />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider">Configure Dashboard Widgets</span>
            </button>
          </div>
        )}

        {/* ── Phase 1: THE WHO (Hidden for Experts) ── */}
        {!isExpert && (
          <div className={isNewUser ? "pt-4" : "pt-12"}>
            <section className="space-y-6">
              <div className="text-center space-y-2 mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-wider mb-2" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-primary)" }}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Phase 1: The Who
                </div>
                <h2 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: "var(--color-text-primary)" }}>
                  {isNewUser ? "Welcome. Let's Build Your Narrative." : "Continue Connecting Sources"}
                </h2>
                <p className="text-[14px] max-w-xl mx-auto" style={{ color: "var(--color-text-dim)" }}>
                  Before we track operations, we must understand the core. Connect your outward presence and memories to seed your personal knowledge graph.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Professional Story */}
                <div className="animate-fade-in stagger-1">
                  <SourceCard 
                    icon={<User size={18} className="text-blue-500" />}
                    title="Professional Story"
                    description="Connect your public resume and timeline."
                    examples="LinkedIn, Personal Website"
                    status="connect"
                    actionHref="/identity"
                  />
                </div>
                 
                {/* Visual Story */}
                <div className="animate-fade-in stagger-2">
                  <SourceCard 
                    icon={<MonitorPlay size={18} className="text-pink-500" />}
                    title="Visual Narrative"
                    description="Your aesthetic and public-facing media."
                    examples="Instagram, YouTube, Portfolio"
                    status="connect"
                    actionHref="/media"
                  />
                </div>

                {/* Memories & Archives */}
                <div className="animate-fade-in stagger-3">
                  <SourceCard 
                    icon={<Folders size={18} className="text-orange-500" />}
                    title="Memories & Archives"
                    description="Ingest photo libraries and personal hard drives."
                    examples="Google Photos Export, Local Media"
                    status="connect"
                    unlocks="Media Plugin"
                  />
                </div>

                {/* The Network */}
                <div className="animate-fade-in stagger-4">
                  <SourceCard 
                    icon={<MessageSquare size={18} className="text-green-500" />}
                    title="Your Network"
                    description="Analyze your relationship graph securely."
                    examples="iMessage (Local SQLite), WhatsApp"
                    status="active"
                    unlocks="People Plugin"
                  />
                </div>

              </div>
            </section>
          </div>
        )}

        {/* ── Future Phases Preview (Hidden for Experts) ── */}
        {!isExpert && (
          <div className="pt-12 border-t flex justify-center gap-8" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 opacity-100">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-blue-500 text-white">1</div>
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>The Who</span>
            </div>
            <ChevronRight size={16} className="mt-1" style={{ color: "var(--color-text-muted)" }} />
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}>2</div>
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-dim)" }}>The What</span>
            </div>
            <ChevronRight size={16} className="mt-1" style={{ color: "var(--color-text-muted)" }} />
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}>3</div>
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-dim)" }}>The How</span>
            </div>
          </div>
        )}

      </div>

      {/* ── Widget Manager Overlay Drawer ── */}
      {isManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md rounded-2xl border flex flex-col p-6 animate-scale-up"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-accent" />
                <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Manage Bento Widgets</h3>
              </div>
              <button 
                onClick={() => setIsManagerOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: "var(--color-text-dim)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[350px] pr-1">
              {ALL_WIDGETS.map(widget => {
                const active = activeWidgets.includes(widget.id);
                return (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl transition-all border text-left hover:bg-white/5"
                    style={{
                      background: active ? "var(--color-surface-elevated)" : "transparent",
                      borderColor: active ? "var(--color-accent)" : "var(--color-border)"
                    }}
                  >
                    <div>
                      <div className="text-[12px] font-bold" style={{ color: "var(--color-text-primary)" }}>{widget.label}</div>
                      <div className="text-[10px] opacity-50 mt-0.5" style={{ color: "var(--color-text-dim)" }}>{widget.desc}</div>
                    </div>
                    <div 
                      className="w-5 h-5 rounded-full border flex items-center justify-center transition-all"
                      style={{ 
                        borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                        background: active ? "var(--color-accent)" : "transparent"
                      }}
                    >
                      {active && <Check size={10} className="text-black font-bold" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setIsManagerOpen(false)}
              className="w-full py-2.5 bg-accent text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl mt-6 hover:scale-[1.01] transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Source Connection Card ── */
function SourceCard({
  icon,
  title,
  description,
  examples,
  status,
  actionHref,
  unlocks
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  examples: string;
  status: "active" | "connect";
  actionHref?: string;
  unlocks?: string;
}) {
  const isConnect = status === "connect";

  const CardWrap = ({ children }: { children: React.ReactNode }) => (
    <div className={`p-5 rounded-2xl transition-all border ${isConnect ? 'hover:bg-white/5 cursor-pointer' : ''}`} style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
      {children}
    </div>
  );

  const inner = (
    <CardWrap>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-surface-elevated)" }}>
            {icon}
          </div>
          <div>
            <h3 className="text-[14px] font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
            {unlocks && (
              <div className="text-[10px] font-mono uppercase tracking-wider mt-1" style={{ color: "var(--color-text-dim)" }}>
                Unlocks: <span style={{ color: "var(--color-text-muted)" }}>{unlocks}</span>
              </div>
            )}
          </div>
        </div>
        <Badge variant={isConnect ? "neutral" : "success"}>
          {isConnect ? "Connect" : "Active"}
        </Badge>
      </div>
      
      <p className="text-[13px] mb-2" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
      
      <div className="pt-3 border-t mt-3 flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-[11px] font-mono truncate" style={{ color: "var(--color-text-dim)" }}>
          {examples}
        </p>
        {isConnect && (
          <ChevronRight size={14} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>
    </CardWrap>
  );

  return actionHref ? <Link href={actionHref}>{inner}</Link> : inner;
}
