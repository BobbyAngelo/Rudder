"use client";

import { useState } from "react";
import { CalendarDays, CheckSquare, Columns3 } from "lucide-react";
import dynamic from "next/dynamic";

const TimelineView = dynamic(() => import("./TimelineView"), { ssr: false });
const TaskListView = dynamic(() => import("./TaskListView"), { ssr: false });
const TaskBoardView = dynamic(() => import("./TaskBoardView"), { ssr: false });

type View = "timeline" | "tasks" | "board";

export default function PlannerPage() {
  const [view, setView] = useState<View>("timeline");

  const tabs: { id: View; label: string; icon: any }[] = [
    { id: "timeline", label: "Timeline", icon: CalendarDays },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "board", label: "Board", icon: Columns3 },
  ];

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in">
        {/* Header with view tabs */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Planner
          </h1>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className="px-4 py-1.5 text-xs flex items-center gap-1.5 transition-all"
                  style={{
                    background: view === tab.id ? "var(--color-surface-elevated)" : "transparent",
                    color: view === tab.id ? "var(--color-text-primary)" : "var(--color-text-dim)",
                    borderLeft: tab.id !== "timeline" ? "1px solid var(--color-border)" : "none",
                  }}
                >
                  <Icon size={13} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Views */}
        {view === "timeline" && <TimelineView />}
        {view === "tasks" && <TaskListView />}
        {view === "board" && <TaskBoardView />}
      </div>
    </div>
  );
}

