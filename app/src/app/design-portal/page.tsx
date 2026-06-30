"use client";

import { useState } from "react";
import {
  Sparkles, Cpu, Layers, Terminal, ChevronRight, Check,
  Play, Shield, Send, Command
} from "lucide-react";

interface ThemeConfig {
  id: string;
  name: string;
  subtitle: string;
  vars: Record<string, string>;
}

// Define the 4 custom theme configurations (2 Dark, 2 Light)
const THEMES: ThemeConfig[] = [
  {
    id: "rudder",
    name: "Rudder Dark",
    subtitle: "Sovereign pitch-black canvas & glowing emerald accent",
    vars: {
      "--color-background": "#050507",
      "--color-surface": "#0a0a0c",
      "--color-surface-elevated": "#121215",
      "--color-surface-hover": "#1a1a20",
      "--color-border": "rgba(52, 211, 153, 0.15)",
      "--color-border-hover": "rgba(52, 211, 153, 0.3)",
      "--color-accent": "#34d399",
      "--color-accent-dim": "rgba(52, 211, 153, 0.08)",
      "--color-accent-hover": "#6ee7b7",
      "--color-accent-text": "#050507",
      "--color-text-primary": "#f4f4f5",
      "--color-text-secondary": "#a1a1aa",
      "--color-text-muted": "#71717a",
      "--color-text-dim": "#52525b",
      "--color-sidebar-bg": "#050507",
      "--color-sidebar-border": "rgba(255, 255, 255, 0.04)",
      "--color-glass-bg": "rgba(10, 10, 12, 0.5)",
      "--color-glass-border": "rgba(52, 211, 153, 0.1)",
      "--color-glass-shadow": "rgba(0, 0, 0, 0.5)"
    }
  },
  {
    id: "linear",
    name: "Linear Dark",
    subtitle: "Steel slate base, royal accents & keyboard borders",
    vars: {
      "--color-background": "#0c0c14",
      "--color-surface": "#161624",
      "--color-surface-elevated": "#1e1e32",
      "--color-surface-hover": "#25253d",
      "--color-border": "rgba(95, 87, 255, 0.2)",
      "--color-border-hover": "rgba(95, 87, 255, 0.35)",
      "--color-accent": "#5f57ff",
      "--color-accent-dim": "rgba(95, 87, 255, 0.08)",
      "--color-accent-hover": "#7c75ff",
      "--color-accent-text": "#f7f8f8",
      "--color-text-primary": "#f7f8f8",
      "--color-text-secondary": "#b4bcd0",
      "--color-text-muted": "#8a93a6",
      "--color-text-dim": "#5a6275",
      "--color-sidebar-bg": "#08080f",
      "--color-sidebar-border": "rgba(95, 87, 255, 0.1)",
      "--color-glass-bg": "rgba(22, 22, 36, 0.55)",
      "--color-glass-border": "rgba(95, 87, 255, 0.15)",
      "--color-glass-shadow": "rgba(0, 0, 0, 0.4)"
    }
  },
  {
    id: "claude",
    name: "Alabaster Warm",
    subtitle: "Warm sandstone grey sidebar, off-white bento canvas & terracotta accent",
    vars: {
      "--color-background": "#f5f2eb",
      "--color-surface": "#ffffff",
      "--color-surface-elevated": "#eae7e0",
      "--color-surface-hover": "#dfdad2",
      "--color-border": "rgba(200, 90, 23, 0.12)",
      "--color-border-hover": "rgba(200, 90, 23, 0.28)",
      "--color-accent": "#c85a17",
      "--color-accent-dim": "rgba(200, 90, 23, 0.06)",
      "--color-accent-hover": "#a23e0f",
      "--color-accent-text": "#ffffff",
      "--color-text-primary": "#1f1d1b",
      "--color-text-secondary": "#635f59",
      "--color-text-muted": "#8c867e",
      "--color-text-dim": "#aba398",
      "--color-sidebar-bg": "#beb5a8",
      "--color-sidebar-border": "rgba(0, 0, 0, 0.08)",
      "--color-sidebar-text-primary": "#1f1d1b",
      "--color-sidebar-text-secondary": "#3d3a35",
      "--color-sidebar-text-muted": "#5e5a52",
      "--color-sidebar-text-dim": "#736e65",
      "--color-sidebar-surface-elevated": "#dfdad2",
      "--color-sidebar-surface-hover": "#d2cac0",
      "--color-glass-bg": "rgba(255, 255, 255, 0.75)",
      "--color-glass-border": "rgba(0, 0, 0, 0.06)",
      "--color-glass-shadow": "rgba(31, 29, 27, 0.04)"
    }
  },
  {
    id: "alabaster_dark",
    name: "Alabaster Dark",
    subtitle: "Warm clay black, earth charcoal & glowing terracotta highlights",
    vars: {
      "--color-background": "#141210",
      "--color-surface": "#1b1815",
      "--color-surface-elevated": "#24201c",
      "--color-surface-hover": "#2e2924",
      "--color-border": "rgba(217, 116, 56, 0.18)",
      "--color-border-hover": "rgba(217, 116, 56, 0.35)",
      "--color-accent": "#d97438",
      "--color-accent-dim": "rgba(217, 116, 56, 0.08)",
      "--color-accent-hover": "#f48c4f",
      "--color-accent-text": "#141210",
      "--color-text-primary": "#f7f4f0",
      "--color-text-secondary": "#beb5a8",
      "--color-text-muted": "#8e8374",
      "--color-text-dim": "#6b6053",
      "--color-sidebar-bg": "#110f0e",
      "--color-sidebar-border": "rgba(217, 116, 56, 0.1)",
      "--color-glass-bg": "rgba(27, 24, 21, 0.55)",
      "--color-glass-border": "rgba(217, 116, 56, 0.15)",
      "--color-glass-shadow": "rgba(0, 0, 0, 0.5)"
    }
  },
  {
    id: "apple",
    name: "Apple Light",
    subtitle: "SF system blue & stark white high-contrast layers",
    vars: {
      "--color-background": "#f5f5f7",
      "--color-surface": "#ffffff",
      "--color-surface-elevated": "#fbfbfd",
      "--color-surface-hover": "#e8e8ed",
      "--color-border": "rgba(0, 0, 0, 0.08)",
      "--color-border-hover": "rgba(0, 0, 0, 0.15)",
      "--color-accent": "#0071e3",
      "--color-accent-dim": "rgba(0, 113, 227, 0.06)",
      "--color-accent-hover": "#005bb5",
      "--color-accent-text": "#ffffff",
      "--color-text-primary": "#1d1d1f",
      "--color-text-secondary": "#86868b",
      "--color-text-muted": "#a1a1a6",
      "--color-text-dim": "#c1c1c6",
      "--color-sidebar-bg": "#ececed",
      "--color-sidebar-border": "rgba(0, 0, 0, 0.05)",
      "--color-glass-bg": "rgba(255, 255, 255, 0.75)",
      "--color-glass-border": "rgba(0, 0, 0, 0.06)",
      "--color-glass-shadow": "rgba(0, 0, 0, 0.06)"
    }
  }
];

