"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User, Mail, Phone, MapPin, Globe, Calendar, Star, Flag,
  Link as LinkIcon, Save, Pencil, X, Loader2,
  ExternalLink, Copy, Check, Plus, Trash2, ArrowUp, ArrowDown,
  Clock, Compass, Briefcase, GraduationCap, Award, Flame, Target
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Identity — Single-Page Sovereign Profile Dashboard
   
   Slick multi-column layout with cool-toned accents:
   - Cover banner & Avatar initials overlay
   - Left Column: Metadata & Contact Directory + Sovereign Links
   - Right Column: Core Values Priority List + Milestone Timeline
   - Dynamic inline editing and SQLite syncing.
   ═══════════════════════════════════════════════════════ */

interface Profile {
  display_name: string;
  full_name: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  website: string;
}

interface Value {
  id?: number;
  label: string;
  description: string;
  priority: number;
}

interface Milestone {
  id?: number;
  title: string;
  description: string;
  date: string | null;
  category: string;
}

interface IdentityLink {
  id?: number;
  platform: string;
  url: string;
  label: string;
}

const ACCENT = "var(--color-section-identity)"; // Teal/Emerald themed local accent

export default function IdentityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Value[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [links, setLinks] = useState<IdentityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit drafts
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [draftValues, setDraftValues] = useState<Value[]>([]);
  const [draftLinks, setDraftLinks] = useState<IdentityLink[]>([]);
  const [draftMilestones, setDraftMilestones] = useState<Milestone[]>([]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState("");

  // Habits States
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [habitDraft, setHabitDraft] = useState<any>({ frequency: "daily", color: "#34d399" });
  const [habitSaving, setHabitSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/identity");
      const data = await res.json();
      setProfile(data.profile);
      setValues(data.values || []);
      setMilestones(data.milestones || []);
      setLinks(data.links || []);
    } catch (err) {
      console.error("Failed to fetch identity:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch("/api/habits");
      const data = await res.json();
      setHabits(data.habits || []);
      setHabitLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to fetch habits:", err);
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchHabits();
  }, [fetchData, fetchHabits]);

  // Document Title SEO Hook
  useEffect(() => {
    document.title = "Identity Profile | Rudder";
  }, []);

  // Timezone live clock
  useEffect(() => {
    if (!profile?.timezone) return;
    const updateTime = () => {
      try {
        const time = new Date().toLocaleTimeString("en-US", {
          timeZone: profile.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
        setLocalTime(time);
      } catch (e) {
        setLocalTime("");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [profile?.timezone]);

  const startEditing = () => {
    setDraft({ ...profile! });
    setDraftValues([...values]);
    setDraftLinks([...links]);
    setDraftMilestones([...milestones]);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/identity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: draft,
          values: draftValues,
          replaceValues: true,
          links: draftLinks,
          replaceLinks: true,
          milestones: draftMilestones,
          replaceMilestones: true
        }),
      });
      setEditing(false);
      await fetchData();
    } catch (err) {
      console.error("Failed to save identity:", err);
    } finally {
      setSaving(false);
    }
  };

  // Habits Actions
  const toggleHabit = async (habitId: number) => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const isCompleted = habitLogs.some(l => l.habit_id === habitId && l.date === dateStr);
    
    // Optimistic update
    if (isCompleted) {
      setHabitLogs(habitLogs.filter(l => !(l.habit_id === habitId && l.date === dateStr)));
    } else {
      setHabitLogs([{ habit_id: habitId, date: dateStr, status: "completed" }, ...habitLogs]);
    }

    try {
      await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habitId, date: dateStr })
      });
      await fetchHabits();
    } catch (err) {
      console.error("Failed to toggle habit", err);
      fetchHabits();
    }
  };

  const calculateStreak = (habitId: number) => {
    const logsForHabit = habitLogs.filter(l => l.habit_id === habitId).map(l => l.date).sort().reverse();
    if (logsForHabit.length === 0) return 0;

    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0,0,0,0);
    const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
    
    let currentCheckStr = checkDateStr;
    if (logsForHabit.includes(checkDateStr)) {
      streak = 1;
    } else {
      const yesterday = new Date(checkDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      if (logsForHabit.includes(yesterdayStr)) {
        currentCheckStr = yesterdayStr;
        streak = 1;
      } else {
        return 0;
      }
    }

    let currentCheck = new Date(currentCheckStr);
    while (true) {
      currentCheck.setDate(currentCheck.getDate() - 1);
      const str = `${currentCheck.getFullYear()}-${String(currentCheck.getMonth() + 1).padStart(2, "0")}-${String(currentCheck.getDate()).padStart(2, "0")}`;
      if (logsForHabit.includes(str)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitDraft.title) return;
    setHabitSaving(true);
    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(habitDraft)
      });
      setShowHabitModal(false);
      setHabitDraft({ frequency: "daily", color: "#34d399" });
      await fetchHabits();
    } catch (err) {
      console.error("Failed to save habit:", err);
    } finally {
      setHabitSaving(false);
    }
  };

  const handleDeleteHabit = async (id: number) => {
    if (!confirm("Are you sure you want to delete this habit? All check-in history will be removed.")) return;
    try {
      await fetch(`/api/habits?id=${id}`, { method: "DELETE" });
      await fetchHabits();
    } catch (err) {
      console.error("Failed to delete habit:", err);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getZodiacSign = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const signs = [
      { name: "Capricorn ♑", start: [12, 22], end: [1, 19] },
      { name: "Aquarius ♒", start: [1, 20], end: [2, 18] },
      { name: "Pisces ♓", start: [2, 19], end: [3, 20] },
      { name: "Aries ♈", start: [3, 21], end: [4, 19] },
      { name: "Taurus ♉", start: [4, 20], end: [5, 20] },
      { name: "Gemini ♊", start: [5, 21], end: [6, 20] },
      { name: "Cancer ♋", start: [6, 21], end: [7, 22] },
      { name: "Leo ♌", start: [7, 23], end: [8, 22] },
      { name: "Virgo ♍", start: [8, 23], end: [9, 22] },
      { name: "Libra ♎", start: [9, 23], end: [10, 22] },
      { name: "Scorpio ♏", start: [10, 23], end: [11, 21] },
      { name: "Sagittarius ♐", start: [11, 22], end: [12, 21] }
    ];
    
    for (const sign of signs) {
      const [sm, sd] = sign.start;
      const [em, ed] = sign.end;
      if ((month === sm && day >= sd) || (month === em && day <= ed)) {
        return sign.name;
      }
    }
    return "Capricorn ♑";
  };

  const calculateAge = (dateStr: string | null) => {
    if (!dateStr) return null;
    const birthDate = new Date(dateStr);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Values editor actions
  const moveValue = (index: number, direction: "up" | "down") => {
    const newValues = [...draftValues];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newValues.length) return;
    
    const temp = newValues[index];
    newValues[index] = newValues[targetIndex];
    newValues[targetIndex] = temp;
    
    const updated = newValues.map((v, idx) => ({ ...v, priority: idx + 1 }));
    setDraftValues(updated);
  };

  const addValue = () => {
    const newValue: Value = {
      label: "New Core Value",
      description: "Description of what drives this philosophy...",
      priority: draftValues.length + 1
    };
    setDraftValues([...draftValues, newValue]);
  };

  const deleteValue = (index: number) => {
    const filtered = draftValues.filter((_, idx) => idx !== index);
    const updated = filtered.map((v, idx) => ({ ...v, priority: idx + 1 }));
    setDraftValues(updated);
  };

  const updateValue = (index: number, fields: Partial<Value>) => {
    setDraftValues(draftValues.map((v, idx) => idx === index ? { ...v, ...fields } : v));
  };

  // Milestones editor actions
  const addMilestone = () => {
    const newMilestone: Milestone = {
      title: "New Landmark Milestone",
      description: "Short highlight summary...",
      date: new Date().toISOString().split("T")[0],
      category: "life"
    };
    setDraftMilestones([newMilestone, ...draftMilestones]);
  };

  const deleteMilestone = (index: number) => {
    setDraftMilestones(draftMilestones.filter((_, idx) => idx !== index));
  };

  const updateMilestone = (index: number, fields: Partial<Milestone>) => {
    setDraftMilestones(draftMilestones.map((m, idx) => idx === index ? { ...m, ...fields } : m));
  };

  // Links editor actions
  const addLink = () => {
    const newLink: IdentityLink = {
      platform: "github",
      url: "https://github.com/",
      label: "GitHub Profile"
    };
    setDraftLinks([...draftLinks, newLink]);
  };

  const deleteLink = (index: number) => {
    setDraftLinks(draftLinks.filter((_, idx) => idx !== index));
  };

  const updateLink = (index: number, fields: Partial<IdentityLink>) => {
    setDraftLinks(draftLinks.map((l, idx) => idx === index ? { ...l, ...fields } : l));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  const age = calculateAge(profile?.date_of_birth ?? null);
  const zodiac = getZodiacSign(profile?.date_of_birth ?? null);

  return (
    <div className="relative min-h-screen bg-background text-text-primary selection:bg-emerald-500/25 selection:text-white pb-16">
      
      {/* Decorative top lighting spotlights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.04),transparent_60%)] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 pt-10 relative z-10 space-y-6">
        
        {/* ── COVER & HEADER BANNER ── */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-border bg-surface/10">
          {/* Banner cover backdrop */}
          <div className="h-28 w-full bg-gradient-to-r from-emerald-950/20 via-background to-blue-950/20 border-b border-border relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(52,211,153,0.05),transparent_40%)]" />
          </div>

          <div className="px-8 pb-8 relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex flex-col md:flex-row gap-6 items-start -mt-10">
              
              {/* Avatar Grid */}
              <div className="w-20 h-20 rounded-2xl border-2 border-border bg-background flex items-center justify-center text-xl font-mono font-bold text-emerald-400 shadow-xl shrink-0 ring-4 ring-emerald-500/5 overflow-hidden">
                {editing ? (
                  "✍️"
                ) : profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (profile?.display_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                )}
              </div>

              {/* Names & Short Bio */}
              <div className="space-y-1 md:pt-12 min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-2 max-w-md">
                    <input
                      value={draft.display_name || ""}
                      onChange={e => setDraft({ ...draft, display_name: e.target.value })}
                      placeholder="Display Name"
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-base font-semibold text-white outline-none w-full focus:border-emerald-500/40"
                    />
                    <input
                      value={draft.full_name || ""}
                      onChange={e => setDraft({ ...draft, full_name: e.target.value })}
                      placeholder="Full Legal Name"
                      className="bg-background border border-border rounded-lg px-3 py-1 text-xs text-text-secondary outline-none w-full focus:border-emerald-500/40"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {profile?.display_name || "Set Display Name"}
                    </h1>
                    {profile?.full_name && (
                      <p className="text-xs text-text-secondary font-mono">
                        {profile.full_name}
                      </p>
                    )}
                  </>
                )}

                <div className="pt-2">
                  {editing ? (
                    <textarea
                      value={draft.bio || ""}
                      onChange={e => setDraft({ ...draft, bio: e.target.value })}
                      placeholder="Brief bio about yourself..."
                      rows={2}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-secondary outline-none w-full focus:border-emerald-500/40 resize-none max-w-xl"
                    />
                  ) : profile?.bio ? (
                    <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic">No biography configured.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 md:pt-12 shrink-0">
              {editing ? (
                <>
                  <button 
                    onClick={cancelEditing} 
                    className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-text-secondary border border-border hover:border-border-hover bg-surface/30 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-background font-bold transition-all hover:scale-[1.02] flex items-center gap-1.5"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                </>
              ) : (
                <button 
                  onClick={startEditing} 
                  className="px-5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-text-secondary border border-border hover:border-border-hover bg-surface/30 transition-all flex items-center gap-1.5"
                >
                  <Pencil size={12} /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── TWO COLUMN MULTI-DASHBOARD ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ════════ LEFT COLUMN (DIRECTORY & LINKS) ════════ */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Contact Details Card */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Compass size={14} className="text-emerald-400" />
                <span className="text-[10px] uppercase font-mono tracking-widest text-text-secondary font-semibold">
                  Sovereign Directory
                </span>
              </div>

              {editing ? (
                /* Editing fields */
                <div className="space-y-4">
                  {[
                    { key: "email", label: "Email", placeholder: "e.g. hello@domain.com" },
                    { key: "phone", label: "Phone", placeholder: "e.g. +1 (555) 0199" },
                    { key: "location", label: "Location", placeholder: "e.g. Brooklyn, NY" },
                    { key: "website", label: "Website", placeholder: "e.g. https://domain.com" },
                    { key: "timezone", label: "Timezone", placeholder: "e.g. America/New_York" },
                    { key: "avatar_url", label: "Avatar Image URL", placeholder: "e.g. /my-avatar.jpg or https://..." },
                    { key: "date_of_birth", label: "Birthday (YYYY-MM-DD)", placeholder: "e.g. 1995-10-24" }
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
                        {field.label}
                      </label>
                      <input
                        value={(draft[field.key as keyof Profile] as string) || ""}
                        onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Displaying fields */
                <div className="space-y-4">
                  {/* Email */}
                  {profile?.email && (
                    <div className="flex items-start justify-between group">
                      <div className="flex gap-3">
                        <Mail size={14} className="text-text-muted mt-1 shrink-0" />
                        <div>
                          <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Email Address</div>
                          <span className="text-xs text-text-primary">{profile.email}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(profile.email, "email")}
                        className="text-text-dim hover:text-emerald-400 p-1 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        {copiedField === "email" ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Phone */}
                  {profile?.phone && (
                    <div className="flex items-start justify-between group">
                      <div className="flex gap-3">
                        <Phone size={14} className="text-text-muted mt-1 shrink-0" />
                        <div>
                          <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Phone Number</div>
                          <span className="text-xs text-text-primary">{profile.phone}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(profile.phone, "phone")}
                        className="text-text-dim hover:text-emerald-400 p-1 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        {copiedField === "phone" ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Location */}
                  {profile?.location && (
                    <div className="flex gap-3">
                      <MapPin size={14} className="text-text-muted mt-1 shrink-0" />
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Current Base</div>
                        <span className="text-xs text-text-primary">{profile.location}</span>
                      </div>
                    </div>
                  )}

                  {/* Website */}
                  {profile?.website && (
                    <div className="flex gap-3">
                      <Globe size={14} className="text-text-muted mt-1 shrink-0" />
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Website</div>
                        <a 
                          href={profile.website} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-emerald-400 hover:underline flex items-center gap-1.5"
                        >
                          {profile.website.replace(/(https?:\/\/)?(www\.)?/, "")}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Timezone */}
                  {profile?.timezone && (
                    <div className="flex gap-3">
                      <Clock size={14} className="text-text-muted mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Timezone</div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-text-primary">{profile.timezone}</span>
                          {localTime && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                              {localTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Birthday */}
                  {profile?.date_of_birth && (
                    <div className="flex gap-3">
                      <Calendar size={14} className="text-text-muted mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Land Date (Birthday)</div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-text-primary">{profile.date_of_birth}</span>
                          {age !== null && (
                            <span className="text-[9px] font-mono text-text-secondary">
                              {age} yrs • {zodiac}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fallback if all empty */}
                  {!profile?.email && !profile?.phone && !profile?.location && !profile?.website && !profile?.timezone && !profile?.date_of_birth && (
                    <p className="text-xs text-text-muted italic py-2">No contact or directory fields configured.</p>
                  )}
                </div>
              )}
            </div>

            {/* Sovereign Links Card */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-emerald-400" />
                  <span className="text-[10px] uppercase font-mono tracking-widest text-text-secondary font-semibold">
                    Sovereign Links
                  </span>
                </div>
                {editing && (
                  <button 
                    onClick={addLink} 
                    className="p-1 text-emerald-400 hover:text-white transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {editing ? (
                /* Editing links */
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {draftLinks.map((link, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-border bg-background space-y-2 relative group">
                      <button 
                        onClick={() => deleteLink(idx)}
                        className="absolute top-2 right-2 text-text-dim hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Platform</label>
                          <input
                            value={link.platform}
                            onChange={e => updateLink(idx, { platform: e.target.value })}
                            placeholder="github, linkedin..."
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-white outline-none"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Label</label>
                          <input
                            value={link.label}
                            onChange={e => updateLink(idx, { label: e.target.value })}
                            placeholder="My GitHub"
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-white outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-mono uppercase text-text-muted">Absolute URL</label>
                        <input
                          value={link.url}
                          onChange={e => updateLink(idx, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-white outline-none font-mono"
                        />
                      </div>
                    </div>
                  ))}
                  {draftLinks.length === 0 && (
                    <p className="text-[11px] text-text-muted italic text-center py-4">No links added. Click the plus button to add.</p>
                  )}
                </div>
              ) : (
                /* Displaying links as grid cards */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {links.map((link, idx) => (
                    <a
                      key={link.id || idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl border border-border bg-surface/5 hover:border-emerald-500/30 hover:bg-surface/20 transition-all duration-300 flex items-center justify-between group min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-primary truncate group-hover:text-emerald-400 transition-colors">
                          {link.label || link.platform}
                        </div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted mt-0.5">
                          {link.platform}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-text-dim group-hover:text-emerald-400 transition-colors shrink-0 ml-2" />
                    </a>
                  ))}
                  {links.length === 0 && (
                    <p className="text-xs text-text-muted italic py-2 col-span-2">No links configured.</p>
                  )}
                </div>
              )}
            </div>

            {/* Consolidated Daily Habits Tracker Widget */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-emerald-400" />
                  <span className="text-[10px] uppercase font-mono tracking-widest text-text-secondary font-semibold">
                    Daily Habits
                  </span>
                </div>
                <button 
                  onClick={() => setShowHabitModal(true)} 
                  className="p-1 text-emerald-400 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {habitsLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {habits.map((habit) => {
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const isCompletedToday = habitLogs.some(
                      (l) => l.habit_id === habit.id && l.date === todayStr
                    );
                    const streak = calculateStreak(habit.id);

                    // Last 7 days check-in history grid
                    const recentDays = Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      const isCompleted = habitLogs.some(
                        (l) => l.habit_id === habit.id && l.date === dStr
                      );
                      const dayLabel = d.toLocaleDateString("en-US", { weekday: "narrow" });
                      return { dStr, isCompleted, dayLabel };
                    });

                    return (
                      <div 
                        key={habit.id}
                        className="p-2.5 rounded-xl border border-border bg-background/20 hover:border-border/60 hover:bg-background/40 transition-all duration-300 flex flex-col justify-between gap-2.5 group min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Compact Circle Checkbox */}
                          <button
                            onClick={() => toggleHabit(habit.id)}
                            className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{
                              borderColor: isCompletedToday ? habit.color : "rgb(64, 64, 64)",
                              backgroundColor: isCompletedToday ? habit.color : "transparent",
                              color: isCompletedToday ? "#000" : "transparent",
                            }}
                          >
                            <Check size={10} strokeWidth={3.5} />
                          </button>

                          <div className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
                            <span 
                              onClick={() => toggleHabit(habit.id)}
                              title={habit.title}
                              className={`text-[11px] font-semibold truncate cursor-pointer select-none transition-all duration-200 ${
                                isCompletedToday 
                                  ? 'text-text-muted line-through decoration-neutral-500/40' 
                                  : 'text-text-primary hover:text-white'
                              }`}
                            >
                              {habit.title}
                            </span>
                            {streak > 0 && (
                              <span 
                                title={`Streak: ${streak} days`}
                                className="text-[9px] font-mono font-bold text-amber-500 flex items-center gap-0.5 shrink-0"
                              >
                                <Flame size={9} fill="currentColor" /> {streak}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Sparkdots & Delete */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60">
                          <div className="flex items-center gap-0.5">
                            {recentDays.map((day) => (
                              <div 
                                key={day.dStr}
                                title={`${day.dStr} (${day.isCompleted ? 'Completed' : 'Missed'})`}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor: day.isCompleted ? habit.color : "rgb(24, 24, 27)",
                                }}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => handleDeleteHabit(habit.id)}
                            className="p-0.5 text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {habits.length === 0 && (
                    <p className="text-xs text-text-muted italic py-2 col-span-2">No habits configured. Click the plus button to add.</p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ════════ RIGHT COLUMN (VALUES & TIMELINE) ════════ */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Core Values / Drivers */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-emerald-400" />
                  <span className="text-[10px] uppercase font-mono tracking-widest text-text-secondary font-semibold">
                    Core Values & Drivers
                  </span>
                </div>
                {editing && (
                  <button 
                    onClick={addValue} 
                    className="p-1 text-emerald-400 hover:text-white transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {editing ? (
                /* Editing values list with priority shifter */
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {draftValues.map((val, idx) => (
                    <div key={idx} className="flex gap-3 items-start p-3.5 rounded-xl border border-border bg-background">
                      
                      {/* Priority Rank adjusters */}
                      <div className="flex flex-col gap-1 items-center justify-center pt-1 shrink-0">
                        <button 
                          disabled={idx === 0} 
                          onClick={() => moveValue(idx, "up")}
                          className="text-text-dim hover:text-emerald-400 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-text-muted">{idx + 1}</span>
                        <button 
                          disabled={idx === draftValues.length - 1} 
                          onClick={() => moveValue(idx, "down")}
                          className="text-text-dim hover:text-emerald-400 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <input
                          value={val.label}
                          onChange={e => updateValue(idx, { label: e.target.value })}
                          placeholder="Value Label"
                          className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-white outline-none font-semibold focus:border-emerald-500/40"
                        />
                        <textarea
                          value={val.description}
                          onChange={e => updateValue(idx, { description: e.target.value })}
                          placeholder="Explain what this value drives..."
                          rows={2}
                          className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-text-secondary outline-none resize-none focus:border-emerald-500/40"
                        />
                      </div>

                      <button 
                        onClick={() => deleteValue(idx)}
                        className="text-text-dim hover:text-red-400 p-1 mt-1 transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {draftValues.length === 0 && (
                    <p className="text-[11px] text-text-muted italic text-center py-4">No core values. Add values to guide AI persona tone.</p>
                  )}
                </div>
              ) : (
                /* Displaying core values list */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {values.map((val, idx) => (
                    <div 
                      key={val.id || idx}
                      className="p-4 rounded-xl border border-border bg-surface/5 flex items-start gap-3.5 hover:border-emerald-500/10 transition-colors group min-w-0"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400 shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-xs font-semibold text-text-primary group-hover:text-emerald-400 transition-colors">
                          {val.label}
                        </h4>
                        {val.description && (
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            {val.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {values.length === 0 && (
                    <p className="text-xs text-text-muted italic py-2 col-span-2">No core values configured.</p>
                  )}
                </div>
              )}
            </div>

            {/* Milestones / Life Timeline */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Flag size={14} className="text-emerald-400" />
                  <span className="text-[10px] uppercase font-mono tracking-widest text-text-secondary font-semibold">
                    Milestones & Timeline
                  </span>
                </div>
                {editing && (
                  <button 
                    onClick={addMilestone} 
                    className="p-1 text-emerald-400 hover:text-white transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {editing ? (
                /* Editing milestones list */
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {draftMilestones.map((m, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-background space-y-3 relative">
                      <button 
                        onClick={() => deleteMilestone(idx)}
                        className="absolute top-3 right-3 text-text-dim hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Title</label>
                          <input
                            value={m.title}
                            onChange={e => updateMilestone(idx, { title: e.target.value })}
                            placeholder="Milestone Title"
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-white outline-none font-semibold focus:border-emerald-500/40"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Date (YYYY-MM-DD)</label>
                          <input
                            value={m.date || ""}
                            onChange={e => updateMilestone(idx, { date: e.target.value })}
                            placeholder="Date"
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-white outline-none font-mono focus:border-emerald-500/40"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div className="col-span-2 space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Highlight Detail</label>
                          <input
                            value={m.description}
                            onChange={e => updateMilestone(idx, { description: e.target.value })}
                            placeholder="Brief description..."
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text-secondary outline-none focus:border-emerald-500/40"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-mono uppercase text-text-muted">Category</label>
                          <select
                            value={m.category}
                            onChange={e => updateMilestone(idx, { category: e.target.value })}
                            className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-emerald-500/40"
                          >
                            <option value="life">Life</option>
                            <option value="career">Career</option>
                            <option value="education">Education</option>
                            <option value="personal">Personal</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  {draftMilestones.length === 0 && (
                    <p className="text-[11px] text-text-muted italic text-center py-4">No milestones added. Click the plus button to add.</p>
                  )}
                </div>
              ) : (
                /* Displaying vertical milestone timeline path */
                <div className="relative pl-6 border-l border-border ml-3 space-y-6 pt-2">
                  {milestones.map((m, idx) => {
                    const badgeStyles: Record<string, string> = {
                      career: "bg-teal-500/10 text-teal-400 border border-teal-500/10",
                      education: "bg-blue-500/10 text-blue-400 border border-blue-500/10",
                      life: "bg-purple-500/10 text-purple-400 border border-purple-500/10",
                      personal: "bg-text-dim/10 text-text-secondary border border-border-hover/10"
                    };
                    const badgeStyle = badgeStyles[m.category] || badgeStyles.personal;
                    
                    const CategoryIcon = () => {
                      if (m.category === "career") return <Briefcase size={10} className="shrink-0" />;
                      if (m.category === "education") return <GraduationCap size={11} className="shrink-0" />;
                      if (m.category === "personal") return <Award size={10} className="shrink-0" />;
                      return <User size={10} className="shrink-0" />;
                    };

                    return (
                      <div key={m.id || idx} className="relative group">
                        
                        {/* Timeline pulsing node circle */}
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border border-border bg-background flex items-center justify-center shadow">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 transition-transform group-hover:scale-125" />
                        </div>

                        {/* Milestone card contents */}
                        <div className="p-4 rounded-xl border border-border/60 bg-surface/5 group-hover:border-border transition-colors space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-text-primary group-hover:text-emerald-400 transition-colors">
                              {m.title}
                            </h4>
                            {m.date && (
                              <span className="text-[9px] font-mono text-text-muted self-start sm:self-auto uppercase">
                                {m.date}
                              </span>
                            )}
                          </div>
                          
                          {/* Badges row */}
                          <div className="flex gap-2 items-center">
                            <span className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${badgeStyle}`}>
                              <CategoryIcon />
                              {m.category}
                            </span>
                          </div>

                          {m.description && (
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              {m.description}
                            </p>
                          )}
                        </div>

                      </div>
                    );
                  })}
                  {milestones.length === 0 && (
                    <p className="text-xs text-text-muted italic py-2">No milestones configured.</p>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Habits Modal */}
      {showHabitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary font-semibold">New Habit</h3>
              <button 
                onClick={() => setShowHabitModal(false)}
                className="text-text-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveHabit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">Habit Title</label>
                <input
                  type="text"
                  required
                  value={habitDraft.title || ""}
                  onChange={(e) => setHabitDraft({ ...habitDraft, title: e.target.value })}
                  placeholder="e.g. Morning Meditation"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">Description</label>
                <input
                  type="text"
                  value={habitDraft.description || ""}
                  onChange={(e) => setHabitDraft({ ...habitDraft, description: e.target.value })}
                  placeholder="Optional detail..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">Frequency</label>
                  <select
                    value={habitDraft.frequency || "daily"}
                    onChange={(e) => setHabitDraft({ ...habitDraft, frequency: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">Linked Value</label>
                  <select
                    value={habitDraft.linked_value_id || ""}
                    onChange={(e) => setHabitDraft({ ...habitDraft, linked_value_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                  >
                    <option value="">None</option>
                    {values.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">Theme Color</label>
                <div className="flex gap-2">
                  {[
                    { hex: "#34d399", name: "Green" },
                    { hex: "#60a5fa", name: "Blue" },
                    { hex: "#a78bfa", name: "Purple" },
                    { hex: "#f472b6", name: "Pink" },
                    { hex: "#fbbf24", name: "Amber" },
                  ].map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setHabitDraft({ ...habitDraft, color: color.hex })}
                      className="w-6 h-6 rounded-full border border-border transition-transform duration-200"
                      style={{
                        backgroundColor: color.hex,
                        transform: habitDraft.color === color.hex ? "scale(1.15)" : "none",
                        boxShadow: habitDraft.color === color.hex ? `0 0 10px ${color.hex}80` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHabitModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-elevated text-text-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={habitSaving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black transition-colors flex items-center gap-1.5"
                >
                  {habitSaving && <Loader2 size={12} className="animate-spin" />}
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
