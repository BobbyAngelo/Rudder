"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, Search, Loader2, FileText, Radio } from "lucide-react";
import { SESSION_KINDS, getSessionKindByLabel } from "@/lib/sessionKinds";

interface MemItem { id: string; source: string; title: string; date: string | null; snippet: string; }
interface SourceCount { source: string; count: number; }
interface KindCount { kind: string; count: number; }
interface AskSource { id: string; source: string; title: string; date?: string; snippet: string; }

const CAPTURED = "__captured__";

/** Split a stored title into its session kind (if any) and the remaining label. */
function splitKind(title: string): { kind: string | null; rest: string } {
  const i = title.indexOf(": ");
  const head = i > 0 ? title.slice(0, i) : title;
  if (getSessionKindByLabel(head)) {
    return { kind: head, rest: i > 0 ? title.slice(i + 2) : "" };
  }
  return { kind: null, rest: title };
}

export default function MemoryPage() {
  const [items, setItems] = useState<MemItem[]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [kinds, setKinds] = useState<KindCount[]>([]);
  const [total, setTotal] = useState(0);
  const [capturedTotal, setCapturedTotal] = useState(0);
  const [active, setActive] = useState("all");   // "all" | CAPTURED | <source>
  const [kind, setKind] = useState("all");        // session-type facet (captured only)
  const [loading, setLoading] = useState(true);

  // ── ask state ──
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerSources, setAnswerSources] = useState<AskSource[]>([]);
  const [asking, setAsking] = useState(false);

  const loadFeed = useCallback(async (sel: string, k: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "80" });
    if (sel === CAPTURED) {
      params.set("captured", "1");
      if (k !== "all") params.set("kind", k);
    } else {
      params.set("source", sel);
    }
    const res = await fetch(`/api/memory?${params.toString()}`);
    const data = await res.json();
    setItems(data.items || []);
    setSources(data.sources || []);
    setKinds(data.kinds || []);
    setTotal(data.total || 0);
    setCapturedTotal(data.capturedTotal || 0);
    setLoading(false);
  }, []);

  useEffect(() => { loadFeed(active, kind); }, [active, kind, loadFeed]);

  const selectFilter = (sel: string) => { setActive(sel); setKind("all"); };

  const ask = async () => {
    if (!q.trim()) return;
    setAsking(true); setAnswer(""); setAnswerSources([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setAnswer(data.answer || "No response");
      setAnswerSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setAnswer("⚠️ Error reaching Rudder.");
    } finally {
      setAsking(false);
    }
  };

  // Hide individual capture sources from the source row — they live under "Captured".
  const connectorSources = sources.filter((s) => !["laptop", "phone", "esp32", "pendant", "capture", "session"].includes(s.source));
  const isCaptured = active === CAPTURED;

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in">
        <header className="page-header">
          <h1 className="page-title flex items-center gap-2"><Brain size={20} /> Memory</h1>
          <p className="page-subtitle">
            Everything Rudder remembers — {total.toLocaleString()} items across your notes, captures, and connected sources. All local.
          </p>
        </header>

        {/* Ask your memory */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-dim)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask your memory anything…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[14px] outline-none"
            style={{ background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
          />
          {asking && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--color-text-dim)" }} />}
        </div>

        {answer && (
          <div className="mb-6 rounded-xl border p-4 animate-fade-in" style={{ background: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>{answer}</p>
            {answerSources.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>Sources</p>
                {answerSources.map((s, i) => (
                  <div key={s.id} className="flex items-start gap-2 text-[12px]">
                    <span className="shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold" style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>{i + 1}</span>
                    <span style={{ color: "var(--color-text-secondary)" }}><strong style={{ color: "var(--color-text-primary)" }}>{s.title}</strong> — {s.snippet}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Source filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Chip label={`All (${total})`} active={active === "all"} onClick={() => selectFilter("all")} />
          {capturedTotal > 0 && (
            <Chip
              label={`Captured (${capturedTotal})`}
              active={isCaptured}
              onClick={() => selectFilter(CAPTURED)}
              icon={<Radio size={11} />}
            />
          )}
          {connectorSources.map((s) => (
            <Chip key={s.source} label={`${s.source} (${s.count})`} active={active === s.source} onClick={() => selectFilter(s.source)} />
          ))}
        </div>

        {/* Kind facet (captured view only) */}
        {isCaptured && (
          <div className="flex flex-wrap gap-1.5 mb-4 pl-2 ml-1 border-l-2 animate-fade-in" style={{ borderColor: "var(--color-accent)" }}>
            <Chip label="All types" active={kind === "all"} onClick={() => setKind("all")} small />
            {kinds.map((k) => (
              <Chip key={k.kind} label={`${k.kind} (${k.count})`} active={kind === k.kind} onClick={() => setKind(k.kind)} small />
            ))}
            {kinds.length === 0 && (
              <span className="text-[11px] py-1" style={{ color: "var(--color-text-dim)" }}>No sessions captured yet — record one from Capture Session or your phone.</span>
            )}
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "var(--color-text-dim)" }} /></div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}>
            <FileText size={20} className="mx-auto mb-2" />
            <p className="text-[13px]">
              {isCaptured
                ? "No captured sessions here yet. Hit Capture Session in the sidebar (or open /m.html on your phone) to record one."
                : "Nothing here yet. Connect a folder in Settings → Connectors, or beam a note from a device."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const { kind: itemKind, rest } = splitKind(it.title);
              return (
                <div key={it.id} className="rounded-xl border p-3.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {itemKind ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium" style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)", border: "1px solid rgba(52,211,153,0.2)" }}>{itemKind}</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-dim)" }}>{it.source}</span>
                    )}
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{rest || <span style={{ color: "var(--color-text-dim)" }}>Untitled</span>}</span>
                    {it.date && <span className="text-[10px] ml-auto shrink-0" style={{ color: "var(--color-text-dim)" }}>{it.date}</span>}
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{it.snippet}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick, icon, small }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg transition-colors inline-flex items-center gap-1.5 ${small ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{
        background: active ? "var(--color-accent-dim)" : "var(--color-surface)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
      }}
    >
      {icon}{label}
    </button>
  );
}