export default function DesignPortal() {
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [activeTab, setActiveTab] = useState("colors");
  const [testPulse, setTestPulse] = useState(true);
  const [inputText, setInputText] = useState("");

  const applyThemeStyle = (themeVars: Record<string, string>) => {
    return themeVars as React.CSSProperties;
  };

  return (
    <div 
      className="min-h-screen p-8 transition-colors duration-500 flex flex-col items-center" 
      style={{
        ...applyThemeStyle(selectedTheme.vars),
        backgroundColor: "var(--color-background)",
        color: "var(--color-text-primary)"
      }}
    >
      <div className="w-full max-w-5xl space-y-10 animate-fade-in py-8">
        
        {/* Portal Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b pb-6" style={{ borderColor: "var(--color-border)" }}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 0 10px var(--color-accent)" }}></span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Rudder Design Portal</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Theme & Typography Playground</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">Test design choices, typography layers, and bento components interactively.</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 border flex items-center gap-1.5 ${
                  selectedTheme.id === theme.id 
                    ? "bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-text-primary)]" 
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {selectedTheme.id === theme.id && <Check size={12} className="text-[var(--color-accent)]" />}
                {theme.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </header>

        {/* Dynamic Theme Banner */}
        <div className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel" style={{ borderColor: "var(--color-border)" }}>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">Active Skin: {selectedTheme.name}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{selectedTheme.subtitle}</p>
          </div>
          <div className="flex gap-2 font-mono text-[9px] text-[var(--color-text-muted)] uppercase">
            <span className="px-2.5 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">BG: {selectedTheme.vars["--color-background"]}</span>
            <span className="px-2.5 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">ACCENT: {selectedTheme.vars["--color-accent"]}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div 
          className="flex gap-1.5 p-1 rounded-xl border w-fit transition-colors duration-300"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          {["colors", "typography", "bento", "animations"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all border ${
                activeTab === tab 
                  ? "bg-[var(--color-surface-elevated)] border-[var(--color-border-hover)] text-[var(--color-text-primary)]" 
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content 1: Colors */}
        {activeTab === "colors" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-6">
              <h2 className="text-lg font-bold tracking-tight">System Palette</h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Rudder maps system components to unified layout layers. Swapping themes dynamically transforms all bento components.
              </p>
              
              <div className="space-y-2.5">
                <ColorBox label="Background" desc="Root canvas backdrop" color="var(--color-background)" border="var(--color-border)" />
                <ColorBox label="Surface" desc="Standard bento card containers" color="var(--color-surface)" border="var(--color-border)" />
                <ColorBox label="Elevated" desc="Modal panels & active nodes" color="var(--color-surface-elevated)" border="var(--color-border)" />
                <ColorBox label="Accent" desc="Primary operational action color" color="var(--color-accent)" border="var(--color-border)" />
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-lg font-bold tracking-tight">Section Accents</h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Functional areas of your life ledger receive specific desaturated color branding for clean visual grouping.
              </p>
              
              <div className="space-y-2.5">
                <ColorBox label="Identity / The Who" desc="Public presence, professional timeline" color="var(--color-section-identity, #f59e0b)" border="var(--color-border)" />
                <ColorBox label="Health / Quantified" desc="Sleep metrics, HRV indicators, fitness" color="var(--color-section-health, #34d399)" border="var(--color-border)" />
                <ColorBox label="Ops / Orchestration" desc="Swarm consoles, task lists, calendar" color="var(--color-section-ops, #3b82f6)" border="var(--color-border)" />
                <ColorBox label="Creative / Zenith" desc="Distraction-free writing, outlining" color="var(--color-section-creative, #a78bfa)" border="var(--color-border)" />
                <ColorBox label="Infrastructure" desc="Local servers, compute fleets" color="var(--color-section-infra, #f472b6)" border="var(--color-border)" />
              </div>
            </div>
          </div>
        )}

        {/* Tab content 2: Typography */}
        {activeTab === "typography" && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Sans Interface */}
              <div className="p-6 rounded-2xl border" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <span className="text-[9px] font-mono text-[var(--color-text-dim)] uppercase tracking-wider">01 / Modern Interface</span>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-1 mb-3">Sans-Serif: Inter</h4>
                <div className="space-y-3 font-sans">
                  <div className="text-2xl font-extrabold tracking-[-0.04em]">Tracking Heading</div>
                  <div className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    Used for core dashboard metrics, buttons, settings, and navigation layout. Clean and highly legible.
                  </div>
                </div>
              </div>

              {/* Literary Serif */}
              <div className="p-6 rounded-2xl border" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <span className="text-[9px] font-mono text-[var(--color-text-dim)] uppercase tracking-wider">02 / Literary Ledger</span>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-1 mb-3">Serif: Playfair Display</h4>
                <div className="space-y-3 font-serif">
                  <div className="text-2xl font-bold italic">Thinking Garden</div>
                  <div className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    Used exclusively for human-authored thought journals, biographies, and memoirs. Adds warmth and editorial presence.
                  </div>
                </div>
              </div>

              {/* Monospace System */}
              <div className="p-6 rounded-2xl border" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <span className="text-[9px] font-mono text-[var(--color-text-dim)] uppercase tracking-wider">03 / Telemetry & Code</span>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-1 mb-3">Mono: JetBrains Mono</h4>
                <div className="space-y-3 font-mono">
                  <div className="text-sm font-bold tracking-tight">127.0.0.1:52415</div>
                  <div className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                    Used for cluster metrics, system timestamps, logs, and stable hash IDs. Precise, readable database indexing.
                  </div>
                </div>
              </div>

            </div>

            {/* Typography Hierarchy Specimen */}
            <div className="p-8 rounded-2xl border" style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}>
              <span className="text-[9px] font-mono text-[var(--color-text-dim)] uppercase tracking-wider">Interactive Type Hierarchy</span>
              <div className="mt-6 space-y-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-[-0.04em]">This is a Level 1 Heading (3xl, extrabold)</h1>
                  <p className="text-xs text-[var(--color-text-dim)] mt-0.5">sans-serif · tracking-tight</p>
                </div>
                <div className="h-px" style={{ backgroundColor: "var(--color-border)" }} />
                <div>
                  <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">This is a Level 2 Heading (xl, bold)</h2>
                  <p className="text-xs text-[var(--color-text-dim)] mt-0.5">sans-serif</p>
                </div>
                <div className="h-px" style={{ backgroundColor: "var(--color-border)" }} />
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-accent)]">Section Label Header (sm, semibold, uppercase, accent)</h3>
                  <p className="text-xs text-[var(--color-text-dim)] mt-0.5">sans-serif · uppercase · tracking-wider</p>
                </div>
                <div className="h-px" style={{ backgroundColor: "var(--color-border)" }} />
                <div>
                  <blockquote className="font-serif italic text-lg text-[var(--color-text-secondary)] pl-4 border-l-2" style={{ borderColor: "var(--color-accent)" }}>
                    &quot;The only data that can&apos;t leak is the data that never leaves your hands. Keep your thoughts sovereign.&quot;
                  </blockquote>
                  <p className="text-xs text-[var(--color-text-dim)] mt-1.5">serif-literary · italic · quote block</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab content 3: Bento Grid Cards */}
        {activeTab === "bento" && (
          <div className="space-y-8 animate-fade-in">
            <p className="text-xs text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
              Below is a bento grid mockup displaying live widgets running your selected theme variables. 
              Hover over cards to see the glow shadows and border highlight transitions.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Ask Widget (Large) */}
              <div className="md:col-span-2 p-6 rounded-2xl border glow-card glass-panel" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Command size={14} style={{ color: "var(--color-accent)" }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Ask Rudder</span>
                </div>
                <h3 className="text-sm font-semibold mb-2">Query Your Life Ledger</h3>
                <div className="relative mt-4">
                  <input 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Where did I have coffee in Buenos Aires last month?" 
                    className="modal-input pr-10 pl-3 py-2.5 font-sans"
                  />
                  <button className="absolute right-2 top-2 p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all">
                    <Send size={12} />
                  </button>
                </div>
              </div>

              {/* Status Fleet Widget (Small) */}
              <div className="p-6 rounded-2xl border glow-card glass-panel flex flex-col justify-between" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu size={14} style={{ color: "var(--color-accent)" }} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Fleet Status</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Compute Swarm</h3>
                </div>
                <div className="space-y-2 mt-4">
                  <div 
                    className="flex justify-between items-center text-xs p-1.5 rounded border"
                    style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Local Node
                    </span>
                    <span className="font-mono text-[9px] text-[var(--color-text-dim)]">Ollama Online</span>
                  </div>
                  <div 
                    className="flex justify-between items-center text-xs p-1.5 rounded border"
                    style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> Compute Node
                    </span>
                    <span className="font-mono text-[9px] text-[var(--color-text-dim)]">5.2 Tflops</span>
                  </div>
                </div>
              </div>

              {/* Writing Garden Widget (Small) */}
              <div className="p-6 rounded-2xl border glow-card glass-panel flex flex-col justify-between" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={14} style={{ color: "var(--color-section-creative)" }} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Thinking Garden</span>
                  </div>
                  <h3 className="text-sm font-semibold font-serif italic mb-1">Buenos Aires Reflections</h3>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] italic line-clamp-3 mt-3">
                  Palermo is quiet in the mornings. Sitting under the jacaranda trees, writing on the local device, I felt the connection of memory...
                </p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-600 bg-emerald-500/5">🌿 Garden protected</span>
                  <ChevronRight size={14} />
                </div>
              </div>

              {/* Daily Agenda Widget (Large) */}
              <div className="md:col-span-2 p-6 rounded-2xl border glow-card glass-panel" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Layers size={14} style={{ color: "var(--color-accent)" }} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Orchestrator Logs</span>
                  </div>
                  <span className="text-[9px] font-mono text-[var(--color-text-dim)]">4 commitments surface</span>
                </div>
                <div className="space-y-2 mt-4">
                  <AgendaItem time="09:00" title="Review biometrics report" category="Health" tag="Quantified" />
                  <AgendaItem time="11:30" title="Compose agency strategy brief" category="Work" tag="Ops" />
                  <AgendaItem time="14:00" title="Hardware enclosure 3D printing run" category="Hardware" tag="Infra" />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab content 4: Animations & Micro-Interactions */}
        {activeTab === "animations" && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Interactive buttons */}
              <div 
                className="p-6 rounded-2xl border space-y-6" 
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <h3 className="text-sm font-semibold">Active Push Scale Feedback</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Buttons instantly scale down slightly on click (`scale-[0.97]`) to give tight tactile feedback. Test them below:
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary flex items-center gap-2">
                    <Play size={12} fill="currentColor" /> Primary Action
                  </button>
                  <button className="btn-ghost flex items-center gap-2 border border-[var(--color-border)]">
                    <Shield size={12} /> Secondary Action
                  </button>
                  <button 
                    onClick={() => setTestPulse(!testPulse)}
                    className="px-3.5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Toggle Pulse
                  </button>
                </div>
              </div>

              {/* Telemetry log trace terminal */}
              <div className="p-6 rounded-2xl border dot-matrix space-y-4 font-mono text-xs text-emerald-400" style={{ borderColor: "rgba(52, 211, 153, 0.2)" }}>
                <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
                  <span className="text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal size={12} /> telemetry_daemon.log
                  </span>
                  {testPulse ? (
                    <span className="flex items-center gap-1 text-[9px] text-green-400 glow-text-green">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span> LOGGING
                    </span>
                  ) : (
                    <span className="text-[9px] text-amber-500">PAUSED</span>
                  )}
                </div>
                
                <div className="space-y-1.5 text-[10px] leading-relaxed select-none">
                  <div>[14:50:36] INGEST: parsed 12 events from Apple Health (.xml)</div>
                  <div>[14:50:39] RAG: embedding 4 new chunks via nomic-embed-text</div>
                  <div className="text-yellow-400/90">[14:50:41] FLEET: remote compute mini-node host offline - retrying...</div>
                  {testPulse && (
                    <div className="text-emerald-300/80 animate-pulse">[14:50:43] SYNC: reality_nodes synced successfully (144 entities tracked)</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ColorBox({ label, desc, color, border }: { label: string; desc: string; color: string; border: string }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border" style={{ borderColor: border, backgroundColor: "var(--color-surface)" }}>
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{desc}</div>
      </div>
      <div className="w-8 h-8 rounded-lg border border-[var(--color-border)]" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}20` }}></div>
    </div>
  );
}

function AgendaItem({ time, title, tag }: { time: string; title: string; category: string; tag: string }) {
  return (
    <div 
      className="flex items-center justify-between p-2.5 rounded-xl border text-xs"
      style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{time}</span>
        <span className="font-sans text-[var(--color-text-primary)] font-medium">{title}</span>
      </div>
      <span 
        className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        {tag}
      </span>
    </div>
  );
}
