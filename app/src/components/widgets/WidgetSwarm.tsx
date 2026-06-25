"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal, Loader2, Sparkles, Save, Check, AlertCircle } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface HarnessSummary {
  id: number;
  name: string;
  slug: string;
  target_ai: string;
}

export function WidgetSwarm() {
  const [harnesses, setHarnesses] = useState<HarnessSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Fetch harnesses on mount
  useEffect(() => {
    async function getHarnesses() {
      try {
        const res = await fetch("/api/harness");
        const data = await res.json();
        if (data.success && data.harnesses.length > 0) {
          setHarnesses(data.harnesses);
          setSelectedSlug(data.harnesses[0].slug);
        }
      } catch (err) {
        console.error("Failed to load harnesses:", err);
      }
    }
    getHarnesses();
  }, []);

  // Auto-scroll logs terminal
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSpawn = async () => {
    if (!selectedSlug || !prompt.trim()) return;

    setRunning(true);
    setLogs([]);
    setDraft("");
    setSavedId(null);
    setError(null);

    // Initial logs setup
    setLogs([
      `[System] Initializing Swarm Console...`,
      `[System] Target Harness Slug: ${selectedSlug}`,
      `[System] Writing Request: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"`
    ]);

    try {
      // Execute the multi-agent run
      const res = await fetch("/api/swarm/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, prompt })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLogs(data.logs || []);
        setDraft(data.draft || "");
      } else {
        const errMsg = data.error || "Swarm run failed.";
        setLogs(prev => [...prev, `[System Error] ${errMsg}`]);
        setError(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || "Failed to connect to API server.";
      setLogs(prev => [...prev, `[System Error] ${errMsg}`]);
      setError(errMsg);
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/swarm/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          content: draft,
          mode: "journal",
          tags: ["swarm", "draft"]
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSavedId(data.id);
        setCustomTitle("");
      } else {
        setError(data.error || "Failed to save draft.");
      }
    } catch (err: any) {
      setError(err.message || "Connection failed when saving draft.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WidgetCard title="Sovereign Swarm" icon={<Terminal size={14} />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
        
        {/* Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider text-text-dim">Context Harness</label>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              disabled={running}
              className="px-3 py-2 rounded-xl text-xs outline-none cursor-pointer text-[var(--color-text-primary)] border border-border bg-background/50 hover:bg-background/80 transition-all"
            >
              {harnesses.map((h) => (
                <option key={h.id} value={h.slug} className="bg-surface text-[var(--color-text-primary)]">
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider text-text-dim">Actions</label>
            <button
              onClick={handleSpawn}
              disabled={running || !prompt.trim() || !selectedSlug}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-98 ${
                running || !prompt.trim()
                  ? "bg-white/5 border border-white/5 text-text-dim cursor-not-allowed"
                  : "bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 shadow-md shadow-accent/5"
              }`}
            >
              {running ? (
                <>
                  <Loader2 size={12} className="animate-spin text-accent" />
                  <span>Swarm Active</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-accent" />
                  <span>Spawn Swarm</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Writing Prompt Textarea */}
        <div className="flex flex-col space-y-1 shrink-0">
          <label className="text-[10px] uppercase font-mono tracking-wider text-text-dim">Writing Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={running}
            rows={2}
            placeholder="Describe the content structure and context instructions..."
            className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all resize-none text-[var(--color-text-primary)] border border-border bg-background/30 hover:border-accent/10 focus:border-accent/30"
          />
        </div>

        {/* Execution Logs Terminal */}
        {(running || logs.length > 0) && (
          <div className="flex-1 flex flex-col min-h-0 space-y-1 shrink-0">
            <label className="text-[10px] uppercase font-mono tracking-wider text-text-dim flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Console Logs
            </label>
            <div
              className="flex-1 overflow-y-auto p-3 rounded-xl border border-white/5 font-mono text-[10px] leading-relaxed max-h-[140px] space-y-1.5 select-text"
              style={{ background: "rgba(0,0,0,0.85)" }}
            >
              {logs.map((logLine, idx) => {
                let color = "text-text-dim";
                if (logLine.startsWith("[System]")) color = "text-accent";
                else if (logLine.startsWith("[Researcher]")) color = "text-blue-400";
                else if (logLine.startsWith("[Writer]")) color = "text-yellow-400";
                else if (logLine.startsWith("[Editor]")) color = "text-green-400";
                else if (logLine.startsWith("[System Error]")) color = "text-red-400";

                return (
                  <div key={idx} className={`${color} whitespace-pre-wrap`}>
                    {logLine}
                  </div>
                );
              })}
              <div ref={consoleEndRef} />
            </div>
          </div>
        )}

        {/* Polished Draft Output Pane */}
        {draft && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2.5 border-t border-border pt-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-accent font-bold">Polished Output Draft</span>
              <span className="text-[9px] font-mono text-text-dim">
                {draft.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            
            <div
              className="flex-1 overflow-y-auto p-3.5 rounded-xl border border-border text-xs leading-relaxed max-h-[160px] text-[var(--color-text-primary)] select-text"
              style={{ background: "var(--color-surface-elevated)" }}
            >
              {draft}
            </div>

            {/* Saving actions */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Optional draft title..."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                disabled={saving || !!savedId}
                className="flex-1 px-3 py-2 rounded-xl text-xs border border-border bg-background/30 text-[var(--color-text-primary)] outline-none focus:border-accent/30"
              />
              <button
                onClick={handleSave}
                disabled={saving || !!savedId}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  savedId
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-accent/15 border border-accent/20 text-accent hover:bg-accent/25"
                }`}
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : savedId ? (
                  <>
                    <Check size={12} />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    <span>Save to Journal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
