"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, CheckCircle2, Circle, Clock, Trash2, Calendar, Flag, Inbox,
} from "lucide-react";
import { EmptyState } from "@/components/ui";

interface Task {
  id: number; title: string; description: string; status: "todo" | "in_progress" | "done" | "archived";
  priority: number; project_id: number; due_date: string | null; completed_at: string | null;
  sort_order: number; labels: string; created_at: string; updated_at: string;
}

type TaskFilter = "active" | "all" | "done";

interface TaskCounts {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

const PRIORITY_CONFIG = [
  { label: "None", color: "transparent" },
  { label: "Low", color: "#60a5fa" },
  { label: "Medium", color: "#fbbf24" },
  { label: "High", color: "#f97316" },
  { label: "Urgent", color: "#ef4444" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  todo: { label: "To Do", color: "#94a3b8", icon: Circle },
  in_progress: { label: "In Progress", color: "#60a5fa", icon: Clock },
  done: { label: "Done", color: "#34d399", icon: CheckCircle2 },
};

export function useTaskActions() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState({ todo: 0, in_progress: 0, done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");

  const fetchTasks = useCallback(async () => {
    const statusParam = filter === "active" ? "active" : filter === "done" ? "done" : "all";
    const res = await fetch(`/api/tasks?status=${statusParam}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setCounts(data.counts || { todo: 0, in_progress: 0, done: 0, total: 0 });
    setLoading(false);
  }, [filter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState runs after await, not synchronously
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function createTask(title: string, priority: number) {
    await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority }),
    });
    fetchTasks();
  }

  async function updateTask(id: number, updates: Partial<Task>) {
    await fetch(`/api/tasks?id=${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchTasks();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    fetchTasks();
  }

  function toggleStatus(task: Task) {
    const next = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    updateTask(task.id, { status: next });
  }

  return { tasks, counts, loading, filter, setFilter, createTask, updateTask, deleteTask, toggleStatus, fetchTasks };
}

/* ── Quick Add Bar ── */
export function QuickAdd({ onCreate }: { onCreate: (title: string, priority: number) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(0);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    await onCreate(title.trim(), priority);
    setTitle(""); setPriority(0); setAdding(false);
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <Plus size={16} style={{ color: "var(--color-text-dim)" }} />
        <input ref={inputRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--color-text-primary)" }} />
        <button type="button" onClick={() => setPriority((p) => (p + 1) % 5)}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider"
          style={{ background: priority > 0 ? `${PRIORITY_CONFIG[priority].color}15` : "transparent", color: priority > 0 ? PRIORITY_CONFIG[priority].color : "var(--color-text-dim)", border: "1px solid var(--color-border)" }}>
          <Flag size={10} />{PRIORITY_CONFIG[priority].label}
        </button>
      </div>
      <button type="submit" disabled={adding || !title.trim()}
        className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
        style={{ background: "var(--color-accent)", color: "#000" }}>
        {adding ? "..." : "Add"}
      </button>
    </form>
  );
}

/* ── Filter Tabs ── */
export function FilterTabs({ filter, setFilter, counts }: { filter: string; setFilter: (f: TaskFilter) => void; counts: TaskCounts }) {
  return (
    <div className="flex gap-1 mb-4">
      {(["active", "all", "done"] as const).map((f) => (
        <button key={f} onClick={() => setFilter(f)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
          style={{ background: filter === f ? "var(--color-surface-elevated)" : "transparent", color: filter === f ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
          {f === "active" ? `Active (${counts.todo + counts.in_progress})` : f === "done" ? `Done (${counts.done})` : "All"}
        </button>
      ))}
    </div>
  );
}

/* ── Task Row ── */
export function TaskRow({ task, onToggle, onUpdate, onDelete }: { task: Task; onToggle: (t: Task) => void; onUpdate: (id: number, u: Partial<Task>) => void; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const conf = STATUS_CONFIG[task.status];
  const Icon = conf.icon;
  const isDone = task.status === "done";
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone;

  function save() { if (editTitle.trim() && editTitle !== task.title) onUpdate(task.id, { title: editTitle.trim() }); setEditing(false); }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl group transition-all" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <button onClick={() => onToggle(task)} className="shrink-0 transition-all hover:scale-110" style={{ color: conf.color }}><Icon size={18} /></button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-full bg-transparent outline-none text-sm" style={{ color: "var(--color-text-primary)" }} autoFocus />
        ) : (
          <span className="text-[13px] cursor-pointer" onClick={() => { setEditTitle(task.title); setEditing(true); }}
            style={{ color: isDone ? "var(--color-text-dim)" : "var(--color-text-primary)", textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
            {task.title}
          </span>
        )}
      </div>
      {task.priority > 0 && <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
        style={{ background: `${PRIORITY_CONFIG[task.priority].color}15`, color: PRIORITY_CONFIG[task.priority].color }}>{PRIORITY_CONFIG[task.priority].label}</span>}
      {task.due_date && <span className="text-[10px] font-mono shrink-0 flex items-center gap-1"
        style={{ color: isOverdue ? "#ef4444" : "var(--color-text-dim)" }}><Calendar size={10} />{fmtDate(task.due_date)}</span>}
      <button onClick={() => onDelete(task.id)} className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all" style={{ color: "var(--color-text-dim)" }}><Trash2 size={13} /></button>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00"), now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ═════════════════════════════════════════════════
   Exported Default: Task List View
   ═════════════════════════════════════════════════ */

export default function TaskListView() {
  const { tasks, counts, loading, filter, setFilter, createTask, updateTask, deleteTask, toggleStatus } = useTaskActions();

  if (loading) return <div className="animate-pulse h-32 rounded-xl" style={{ background: "var(--color-surface)" }} />;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{counts.todo + counts.in_progress} active · {counts.done} completed</p>
      </div>
      <QuickAdd onCreate={createTask} />
      <FilterTabs filter={filter} setFilter={setFilter} counts={counts} />
      {tasks.length === 0 ? (
        <EmptyState icon={<Inbox size={24} />} title={filter === "done" ? "No completed tasks" : "No tasks yet"} description="Add your first task above." />
      ) : (
        <div className="space-y-1">{tasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleStatus} onUpdate={updateTask} onDelete={deleteTask} />)}</div>
      )}
    </>
  );
}
