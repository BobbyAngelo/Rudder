"use client";

/* ═══════════════════════════════════════════════════════
   /identity — your personal profile, and the anchor the whole
   system reasons from. Everything here is indexed into local memory
   on save, so Ask and the Life Historian know who "you" are.
   ═══════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  User, MapPin, Mail, Phone, Globe, Calendar, Clock, Plus, X, Save, Loader2,
  Check, Target, BookOpen, Heart, Link2, Brain, Send, GripVertical,
} from "lucide-react";

interface Profile {
  display_name?: string; full_name?: string; headline?: string; bio?: string;
  operating_manual?: string; goals?: string; email?: string; phone?: string;
  location?: string; timezone?: string; date_of_birth?: string; website?: string;
}
interface ValueItem { label: string; description: string; }
interface Milestone { title: string; description: string; date: string; category: string; }
interface LinkItem { platform: string; url: string; label: string; }
interface AskSource { id: string; source: string; title: string; date?: string; snippet: string; }

const CATEGORIES = ["life", "career", "education", "personal"];

export default function IdentityPage() {
  const [profile, setProfile] = useState<Profile>({});
  const [values, setValues] = useState<ValueItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [askQ, setAskQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askSources, setAskSources] = useState<AskSource[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/identity");
      const d = await res.json();
      setProfile(d.profile || {});
      setValues((d.values || []).map((v: any) => ({ label: v.label || "", description: v.description || "" })));
      setMilestones((d.milestones || []).map((m: any) => ({ title: m.title || "", description: m.description || "", date: m.date || "", category: m.category || "life" })));
      setLinks((d.links || []).map((l: any) => ({ platform: l.platform || "", url: l.url || "", label: l.label || "" })));
    } catch { /* empty state */ }
    setLoading(false);
    setDirty(false);
  }

  const mark = useCallback(() => { setDirty(true); setSaveMsg(null); }, []);
  const setP = (k: keyof Profile, v: string) => { setProfile((p) => ({ ...p, [k]: v })); mark(); };

  async function save() {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch("/api/identity", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile,
          values: values.filter((v) => v.label.trim()).map((v, i) => ({ ...v, priority: i })),
          replaceValues: true,
          milestones: milestones.filter((m) => m.title.trim()),
          replaceMilestones: true,
          links: links.filter((l) => l.platform.trim() && l.url.trim()),
          replaceLinks: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setDirty(false);
      setSaveMsg(d.memoryIndexed != null ? `Saved — ${d.memoryIndexed} memories indexed into your brain.` : "Saved.");
    } catch (e) {
      setSaveMsg(`⚠️ ${(e as Error).message}`);
    }
    setSaving(false);
  }

  async function ask() {
    if (askQ.trim().length < 3 || asking) return;
    setAsking(true); setAskAnswer(""); setAskSources([]);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: askQ }) });
      const d = await res.json();
      setAskAnswer(d.answer || "No response.");
      setAskSources(Array.isArray(d.sources) ? d.sources : []);
    } catch { setAskAnswer("⚠️ Couldn't reach Rudder."); }
    setAsking(false);
  }

  // Completeness signal
  const signals = [
    !!profile.display_name?.trim(), !!profile.headline?.trim(), !!profile.bio?.trim(),
    !!profile.operating_manual?.trim(), !!profile.goals?.trim(), !!profile.location?.trim(),
    values.some((v) => v.label.trim()), milestones.some((m) => m.title.trim()), links.some((l) => l.url.trim()),
  ];
  const filled = signals.filter(Boolean).length;
  const pct = Math.round((filled / signals.length) * 100);
  const nextHint = !profile.display_name?.trim() ? "add your name"
    : !profile.headline?.trim() ? "add a one-line headline"
    : !profile.operating_manual?.trim() ? "write your operating manual"
    : !profile.goals?.trim() ? "note what you're working toward"
    : !values.some((v) => v.label.trim()) ? "add a few values"
    : !milestones.some((m) => m.title.trim()) ? "add a milestone or two"
    : !profile.bio?.trim() ? "write a short bio" : null;

  const name = profile.display_name?.trim() || "You";

  if (loading) return <div className="page-container"><div className="page-content"><Loader2 className="animate-spin" style={{ color: "var(--color-text-dim)" }} /></div></div>;

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in" style={{ maxWidth: "48rem", paddingBottom: "5rem" }}>

        {/* ── Header ── */}
        <div className="card" style={{ padding: "1.5rem", display: "flex", gap: "1.1rem", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: "1.5rem", fontWeight: 800, color: "#04130c", background: "var(--color-accent-gradient)" }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <input className="bare-input" style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em" }} value={profile.display_name || ""} onChange={(e) => setP("display_name", e.target.value)} placeholder="Your name" />
            <input className="bare-input" style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginTop: 2 }} value={profile.headline || ""} onChange={(e) => setP("headline", e.target.value)} placeholder="A one-line headline — e.g. Designer, runner, dad of two" />
          </div>
        </div>

        {/* ── Completeness ── */}
        <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span className="section-label">How well Rudder knows you</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: pct > 66 ? "var(--color-accent)" : "var(--color-text-secondary)" }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "var(--color-surface-elevated)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent-gradient)", transition: "width .4s ease" }} />
          </div>
          {nextHint && <p style={{ fontSize: "0.78rem", color: "var(--color-text-dim)", marginTop: "0.5rem" }}>Next: {nextHint}.</p>}
        </div>

        {/* ── Ask about yourself (proves the loop) ── */}
        <Section icon={<Brain size={15} />} title="Ask Rudder about you" subtitle="Everything below is indexed into your memory — try it.">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input className="modal-input" value={askQ} onChange={(e) => setAskQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="What do I value? · What am I working toward?" style={{ flex: 1 }} />
            <button className="btn-primary" onClick={ask} disabled={asking || askQ.trim().length < 3}>{asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
          </div>
          {askAnswer && (
            <div style={{ marginTop: "0.9rem", padding: "0.9rem", borderRadius: "var(--radius-sm)", background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--color-text-primary)" }}>{askAnswer}</p>
              {askSources.length > 0 && (
                <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {askSources.map((s, i) => (
                    <span key={s.id} className="badge-base badge-neutral" title={s.snippet}>{i + 1} · {s.title}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Bio ── */}
        <Section icon={<User size={15} />} title="About you">
          <textarea className="modal-input" rows={3} value={profile.bio || ""} onChange={(e) => setP("bio", e.target.value)} placeholder="A short bio in your own words — who you are, what you care about." />
        </Section>

        {/* ── Operating manual ── */}
        <Section icon={<BookOpen size={15} />} title="Your operating manual" subtitle="How you work and how to work with you — Rudder reasons in your frame.">
          <textarea className="modal-input" rows={4} value={profile.operating_manual || ""} onChange={(e) => setP("operating_manual", e.target.value)} placeholder="e.g. I think best in the morning. Be direct with me. I value depth over speed. Don't sugar-coat feedback." />
        </Section>

        {/* ── Goals ── */}
        <Section icon={<Target size={15} />} title="What you're working toward" subtitle="Your current focus, so the system knows what matters now.">
          <textarea className="modal-input" rows={3} value={profile.goals || ""} onChange={(e) => setP("goals", e.target.value)} placeholder="e.g. Ship Rudder. Run a half-marathon. Be more present at home." />
        </Section>

        {/* ── Values ── */}
        <Section icon={<Heart size={15} />} title="Values & principles" subtitle="What you live by — aligns how Rudder reasons for you.">
          <ListEditor
            items={values}
            onChange={(v) => { setValues(v); mark(); }}
            blank={{ label: "", description: "" }}
            addLabel="Add a value"
            render={(item, set) => (
              <>
                <input className="modal-input" style={{ flex: "0 0 32%" }} value={item.label} onChange={(e) => set({ ...item, label: e.target.value })} placeholder="Honesty" />
                <input className="modal-input" style={{ flex: 1 }} value={item.description} onChange={(e) => set({ ...item, description: e.target.value })} placeholder="Why it matters to you (optional)" />
              </>
            )}
          />
        </Section>

        {/* ── Milestones ── */}
        <Section icon={<Calendar size={15} />} title="Milestones" subtitle="Key moments — the first fixed points on your life story's timeline.">
          <ListEditor
            items={milestones}
            onChange={(v) => { setMilestones(v); mark(); }}
            blank={{ title: "", description: "", date: "", category: "life" }}
            addLabel="Add a milestone"
            render={(item, set) => (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <input className="modal-input" style={{ flex: 1 }} value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} placeholder="Moved to Portland" />
                  <input className="modal-input" type="date" style={{ flex: "0 0 9rem" }} value={item.date} onChange={(e) => set({ ...item, date: e.target.value })} />
                  <select className="modal-input" style={{ flex: "0 0 7rem" }} value={item.category} onChange={(e) => set({ ...item, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input className="modal-input" value={item.description} onChange={(e) => set({ ...item, description: e.target.value })} placeholder="What happened, and why it mattered (optional)" />
              </div>
            )}
          />
        </Section>

        {/* ── Links ── */}
        <Section icon={<Link2 size={15} />} title="Links" subtitle="Your presence online.">
          <ListEditor
            items={links}
            onChange={(v) => { setLinks(v); mark(); }}
            blank={{ platform: "", url: "", label: "" }}
            addLabel="Add a link"
            render={(item, set) => (
              <>
                <input className="modal-input" style={{ flex: "0 0 28%" }} value={item.platform} onChange={(e) => set({ ...item, platform: e.target.value })} placeholder="github" />
                <input className="modal-input" style={{ flex: 1 }} value={item.url} onChange={(e) => set({ ...item, url: e.target.value })} placeholder="https://…" />
              </>
            )}
          />
        </Section>

        {/* ── Details ── */}
        <Section icon={<MapPin size={15} />} title="Details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Detail icon={<MapPin size={14} />} value={profile.location || ""} onChange={(v) => setP("location", v)} placeholder="Location" />
            <Detail icon={<Clock size={14} />} value={profile.timezone || ""} onChange={(v) => setP("timezone", v)} placeholder="Timezone" />
            <Detail icon={<Mail size={14} />} value={profile.email || ""} onChange={(v) => setP("email", v)} placeholder="Email" />
            <Detail icon={<Phone size={14} />} value={profile.phone || ""} onChange={(v) => setP("phone", v)} placeholder="Phone" />
            <Detail icon={<Globe size={14} />} value={profile.website || ""} onChange={(v) => setP("website", v)} placeholder="Website" />
            <Detail icon={<Calendar size={14} />} value={profile.date_of_birth || ""} onChange={(v) => setP("date_of_birth", v)} placeholder="Birthday" type="date" />
          </div>
        </Section>
      </div>

      {/* ── Sticky save bar ── */}
      {(dirty || saveMsg) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", background: "rgba(8,8,10,0.85)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--color-border)", zIndex: 40 }}>
          {saveMsg && <span style={{ fontSize: "0.85rem", color: saveMsg.startsWith("⚠️") ? "var(--color-danger)" : "var(--color-accent)", display: "flex", alignItems: "center", gap: 6 }}>{!saveMsg.startsWith("⚠️") && <Check size={15} />}{saveMsg}</span>}
          {dirty && (
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
            </button>
          )}
        </div>
      )}

      <style>{`
        .bare-input { width: 100%; background: transparent; border: none; outline: none; color: var(--color-text-primary); padding: 0; }
        .bare-input::placeholder { color: var(--color-text-dim); }
      `}</style>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: subtitle ? "0.15rem" : "0.75rem" }}>
        <span style={{ color: "var(--color-accent)" }}>{icon}</span>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: "0.78rem", color: "var(--color-text-dim)", marginBottom: "0.75rem" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function Detail({ icon, value, onChange, placeholder, type }: { icon: ReactNode; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-background)" }}>
      <span style={{ color: "var(--color-text-dim)", flexShrink: 0 }}>{icon}</span>
      <input className="bare-input" type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ fontSize: "0.85rem" }} />
    </div>
  );
}

function ListEditor<T>({ items, onChange, blank, addLabel, render }: { items: T[]; onChange: (items: T[]) => void; blank: T; addLabel: string; render: (item: T, set: (next: T) => void) => ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
          <span style={{ color: "var(--color-text-ghost)", paddingTop: 8, flexShrink: 0 }}><GripVertical size={14} /></span>
          {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))))}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="btn-ghost" style={{ flexShrink: 0, padding: "0.4rem", color: "var(--color-text-dim)" }} title="Remove"><X size={14} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...blank }])} className="btn-ghost" style={{ alignSelf: "flex-start", border: "1px dashed var(--color-border)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}
