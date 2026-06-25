"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock, MapPin, Trash2, CheckCircle2, Circle, Plus, X, Sparkles, PlusCircle, CheckSquare, Heart, AlertCircle
} from "lucide-react";
import { parseCommand, ParsedCommand } from "@/lib/nlp";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: number;
  location: string;
  color: string;
  category: string;
  linked_people: number[];
  created_at: string;
}

interface DueTask {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: number;
  due_date: string | null;
  due_time: string | null;
}

interface HealthAppt {
  provider: string;
  specialty: string;
  date: string; // YYYY-MM-DD
}

const CATEGORY_COLORS: Record<string, string> = {
  personal: "#34d399",
  work: "#60a5fa",
  health: "#f97316",
  social: "#a78bfa",
};

const CATEGORY_BG_COLORS: Record<string, string> = {
  personal: "rgba(52, 211, 153, 0.12)",
  work: "rgba(96, 165, 250, 0.12)",
  health: "rgba(249, 117, 22, 0.12)",
  social: "rgba(167, 139, 250, 0.12)",
};

const PRIORITY_FLAGS = ["", "🔵", "🟡", "🟠", "🔴"];

/* ═══════════════════════════════════════════════════════
   Redesigned Timeline View Component
   ═══════════════════════════════════════════════════════ */

