"use client";

import { useState, useEffect } from "react";
import { Check, CheckSquare, Square, Target, Loader2, Sparkles } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface Habit {
  id: number;
  title: string;
  description: string;
  frequency: string;
  color: string;
  icon: string;
}

interface HabitLog {
  habit_id: number;
  date: string;
  status: string;
}

export function WidgetHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Get today's local date string YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayString();

  const fetchHabits = async () => {
    try {
      const res = await fetch("/api/habits");
      const data = await res.json();
      setHabits(data.habits || []);
      setLogs(data.logs || []);
    } catch (err) {
      console.error("WidgetHabits failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const handleToggle = async (habitId: number) => {
    setTogglingId(habitId);
    try {
      const res = await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habit_id: habitId,
          date: todayStr,
          status: "completed"
        })
      });
      const data = await res.json();
      
      // Update logs state locally
      if (data.action === "removed") {
        setLogs(prev => prev.filter(l => !(l.habit_id === habitId && l.date === todayStr)));
      } else {
        setLogs(prev => [...prev, { habit_id: habitId, date: todayStr, status: "completed" }]);
      }
    } catch (err) {
      console.error("Toggle habit failed:", err);
    } finally {
      setTogglingId(null);
    }
  };

  // Check if completed today
  const isCompletedToday = (habitId: number) => {
    return logs.some(l => l.habit_id === habitId && l.date === todayStr);
  };

  return (
    <WidgetCard title="Daily Habits" icon={<Target size={14} />} className="col-span-2 md:col-span-2 row-span-1">
      <div className="flex flex-col h-full justify-between">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-accent" />
          </div>
        ) : habits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
            No active habits tracked.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[85px] pr-1">
            {habits.slice(0, 4).map(habit => {
              const completed = isCompletedToday(habit.id);
              const toggling = togglingId === habit.id;

              return (
                <button
                  key={habit.id}
                  onClick={() => handleToggle(habit.id)}
                  disabled={toggling}
                  className="flex items-center gap-2 p-2 rounded-xl text-left transition-all hover:bg-white/5 disabled:opacity-50"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  <div 
                    className="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                    style={{ 
                      borderColor: completed ? habit.color : "var(--color-border)",
                      background: completed ? `${habit.color}15` : "transparent"
                    }}
                  >
                    {toggling ? (
                      <Loader2 size={8} className="animate-spin text-accent" />
                    ) : completed ? (
                      <Check size={10} style={{ color: habit.color }} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span 
                      className={`text-[11px] font-semibold truncate block transition-all ${
                        completed ? "line-through opacity-45" : ""
                      }`}
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {habit.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
