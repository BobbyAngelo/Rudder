"use client";

import { useState, useEffect } from "react";
import { OrbitRing } from "@/components/OrbitRing";
import { Database, HardDrive, Cpu, RefreshCw } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetOrbit() {
  const [stats, setStats] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      setTimeout(() => {
        fetch("/api/dashboard").then(r => r.json()).then(setStats);
        setIsSyncing(false);
      }, 3000);
    } catch {
      setIsSyncing(false);
    }
  };

  const ledgerCount = stats?.ledger_count ?? 0;

  return (
    <WidgetCard className="col-span-2 md:col-span-2 lg:col-span-2 row-span-1">
      <div className="flex items-center gap-4 h-full p-2">
        <div className="flex-1 flex justify-center scale-75 origin-center">
          <OrbitRing ledgerCount={ledgerCount} />
        </div>
        
        <div className="flex-1 flex flex-col justify-center gap-3">
          <div className="flex flex-col gap-2">
            {[
              { icon: Database, label: "Data Sources", value: stats?.data_sources?.toString() ?? "—", color: "#34d399" },
              { icon: HardDrive, label: "People", value: stats?.people_count?.toLocaleString() ?? "—", color: "#f472b6" },
              { icon: Cpu, label: "Health Records", value: stats?.health_records?.toLocaleString() ?? "—", color: "#60a5fa" },
            ].map((s, i) => (
              <div key={s.label} className={`flex items-center gap-3 animate-fade-in stagger-${i + 1}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5">
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>{s.label}</span>
                  <span className="text-[14px] font-mono font-medium leading-none mt-1" style={{ color: "var(--color-text-secondary)" }}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-[9px] font-mono font-medium uppercase tracking-wider transition-all hover:bg-white/5 active:scale-95 mt-1"
            style={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} style={{ color: "#34d399" }} />
            {isSyncing ? "Syncing" : "Sync Now"}
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
