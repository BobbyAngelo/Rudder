"use client";

/* ═══════════════════════════════════════════════════════
   /act — Rudder's Desk.
   The forward-facing inbox. Rudder proposes; you decide. Every card carries a
   grounded rationale and the memory it came from. Nothing acts without your
   confirm. Surfaces (no side effect) can be turned into drafts — a message or
   note written in your voice — which you edit and copy. Rudder never sends.
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import {
  Inbox, Loader2, Sparkles, Check, X, Clock, ChevronRight, Quote,
  PenLine, Copy, RefreshCw,
} from "lucide-react";

interface Source { id: string; source: string; title: string; date?: string; snippet: string; }
interface Proposal {
  id: number; kind: string; title: string; body: string; rationale: string;
  sources: Source[]; effect: { type: string }; status: string; createdAt: string;
}
interface KindInfo { kind: string; label: string; blurb: string; }

const KIND_TINT: Record<string, string> = {
  surface: "var(--color-accent)",
  draft: "#7c6cff",
  schedule: "#d98a3a",
};

export default function DeskPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [kinds, setKinds] = useState<KindInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");

  async function load() {
    const d = await fetch("/api/act").then((r) => r.json()).catch(() => null);
    if (d && !d.error) { setProposals(d.proposals || []); setKinds(d.kinds || []); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function scan() {
    if (scanning) return;
    setScanning(true); setNote("");
    const d = await fetch("/api/act/generate", { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (d && !d.error) {
      setProposals(d.proposals || []);
      setNote(d.added > 0 ? `${d.added} new ${d.added === 1 ? "item" : "items"} on your desk.` : "Nothing new to surface right now.");
    } else {
      setNote(d?.error ? `Couldn't scan: ${d.error}` : "Couldn't scan your memory. Is Ollama running?");
    }
    setScanning(false);
  }

  async function review(id: number, action: "confirm" | "dismiss" | "snooze", editedBody?: string) {
    if (busyId) return;
    setBusyId(id);
    // Persist any edit to a draft before confirming so "Use this" keeps your changes.
    if (action === "confirm" && typeof editedBody === "string") {
      await fetch(`/api/act/${id}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "edit", body: editedBody }),
      }).catch(() => {});
    }
    await fetch(`/api/act/${id}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    setProposals((ps) => ps.filter((p) => p.id !== id));
    setBusyId(null);
  }

  // Turn a surfaced item into a voiced draft; the new draft card appears in place.
  async function draft(source: Proposal) {
    if (draftingId) return;
    setDraftingId(source.id);
    const d = await fetch("/api/act/draft", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: source.id }),
    }).then((r) => r.json()).catch(() => null);
    if (d?.proposal) {
      // Insert the draft right after the card it came from.
      setProposals((ps) => {
        const i = ps.findIndex((p) => p.id === source.id);
        const next = [...ps];
        next.splice(i + 1, 0, d.proposal);
        return next;
      });
    } else {
      setNote(d?.error || "Couldn't write the draft. Is Ollama running?");
    }
    setDraftingId(null);
  }

  if (loading) {
    return <div className="page-container"><div className="page-content"><Loader2 className="animate-spin" style={{ color: "var(--color-text-dim)" }} /></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in" style={{ maxWidth: "46rem", paddingBottom: "4rem" }}>
        <header className="page-header" style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", background: "var(--color-accent-dim)", color: "var(--color-accent)", flexShrink: 0 }}><Inbox size={20} /></span>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">Rudder&apos;s desk</h1>
            <p className="page-subtitle">Things worth your attention, surfaced from your own memory. You decide what happens next — nothing acts without your say.</p>
          </div>
          <button className="btn-primary" onClick={scan} disabled={scanning} style={{ flexShrink: 0 }}>
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Scan now
          </button>
        </header>

        {note && (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", margin: "0 0 1rem 0.25rem" }}>{note}</div>
        )}

        {proposals.length === 0 ? (
          <div className="card" style={{ padding: "2.25rem", textAlign: "center", color: "var(--color-text-muted)" }}>
            <Inbox size={22} style={{ color: "var(--color-text-dim)" }} />
            <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", maxWidth: "28rem", marginInline: "auto" }}>
              Your desk is clear. Hit <strong>Scan now</strong> and Rudder will look through your memory for moments worth revisiting — a day from a past year, a relationship gone quiet, an open loop you left dangling.
            </p>
            {kinds.length > 0 && (
              <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                {kinds.map((k) => (
                  <span key={k.kind} className="badge-base badge-neutral" title={k.blurb} style={{ textTransform: "capitalize" }}>{k.label}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {proposals.map((p) => (
              <Card key={p.id} p={p} busy={busyId === p.id} drafting={draftingId === p.id}
                onReview={review} onDraft={draft} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ReviewFn = (id: number, a: "confirm" | "dismiss" | "snooze", editedBody?: string) => void;

function draftVerb(title: string): string {
  if (/been a while|quiet/i.test(title)) return "Draft a hello";
  if (/on this day/i.test(title)) return "Write a reflection";
  return "Draft the follow-up";
}

function Card({ p, busy, drafting, onReview, onDraft }: {
  p: Proposal; busy: boolean; drafting: boolean;
  onReview: ReviewFn; onDraft: (p: Proposal) => void;
}) {
  const tint = KIND_TINT[p.kind] || "var(--color-accent)";
  if (p.kind === "draft") return <DraftCard p={p} busy={busy} tint={tint} onReview={onReview} />;

  return (
    <div className="card" style={{ padding: "1.25rem 1.4rem", borderLeft: `3px solid ${tint}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span className="badge-base" style={{ background: "var(--color-surface-elevated)", color: tint, textTransform: "capitalize", fontWeight: 600 }}>{p.kind}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--color-text-dim)" }}>{p.createdAt?.slice(0, 10)}</span>
      </div>

      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-text-primary)", marginBottom: "0.35rem" }}>{p.title}</h3>

      {p.body && (
        <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--color-text-primary)", marginBottom: "0.6rem", whiteSpace: "pre-wrap" }}>{p.body}</p>
      )}

      {p.rationale && (
        <p style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "var(--color-text-muted)", marginBottom: p.sources.length ? "0.6rem" : "0.9rem", display: "flex", gap: "0.4rem" }}>
          <ChevronRight size={14} style={{ color: tint, flexShrink: 0, marginTop: "0.1rem" }} />
          <span>{p.rationale}</span>
        </p>
      )}

      {p.sources.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", margin: "0 0 0.95rem 0", paddingLeft: "0.2rem" }}>
          {p.sources.map((s) => (
            <div key={s.id} style={{ fontSize: "0.75rem", color: "var(--color-text-dim)", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
              <Quote size={12} style={{ flexShrink: 0, marginTop: "0.15rem", opacity: 0.6 }} />
              <span><span style={{ textTransform: "capitalize", color: "var(--color-text-muted)" }}>{s.source}</span>{s.date ? ` · ${s.date}` : ""} — {s.snippet}{s.snippet.length >= 160 ? "…" : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => onDraft(p)} disabled={busy || drafting} style={{ fontSize: "0.8rem" }}>
          {drafting ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />} {drafting ? "Writing…" : draftVerb(p.title)}
        </button>
        <button className="btn-ghost" onClick={() => onReview(p.id, "confirm")} disabled={busy || drafting} style={{ border: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Noted
        </button>
        <button className="btn-ghost" onClick={() => onReview(p.id, "snooze")} disabled={busy || drafting} style={{ border: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
          <Clock size={13} /> Later
        </button>
        <button className="btn-ghost" onClick={() => onReview(p.id, "dismiss")} disabled={busy || drafting} style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
          <X size={13} /> Dismiss
        </button>
      </div>
    </div>
  );
}

/* A draft is editable. "Use this" saves your edits then files it away (Rudder
   never sends). Copy puts it on your clipboard to paste wherever you like. */
