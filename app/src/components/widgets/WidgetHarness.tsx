"use client";

import { useEffect, useState } from "react";
import { Target, Copy, Check, Loader2, Sparkles, Terminal } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import Link from "next/link";

interface HarnessSummary {
  id: number;
  name: string;
  slug: string;
  target_ai: string;
  sourcesCount: number;
}

export function WidgetHarness() {
  const [harnesses, setHarnesses] = useState<HarnessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [compilingSlug, setCompilingSlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHarnesses() {
      try {
        const res = await fetch("/api/harness");
        const data = await res.json();
        if (data.success) {
          setHarnesses(data.harnesses);
        }
      } catch (err) {
        console.error("Failed to load harnesses inside widget:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHarnesses();
  }, []);

  const handleQuickCopy = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setCompilingSlug(slug);
    try {
      const res = await fetch(`/api/harness/compile?slug=${slug}`);
      const data = await res.json();
      if (data.success && data.compiled) {
        await navigator.clipboard.writeText(data.compiled.compiled_markdown);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
      }
    } catch (err) {
      console.error("Failed to compile or copy harness:", err);
    } finally {
      setCompilingSlug(null);
    }
  };

  return (
    <WidgetCard title="Context Harnesses" icon={<Target size={14} />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-3">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-accent" />
          </div>
        ) : harnesses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-text-dim">
            <Target size={20} className="mb-2 opacity-50" />
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">No Harnesses Configured</p>
            <Link 
              href="/harness" 
              className="text-[10px] text-accent uppercase font-mono tracking-wider mt-2 hover:underline"
            >
              Configure Harnesses
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[220px]">
            {harnesses.map((h) => {
              const isCompiling = compilingSlug === h.slug;
              const isCopied = copiedSlug === h.slug;

              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background/30 hover:bg-surface-elevated/20 transition-all group"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-xs font-bold text-[var(--color-text-primary)] truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {h.name}
                    </div>
                    <div className="text-[9px] font-mono text-text-dim mt-1 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] uppercase text-[var(--color-text-secondary)]">
                        {h.target_ai}
                      </span>
                      <span>•</span>
                      <span>{h.sourcesCount} sources active</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleQuickCopy(h.slug, e)}
                    disabled={isCompiling}
                    className={`p-2 rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${
                      isCopied 
                        ? "bg-accent/15 border-accent/30 text-accent" 
                        : "bg-surface border-border text-text-dim hover:text-[var(--color-text-primary)] hover:border-accent/20"
                    }`}
                    title="Quick Copy Context Bundle"
                  >
                    {isCompiling ? (
                      <Loader2 size={12} className="animate-spin text-accent" />
                    ) : isCopied ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Link */}
        <div className="pt-2 border-t flex items-center justify-between mt-auto shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-[9px] text-text-dim font-mono flex items-center gap-1">
            <Terminal size={10} /> feed local swarms
          </span>
          <Link
            href="/harness"
            className="text-[10px] font-mono uppercase tracking-wider text-accent hover:underline flex items-center gap-1 font-bold"
          >
            Manage Persona Profiles
          </Link>
        </div>
      </div>
    </WidgetCard>
  );
}