export default function TimelineView() {
  const today = new Date();
  const todayStr = getISOString(today);

  // States
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<DueTask[]>([]);
  const [healthAppts, setHealthAppts] = useState<HealthAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // NLP Capture states
  const [nlpInput, setNlpInput] = useState("");
  const [isNlpSaving, setIsNlpSaving] = useState(false);

  // Legacy Manual Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Timeblocking task assignment picker state
  const [blockingHour, setBlockingHour] = useState<string | null>(null);

  // Compute 7-day horizon range
  const horizonDates = useMemo(() => {
    const dates: { dateStr: string; label: string; weekday: string }[] = [];
    const dateCursor = new Date(today);
    // Let's start from yesterday to give context
    dateCursor.setDate(dateCursor.getDate() - 1);

    for (let i = 0; i < 8; i++) {
      const dStr = getISOString(dateCursor);
      let label = dateCursor.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dStr === todayStr) {
        label = "Today";
      } else {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dStr === getISOString(yesterday)) {
          label = "Yesterday";
        } else {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dStr === getISOString(tomorrow)) {
            label = "Tomorrow";
          }
        }
      }
      dates.push({
        dateStr: dStr,
        label,
        weekday: dateCursor.toLocaleDateString("en-US", { weekday: "short" })
      });
      dateCursor.setDate(dateCursor.getDate() + 1);
    }
    return dates;
  }, [todayStr]);

  const startRange = horizonDates[0].dateStr;
  const endRange = horizonDates[horizonDates.length - 1].dateStr;

  const fetchTimelineData = useCallback(async () => {
    try {
      const [calRes, taskRes, healthRes] = await Promise.all([
        fetch(`/api/calendar?start=${startRange}&end=${endRange}`),
        fetch(`/api/tasks`),
        fetch(`/api/health`).catch(() => null),
      ]);

      const calData = await calRes.json();
      const taskData = await taskRes.json();

      setEvents(calData.events || []);
      setTasks(taskData.tasks || []);

      if (healthRes) {
        const healthData = await healthRes.json();
        const appts: HealthAppt[] = (healthData.providers || [])
          .filter((p: any) => p.next_appointment)
          .map((p: any) => ({
            provider: p.name,
            specialty: p.specialty,
            date: p.next_appointment,
          }));
        setHealthAppts(appts);
      }
    } catch (err) {
      console.error("Failed to fetch timeline data:", err);
    } finally {
      setLoading(false);
    }
  }, [startRange, endRange]);

  useEffect(() => {
    fetchTimelineData();
  }, [fetchTimelineData]);

  // Handle natural language parse and save
  const parsedNlp: ParsedCommand | null = useMemo(() => {
    if (!nlpInput.trim()) return null;
    return parseCommand(nlpInput);
  }, [nlpInput]);

  const handleNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedNlp || isNlpSaving) return;
    setIsNlpSaving(true);

    try {
      if (parsedNlp.type === "event") {
        await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsedNlp.title,
            start_date: parsedNlp.date,
            start_time: parsedNlp.time,
            category: parsedNlp.category,
            color: CATEGORY_COLORS[parsedNlp.category] || "#34d399",
            all_day: parsedNlp.time ? 0 : 1
          })
        });
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsedNlp.title,
            due_date: parsedNlp.date,
            due_time: parsedNlp.time,
            category: parsedNlp.category,
            priority: 1
          })
        });
      }
      setNlpInput("");
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to save NLP item:", err);
    } finally {
      setIsNlpSaving(false);
    }
  };

  // Check off a task
  const toggleTaskStatus = async (task: DueTask) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    try {
      await fetch(`/api/tasks?id=${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  // Delete calendar event
  const handleDeleteEvent = async (id: number) => {
    try {
      await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
      setSelectedEvent(null);
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Delete task
  const handleDeleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // Assign task to a specific hour block (time blocking)
  const assignTaskToBlock = async (taskId: number, hour: string) => {
    try {
      await fetch(`/api/tasks?id=${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: selectedDate, due_time: hour })
      });
      setBlockingHour(null);
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to assign task block:", err);
    }
  };

  // Unassign task block time (set due_time = null)
  const unassignTaskBlock = async (taskId: number) => {
    try {
      await fetch(`/api/tasks?id=${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_time: null })
      });
      fetchTimelineData();
    } catch (err) {
      console.error("Failed to unassign task block:", err);
    }
  };

  // Group items by day
  const itemsByDay = useMemo(() => {
    const groups: Record<string, { events: CalendarEvent[]; tasks: DueTask[]; health: HealthAppt[] }> = {};

    horizonDates.forEach(hd => {
      groups[hd.dateStr] = { events: [], tasks: [], health: [] };
    });

    events.forEach(ev => {
      if (groups[ev.start_date]) {
        groups[ev.start_date].events.push(ev);
      }
    });

    tasks.forEach(t => {
      if (t.due_date && groups[t.due_date]) {
        groups[t.due_date].tasks.push(t);
      }
    });

    healthAppts.forEach(a => {
      if (groups[a.date]) {
        groups[a.date].health.push(a);
      }
    });

    // Sort events and tasks by time
    Object.keys(groups).forEach(dateKey => {
      groups[dateKey].events.sort((a, b) => (a.start_time || "00:00").localeCompare(b.start_time || "00:00"));
      groups[dateKey].tasks.sort((a, b) => (a.due_time || "00:00").localeCompare(b.due_time || "00:00"));
    });

    return groups;
  }, [events, tasks, healthAppts, horizonDates]);

  // Unscheduled tasks for time-blocking picker (active tasks with either no date or due today without time)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(t => t.status !== "done" && (!t.due_time || t.due_date !== selectedDate));
  }, [tasks, selectedDate]);

  // Focus day schedule hours (8 AM to 9 PM)
  const focusHours = Array.from({ length: 14 }, (_, i) => {
    const h = i + 8;
    return `${String(h).padStart(2, "0")}:00`;
  });

  // Items for the selected Focus Day
  const selectedFocusItems = useMemo(() => {
    const dateItems = itemsByDay[selectedDate] || { events: [], tasks: [], health: [] };
    
    // Combine events, tasks, health appointments
    const allItems: {
      id: string;
      title: string;
      subtitle?: string;
      time: string | null;
      type: "event" | "task" | "health";
      color?: string;
      isDone?: boolean;
      originalItem: any;
    }[] = [];

    dateItems.events.forEach(ev => {
      allItems.push({
        id: `e-${ev.id}`,
        title: ev.title,
        subtitle: ev.location || ev.description,
        time: ev.start_time,
        type: "event",
        color: CATEGORY_COLORS[ev.category] || ev.color,
        originalItem: ev
      });
    });

    dateItems.tasks.forEach(t => {
      allItems.push({
        id: `t-${t.id}`,
        title: t.title,
        time: t.due_time,
        type: "task",
        isDone: t.status === "done",
        originalItem: t
      });
    });

    dateItems.health.forEach(a => {
      allItems.push({
        id: `h-${a.provider}`,
        title: `Appt: ${a.provider}`,
        subtitle: a.specialty,
        time: "09:00", // Default health appointments if no time, or TBD
        type: "health",
        color: "#f97316",
        originalItem: a
      });
    });

    return allItems;
  }, [itemsByDay, selectedDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono" style={{ color: "var(--color-text-dim)" }}>Loading Timeline Horizon...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* ── Left/Main Timeline Horizon (2 columns) ── */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Command Bar NLP Input */}
        <form onSubmit={handleNlpSubmit} className="relative group">
          <div 
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
            style={{ 
              background: "var(--color-surface)", 
              border: "1px solid var(--color-border)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
            }}
          >
            <Sparkles size={16} className="text-accent animate-pulse" />
            <input
              type="text"
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              placeholder="Meet Dr. Carter tomorrow at 3pm #health, or todo write project status by Friday..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-50"
              style={{ color: "var(--color-text-primary)" }}
              disabled={isNlpSaving}
            />
            {nlpInput && (
              <button 
                type="button" 
                onClick={() => setNlpInput("")}
                style={{ color: "var(--color-text-dim)" }}
                className="hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              disabled={isNlpSaving || !nlpInput.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-medium font-mono uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
              style={{ background: "var(--color-accent)", color: "#000" }}
            >
              {isNlpSaving ? "Saving..." : "Schedule"}
            </button>
          </div>

          {/* Real-time Natural Language Parser Preview */}
          {parsedNlp && (
            <div 
              className="absolute left-0 right-0 mt-2 p-3 rounded-xl border z-10 flex flex-wrap items-center gap-2 animate-fade-in text-[11px]"
              style={{ 
                background: "var(--color-surface-elevated)", 
                borderColor: "var(--color-border)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
              }}
            >
              <span className="font-mono uppercase px-1.5 py-0.5 rounded text-[9px] tracking-wider"
                style={{ 
                  background: parsedNlp.type === "event" ? "rgba(96, 165, 250, 0.2)" : "rgba(52, 211, 153, 0.2)",
                  color: parsedNlp.type === "event" ? "#60a5fa" : "#34d399"
                }}
              >
                {parsedNlp.type}
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                {parsedNlp.title}
              </span>
              <span style={{ color: "var(--color-text-dim)" }}>scheduled for</span>
              <span className="font-mono font-medium text-accent">
                {parsedNlp.date}
              </span>
              {parsedNlp.time && (
                <>
                  <span style={{ color: "var(--color-text-dim)" }}>at</span>
                  <span className="font-mono font-medium text-accent">{parsedNlp.time}</span>
                </>
              )}
              <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] capitalize"
                style={{ background: CATEGORY_BG_COLORS[parsedNlp.category], color: CATEGORY_COLORS[parsedNlp.category] }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[parsedNlp.category] }} />
                {parsedNlp.category}
              </span>
            </div>
          )}
        </form>

        {/* Horizon Timeline List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--color-text-dim)" }}>Horizon Feed</h2>
            <button 
              onClick={() => { setSelectedDate(todayStr); setShowCreateModal(true); }}
              className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Manual Create
            </button>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {horizonDates.map(({ dateStr, label, weekday }) => {
              const dayData = itemsByDay[dateStr] || { events: [], tasks: [], health: [] };
              const isSelected = selectedDate === dateStr;
              const hasItems = dayData.events.length > 0 || dayData.tasks.length > 0 || dayData.health.length > 0;

              return (
                <div 
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isSelected 
                      ? "ring-1" 
                      : "hover:brightness-110"
                  }`}
                  style={{ 
                    background: isSelected ? "var(--color-surface-elevated)" : "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
                    borderColor: isSelected ? "var(--color-accent)" : "var(--color-border)"
                  }}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-mono uppercase tracking-wider text-accent font-bold">{weekday}</span>
                      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{label}</span>
                    </div>
                    {dateStr === todayStr && (
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold" 
                        style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>Current Day</span>
                    )}
                  </div>

                  {!hasItems ? (
                    <div className="text-[11px] py-2 px-1 text-dashed" style={{ color: "var(--color-text-dim)" }}>
                      No active schedules. Click to focus day.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Health Appointments */}
                      {dayData.health.map((appt, idx) => (
                        <div key={`health-${idx}`} className="flex items-center gap-3 p-2 rounded-xl text-xs border-l-2"
                          style={{ background: "var(--color-background)", borderLeftColor: "#f97316" }}>
                          <Heart size={12} className="text-[#f97316]" />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{appt.provider}</span>
                            <span className="mx-2 text-[10px]" style={{ color: "var(--color-text-dim)" }}>({appt.specialty})</span>
                          </div>
                        </div>
                      ))}

                      {/* Events */}
                      {dayData.events.map(ev => (
                        <div 
                          key={`ev-${ev.id}`} 
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                          className="flex items-center gap-3 p-2 rounded-xl text-xs border-l-2 transition-all hover:translate-x-0.5"
                          style={{ background: "var(--color-background)", borderLeftColor: CATEGORY_COLORS[ev.category] || ev.color }}
                        >
                          {ev.start_time ? (
                            <span className="font-mono text-[10px] w-10 shrink-0" style={{ color: "var(--color-text-dim)" }}>{ev.start_time}</span>
                          ) : (
                            <span className="font-mono text-[9px] w-10 shrink-0 uppercase tracking-widest text-accent font-bold">ALL</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{ev.title}</div>
                            {ev.location && <div className="text-[9px] flex items-center gap-1 mt-0.5" style={{ color: "var(--color-text-dim)" }}><MapPin size={8} /> {ev.location}</div>}
                          </div>
                          <span className="text-[9px] font-mono capitalize px-1.5 py-0.2 rounded" style={{ background: CATEGORY_BG_COLORS[ev.category], color: CATEGORY_COLORS[ev.category] }}>
                            {ev.category}
                          </span>
                        </div>
                      ))}

                      {/* Tasks */}
                      {dayData.tasks.map(t => (
                        <div 
                          key={`task-${t.id}`} 
                          onClick={(e) => { e.stopPropagation(); }}
                          className="flex items-center gap-3 p-2 rounded-xl text-xs group"
                          style={{ background: "var(--color-background)" }}
                        >
                          <button 
                            onClick={() => toggleTaskStatus(t)}
                            className="shrink-0 transition-transform hover:scale-110"
                            style={{ color: t.status === "done" ? "#34d399" : "var(--color-text-dim)" }}
                          >
                            {t.status === "done" ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          </button>
                          
                          {t.due_time && (
                            <span className="font-mono text-[10px]" style={{ color: "var(--color-text-dim)" }}>{t.due_time}</span>
                          )}

                          <span 
                            className="flex-1 truncate" 
                            style={{ 
                              color: t.status === "done" ? "var(--color-text-dim)" : "var(--color-text-primary)",
                              textDecoration: t.status === "done" ? "line-through" : "none" 
                            }}
                          >
                            {t.title}
                          </span>

                          <button 
                            onClick={() => handleDeleteTask(t.id)}
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all shrink-0 ml-auto"
                            style={{ color: "var(--color-text-dim)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Right Column: Focus Day & Time Blocking ── */}
      <div className="space-y-4">
        <div className="p-4 rounded-2xl space-y-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-text-dim)" }}>Day Focus</span>
              <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                {horizonDates.find(h => h.dateStr === selectedDate)?.label || selectedDate}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">{selectedDate}</span>
          </div>

          {/* Time blocking scroll list */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {focusHours.map(hour => {
              // Find events/tasks/health appts matching this hour block
              const matchedItems = selectedFocusItems.filter(item => {
                if (!item.time) return false;
                const itemHour = item.time.split(":")[0];
                const blockHour = hour.split(":")[0];
                return itemHour === blockHour;
              });

              return (
                <div key={hour} className="flex gap-3 group/slot py-1.5 border-b border-dashed" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="w-10 font-mono text-[10px] font-bold text-left pt-1" style={{ color: "var(--color-text-dim)" }}>
                    {hour}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    {matchedItems.map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg text-[11px] font-medium"
                        style={{ 
                          background: item.type === "event" 
                            ? `${item.color}15` 
                            : item.type === "health" 
                              ? "rgba(249,115,22,0.15)"
                              : "var(--color-surface-elevated)",
                          color: item.type === "event" 
                            ? item.color 
                            : item.type === "health"
                              ? "#f97316"
                              : "var(--color-text-primary)",
                          borderLeft: `2.5px solid ${item.color || "var(--color-border)"}`
                        }}
                      >
                        <span className={`truncate ${item.isDone ? "line-through opacity-55" : ""}`}>{item.title}</span>
                        {item.type === "task" && (
                          <button 
                            onClick={() => unassignTaskBlock(item.originalItem.id)}
                            className="opacity-0 group-hover/slot:opacity-60 hover:!opacity-100 transition-opacity ml-1"
                            title="Unschedule block"
                          >
                            <X size={10} style={{ color: "var(--color-text-dim)" }} />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Quick allocate time block button */}
                    {matchedItems.length === 0 && (
                      <button
                        onClick={() => setBlockingHour(hour)}
                        className="opacity-0 group-hover/slot:opacity-40 hover:!opacity-80 transition-opacity text-[10px] font-mono flex items-center gap-1 text-accent py-1"
                      >
                        <PlusCircle size={10} /> Time block task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Allocation Picker Overlay Modal */}
        {blockingHour && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setBlockingHour(null)}>
            <div 
              className="relative w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-accent">Block Schedule</span>
                  <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Block task at {blockingHour}</span>
                </div>
                <button onClick={() => setBlockingHour(null)} style={{ color: "var(--color-text-dim)" }}><X size={16} /></button>
              </div>

              {unscheduledTasks.length === 0 ? (
                <div className="text-center py-6 text-xs" style={{ color: "var(--color-text-dim)" }}>
                  No active tasks to block. Create a task first.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                  <div className="text-[10px] font-mono uppercase pb-1" style={{ color: "var(--color-text-dim)" }}>Active Priority Tasks</div>
                  {unscheduledTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => assignTaskToBlock(t.id, blockingHour)}
                      className="w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all hover:bg-[var(--color-surface-elevated)] border"
                      style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--color-text-primary)" }} className="truncate pr-2">{t.title}</span>
                        {t.priority > 0 && <span>{PRIORITY_FLAGS[t.priority]}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Legacy Manual Create Event Modal ── */}
      {showCreateModal && (
        <CreateEventModal
          date={selectedDate}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchTimelineData(); }}
        />
      )}

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Create Event Modal (Manual backup)
   ═══════════════════════════════════════════════════════ */

function CreateEventModal({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(date);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("personal");
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        start_date: startDate,
        start_time: allDay ? null : startTime || null,
        end_time: allDay ? null : endTime || null,
        all_day: allDay,
        location,
        category,
        color: CATEGORY_COLORS[category] || "#34d399",
      }),
    });

    setSaving(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>New Event</h2>
          <button onClick={onClose} style={{ color: "var(--color-text-dim)" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title..."
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            autoFocus
          />

          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)", colorScheme: "dark" }}
            />
            {!allDay && (
              <>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-[110px] px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)", colorScheme: "dark" }}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-[110px] px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)", colorScheme: "dark" }}
                />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ border: "1px solid var(--color-border)" }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
              <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>All day</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location..."
              className="flex-1 px-3 py-2 rounded-lg text-xs bg-transparent outline-none"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            />
          </div>

          <div className="flex gap-1.5">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-all"
                style={{
                  background: category === cat ? `${color}25` : "transparent",
                  color: category === cat ? color : "var(--color-text-dim)",
                  border: category === cat ? `1.5px solid ${color}` : "1px solid var(--color-border)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30"
            style={{ background: "var(--color-accent)", color: "#000" }}
          >
            {saving ? "Creating..." : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Event Detail Modal
   ═══════════════════════════════════════════════════════ */

function EventDetailModal({
  event,
  onClose,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-xl shadow-2xl p-5 space-y-3"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <div
              className="w-3 h-3 rounded-full mt-1.5 shrink-0"
              style={{ background: CATEGORY_COLORS[event.category] || event.color }}
            />
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{event.title}</h2>
              <span
                className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: CATEGORY_COLORS[event.category] || "var(--color-text-dim)" }}
              >
                {event.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--color-text-dim)" }}><X size={16} /></button>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Clock size={13} />
            <span className="text-xs font-mono">
              {formatEventDate(event.start_date)}
              {event.start_time && ` at ${event.start_time}`}
              {event.end_time && ` — ${event.end_time}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
              <MapPin size={13} />
              <span className="text-xs">{event.location}</span>
            </div>
          )}
          {event.description && (
            <p className="text-xs pt-1" style={{ color: "var(--color-text-dim)" }}>{event.description}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => onDelete(event.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-85"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function getISOString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
