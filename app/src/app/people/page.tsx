"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, Mail, Building2, UserCircle, Loader2,
  Phone, Globe, ExternalLink, MapPin, Plus, Trash2, Save,
  Briefcase, Palette, HeartHandshake, LayoutList, Fingerprint, 
  Check, Copy, ChevronRight, MessageSquare, Compass, Send, Zap, X, Pencil
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   People — Sovereign Network Hub & Social Dashboard
   
   Slick multi-pane layout:
   - Left Sidebar: Contact list styled like a chat feed with search & category filter.
   - Main Pane (Default): Network insights overview, relationship category cards, and relationship cooldown lists.
   - Main Pane (Selected): LinkedIn-style Profile, Warmth Pulse Gauge, interaction logs feed, and AI co-pilot generators.
   - Custom features: Client-side LinkedIn text parser and instant Email check-in generator.
   ═══════════════════════════════════════════════════════ */

interface Person {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  relationship: string;
  notes: string;
  linkedin?: string | null;
  website?: string | null;
  address?: string | null;
  warmth?: number;
}

interface RelationshipCount {
  relationship: string;
  count: number;
}

const REL_COLORS: Record<string, string> = {
  family: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  self: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  professional: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
  contact: "bg-text-dim/10 text-text-secondary border border-border-hover/20",
  friends: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  unsorted: "bg-text-dim/10 text-text-secondary border border-border-hover/20",
};

const REL_ICONS: Record<string, React.ElementType> = {
  family: Users,
  self: Fingerprint,
  professional: Briefcase,
  contact: UserCircle,
  friends: HeartHandshake,
  unsorted: LayoutList,
};

