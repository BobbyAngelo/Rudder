"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckSquare, Plus, Loader2 } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetAgenda() {
  const [data, setData] = useState<{tasks: any[], events: any[]}>({ tasks: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = () => {
    fetch("/api/widgets/agenda")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
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

  return (
    <WidgetCard title="Agenda & Tasks" icon={<Calendar size={14} />} loading={loading} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-6">
        
        {/* Events */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-mono tracking-wider uppercase" style={{ color: "var(--color-text-dim)" }}>Schedule</h4>
          {data.events.length === 0 && !loading && (
            <div className="text-[11px] p-2 rounded-lg" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-elevated)" }}>No upcoming events</div>
          )}
          {data.events.map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border-l-2" style={{ background: "var(--color-surface-elevated)", borderLeftColor: "#60a5fa" }}>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium leading-none" style={{ color: "var(--color-text-primary)" }}>{e.name}</span>
                <span className="text-[9px] font-mono mt-1" style={{ color: "var(--color-text-dim)" }}>{e.time || "TBD"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-2 flex-1">
          <h4 className="text-[10px] font-mono tracking-wider uppercase" style={{ color: "var(--color-text-dim)" }}>Priority Tasks</h4>
          {data.tasks.length === 0 && !loading && (
            <div className="text-[11px] p-2 rounded-lg" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-elevated)" }}>All caught up</div>
          )}
          {data.tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "var(--color-surface-elevated)" }}>
              <CheckSquare size={14} style={{ color: t.status === 'completed' ? "#34d399" : "var(--color-text-dim)" }} />
              <span className="text-[11px] font-medium leading-none" style={{ color: "var(--color-text-primary)" }}>{t.name}</span>
            </div>
          ))}

          {/* Add Task Input */}
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
              placeholder="Add a task..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-[11px] outline-none transition-all mt-2"
              style={{ background: "var(--color-background)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
            />
          </div>
        </div>

      </div>
    </WidgetCard>
  );
}
