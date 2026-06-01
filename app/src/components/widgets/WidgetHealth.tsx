"use client";

import { useState, useEffect, useMemo } from "react";
import { Activity, Heart, Moon, Loader2 } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface HealthStats {
  steps?: number;
  distance?: string;
  activeEnergy?: number;
  flights?: number;
  heartRate?: number | null;
  date?: string;
}

export function WidgetHealth() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("/api/health?action=dashboard");
        const data = await res.json();
        setStats(data.latestStats || null);
        
        // Find sleep hours from recent sleep array
        if (data.recentSleep && data.recentSleep.length > 0) {
          setSleepHours(parseFloat(data.recentSleep[0].hours?.toFixed(1) || "0"));
        }
      } catch (err) {
        console.error("WidgetHealth failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHealth();
  }, []);

  const stepProgress = useMemo(() => {
    if (!stats?.steps) return 0;
    return Math.min(Math.round((stats.steps / 10000) * 100), 100);
  }, [stats]);

  return (
    <WidgetCard title="Health Telemetry" icon={<Activity size={14} />} className="col-span-2 md:col-span-2 row-span-1">
      <div className="flex flex-col h-full justify-between">
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-accent" />
          </div>
        ) : !stats ? (
          <div className="flex-grow flex items-center justify-center text-[10px] text-neutral-500 font-mono">
            No health records synced.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            
            {/* Steps Metric */}
            <div className="p-2 rounded-xl text-center" style={{ background: "var(--color-surface-elevated)" }}>
              <div className="flex items-center justify-center gap-1 mb-1 text-blue-400">
                <Activity size={10} />
                <span className="text-[8px] font-mono uppercase tracking-wider">Steps</span>
              </div>
              <div className="text-[12px] font-bold font-mono tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                {stats.steps?.toLocaleString() || "—"}
              </div>
              <div className="text-[8px] font-mono opacity-50 mt-0.5">{stepProgress}% of 10k</div>
            </div>

            {/* Heart Rate Metric */}
            <div className="p-2 rounded-xl text-center" style={{ background: "var(--color-surface-elevated)" }}>
              <div className="flex items-center justify-center gap-1 mb-1 text-red-400">
                <Heart size={10} />
                <span className="text-[8px] font-mono uppercase tracking-wider">Pulse</span>
              </div>
              <div className="text-[12px] font-bold font-mono tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                {stats.heartRate ? `${stats.heartRate} bpm` : "—"}
              </div>
              <div className="text-[8px] font-mono opacity-50 mt-0.5">Last sync</div>
            </div>

            {/* Sleep Metric */}
            <div className="p-2 rounded-xl text-center" style={{ background: "var(--color-surface-elevated)" }}>
              <div className="flex items-center justify-center gap-1 mb-1 text-purple-400">
                <Moon size={10} />
                <span className="text-[8px] font-mono uppercase tracking-wider">Sleep</span>
              </div>
              <div className="text-[12px] font-bold font-mono tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                {sleepHours !== null ? `${sleepHours} hrs` : "—"}
              </div>
              <div className="text-[8px] font-mono opacity-50 mt-0.5">Last night</div>
            </div>

          </div>
        )}
      </div>
    </WidgetCard>
  );
}