const SECTION_COLOR = "var(--color-section-identity)";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [relationships, setRelationships] = useState<RelationshipCount[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterRel, setFilterRel] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  
  // Adding & Editing States
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Draft States
  const [draft, setDraft] = useState<Partial<Person>>({});
  const [linkedinData, setLinkedinData] = useState("");
  const [logNote, setLogNote] = useState("");
  const [draftedEmail, setDraftedEmail] = useState("");
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modern Social Features Tab & Feed States
  const [activeTab, setActiveTab] = useState<"feed" | "grid" | "pulse">("feed");
  const [feedContactId, setFeedContactId] = useState<number | "">("");
  const [feedText, setFeedText] = useState("");
  const [feedDate, setFeedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [feedSaving, setFeedSaving] = useState(false);

  // Document Title SEO Hook
  useEffect(() => {
    document.title = "Sovereign Network | Rudder";
  }, []);

  // Debounce search input to prevent query spamming
  useEffect(() => {
    if (search === "") {
      setDebouncedSearch("");
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterRel) params.set("relationship", filterRel);
      params.set("limit", "500");
      const res = await fetch(`/api/people?${params}`);
      const data = await res.json();
      setPeople(data.people || []);
      setTotal(data.total || 0);
      setRelationships(data.relationships || []);
    } catch (err) {
      console.error("Failed to fetch people:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterRel]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setDraft({ ...person });
    setEditing(false);
    setIsAdding(false);
    setDraftedEmail("");
    setLinkedinData("");
    setLogNote("");
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setSelectedPerson(null);
    setEditing(false);
    setDraft({
      name: "",
      email: "",
      phone: "",
      company: "",
      role: "",
      relationship: "professional",
      notes: "",
      warmth: 10,
      linkedin: "",
      website: "",
      address: ""
    });
    setDraftedEmail("");
  };

  const handleStartEdit = () => {
    setDraft({ ...selectedPerson! });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft({ ...selectedPerson! });
  };

  const handleSave = async () => {
    if (!draft.name?.trim()) return;
    setSaving(true);
    try {
      if (isAdding) {
        // Create new contact
        const res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft)
        });
        const data = await res.json();
        setIsAdding(false);
        await fetchPeople();
        if (data.id) {
          // Select newly created contact
          const created = people.find(p => p.id === data.id) || { ...draft, id: data.id } as Person;
          setSelectedPerson(created);
        }
      } else {
        // Update contact
        await fetch(
          "/api/people", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft)
          }
        );
        setEditing(false);
        await fetchPeople();
        // Update local reference
        setSelectedPerson(draft as Person);
      }
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this connection from your sovereign ledger?")) return;
    try {
      await fetch(`/api/people?id=${id}`, {
        method: "DELETE"
      });
      setSelectedPerson(null);
      await fetchPeople();
    } catch (err) {
      console.error("Failed to delete contact:", err);
    }
  };

  // Append a direct text log to the contact's ledger history
  const handleLogInteraction = async () => {
    if (!logNote.trim() || !selectedPerson) return;
    
    const timestamp = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const formattedLog = `Logged interaction (${timestamp}): ${logNote.trim()}`;
    const updatedNotes = selectedPerson.notes 
      ? `${formattedLog} | ${selectedPerson.notes}` 
      : formattedLog;

    const updatedPerson = {
      ...selectedPerson,
      notes: updatedNotes,
      warmth: Math.min((selectedPerson.warmth || 0) + 15, 100) // Interacting increases relationship warmth score!
    };

    try {
      await fetch("/api/people", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPerson)
      });
      setLogNote("");
      setSelectedPerson(updatedPerson);
      setDraft(updatedPerson);
      await fetchPeople();
    } catch (err) {
      console.error("Failed to append note log:", err);
    }
  };

  // Automatic LinkedIn details extractor
  const handleParseLinkedIn = () => {
    if (!linkedinData.trim()) return;
    
    const lines = linkedinData.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed: Partial<Person> = { ...draft };

    // Heuristics: first line is name
    if (lines[0]) {
      parsed.name = lines[0];
    }

    // Scan lines for common career keys
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      if (line.includes(" at ")) {
        const parts = line.split(" at ");
        parsed.role = parts[0].trim();
        parsed.company = parts[1].replace(/·.*/, "").trim();
      } else if (line.toLowerCase().includes("engineer") || line.toLowerCase().includes("manager") || line.toLowerCase().includes("founder") || line.toLowerCase().includes("director") || line.toLowerCase().includes("developer")) {
        parsed.role = line;
      } else if (line.includes("Greater") || line.includes("Area") || line.includes("Region") || line.includes("City")) {
        parsed.address = line;
      }
    }

    setDraft(parsed);
    setLinkedinData("");
    alert("LinkedIn data parsed. Form details populated successfully!");
  };

  // Generate check-in email based on notes
  const handleDraftCheckIn = () => {
    if (!selectedPerson) return;
    setIsDraftingEmail(true);
    
    // Simulate AI synthesis delay
    setTimeout(() => {
      const firstName = selectedPerson.name.split(" ")[0];
      const companyStr = selectedPerson.company ? ` at ${selectedPerson.company}` : "";
      
      // Look for a key topic word inside logs
      let noteTopic = "";
      if (selectedPerson.notes) {
        const words = selectedPerson.notes.replace(/[|.,;:()]/g, "").split(/\s+/);
        const candidates = words.filter(w => w.length > 5 && !["project", "meeting", "colleague", "contact", "discussed", "logistics"].includes(w.toLowerCase()));
        if (candidates.length > 0) {
          noteTopic = candidates[0].toLowerCase();
        }
      }

      const contextualHook = noteTopic 
        ? `I was thinking about our conversation regarding ${noteTopic} and wanted to see how that's coming along.`
        : "I wanted to check in, see how you are doing, and hear about what you've been working on lately.";

      const subject = `Catching up / Rudder Connect`;
      const body = `Hi ${firstName},\n\nHope you're having a great week!\n\nIt's been a while since we last caught up. ${contextualHook} ${selectedPerson.company ? `How are things progressing${companyStr}?` : ""}\n\nLet me know if you'd be open to a quick call or coffee sometime soon to catch up.\n\nBest,\n[Your Name]`;

      setDraftedEmail(`${subject}\n\n${body}`);
      setIsDraftingEmail(false);
    }, 1000);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Warmth categories
  const getWarmthCategory = (score: number) => {
    if (score >= 75) return { label: "Hot 🔥", color: "text-rose-400" };
    if (score >= 40) return { label: "Warm ☀️", color: "text-amber-400" };
    if (score >= 15) return { label: "Mild 🍃", color: "text-emerald-400" };
    return { label: "Cooled ❄️", color: "text-blue-400" };
  };

  // Helper to compile activity feed from all contact notes
  const getActivityFeed = () => {
    const feedItems: Array<{
      personId: number;
      personName: string;
      relationship: string;
      date: string;
      text: string;
      originalTimestamp: string;
    }> = [];

    people.forEach((p) => {
      if (!p.notes) return;
      const logs = p.notes.split(" | ");
      logs.forEach((log) => {
        // Match "Logged interaction (Date): Text"
        const match = log.match(/Logged interaction \(([^)]+)\):\s*(.*)/i);
        if (match) {
          feedItems.push({
            personId: p.id,
            personName: p.name,
            relationship: p.relationship,
            date: match[1],
            text: match[2],
            originalTimestamp: log,
          });
        } else if (log.trim()) {
          feedItems.push({
            personId: p.id,
            personName: p.name,
            relationship: p.relationship,
            date: "Recent Log",
            text: log,
            originalTimestamp: log,
          });
        }
      });
    });

    return feedItems.sort((a, b) => {
      const da = Date.parse(a.date);
      const db = Date.parse(b.date);
      if (isNaN(da) && isNaN(db)) return 0;
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return db - da;
    });
  };

  const handlePostFeedUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedContactId || !feedText.trim()) return;

    const person = people.find(p => p.id === Number(feedContactId));
    if (!person) return;

    setFeedSaving(true);
    // Parse input date
    const d = new Date(feedDate + "T12:00:00");
    const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const formattedLog = `Logged interaction (${dateStr}): ${feedText.trim()}`;
    const updatedNotes = person.notes
      ? `${formattedLog} | ${person.notes}`
      : formattedLog;

    const updatedPerson = {
      ...person,
      notes: updatedNotes,
      warmth: Math.min((person.warmth || 0) + 15, 100)
    };

    try {
      await fetch("/api/people", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPerson)
      });
      setFeedText("");
      setFeedContactId("");
      await fetchPeople();
    } catch (err) {
      console.error("Failed to post feed update:", err);
    } finally {
      setFeedSaving(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-screen bg-background">
      
      {/* ═══ COLUMN 1: LEFT SIDEBAR CONTACT LIST ═══ */}
      <div className="w-[360px] flex flex-col border-r border-border bg-background/20 shrink-0 relative z-20">
        
        {/* Search, Filters and Create Actions */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              Sovereign Network
            </h1>
            <button 
              onClick={handleStartAdd} 
              className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:text-white transition-all flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ledger..."
                className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-white outline-none focus:border-emerald-500/30 placeholder:text-text-dim"
              />
            </div>
            
            <select 
              value={filterRel} 
              onChange={e => { setFilterRel(e.target.value); setSelectedPerson(null); }}
              className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-text-secondary outline-none capitalize cursor-pointer max-w-[110px]"
            >
              <option value="">All Types</option>
              {relationships.map(r => (
                <option key={r.relationship} value={r.relationship}>
                  {r.relationship} ({r.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable list styled as a social chat feed */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-emerald-400" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-text-dim italic">{search ? "No connections match" : "Sovereign index empty"}</p>
            </div>
          ) : (
            people.map(person => {
              const active = selectedPerson?.id === person.id;
              const warmthScore = person.warmth || 0;
              const relStyle = REL_COLORS[person.relationship] || REL_COLORS.unsorted;
              
              // Extract first note snippet to show as "latest status"
              let statusText = "No previous logs";
              if (person.notes) {
                const logs = person.notes.split(" | ");
                statusText = logs[0].replace(/Logged interaction.*:\s*/, "");
                if (statusText.length > 50) statusText = statusText.slice(0, 50) + "...";
              }

              return (
                <button 
                  key={person.id} 
                  onClick={() => handleSelectPerson(person)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all border ${
                    active 
                      ? "bg-emerald-500/5 border-emerald-500/30 shadow-md shadow-emerald-950/5" 
                      : "border-transparent hover:bg-surface/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    
                    {/* User initials circle with glowing border based on warmth */}
                    <div className={`w-9 h-9 rounded-xl bg-surface border flex items-center justify-center text-xs font-bold shrink-0 shadow relative ${
                      warmthScore >= 60 ? "border-emerald-500/40" : warmthScore >= 20 ? "border-blue-500/30" : "border-border"
                    }`}>
                      <span className={warmthScore >= 60 ? "text-emerald-400" : "text-text-secondary"}>
                        {person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      {/* Connection status indicator */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-border ${
                        warmthScore >= 75 ? "bg-rose-500" : warmthScore >= 40 ? "bg-amber-500" : warmthScore >= 15 ? "bg-emerald-500" : "bg-blue-400"
                      }`} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-text-primary truncate group-hover:text-emerald-400">
                          {person.name}
                        </div>
                        <span className={`text-[8px] font-mono px-1 rounded uppercase tracking-wider scale-90 ${relStyle}`}>
                          {person.relationship}
                        </span>
                      </div>
                      
                      {person.role && (
                        <div className="text-[10px] text-text-secondary truncate">
                          {person.role} {person.company ? `at ${person.company}` : ""}
                        </div>
                      )}
                      
                      <div className="text-[9px] text-text-muted truncate font-mono">
                        {statusText}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* ═══ COLUMN 2: CENTER WORKSPACE AREA ═══ */}
      <div className="flex-1 overflow-y-auto relative z-10">
        
        {/* Decorative lighting background spotlight */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.02),transparent_70%)] pointer-events-none" />

        {/* ── DEFAULT VIEW: NETWORK INSIGHTS HUB ── */}
        {!selectedPerson && !isAdding && (
          <div className="flex flex-col min-h-full">
            {/* Top Navigation Sub-menu */}
            <div className="flex border-b border-border bg-background/20 px-8 py-2 gap-6 shrink-0 relative z-30">
              {[
                { id: "feed", label: "Activity Stream", icon: MessageSquare },
                { id: "grid", label: "Network Directory", icon: Users },
                { id: "pulse", label: "Engagement Pulse", icon: Compass },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all relative ${
                      active
                        ? "border-emerald-400 text-emerald-400 font-semibold"
                        : "border-transparent text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-fade-in flex-1">
              
              {/* TAB 1: ACTIVITY STREAM FEED */}
              {activeTab === "feed" && (
                <div className="space-y-6">
                  {/* Share / Post Box */}
                  <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/10 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <Palette size={14} className="text-emerald-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-semibold">
                        Log Network Update
                      </span>
                    </div>

                    <form onSubmit={handlePostFeedUpdate} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-text-muted">Contact *</label>
                          <select
                            required
                            value={feedContactId}
                            onChange={(e) => setFeedContactId(e.target.value ? Number(e.target.value) : "")}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                          >
                            <option value="">Select connection...</option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.relationship})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-text-muted">Interaction Date</label>
                          <input
                            type="date"
                            value={feedDate}
                            onChange={(e) => setFeedDate(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40 font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase text-text-muted">What happened? *</label>
                        <textarea
                          required
                          value={feedText}
                          onChange={(e) => setFeedText(e.target.value)}
                          placeholder="Shared a project update, grabbed lunch, introduced to key partner..."
                          rows={3}
                          className="w-full bg-background border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500/40 resize-none leading-relaxed"
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={feedSaving || !feedContactId || !feedText.trim()}
                          className="px-5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-background font-bold bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 transition-all hover:scale-[1.01] flex items-center gap-1.5"
                        >
                          {feedSaving && <Loader2 size={12} className="animate-spin" />}
                          Post Update
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Aggregated scrolling timeline feed */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-semibold">
                        Global Activity Feed
                      </span>
                      <span className="text-[9px] font-mono text-text-dim">Sorted by Date</span>
                    </div>

                    <div className="space-y-4">
                      {getActivityFeed().length > 0 ? (
                        getActivityFeed().map((item, idx) => {
                          const relStyle = REL_COLORS[item.relationship] || REL_COLORS.unsorted;
                          return (
                            <div 
                              key={idx}
                              className="glass-panel p-5 rounded-2xl border border-border/60 bg-surface/5 hover:border-border transition-colors flex gap-4"
                            >
                              {/* Avatar Initials Bubble */}
                              <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 select-none">
                                {item.personName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>

                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const p = people.find(x => x.id === item.personId);
                                        if (p) handleSelectPerson(p);
                                      }}
                                      className="text-xs font-bold text-text-primary hover:text-emerald-400 text-left transition-colors truncate"
                                    >
                                      {item.personName}
                                    </button>
                                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 ${relStyle}`}>
                                      {item.relationship}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono text-emerald-400/90 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                                    {item.date}
                                  </span>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed font-sans">
                                  {item.text}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-text-dim italic py-12 text-center">No social activity logged yet. Use the composer above to write your first log!</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: NETWORK DIRECTORY GRID */}
              {activeTab === "grid" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-semibold">
                      Contacts Matrix ({people.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {people.length > 0 ? (
                      people.map((person) => {
                        const warmthScore = person.warmth || 0;
                        const relStyle = REL_COLORS[person.relationship] || REL_COLORS.unsorted;
                        return (
                          <div 
                            key={person.id}
                            className="glass-panel p-5 rounded-2xl border border-border/60 bg-surface/5 hover:border-border transition-colors flex flex-col justify-between gap-4 group"
                          >
                            <div className="flex items-start gap-4">
                              {/* Avatar Initials Bubble with warmth indicator dot */}
                              <div className={`w-11 h-11 rounded-xl bg-surface border flex items-center justify-center text-sm font-bold shrink-0 relative ${
                                warmthScore >= 60 ? "border-emerald-500/40" : warmthScore >= 20 ? "border-blue-500/30" : "border-border"
                              }`}>
                                <span className={warmthScore >= 60 ? "text-emerald-400" : "text-text-secondary"}>
                                  {person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </span>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-border ${
                                  warmthScore >= 75 ? "bg-rose-500" : warmthScore >= 40 ? "bg-amber-500" : warmthScore >= 15 ? "bg-emerald-500" : "bg-blue-400"
                                }`} />
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs font-bold text-text-primary truncate group-hover:text-emerald-400 transition-colors">
                                    {person.name}
                                  </h4>
                                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${relStyle}`}>
                                    {person.relationship}
                                  </span>
                                </div>
                                {person.role && (
                                  <p className="text-[10px] text-text-secondary truncate">
                                    {person.role} {person.company ? `at ${person.company}` : ""}
                                  </p>
                                )}
                                {person.email && (
                                  <p className="text-[10px] text-text-muted truncate font-mono">
                                    {person.email}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Warmth indicator bar and View Ledger button */}
                            <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/60">
                              <div className="flex-1 max-w-[140px]">
                                <div className="flex justify-between text-[8px] font-mono text-text-muted uppercase mb-1">
                                  <span>Warmth</span>
                                  <span>{warmthScore}%</span>
                                </div>
                                <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                      warmthScore >= 75 ? "bg-rose-500" : warmthScore >= 40 ? "bg-amber-500" : "bg-emerald-400"
                                    }`}
                                    style={{ width: `${warmthScore}%` }}
                                  />
                                </div>
                              </div>

                              <button
                                onClick={() => handleSelectPerson(person)}
                                className="px-3 py-1 rounded bg-background border border-border hover:border-border-hover text-text-secondary hover:text-white transition-all text-[10px] font-mono uppercase tracking-wider"
                              >
                                View Ledger
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-text-dim italic py-12 text-center col-span-2">No connections configured yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ENGAGEMENT & COOLDOWN (PULSE) */}
              {activeTab === "pulse" && (
                <div className="space-y-6">
                  {/* Connection Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Total Connections</div>
                      <div className="text-3xl font-extrabold text-white mt-2 font-mono">{people.length}</div>
                      <div className="text-[10px] text-text-secondary mt-1">Sovereign nodes index</div>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Highly Engaged</div>
                      <div className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">
                        {people.filter(p => (p.warmth || 0) >= 50).length}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-1">Warmth score above 50%</div>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Cooled Off</div>
                      <div className="text-3xl font-extrabold text-blue-400 mt-2 font-mono">
                        {people.filter(p => (p.warmth || 0) <= 10).length}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-1">Check-in recommended</div>
                    </div>
                  </div>

                  {/* Relationship Category Distribution */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary">Category Distribution</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {relationships.map(r => {
                        const relStyle = REL_COLORS[r.relationship] || REL_COLORS.unsorted;
                        const Icon = REL_ICONS[r.relationship] || LayoutList;
                        return (
                          <div key={r.relationship} className="glass-panel p-4 rounded-xl border border-border bg-surface/5 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${relStyle}`}>
                              <Icon size={14} />
                            </div>
                            <div>
                              <div className="text-[10px] font-mono uppercase text-text-muted">{r.relationship}</div>
                              <div className="text-sm font-bold text-white mt-0.5">{r.count}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Relationship Cooldown Tracker */}
                  <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary">Relationship Cooldown Alert</h3>
                      <span className="text-[9px] font-mono text-text-muted">Action Suggested</span>
                    </div>
                    <div className="space-y-3">
                      {people
                        .filter(p => (p.warmth || 0) <= 12)
                        .slice(0, 8)
                        .map(p => (
                          <div key={p.id} className="p-3.5 rounded-xl border border-border bg-surface/5 hover:border-border flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-xs font-bold text-text-secondary shrink-0">
                                {p.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-text-primary truncate">{p.name}</div>
                                <div className="text-[10px] text-text-muted truncate">
                                  {p.role || "Connection"} {p.company ? `at ${p.company}` : ""} • Cooled score: {p.warmth || 0}%
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                handleSelectPerson(p);
                                // Auto open checking email draft trigger
                                setTimeout(handleDraftCheckIn, 500);
                              }}
                              className="px-3 py-1 rounded bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/25 transition-all text-[10px] font-mono uppercase tracking-wider shrink-0"
                            >
                              Check In
                            </button>
                          </div>
                        ))}
                      {people.filter(p => (p.warmth || 0) <= 12).length === 0 && (
                        <p className="text-xs text-text-muted italic py-2 text-center">All relationships actively engaged. Great job!</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── PROFILE INGEST / CREATION / EDITING FORM ── */}
        {(isAdding || editing) && (
          <div className="p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <Fingerprint size={16} className="text-emerald-400" />
                {isAdding ? "Ingest New Sovereign Node" : `Edit Details — ${draft.name}`}
              </h2>
              <button 
                onClick={() => isAdding ? setIsAdding(false) : setEditing(false)}
                className="p-1 rounded text-text-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* LinkedIn Data Paste Helper (For Fast Ingestion) */}
            {isAdding && (
              <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">
                    LinkedIn Quick-Ingest Parser
                  </span>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Paste raw copypasta text from their LinkedIn profile top section (e.g. name, subtitle headline, location). The system will automatically map the parameters.
                </p>
                <div className="flex gap-2">
                  <textarea
                    value={linkedinData}
                    onChange={e => setLinkedinData(e.target.value)}
                    placeholder="Paste LinkedIn profile content here..."
                    rows={2}
                    className="flex-1 bg-background border border-border rounded-lg p-2 text-xs text-white outline-none resize-none focus:border-emerald-500/30"
                  />
                  <button 
                    onClick={handleParseLinkedIn}
                    className="px-3 bg-emerald-500 hover:bg-emerald-600 text-background font-bold rounded-lg text-xs font-mono uppercase tracking-wider shrink-0 transition-colors"
                  >
                    Parse
                  </button>
                </div>
              </div>
            )}

            {/* Main Form Fields */}
            <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Contact Name *</label>
                  <input
                    value={draft.name || ""}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Full Name"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Category</label>
                    <select
                      value={draft.relationship || "contact"}
                      onChange={e => setDraft({ ...draft, relationship: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-secondary outline-none cursor-pointer focus:border-emerald-500/30"
                    >
                      <option value="professional">Professional</option>
                      <option value="friends">Friends</option>
                      <option value="family">Family</option>
                      <option value="self">Self</option>
                      <option value="contact">Contact</option>
                      <option value="unsorted">Unsorted</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Warmth Index (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.warmth !== undefined ? draft.warmth : 10}
                      onChange={e => setDraft({ ...draft, warmth: parseInt(e.target.value) || 0 })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Email Address</label>
                  <input
                    value={draft.email || ""}
                    onChange={e => setDraft({ ...draft, email: e.target.value })}
                    placeholder="e.g. contact@domain.com"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Phone Number</label>
                  <input
                    value={draft.phone || ""}
                    onChange={e => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="e.g. +1 (555) 0123"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Role / Job Title</label>
                  <input
                    value={draft.role || ""}
                    onChange={e => setDraft({ ...draft, role: e.target.value })}
                    placeholder="e.g. Product Lead"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Company</label>
                  <input
                    value={draft.company || ""}
                    onChange={e => setDraft({ ...draft, company: e.target.value })}
                    placeholder="e.g. Stripe"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Website</label>
                  <input
                    value={draft.website || ""}
                    onChange={e => setDraft({ ...draft, website: e.target.value })}
                    placeholder="e.g. https://domain.com"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">LinkedIn URL</label>
                  <input
                    value={draft.linkedin || ""}
                    onChange={e => setDraft({ ...draft, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Base Location / Address</label>
                <input
                  value={draft.address || ""}
                  onChange={e => setDraft({ ...draft, address: e.target.value })}
                  placeholder="e.g. Austin, Texas"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Context Notes / History Timeline</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Insert logs separated by ' | ' e.g. Met at conference | Followed up on email"
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500/30 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => isAdding ? setIsAdding(false) : setEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-text-secondary border border-border hover:bg-surface bg-background/20 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving || !draft.name?.trim()}
                className="px-5 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-background font-bold bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 transition-all hover:scale-[1.01] flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {isAdding ? "Ingest Node" : "Save Changes"}
              </button>
            </div>

          </div>
        )}

        {/* ── DETAILED SOVEREIGN SOCIAL PROFILE VIEW ── */}
        {selectedPerson && !editing && !isAdding && (
          <div className="animate-fade-in relative min-h-full">
            
            {/* Back button */}
            <div className="absolute top-4 left-4 z-30">
              <button 
                onClick={() => setSelectedPerson(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider text-text-secondary border border-border bg-background/80 backdrop-blur hover:bg-surface-elevated transition-all flex items-center gap-1.5 shadow-lg"
              >
                ← Back to Grid
              </button>
            </div>
            
            {/* 1. COVER HEADER BANNER */}
            <div className="h-32 w-full bg-gradient-to-r from-emerald-950/20 via-background to-blue-950/20 border-b border-border relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(52,211,153,0.05),transparent_40%)] pointer-events-none" />
            </div>

            <div className="px-8 pb-4 relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 -mt-12 z-20">
              
              {/* Avatar overlapping cover banner */}
              <div className="flex gap-4 items-end">
                <div className="w-20 h-20 rounded-2xl border-2 border-border bg-background flex items-center justify-center text-xl font-bold text-emerald-400 shadow-xl ring-4 ring-emerald-500/5">
                  {selectedPerson.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                
                <div className="space-y-1 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-white leading-tight">{selectedPerson.name}</h2>
                    <span className={`text-[8px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                      REL_COLORS[selectedPerson.relationship] || REL_COLORS.unsorted
                    }`}>
                      {selectedPerson.relationship}
                    </span>
                  </div>
                  {selectedPerson.role && (
                    <p className="text-xs text-text-secondary">
                      {selectedPerson.role} {selectedPerson.company ? `at ${selectedPerson.company}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Action drawer trigger buttons */}
              <div className="flex gap-2 self-end sm:self-center">
                <button 
                  onClick={handleStartEdit} 
                  className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-text-secondary border border-border hover:bg-surface bg-background/30 transition-all flex items-center gap-1.5"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(selectedPerson.id)}
                  className="p-2 rounded-xl border border-border hover:border-red-500/30 text-text-secondary hover:text-red-400 bg-background/30 transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* 2. DYNAMIC WORKSPACE GRID */}
            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT PROFILE PANEL */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* AI Co-Pilot Summary Banner */}
                <div className="glass-panel p-5 rounded-2xl border border-blue-500/10 bg-blue-500/5 relative overflow-hidden flex items-start gap-4">
                  <div className="absolute left-0 top-0 w-1 h-full bg-blue-400" />
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 shrink-0">
                    <Fingerprint size={16} />
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <h4 className="text-xs font-bold text-white">Relationship Inference</h4>
                      <p className="text-[11px] text-text-secondary leading-relaxed mt-1">
                        {selectedPerson.warmth! >= 40 
                          ? `Active communication channels open. This contact appears in ${Math.round(selectedPerson.warmth! / 5)} correspondence files. Warm relationship status.`
                          : `Cold relationship status. No interactions logged recently. Click check-in to generate icebreaker correspondence.`}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button 
                        onClick={handleDraftCheckIn} 
                        disabled={isDraftingEmail}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {isDraftingEmail ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                        Draft check-in
                      </button>
                      {selectedPerson.linkedin && (
                        <a 
                          href={selectedPerson.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-text-secondary border border-border hover:bg-surface transition-all flex items-center gap-1"
                        >
                          <ExternalLink size={10} /> LinkedIn lookup
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Draft Result Overlay */}
                {draftedEmail && (
                  <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5 space-y-3 animate-fade-in relative group">
                    <button 
                      onClick={() => setDraftedEmail("")}
                      className="absolute top-3 right-3 text-text-muted hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">AI Synthesized Draft</span>
                      <button 
                        onClick={() => copyToClipboard(draftedEmail, "email-draft")}
                        className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        {copiedField === "email-draft" ? <Check size={11} /> : <Copy size={11} />}
                        {copiedField === "email-draft" ? "Copied" : "Copy Draft"}
                      </button>
                    </div>
                    <pre className="text-xs text-text-secondary font-sans whitespace-pre-wrap leading-relaxed bg-background p-4 rounded-lg border border-border">
                      {draftedEmail}
                    </pre>
                  </div>
                )}

                {/* Log Interaction form */}
                <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/5 space-y-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Log New Interaction
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={logNote}
                      onChange={e => setLogNote(e.target.value)}
                      placeholder="e.g. Had coffee, discussed private fleet setup..."
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                      onKeyDown={e => e.key === "Enter" && handleLogInteraction()}
                    />
                    <button 
                      onClick={handleLogInteraction}
                      disabled={!logNote.trim()}
                      className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-background font-bold rounded-lg text-xs font-mono uppercase tracking-wider shrink-0 transition-colors"
                    >
                      Log
                    </button>
                  </div>
                </div>

                {/* Interaction timeline posts feed */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-semibold">
                      Interaction Feed Stream
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedPerson.notes ? (
                      selectedPerson.notes.split(" | ").filter(Boolean).map((log, idx) => {
                        // Try parsing a date
                        const dateMatch = log.match(/Logged interaction \(([^)]+)\):/);
                        const dateStr = dateMatch ? dateMatch[1] : "Log Point";
                        const logText = log.replace(/Logged interaction \([^)]+\):\s*/, "");

                        return (
                          <div 
                            key={idx} 
                            className="p-4 rounded-xl border border-border/60 bg-surface/5 hover:border-border transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded">
                                {dateStr}
                              </span>
                              <span className="text-[9px] font-mono text-text-dim">Post #{idx + 1}</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed font-sans">
                              {logText}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-text-dim italic py-4">No logged conversations. Create your first timeline interaction above.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT PROFILE METADATA PANEL */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Relation Warmth Pulse Gauge */}
                <div className="glass-panel p-6 rounded-2xl border border-border bg-surface/10 text-center flex flex-col items-center space-y-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                    Network Pulse Strength
                  </span>
                  
                  {/* Circular SVG Gauge */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      {/* Grey background path */}
                      <path
                        className="text-background"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="transparent"
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Neon progress path */}
                      <path
                        className={`transition-all duration-1000 ${
                          selectedPerson.warmth! >= 75 ? "text-rose-500" : selectedPerson.warmth! >= 40 ? "text-amber-500" : "text-emerald-400"
                        }`}
                        strokeDasharray={`${selectedPerson.warmth || 0}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    
                    {/* Score center */}
                    <div className="absolute text-center">
                      <div className="text-xl font-bold font-mono text-white leading-none">
                        {selectedPerson.warmth || 0}%
                      </div>
                      <div className="text-[8px] font-mono uppercase tracking-wider text-text-muted mt-1">
                        Warmth
                      </div>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-text-secondary">Status: </span>
                    <span className={`font-bold font-mono ${getWarmthCategory(selectedPerson.warmth || 0).color}`}>
                      {getWarmthCategory(selectedPerson.warmth || 0).label}
                    </span>
                  </div>
                </div>

                {/* General Information Card */}
                <div className="glass-panel p-5 rounded-2xl border border-border bg-surface/10 space-y-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted pb-2 border-b border-border">
                    General Parameters
                  </div>

                  <div className="space-y-3.5">
                    {/* Email */}
                    {selectedPerson.email && (
                      <div className="flex justify-between items-start gap-2 group">
                        <div className="min-w-0">
                          <div className="text-[9px] font-mono uppercase text-text-muted">Email</div>
                          <a 
                            href={`mailto:${selectedPerson.email}`} 
                            className="text-xs text-text-primary hover:underline truncate block"
                          >
                            {selectedPerson.email}
                          </a>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(selectedPerson.email!, "email")}
                          className="text-text-dim hover:text-emerald-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedField === "email" ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    )}

                    {/* Phone */}
                    {selectedPerson.phone && (
                      <div className="flex justify-between items-start gap-2 group">
                        <div className="min-w-0">
                          <div className="text-[9px] font-mono uppercase text-text-muted">Phone</div>
                          <span className="text-xs text-text-primary truncate block">{selectedPerson.phone}</span>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(selectedPerson.phone!, "phone")}
                          className="text-text-dim hover:text-emerald-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedField === "phone" ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    )}

                    {/* Company */}
                    {selectedPerson.company && (
                      <div>
                        <div className="text-[9px] font-mono uppercase text-text-muted">Company</div>
                        <div className="text-xs text-text-primary flex items-center gap-1.5">
                          <Building2 size={12} className="text-text-muted" />
                          {selectedPerson.company}
                        </div>
                      </div>
                    )}

                    {/* Base Address */}
                    {selectedPerson.address && (
                      <div>
                        <div className="text-[9px] font-mono uppercase text-text-muted">Base Location</div>
                        <div className="text-xs text-text-primary flex items-center gap-1.5">
                          <MapPin size={12} className="text-text-muted" />
                          {selectedPerson.address}
                        </div>
                      </div>
                    )}

                    {/* Web Link */}
                    {selectedPerson.website && (
                      <div>
                        <div className="text-[9px] font-mono uppercase text-text-muted">Website</div>
                        <a 
                          href={selectedPerson.website} 
                          target="_blank" 
                          rel="noopener" 
                          className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          {selectedPerson.website.replace(/(https?:\/\/)?(www\.)?/, "")}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
