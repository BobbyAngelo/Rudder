"use client";

import { Circle, CheckCircle2, Trash2, Calendar } from "lucide-react";
import { useTaskActions, QuickAdd } from "./TaskListView";

const PRIORITY_CONFIG = [
  { label: "None", color: "transparent" },
  { label: "Low", color: "#60a5fa" },
  { label: "Medium", color: "#fbbf24" },
  { label: "High", color: "#f97316" },
  { label: "Urgent", color: "#ef4444" },
];

const STATUS_CONFIG: Record<string, { color: string }> = {
  todo: { color: "#94a3b8" },
  in_progress: { color: "#60a5fa" },
  done: { color: "#34d399" },
};

export default function TaskBoardView() {
  const { tasks, loading, createTask, deleteTask, toggleStatus } = useTaskActions();

  const columns = [
    { status: "todo", label: "To Do", color: "#94a3b8" },
    { status: "in_progress", label: "In Progress", color: "#60a5fa" },
    { status: "done", label: "Done", color: "#34d399" },
  ];

  if (loading) return <div className="animate-pulse h-64 rounded-xl" style={{ background: "var(--color-surface)" }} />;

  return (
    <>
      <QuickAdd onCreate={createTask} />
      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>{colTasks.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px] p-2 rounded-xl" style={{ background: "var(--color-background)", border: "1px dashed var(--color-border)" }}>
                {colTasks.map((task) => {
                  const isDone = task.status === "done";
                  return (
                    <div key={task.id} className="px-3 py-2.5 rounded-lg group transition-all hover:translate-y-[-1px]"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <div className="flex items-start gap-2">
                        <button onClick={() => toggleStatus(task)} className="shrink-0 mt-0.5 transition-all hover:scale-110" style={{ color: STATUS_CONFIG[task.status].color }}>
                          {isDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        </button>
                        <span className="text-[12px] flex-1" style={{ color: isDone ? "var(--color-text-dim)" : "var(--color-text-primary)", textDecoration: isDone ? "line-through" : "none" }}>
                          {task.title}
                        </span>
                        <button onClick={() => deleteTask(task.id)} className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all" style={{ color: "var(--color-text-dim)" }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                      {(task.priority > 0 || task.due_date) && (
                        <div className="flex items-center gap-2 mt-1.5 ml-[23px]">
                          {task.priority > 0 && <span className="text-[8px] font-mono uppercase px-1 py-0.5 rounded"
                            style={{ background: `${PRIORITY_CONFIG[task.priority].color}15`, color: PRIORITY_CONFIG[task.priority].color }}>{PRIORITY_CONFIG[task.priority].label}</span>}
                          {task.due_date && <span className="text-[9px] font-mono flex items-center gap-0.5" style={{ color: "var(--color-text-dim)" }}><Calendar size={8} />{task.due_date}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {colTasks.length === 0 && <div className="text-center py-6 text-[11px]" style={{ color: "var(--color-text-dim)" }}>No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
