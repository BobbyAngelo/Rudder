"use client";

/* ═══════════════════════════════════════════════════════
   /biographer/book — your whole life as a book.
   The memory timeline becomes a table of contents (eras → chapters);
   each chapter is assembled and polished from that era's real moments;
   then export it to Markdown or print it to a keepsake.
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { BookOpen, Loader2, Download, Printer, Feather, Sparkles } from "lucide-react";

type PointOfView = "memoir" | "biography" | "for-kids";
type Tone = "warm" | "wry" | "cinematic" | "spare" | "literary";
interface Era { label: string; from: string; to: string; count: number; }
interface Outline { eras: Era[]; total: number; span: { from: string; to: string } | null; }

const POVS: PointOfView[] = ["memoir", "biography", "for-kids"];
const TONES: Tone[] = ["warm", "wry", "cinematic", "spare", "literary"];
const stripCites = (s: string) => s.replace(/\s*\[\d+\]/g, "");

export default function BookPage() {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [name, setName] = useState("");
  const [pov, setPov] = useState<PointOfView>("memoir");
  const [tone, setTone] = useState<Tone>("warm");
  const [chapters, setChapters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // era.label being written, or "all"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/biographer/outline").then((r) => r.json()).then((d) => { if (!d.error) setOutline(d); }).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/identity").then((r) => r.json()).then((d) => setName(d?.profile?.display_name || "")).catch(() => {});
  }, []);

  const title = name ? `The Life of ${name}` : "A Life";

  async function writeChapter(era: Era): Promise<string> {
    const res = await fetch("/api/biographer/chapter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: era.label, from: era.from, to: era.to, pov, tone }),
    });
    const d = await res.json();
    return d.story || (d.error ? `⚠️ ${d.error}` : "");
  }

  async function generateOne(era: Era) {
    if (busy) return;
    setBusy(era.label);
    const story = await writeChapter(era);
    setChapters((c) => ({ ...c, [era.label]: story }));
    setBusy(null);
  }

  async function generateAll() {
    if (busy || !outline) return;
    setBusy("all");
    for (const era of outline.eras) {
      const story = await writeChapter(era);
      setChapters((c) => ({ ...c, [era.label]: story }));
    }
    setBusy(null);
  }

  const written = outline ? outline.eras.filter((e) => chapters[e.label]?.trim()) : [];

  function buildMarkdown(): string {
    const md = [`# ${title}`, ""];
    for (const era of written) {
      md.push(`## ${era.label}`, "", stripCites(chapters[era.label]).trim(), "");
    }
    return md.join("\n");
  }

  function downloadMd() {
    const blob = new Blob([buildMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "life-story.md"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printBook() {
    const w = window.open("", "_blank");
    if (!w) return;
    const chaptersHtml = written.map((era) => {
      const paras = stripCites(chapters[era.label]).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>").trim()}</p>`).join("\n");
      return `<section><h2>${era.label}</h2>${paras}</section>`;
    }).join("\n");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { margin: 22mm; }
        body { font-family: Georgia, 'Times New Roman', serif; color:#1a1a1a; line-height:1.7; max-width:38rem; margin:0 auto; }
        .title-page { text-align:center; padding:42vh 0 50vh; page-break-after:always; }
        .title-page h1 { font-size:2.4rem; font-weight:600; letter-spacing:-0.01em; }
        section { page-break-before:always; }
        h2 { font-size:1.5rem; font-weight:600; margin:0 0 1.2rem; }
        p { margin:0 0 1rem; text-align:justify; }
      </style></head>
      <body><div class="title-page"><h1>${title}</h1></div>${chaptersHtml}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  }

  if (loading) return <div className="page-container"><div className="page-content"><Loader2 className="animate-spin" style={{ color: "var(--color-text-dim)" }} /></div></div>;

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in" style={{ maxWidth: "46rem", paddingBottom: "4rem" }}>
        <header className="page-header" style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", background: "var(--color-accent-dim)", color: "var(--color-accent)", flexShrink: 0 }}><BookOpen size={20} /></span>
          <div>
            <h1 className="page-title">Your life story</h1>
            <p className="page-subtitle">Your memory, assembled into chapters — true, cited, in your voice. Then take it with you.</p>
          </div>
        </header>

        {(!outline || outline.eras.length === 0) ? (
          <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
            <Feather size={22} style={{ color: "var(--color-text-dim)" }} />
            <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>No dated memories yet. Connect a calendar, photos, email, or your exports — and the chapters of your life will appear here as a table of contents.</p>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                <Seg label="Voice" options={POVS} value={pov} onChange={(v) => setPov(v as PointOfView)} />
                <Seg label="Tone" options={TONES} value={tone} onChange={(v) => setTone(v as Tone)} />
              </div>
              <button className="btn-primary" onClick={generateAll} disabled={!!busy}>
                {busy === "all" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Write the whole book
              </button>
            </div>

            <div style={{ fontSize: "0.78rem", color: "var(--color-text-dim)", margin: "0 0 0.9rem 0.25rem" }}>
              {outline.eras.length} chapters · {outline.total.toLocaleString()} moments
              {outline.span && <> · {outline.span.from.slice(0, 4)}–{outline.span.to.slice(0, 4)}</>}
              {written.length > 0 && <> · {written.length} written</>}
            </div>

            {/* Chapters */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {outline.eras.map((era) => {
                const prose = chapters[era.label];
                const writing = busy === era.label || (busy === "all" && !prose);
                return (
                  <div key={era.label} className="card" style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: prose ? "1rem" : 0 }}>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>{era.label}</h2>
                      <span className="badge-base badge-neutral">{era.count} moments</span>
                      <div style={{ flex: 1 }} />
                      {!prose && (
                        <button className="btn-ghost" style={{ border: "1px solid var(--color-border)" }} onClick={() => generateOne(era)} disabled={!!busy}>
                          {writing ? <Loader2 size={14} className="animate-spin" /> : <Feather size={14} />} Write
                        </button>
                      )}
                    </div>
                    {prose && (
                      <div style={{ fontFamily: "Georgia, serif", fontSize: "1.02rem", lineHeight: 1.8, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                        {stripCites(prose)}
                      </div>
                    )}
                    {!prose && writing && <p style={{ color: "var(--color-text-dim)", fontSize: "0.85rem", marginTop: "0.75rem" }}>Writing this chapter…</p>}
                  </div>
                );
              })}
            </div>

            {/* Export */}
            {written.length > 0 && (
              <div className="card" style={{ padding: "1.25rem", marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
                <span className="section-label" style={{ marginRight: "auto" }}>Your book, yours to keep</span>
                <button className="btn-ghost" style={{ border: "1px solid var(--color-border)" }} onClick={downloadMd}><Download size={14} /> Markdown</button>
                <button className="btn-primary" onClick={printBook}><Printer size={14} /> Print / PDF</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Seg({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span className="section-label">{label}</span>
      <div style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden", flexWrap: "wrap" }}>
        {options.map((o) => {
          const on = value === o;
          return (
            <button key={o} onClick={() => onChange(o)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", textTransform: "capitalize", background: on ? "var(--color-accent-dim)" : "transparent", color: on ? "var(--color-accent)" : "var(--color-text-muted)", border: "none" }}>
              {o.replace("-", " ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
