"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckSquare, Plus, Loader2, Shield, Sparkles } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetAgenda() {
  const [data, setData] = useState<{tasks: any[], events: any[], globalFocusScore: number}>({ 
    tasks: [], 
    events: [], 
    globalFocusScore: 100 
  });
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [shielding, setShielding] = useState(false);

  const fetchData = () => {
    fetch("/api/widgets/agenda")
      .then(r => r.json())
      .then(d => { 
        setData({
          tasks: d.tasks || [],
          events: d.events || [],
          globalFocusScore: d.globalFocusScore !== undefined ? d.globalFocusScore : 100
        }); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/widgets/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTask.trim() })
      });
      setNewTask("");
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handleShieldFocus = async () => {
    setShielding(true);
    try {
      const res = await fetch("/api/calendar/optimize", {
        method: "POST"
      });
      const resData = await res.json();
      if (resData.success) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setShielding(false);
    }
  };

  return (
    <WidgetCard title="Agenda & Focus Optimizer" icon={<Calendar size={14} />} loading={loading} className="col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1">
        
        {/* Focus Score Section */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed" style={{ background: "rgba(52, 211, 153, 0.02)", borderColor: "var(--color-border)" }}>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-wider uppercase" style={{ color: "var(--color-text-dim)" }}>Focus Strength</span>
            <span className="text-xl font-bold font-serif mt-1" style={{ color: data.globalFocusScore >= 70 ? "var(--color-accent)" : "var(--color-warning)" }}>
              {data.globalFocusScore}% Focus Shield
            </span>
          </div>

          <button
            onClick={handleShieldFocus}
            disabled={shielding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ 
              background: shielding ? "var(--color-surface-elevated)" : "var(--color-accent)", 
              color: shielding ? "var(--color-text-muted)" : "var(--color-background)"
            }}
          >
            {shielding ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Shield size={12} />
                Shield Focus
              </>
            )}
          </button>
        </div>

        {/* Events */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-mono tracking-wider uppercase" style={{ color: "var(--color-text-dim)" }}>Schedule</h4>
          {data.events.length === 0 && !loading && (
            <div className="text-xs p-2 rounded-lg" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-elevated)" }}>No upcoming events</div>
          )}
          {data.events.map((e, i) => {
            const isWork = e.category === "work";
            const dateObj = new Date(e.date);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return (
              <div 
                key={i} 
                className="flex items-center justify-between p-2.5 rounded-lg border-l-2" 
                style={{ 
                  background: "var(--color-surface-elevated)", 
                  borderLeftColor: isWork ? "#60a5fa" : "#34d399" 
                }}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{e.name}</span>
                  <span className="text-[10px] font-mono mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                    {dateStr} {e.time ? `@ ${e.time}` : ""}
                  </span>
                </div>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-text-muted)" }}>
                  {e.category}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-2 flex-1">
          <h4 className="text-[10px] font-mono tracking-wider uppercase" style={{ color: "var(--color-text-dim)" }}>Priority Tasks</h4>
          {data.tasks.length === 0 && !loading && (
            <div className="text-xs p-2 rounded-lg" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-elevated)" }}>All caught up</div>
          )}
          {data.tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--color-surface-elevated)" }}>
              <CheckSquare size={13} style={{ color: t.status === 'completed' ? "#34d399" : "var(--color-text-dim)" }} />
              <span className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{t.name}</span>
            </div>
          ))}

          {/* Add Task / Event NLP Input */}
          <div className="relative mt-auto pt-2">
            {adding ? (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 mt-1">
                <Loader2 size={12} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <Plus size={12} className="absolute left-3 top-1/2 -translate-y-1/2 mt-1" style={{ color: "var(--color-text-dim)" }} />
            )}
            <input 
              type="text" 
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              disabled={adding}
              placeholder="Schedule event or task (e.g. Meet Sarah at 3pm #work)..."
              className="w-full pl-8 pr-3 py-2.5 rounded-lg text-xs outline-none transition-all mt-2"
              style={{ background: "var(--color-background)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
            />
          </div>
        </div>

      </div>
    </WidgetCard>
  );
}
