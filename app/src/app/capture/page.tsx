"use client";

/* ═══════════════════════════════════════════════════════
   /capture — the laptop capture client (P1 reference).
   Apple-Health-style: Start → pick a kind → record → tag → send.
   Posts to the existing /api/ingest door. No hardware required;
   this is the reference flow every other client (phone, esp32,
   e-paper pendant) mirrors via the shared SESSION_KINDS registry.
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import {
  Users, User, MessageSquare, Phone, Mic, Lightbulb, Brain, NotebookPen,
  GraduationCap, BookMarked, CalendarDays, MapPin, Heart, CircleDot,
  Square, Send, Check, Loader, ChevronLeft, X,
} from "lucide-react";
import { SESSION_KINDS, getSessionKind, type SessionKind } from "@/lib/sessionKinds";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Users, User, MessageSquare, Phone, Mic, Lightbulb, Brain, NotebookPen,
  GraduationCap, BookMarked, CalendarDays, MapPin, Heart, CircleDot,
};

type Stage = "kinds" | "recording" | "review" | "sending" | "done";

function fmt(s: number) {
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function CapturePage() {
  const [stage, setStage] = useState<Stage>("kinds");
  const [kind, setKind] = useState<SessionKind | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [title, setTitle] = useState("");
  const [peopleStr, setPeopleStr] = useState("");
  const [note, setNote] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stopTimer(), []);
  function stopTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }

  async function startSession(k: SessionKind) {
    setKind(k); setSeconds(0); setMicError(null);
    setAudioBlob(null); setAudioUrl(null); setNote(""); setTitle(""); setPeopleStr("");
    setStage("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      rec.start();
      recRef.current = rec;
    } catch {
      // No mic / permission denied → still allow a typed session.
      setMicError("No microphone access — you can type the session instead.");
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopSession() {
    stopTimer();
    try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStage("review");
  }

  function reset() {
    setStage("kinds"); setKind(null); setSeconds(0); setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setNote(""); setTitle(""); setPeopleStr(""); setResult(null);
  }

  async function send() {
    if (!kind) return;
    setStage("sending");
    const people = peopleStr.split(",").map((p) => p.trim()).filter(Boolean);
    const date = new Date().toISOString().slice(0, 10);
    try {
      let res: Response;
      if (audioBlob && audioBlob.size > 0) {
        const fd = new FormData();
        const ext = (audioBlob.type.split("/")[1] || "webm").split(";")[0];
        fd.append("audio", audioBlob, `session.${ext}`);
        fd.append("source", "laptop");
        fd.append("kind", kind.label);
        if (title.trim()) fd.append("title", title.trim());
        if (people.length) fd.append("people", JSON.stringify(people));
        fd.append("date", date);
        res = await fetch("/api/ingest", { method: "POST", body: fd });
      } else {
        // No audio → send the typed note as JSON.
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: "laptop", kind: kind.label, title: title.trim() || undefined,
            people: people.length ? people : undefined, date,
            text: note.trim() || `${kind.label} session`,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ ok: true, msg: `Saved to memory — ${data.indexed ?? data.chunks ?? 0} chunk(s) indexed.` });
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    }
    setStage("done");
  }

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in" style={{ maxWidth: "48rem" }}>
        <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">Capture a session</h1>
            <p className="page-subtitle">Record a moment of life, tag it, send it to your brain.</p>
          </div>
          {stage !== "kinds" && (
            <button className="btn-ghost" onClick={reset} style={{ border: "1px solid var(--color-border)" }}>
              <ChevronLeft size={15} /> Start over
            </button>
          )}
        </div>

        {/* ── Stage: pick a kind ── */}
        {stage === "kinds" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" }}>
            {SESSION_KINDS.map((k, i) => {
              const Icon = ICONS[k.icon] ?? CircleDot;
              return (
                <button
                  key={k.id}
                  onClick={() => startSession(k)}
                  className={`card glow-card stagger-${(i % 6) + 1} animate-fade-in`}
                  style={{ padding: "1.25rem 1rem", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.6rem" }}
                >
                  <span style={{
                    width: 38, height: 38, borderRadius: "var(--radius-md)", display: "inline-flex",
                    alignItems: "center", justifyContent: "center",
                    background: "var(--color-accent-dim)", color: "var(--color-accent)",
                  }}>
                    <Icon size={19} />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text-primary)" }}>{k.label}</span>
                  {k.hint && <span style={{ fontSize: "0.72rem", color: "var(--color-text-dim)" }}>{k.hint}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Stage: recording ── */}
        {stage === "recording" && kind && (
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <div className="section-label" style={{ marginBottom: "0.75rem" }}>{kind.label}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
              {!micError && <span className="pulse-dot" style={{ background: "var(--color-danger)", boxShadow: "0 0 10px rgba(248,113,113,0.6)" }} />}
              <span style={{ fontSize: "2.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-text-primary)" }}>{fmt(seconds)}</span>
            </div>
            {micError
              ? <p style={{ color: "var(--color-warning)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>{micError}</p>
              : <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>Recording… speak freely. Stop when you’re done.</p>}
            <div>
              <button className="btn-primary" onClick={stopSession} style={{ padding: "0.65rem 1.5rem" }}>
                <Square size={15} /> Stop session
              </button>
            </div>
          </div>
        )}

        {/* ── Stage: review / tag ── */}
        {stage === "review" && kind && (
          <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="badge-base badge-success">{kind.label}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-dim)" }}>{fmt(seconds)} · {new Date().toLocaleDateString()}</span>
            </div>

            {audioUrl && <audio src={audioUrl} controls style={{ width: "100%" }} />}

            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span className="section-label">Title <span style={{ color: "var(--color-text-ghost)" }}>(optional)</span></span>
              <input className="modal-input" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={`${kind.label} — what was it about?`} />
            </label>

            {kind.promptsForPeople && (
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span className="section-label">Who was there? <span style={{ color: "var(--color-text-ghost)" }}>(comma-separated)</span></span>
                <input className="modal-input" value={peopleStr} onChange={(e) => setPeopleStr(e.target.value)}
                  placeholder="Jordan Lee, Alex Rivera" />
              </label>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span className="section-label">{audioBlob ? "Add a note" : "What happened?"} <span style={{ color: "var(--color-text-ghost)" }}>{audioBlob ? "(optional)" : "(no audio — type it)"}</span></span>
              <textarea className="modal-input" value={note} onChange={(e) => setNote(e.target.value)} rows={audioBlob ? 2 : 4}
                placeholder={audioBlob ? "Anything the transcript should be paired with…" : "Describe the session so the brain can recall it…"} />
            </label>

            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={reset} style={{ border: "1px solid var(--color-border)" }}><X size={15} /> Discard</button>
              <button className="btn-primary" onClick={send}><Send size={15} /> Send to brain</button>
            </div>
            {kind.defaultPrivacy === "private" && (
              <p style={{ fontSize: "0.72rem", color: "var(--color-text-dim)" }}>This kind defaults to private — stored locally, like everything in Rudder.</p>
            )}
          </div>
        )}

        {/* ── Stage: sending ── */}
        {stage === "sending" && (
          <div className="card" style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
            <Loader size={22} className="animate-spin" />
            <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>Transcribing &amp; indexing into memory…</p>
          </div>
        )}

        {/* ── Stage: done ── */}
        {stage === "done" && result && (
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <span style={{
              width: 46, height: 46, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: result.ok ? "var(--color-accent-dim)" : "rgba(248,113,113,0.12)",
              color: result.ok ? "var(--color-accent)" : "var(--color-danger)",
            }}>
              {result.ok ? <Check size={22} /> : <X size={22} />}
            </span>
            <p style={{ marginTop: "0.9rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {result.ok ? "Session captured" : "Couldn’t save"}
            </p>
            <p style={{ marginTop: "0.3rem", fontSize: "0.82rem", color: result.ok ? "var(--color-text-muted)" : "var(--color-danger)" }}>{result.msg}</p>
            {!result.ok && <p style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--color-text-dim)" }}>Tip: audio transcription needs a local Whisper at WHISPER_URL. A typed session works without it.</p>}
            <div style={{ marginTop: "1.25rem" }}>
              <button className="btn-primary" onClick={reset}>Capture another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
