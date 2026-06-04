"use client";

/* ═══════════════════════════════════════════════════════
   /biographer/story — the Life Historian.
   "Tell me the story of ___" → a true, cited, in-your-voice vignette,
   grounded in your local memory via /api/biographer/story.
   Self-contained surface (no entanglement with the legacy biographer page).
   ═══════════════════════════════════════════════════════ */

import { useState, useRef, type ReactNode } from "react";
import { Feather, Sparkles, Loader2, BookOpen, Quote, AlertCircle, ArrowRight } from "lucide-react";

type PointOfView = "memoir" | "biography" | "for-kids";
type StoryLength = "vignette" | "chapter";

interface Source { id: string; source: string; title: string; date?: string; snippet: string; }
interface StoryResult {
  subject: string; title?: string; era?: string; pov?: string;
  story: string; sources: Source[]; chunksUsed?: number;
  cited?: number[]; thin?: boolean; gapPrompt?: string; online?: boolean; mode?: string;
  error?: string;
}

const EXAMPLES = [
  "the summer of 2019",
  "my friendship with Sarah",
  "the week I felt most at peace",
  "my time in this city",
  "the people who shaped me",
];

const POVS: { id: PointOfView; label: string }[] = [
  { id: "memoir", label: "Memoir" },
  { id: "biography", label: "Biography" },
  { id: "for-kids", label: "For my kids" },
];

type Tone = "warm" | "wry" | "cinematic" | "spare" | "literary";
const TONES: { id: Tone; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "wry", label: "Wry" },
  { id: "cinematic", label: "Cinematic" },
  { id: "spare", label: "Spare" },
  { id: "literary", label: "Literary" },
];

