"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Calendar, Check, X, RefreshCw } from "lucide-react";

interface Proposal {
  id: number;
  task_id: number;
  task_title: string;
  task_description: string;
  original_date: string;
  proposed_date: string;
  reason: string;
}

interface HealthInfo {
  sleep_hours: number;
  hrv: number;
}

interface RebalancerData {
  success: boolean;
  proposals: Proposal[];
  health: HealthInfo | null;
}

export function WidgetRebalancer({ onUpdate }: { onUpdate?: () => void }) {
  const [data, setData] = useState<RebalancerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchProposals = () => {
    fetch("/api/planner/rebalance")
      .then(r => r.json())
      .then((d: RebalancerData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleAction = async (action: "approve" | "reject") => {
    setProcessing(true);
    try {
      const res = await fetch("/api/planner/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const resData = await res.json();
      if (resData.success) {
        setData(prev => prev ? { ...prev, proposals: [] } : null);
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !data || data.proposals.length === 0) {
    return null;
  }

  const { proposals, health } = data;
  const sleepStr = health?.sleep_hours ? `${health.sleep_hours} hrs` : "Unknown";
  const hrvStr = health?.hrv ? `${health.hrv} ms` : "Unknown";

  return (
    <div 
      className="w-full rounded-2xl p-5 border border-amber-500/20 backdrop-blur-md relative overflow-hidden animate-fade-in mb-6 space-y-4"
      style={{ 
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%)" 
      }}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Autonomic Focus Shield Proposed
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Low biometric recovery detected (Sleep: <span className="font-semibold text-amber-400">{sleepStr}</span>, HRV: <span className="font-semibold text-amber-400">{hrvStr}</span>).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleAction("reject")}
            disabled={processing}
            className="flex items-center gap-1 text-[11px] font-medium border border-[var(--color-border)] px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-neutral-800 transition-colors"
          >
            <X size={12} /> Ignore
          </button>
          
          <button
            onClick={() => handleAction("approve")}
            disabled={processing}
            className="flex items-center gap-1.5 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-black px-3.5 py-1.5 rounded-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {processing ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <>
                <Check size={12} /> Approve Rebalance
              </>
            )}
          </button>
        </div>
      </div>

      <div className="h-px bg-amber-500/10" />

      {/* Proposals List */}
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium">
          Proposed Task Rescheduling:
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {proposals.map(prop => (
            <div 
              key={prop.id} 
              className="p-3.5 rounded-xl border border-zinc-800 bg-black/30 flex flex-col justify-between space-y-2.5"
            >
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {prop.task_title}
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1 italic font-serif leading-relaxed">
                  "{prop.reason}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono mt-2 pt-2 border-t border-zinc-900 text-[var(--color-text-dim)]">
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Today
                </span>
                <span className="text-amber-500/70">→</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Calendar size={11} /> {prop.proposed_date}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
