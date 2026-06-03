"use client";

/* ═══════════════════════════════════════════════════════
   Onboarding — a clean, standard first-run flow.
   Welcome → who you are (→ profile + memory) → you're set.
   Sovereign by default; no external accounts required.
   ═══════════════════════════════════════════════════════ */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Feather, ArrowRight, Loader2, Check, Lock, Database } from "lucide-react";
import { getDefaultEnabledModules } from "@/lib/modules";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveIdentity() {
    setSaving(true); setError("");
    try {
      await fetch("/api/identity", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            display_name: displayName.trim(),
            full_name: fullName.trim(),
            bio: bio.trim(),
            location: location.trim(),
          },
        }),
      });
      setStep(3);
    } catch (e) {
      setError((e as Error).message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarding_completed: 1, enabled_modules: getDefaultEnabledModules() }),
      });
    } catch { /* proceed regardless */ }
    router.push("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "var(--color-background)" }}>
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: "32rem" }}>

        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "center", marginBottom: "1.5rem" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", fontWeight: 800, color: "#04130c", background: "var(--color-accent-gradient)", boxShadow: "var(--shadow-accent-glow)" }}>R</span>
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>Rudder</span>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: "1.75rem" }}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ width: n === step ? 22 : 7, height: 7, borderRadius: 99, transition: "all .25s", background: n <= step ? "var(--color-accent)" : "var(--color-border)" }} />
          ))}
        </div>

        <div className="card" style={{ padding: "2rem" }}>
          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div style={{ textAlign: "center" }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, display: "inline-grid", placeItems: "center", background: "var(--color-accent-dim)", color: "var(--color-accent)", marginBottom: "1rem" }}>
                <ShieldCheck size={24} />
              </span>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)" }}>Welcome to Rudder</h1>
              <p style={{ color: "var(--color-text-muted)", marginTop: "0.6rem", lineHeight: 1.6, fontSize: "0.95rem" }}>
                A private memory layer for your own AI. Point it at your life, ask across it with citations, and let it tell your story — all on your machine.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", margin: "1.5rem 0", textAlign: "left" }}>
                <Assurance icon={<Lock size={15} />} text="100% local — your data never leaves this computer." />
                <Assurance icon={<Database size={15} />} text="One private SQLite store you own. No account, no cloud." />
                <Assurance icon={<Feather size={15} />} text="Ask it anything, and it answers with receipts." />
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: "0.75rem" }} onClick={() => setStep(2)}>
                Get started <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 2: Who are you ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>Who are you?</h2>
              <p style={{ color: "var(--color-text-muted)", marginTop: "0.35rem", fontSize: "0.875rem" }}>
                This becomes the first thing Rudder remembers about you — so "I", "me", and "my" resolve to the right person. You can edit it anytime.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "1.25rem" }}>
                <Field label="What should I call you?" required>
                  <input className="modal-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" autoFocus />
                </Field>
                <Field label="Full name" hint="(optional)">
                  <input className="modal-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
                </Field>
                <Field label="A line about you" hint="(optional)">
                  <input className="modal-input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Designer, runner, dad of two." />
                </Field>
                <Field label="Where you're based" hint="(optional)">
                  <input className="modal-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Portland, OR" />
                </Field>
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: "0.8rem", marginTop: "0.75rem" }}>{error}</p>}
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem" }}>
                <button className="btn-ghost" style={{ border: "1px solid var(--color-border)" }} onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={saveIdentity} disabled={saving || displayName.trim().length < 1}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: You're set ── */}
          {step === 3 && (
            <div style={{ textAlign: "center" }}>
              <span style={{ width: 48, height: 48, borderRadius: 999, display: "inline-grid", placeItems: "center", background: "var(--color-accent-dim)", color: "var(--color-accent)", marginBottom: "1rem" }}>
                <Check size={24} />
              </span>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
                You're set{displayName ? `, ${displayName.trim()}` : ""}.
              </h2>
              <p style={{ color: "var(--color-text-muted)", marginTop: "0.6rem", lineHeight: 1.6, fontSize: "0.92rem" }}>
                Rudder knows who you are. Now give it something to remember:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", margin: "1.25rem 0", textAlign: "left" }}>
                <NextStep n="1" text="Connect a folder of notes, a calendar, or contacts in Settings → Connectors." />
                <NextStep n="2" text="Or capture a session — record a meeting or an idea from the Capture tab." />
                <NextStep n="3" text="Then ask anything, or have the Life Historian tell your story." />
              </div>
              <button className="btn-primary" style={{ width: "100%", padding: "0.75rem" }} onClick={finish} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : null} Enter Rudder <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--color-text-dim)", marginTop: "1rem" }}>
          Everything you enter stays on this device.
        </p>
      </div>
    </div>
  );
}

function Assurance({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
      <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>{icon}</span>{text}
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span className="section-label">
        {label}{required && <span style={{ color: "var(--color-accent)" }}> *</span>}{hint && <span style={{ color: "var(--color-text-ghost)", textTransform: "none" }}> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function NextStep({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}>{n}</span>
      {text}
    </div>
  );
}