export default function LifeStoryPage() {
  const [subject, setSubject] = useState("");
  const [pov, setPov] = useState<PointOfView>("memoir");
  const [length, setLength] = useState<StoryLength>("vignette");
  const [tone, setTone] = useState<Tone>("warm");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoryResult | null>(null);
  const [activeSrc, setActiveSrc] = useState<number | null>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);

  async function weave(subj?: string) {
    const s = (subj ?? subject).trim();
    if (s.length < 2 || loading) return;
    if (subj) setSubject(subj);
    setLoading(true); setResult(null); setActiveSrc(null);
    try {
      const res = await fetch("/api/biographer/story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: s, pov, length, tone }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ subject: s, story: "", sources: [], error: (e as Error).message });
    }
    setLoading(false);
  }

  function jumpToSource(n: number) {
    setActiveSrc(n);
    sourcesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => setActiveSrc((cur) => (cur === n ? null : cur)), 2200);
  }

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in" style={{ maxWidth: "46rem" }}>
        <header className="page-header" style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{
            width: 40, height: 40, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center",
            background: "var(--color-accent-dim)", color: "var(--color-accent)", flexShrink: 0,
          }}>
            <Feather size={20} />
          </span>
          <div>
            <h1 className="page-title">Life Historian</h1>
            <p className="page-subtitle">Tell me the story of your life — true, cited, and in your own voice.</p>
          </div>
        </header>

        {/* ── Prompt ── */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: "0.95rem", whiteSpace: "nowrap" }}>Tell me the story of</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && weave()}
              placeholder="a year · a person · a place · a moment…"
              className="modal-input"
              style={{ flex: 1, fontSize: "0.95rem" }}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem" }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => weave(ex)} className="btn-ghost"
                style={{ border: "1px solid var(--color-border)", fontSize: "0.75rem", padding: "0.3rem 0.6rem", color: "var(--color-text-muted)" }}>
                {ex}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginTop: "1rem", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
              <Segment label="Voice" options={POVS.map((p) => ({ id: p.id, label: p.label }))} value={pov} onChange={(v) => setPov(v as PointOfView)} />
              <Segment label="Tone" options={TONES.map((t) => ({ id: t.id, label: t.label }))} value={tone} onChange={(v) => setTone(v as Tone)} />
              <Segment label="Length" options={[{ id: "vignette", label: "Vignette" }, { id: "chapter", label: "Chapter" }]} value={length} onChange={(v) => setLength(v as StoryLength)} />
            </div>
            <button className="btn-primary" onClick={() => weave()} disabled={loading || subject.trim().length < 2} style={{ opacity: loading || subject.trim().length < 2 ? 0.6 : 1 }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? "Weaving…" : "Weave the story"}
            </button>
          </div>
        </div>

        {/* ── Result ── */}
        {result && !loading && (
          <div className="card animate-scale-up" style={{ padding: "1.75rem" }}>
            {result.error || result.online === false ? (
              <Notice tone="warn">{result.story || result.error || "Something went wrong."}{result.online === false && <div style={{ marginTop: 6, fontSize: "0.8rem" }}>The Life Historian needs your local model running (Ollama).</div>}</Notice>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                  <BookOpen size={16} style={{ color: "var(--color-accent)" }} />
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>{result.title || result.subject}</h2>
                  {result.era && <span className="badge-base badge-neutral">{result.era}</span>}
                  {result.thin && <span className="badge-base badge-warning">sparse memory</span>}
                </div>

                {result.story
                  ? <div style={{ fontSize: "1.02rem", lineHeight: 1.75, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                      {renderWithCitations(result.story, jumpToSource)}
                    </div>
                  : <p style={{ color: "var(--color-text-muted)" }}>No story yet.</p>}

                {result.gapPrompt && (
                  <Notice tone="info" style={{ marginTop: "1.25rem" }}>
                    <strong style={{ color: "var(--color-text-primary)" }}>Fill the gap:</strong> {result.gapPrompt}
                  </Notice>
                )}

                {result.sources.length > 0 && (
                  <div ref={sourcesRef} style={{ marginTop: "1.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                    <div className="section-label" style={{ marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 6 }}>
                      <Quote size={12} /> Sources — every line traces back here
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {result.sources.map((s, i) => {
                        const n = i + 1;
                        const on = activeSrc === n;
                        return (
                          <div key={s.id} style={{
                            display: "flex", gap: "0.6rem", padding: "0.5rem 0.6rem", borderRadius: "var(--radius-sm)",
                            background: on ? "var(--color-accent-dim)" : "transparent",
                            border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                            transition: "all 0.2s ease",
                          }}>
                            <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>{n}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                                <strong style={{ color: "var(--color-text-primary)" }}>{s.title}</strong>
                                <span style={{ color: "var(--color-text-dim)" }}> · {s.source}{s.date ? ` · ${s.date}` : ""}</span>
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: 2 }}>{s.snippet}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.6rem" }}>
                  <button className="btn-ghost" onClick={() => weave(result.subject)} style={{ border: "1px solid var(--color-border)" }}>
                    <Sparkles size={14} /> Retell
                  </button>
                  <button className="btn-ghost" onClick={() => { setResult(null); setSubject(""); }} style={{ border: "1px solid var(--color-border)" }}>
                    Tell another <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!result && !loading && (
          <p style={{ fontSize: "0.82rem", color: "var(--color-text-dim)", textAlign: "center", marginTop: "2rem" }}>
            Grounded entirely in your own memory. It never invents — where your memory is thin, it asks instead.
          </p>
        )}
      </div>
    </div>
  );
}

/* Render prose, turning [n] into clickable citation chips. */
function renderWithCitations(text: string, onJump: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      return (
        <sup key={i}>
          <button onClick={() => onJump(n)} title={`Source ${n}`}
            style={{ margin: "0 1px", padding: "0 4px", borderRadius: 4, fontSize: "0.7em", fontWeight: 700, cursor: "pointer", background: "var(--color-accent-dim)", color: "var(--color-accent)", border: "1px solid rgba(52,211,153,0.25)" }}>
            {n}
          </button>
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function Segment({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span className="section-label">{label}</span>
      <div style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button key={o.id} onClick={() => onChange(o.id)}
              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: on ? "var(--color-accent-dim)" : "transparent", color: on ? "var(--color-accent)" : "var(--color-text-muted)", border: "none" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Notice({ tone, children, style }: { tone: "warn" | "info"; children: ReactNode; style?: React.CSSProperties }) {
  const c = tone === "warn" ? "var(--color-warning)" : "var(--color-info)";
  return (
    <div style={{ display: "flex", gap: "0.6rem", padding: "0.75rem 0.9rem", borderRadius: "var(--radius-sm)", background: "var(--color-surface-elevated)", border: `1px solid ${c}33`, fontSize: "0.85rem", color: "var(--color-text-secondary)", ...style }}>
      <AlertCircle size={16} style={{ color: c, flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}