function DraftCard({ p, busy, tint, onReview }: { p: Proposal; busy: boolean; tint: string; onReview: ReviewFn }) {
  const [text, setText] = useState(p.body);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div className="card" style={{ padding: "1.25rem 1.4rem", borderLeft: `3px solid ${tint}`, background: "var(--color-surface-elevated)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span className="badge-base" style={{ background: "var(--color-surface)", color: tint, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><PenLine size={11} /> Draft</span>
        <span style={{ fontSize: "0.72rem", color: "var(--color-text-dim)" }}>in your voice · not sent</span>
      </div>

      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>{p.title}</h3>

      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(Math.max(text.split("\n").length + 1, 4), 14)}
        style={{
          width: "100%", resize: "vertical", fontSize: "0.92rem", lineHeight: 1.6,
          color: "var(--color-text-primary)", background: "var(--color-surface)",
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
          padding: "0.7rem 0.8rem", fontFamily: "inherit", marginBottom: "0.5rem",
        }}
      />

      {p.rationale && (
        <p style={{ fontSize: "0.76rem", lineHeight: 1.5, color: "var(--color-text-dim)", marginBottom: "0.85rem" }}>{p.rationale}</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => onReview(p.id, "confirm", text)} disabled={busy} style={{ fontSize: "0.8rem" }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Use this
        </button>
        <button className="btn-ghost" onClick={copy} style={{ border: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
        <button className="btn-ghost" onClick={() => setText(p.body)} disabled={busy || text === p.body} style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>
          <RefreshCw size={13} /> Revert
        </button>
        <button className="btn-ghost" onClick={() => onReview(p.id, "dismiss")} disabled={busy} style={{ fontSize: "0.8rem", color: "var(--color-text-dim)", marginLeft: "auto" }}>
          <X size={13} /> Discard
        </button>
      </div>
    </div>
  );
}
