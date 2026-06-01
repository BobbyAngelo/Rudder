"use client";

import { useState, useEffect, useMemo } from "react";
import { PenTool, Loader2, ArrowRight, BookOpen } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import Link from "next/link";

interface Draft {
  id: number;
  title: string;
  mode: string;
  word_count: number;
  updated_at: string;
}

export function WidgetWriting() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [wordGoal, setWordGoal] = useState(300);

  useEffect(() => {
    // Load word goal
    const savedGoal = localStorage.getItem("rudder_writing_word_goal");
    if (savedGoal) setWordGoal(parseInt(savedGoal));

    // Fetch writing entries
    async function fetchDrafts() {
      try {
        const res = await fetch("/api/writing");
        const data = await res.json();
        setDrafts(data.entries || []);
      } catch (err) {
        console.error("WidgetWriting failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDrafts();
  }, []);

  // Today's total words (from entries updated today)
  const todayWords = useMemo(() => {
    const today = new Date().toDateString();
    return drafts
      .filter(d => new Date(d.updated_at).toDateString() === today)
      .reduce((sum, d) => sum + d.word_count, 0);
  }, [drafts]);

  const progressPercent = useMemo(() => {
    return Math.min(Math.round((todayWords / wordGoal) * 100), 100);
  }, [todayWords, wordGoal]);

  return (
    <WidgetCard title="Zenith Writing" icon={<PenTool size={14} />} className="col-span-2 md:col-span-2 row-span-1">
      <div className="flex flex-col h-full justify-between">
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-accent" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            
            {/* Word Goal tracker */}
            <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
              <span style={{ color: "var(--color-text-dim)" }}>TODAY'S WORDS:</span>
              <span className="text-accent font-semibold">{todayWords} / {wordGoal} w ({progressPercent}%)</span>
            </div>
            
            {/* Progress track */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 mb-2">
              <div 
                className="h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: `${progressPercent}%`, 
                  background: progressPercent === 100 ? "#10b981" : "var(--color-accent)" 
                }} 
              />
            </div>

            {/* Recent Drafts */}
            <div className="space-y-1 overflow-y-auto max-h-[50px] pr-1">
              {drafts.slice(0, 2).map(draft => (
                <Link
                  key={draft.id}
                  href={`/writing?id=${draft.id}`}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition-all text-left block"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <BookOpen size={10} style={{ color: "var(--color-text-dim)" }} />
                    <span className="text-[10px] font-semibold truncate text-primary block">
                      {draft.title || "Untitled"}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-dim opacity-50 shrink-0">
                    {draft.word_count}w
                  </span>
                </Link>
              ))}

              {drafts.length === 0 && (
                <div className="text-[10px] text-neutral-500 font-mono text-center py-2">
                  No active writing drafts.
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </WidgetCard>
  );
}
