"use client";

import React, { useState, useEffect } from "react";
import { Brain, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetNCI() {
  const [lens, setLens] = useState<string>("witness");
  const [reflection, setReflection] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [biometrics, setBiometrics] = useState({
    hrvCurrent: 42,
    hrvBaseline: 45,
    sleepHours: 6.2,
    activeProject: "SLAB Pocket Firmware",
    recentReflections: "Feeling slightly overwhelmed by all these cluster node configuration details."
  });

  // Load live health stats if available to feed authentic metrics
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/health?action=dashboard");
        if (res.ok) {
          const data = await res.json();
          let sleep = 6.2;
          if (data.recentSleep && data.recentSleep.length > 0) {
            sleep = data.recentSleep[0].hours || 6.2;
          }
          setBiometrics(prev => ({
            ...prev,
            hrvCurrent: data.latestStats?.hrv || 42,
            sleepHours: sleep
          }));
        }
      } catch (err) {
        console.error("WidgetNCI failed to load health telemetry:", err);
      }
    }
    loadStats();
  }, []);

  async function triggerReframing() {
    setLoading(true);
    setReflection("");
    try {
      const res = await fetch("/api/nci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lens,
          state: biometrics
        })
      });
      const data = await res.json();
      if (data.success) {
        setReflection(data.insight);
      } else {
        setReflection(`Error refactoring: ${data.error}`);
      }
    } catch (err: any) {
      setReflection(`Failed to connect to local Ollama Swarm: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const lenses = [
    { id: "witness", label: "Witness", icon: "🪞" },
    { id: "reversal", label: "Reversal", icon: "🔄" },
    { id: "impossible_question", label: "Question", icon: "🌱" },
    { id: "presupposition", label: "Presup", icon: "🔍" },
    { id: "label", label: "Reframe", icon: "💎" }
  ];

  return (
    <WidgetCard title="NCI Reframing Engine" icon={<Brain size={14} className="text-purple-400" />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full justify-between space-y-3">
        
        {/* Subtitle */}
        <p className="text-[10px]" style={{ color: "var(--color-text-dim)" }}>
          Select an active Neuro-Cognitive Influence (NCI) lens to filter biometrics and bypass your default mode network.
        </p>

        {/* Lens Pill Selector */}
        <div className="grid grid-cols-5 gap-1">
          {lenses.map(item => {
            const active = lens === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setLens(item.id)}
                className="py-1 rounded-lg text-[9px] font-semibold transition-all border flex flex-col items-center justify-center gap-0.5"
                style={{
                  background: active ? "rgba(139, 92, 246, 0.1)" : "rgba(255, 255, 255, 0.02)",
                  borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-dim)"
                }}
              >
                <span className="text-[11px]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Output Screen */}
        <div 
          className="flex-1 min-h-[100px] p-3 rounded-xl border flex flex-col relative overflow-y-auto"
          style={{
            background: "rgba(0, 0, 0, 0.2)",
            borderColor: "var(--color-border)"
          }}
        >
          {loading ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span className="text-[9px] font-mono tracking-widest uppercase animate-pulse text-purple-300">Refactoring Neurology...</span>
            </div>
          ) : reflection ? (
            <div className="text-[11px] leading-relaxed select-text" style={{ color: "var(--color-text-primary)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={10} className="text-yellow-400 animate-pulse" />
                <span className="text-[8px] font-mono uppercase tracking-wider text-yellow-400">NCI Reflection Active</span>
              </div>
              {reflection}
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-2">
              <Sparkles size={16} className="text-neutral-600 mb-1" />
              <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider">Awaiting Reframing Prompt</span>
            </div>
          )}
        </div>

        {/* Action Trigger Button */}
        <button
          onClick={triggerReframing}
          disabled={loading}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[10px] font-mono uppercase tracking-wider font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98"
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          Refactor Focus
        </button>

      </div>
    </WidgetCard>
  );
}
