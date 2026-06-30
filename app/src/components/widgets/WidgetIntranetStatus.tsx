"use client";

import { useState, useEffect } from "react";
import { Cpu, AlertCircle } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface StatusData {
  ollama: {
    status: "online" | "offline";
    loaded_models: string[];
  };
  system: {
    cpu_load_1m: number;
    cpu_temp_c: number;
    memory_usage_pct: number;
    platform: string;
    uptime_hours: number;
  };
  watchers: {
    name: string;
    type: string;
    last_scanned: string | null;
    status: string;
  }[];
  swarm: {
    tasks_allocated: number;
    drafts_created: number;
  };
}

export function WidgetIntranetStatus() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error("Failed to load status widget data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WidgetCard title="Intranet & Swarm Status" icon={<Cpu size={14} />} className="col-span-2 md:col-span-2 row-span-1">
      <div className="h-full flex flex-col justify-between space-y-2 py-0.5">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
            Scanning local services...
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-red-400 font-mono gap-1.5">
            <AlertCircle size={12} /> Offline
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 h-full">
            
            {/* Column 1: System Telemetry */}
            <div className="flex flex-col justify-between pr-2 border-r" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">System</span>
                <span className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {data.system.cpu_temp_c}°C
                </span>
              </div>
              <div className="space-y-1 mt-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="opacity-50">CPU Load:</span>
                  <span className="font-mono">{data.system.cpu_load_1m}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">RAM:</span>
                  <span className="font-mono">{data.system.memory_usage_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Uptime:</span>
                  <span className="font-mono">{data.system.uptime_hours}h</span>
                </div>
              </div>
            </div>

            {/* Column 2: Ollama & Watchers */}
            <div className="flex flex-col justify-between pl-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Ollama & Swarm</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${data.ollama.status === "online" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
                  <span className="text-[10px] font-mono uppercase">{data.ollama.status}</span>
                </div>
              </div>
              
              <div className="space-y-1 mt-1 text-[11px]">
                {data.ollama.status === "online" && (
                  <div className="flex justify-between">
                    <span className="opacity-50">VRAM LLMs:</span>
                    <span className="font-medium truncate max-w-[80px] text-emerald-400">
                      {data.ollama.loaded_models.length > 0 ? data.ollama.loaded_models[0].split(":")[0] : "idle"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="opacity-50">Sync Watchers:</span>
                  <span className="font-mono">{data.watchers.length} active</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Swarm Tasks:</span>
                  <span className="font-mono text-emerald-400">{data.swarm.tasks_allocated}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </WidgetCard>
  );
}
