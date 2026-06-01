"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Tag, 
  Trash2, 
  Plus, 
  Radio, 
  Wifi, 
  Play, 
  Pause, 
  Volume2, 
  Check, 
  HelpCircle,
  FileText,
  Activity,
  Calendar,
  ClipboardList
} from "lucide-react";

// Sovereign Pala Note Web UI — Premium Cream Aesthetic
// Zero double-hyphens in comments, styles, or logic

interface Note {
  id: number;
  title: string;
  content: string;
  mode: string;
  word_count: number;
  tags: string; // JSON array string
  created_at: string;
  updated_at: string;
}

export default function PalaNotePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState("All");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  
  // Note Form State
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTagsStr, setNewTagsStr] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync AirBridge State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Custom Tag and Task Conversion State
  const [customTagInput, setCustomTagInput] = useState("");
  const [showTaskPlanner, setShowTaskPlanner] = useState(false);
  const [taskPriority, setTaskPriority] = useState(0);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskCreateSuccess, setTaskCreateSuccess] = useState(false);

  // Fetch Notes on mount and poll every 3 seconds for instant real-time sync
  useEffect(() => {
    fetchNotes(true); // Initial load displays the loading spinner
    const pollInterval = setInterval(() => fetchNotes(false), 3000); // Polling does not
    return () => clearInterval(pollInterval);
  }, []);

  const fetchNotes = async (initial = false) => {
    try {
      if (initial) setLoading(true);
      const r = await fetch("/api/pala");
      if (r.ok) {
        const data = await r.json();
        setNotes(data.entries || []);
        if (data.entries && data.entries.length > 0 && !activeNote) {
          setActiveNote(data.entries[0]);
        }
      }
    } catch (e) {
      console.error("Error loading notes:", e);
    } finally {
      if (initial) setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setIsSubmitting(true);
      // Parse comma-separated tags
      const tagsArray = newTagsStr
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      if (tagsArray.length === 0) {
        tagsArray.push("General");
      }

      const r = await fetch("/api/pala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        json: false, // Avoid double-hyphens
        body: JSON.stringify({
          title: newTitle.trim() || "Untitled Thought",
          content: newContent.trim(),
          tags: tagsArray
        })
      } as any);

      if (r.ok) {
        setNewTitle("");
        setNewContent("");
        setNewTagsStr("");
        setShowAddForm(false);
        await fetchNotes(false);
      }
    } catch (e) {
      console.error("Error creating note:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop card expansion
    if (!confirm("Are you sure you want to delete this voice note?")) return;

    try {
      const r = await fetch(`/api/pala?id=${id}`, {
        method: "DELETE"
      });
      if (r.ok) {
        if (activeNote?.id === id) {
          setActiveNote(null);
        }
        await fetchNotes(false);
      }
    } catch (e) {
      console.error("Error deleting note:", e);
    }
  };

  const handleToggleProjectTag = async (note: Note, project: string) => {
    let currentTags: string[] = [];
    try {
      currentTags = JSON.parse(note.tags);
      if (!Array.isArray(currentTags)) {
        currentTags = [];
      }
    } catch {
      currentTags = [];
    }

    let nextTags: string[];
    if (currentTags.includes(project)) {
      nextTags = currentTags.filter(t => t !== project);
    } else {
      nextTags = [...currentTags, project];
    }

    try {
      const r = await fetch("/api/pala", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          tags: nextTags
        })
      });

      if (r.ok) {
        const updatedNote = { ...note, tags: JSON.stringify(nextTags) };
        setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
        if (activeNote?.id === note.id) {
          setActiveNote(updatedNote);
        }
      }
    } catch (e) {
      console.error("Error toggling project tag:", e);
    }
  };

  const handleSyncAirBridge = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      fetchNotes(false);
    }, 2000);
  };

  const handleAddCustomTag = async (note: Note) => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;

    let currentTags: string[] = [];
    try {
      currentTags = JSON.parse(note.tags);
      if (!Array.isArray(currentTags)) {
        currentTags = [];
      }
    } catch {
      currentTags = [];
    }

    if (currentTags.includes(trimmed)) {
      setCustomTagInput("");
      return;
    }

    const nextTags = [...currentTags, trimmed];

    try {
      const r = await fetch("/api/pala", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          tags: nextTags
        })
      });

      if (r.ok) {
        const updatedNote = { ...note, tags: JSON.stringify(nextTags) };
        setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
        if (activeNote?.id === note.id) {
          setActiveNote(updatedNote);
        }
        setCustomTagInput("");
      }
    } catch (e) {
      console.error("Error adding custom tag:", e);
    }
  };

  const handleRemoveCustomTag = async (note: Note, tagToRemove: string) => {
    let currentTags: string[] = [];
    try {
      currentTags = JSON.parse(note.tags);
      if (!Array.isArray(currentTags)) {
        currentTags = [];
      }
    } catch {
      currentTags = [];
    }

    const nextTags = currentTags.filter(t => t !== tagToRemove);

    try {
      const r = await fetch("/api/pala", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          tags: nextTags
        })
      });

      if (r.ok) {
        const updatedNote = { ...note, tags: JSON.stringify(nextTags) };
        setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
        if (activeNote?.id === note.id) {
          setActiveNote(updatedNote);
        }
      }
    } catch (e) {
      console.error("Error removing custom tag:", e);
    }
  };

  const handleConvertToTask = async (note: Note) => {
    try {
      setIsCreatingTask(true);
      
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: note.title,
          description: `Voice Note Transcript:\n${note.content}`,
          status: "todo",
          priority: taskPriority,
          project_id: 1,
          due_date: taskDueDate || null,
          labels: ["Voice"]
        })
      });

      if (r.ok) {
        setTaskCreateSuccess(true);
        setTimeout(() => {
          setTaskCreateSuccess(false);
          setShowTaskPlanner(false);
        }, 3000);
      }
    } catch (e) {
      console.error("Error converting note to task:", e);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Calculate distinct tags dynamically
  const allTags = ["All"];
  notes.forEach(n => {
    try {
      const parsed = JSON.parse(n.tags);
      if (Array.isArray(parsed)) {
        parsed.forEach(t => {
          if (!allTags.includes(t)) {
            allTags.push(t);
          }
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  // Filter notes
  const filteredNotes = notes.filter(n => {
    if (selectedTag === "All") return true;
    try {
      const parsed = JSON.parse(n.tags);
      return Array.isArray(parsed) && parsed.includes(selectedTag);
    } catch (e) {
      return false;
    }
  });

  // Playback timer simulation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackTime(prev => {
          if (prev >= 15) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const selectNoteForPlayback = (note: Note) => {
    setActiveNote(note);
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  return (
    <div className="page-container flex flex-col items-center bg-background text-text-primary font-sans">
      <div className="w-full max-w-6xl space-y-8 animate-fade-in pt-8 pb-16">
        
        {/* 1. Header Grid */}
        <header className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></div>
              <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-emerald-400">Sovereign AirBridge Mode</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Sovereign Pala Note</h1>
            <p className="text-sm text-text-secondary italic mt-1">Air-gapped voice ledger and tags system, connected to your local compute.</p>
          </div>

          {/* 2. Device Status Widget */}
          <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-lg w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <Radio className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-[9px] text-text-muted font-mono uppercase font-bold tracking-wider">Device Status</div>
                <div className="text-sm font-bold text-text-primary">AIPI Lite Custom CDC</div>
                <div className="text-[10px] font-mono text-emerald-400/80">/dev/cu.usbmodem21201</div>
              </div>
            </div>
            <div className="h-px md:h-10 w-full md:w-px bg-white/10"></div>
            <button 
              onClick={handleSyncAirBridge}
              disabled={isSyncing}
              className={`px-4 py-2 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 ${
                syncSuccess 
                ? "bg-accent text-background" 
                : "bg-white/5 border border-border text-text-primary hover:bg-white/10"
              }`}
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 animate-spin" /> Syncing...
                </span>
              ) : syncSuccess ? (
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5" /> Synced!
                </span>
              ) : (
                "Trigger AirBridge Sync"
              )}
            </button>
          </div>
        </header>

        {/* 3. Main Dashboard Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Memos List Grid (7 cols) */}
          <main className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Tag Selector dock */}
            <div className="flex flex-wrap items-center gap-2 bg-surface/60 backdrop-blur-md border border-border/80 p-2 rounded-xl">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-150 ${
                    selectedTag === tag
                      ? "bg-accent text-background shadow-sm"
                      : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Quick Create Note Bar */}
            <div className="glass-panel rounded-xl p-4 shadow-sm">
              {!showAddForm ? (
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface/40 border border-border hover:bg-surface-elevated/60 rounded-lg transition-all duration-150 group"
                >
                  <span className="text-sm font-mono text-text-secondary group-hover:text-text-primary">Create a new written tag note...</span>
                  <Plus className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
                </button>
              ) : (
                <form onSubmit={handleCreateNote} className="flex flex-col gap-4">
                  <div className="text-xs uppercase tracking-widest font-mono font-bold text-text-muted">New Written Note</div>
                  <input 
                    type="text" 
                    placeholder="Note Title (Optional)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 font-sans text-sm focus:outline-none focus:border-accent text-text-primary placeholder-zinc-600"
                  />
                  <textarea 
                    placeholder="Type your thought, draft, or memo..."
                    rows={4}
                    required
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 font-sans text-sm focus:outline-none focus:border-accent text-text-primary placeholder-zinc-600 resize-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Tags (comma separated: Idea, Hardware, Design)"
                    value={newTagsStr}
                    onChange={(e) => setNewTagsStr(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-accent text-text-primary placeholder-zinc-600"
                  />
                  <div className="flex justify-end gap-3 font-mono text-xs font-bold">
                    <button 
                      type="button" 
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-border hover:bg-white/5 rounded-lg text-text-secondary"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-background rounded-lg transition-colors"
                    >
                      {isSubmitting ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Ledger Cards list */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-mono text-text-secondary">Accessing health-ledger database...</span>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-16 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 bg-surface/40">
                <BookOpen className="w-8 h-8 text-text-dim" />
                <div className="text-sm font-mono text-text-secondary">No voice notes match this tag filter.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredNotes.map((note) => {
                  let tagsArr: string[] = [];
                  try {
                    tagsArr = JSON.parse(note.tags);
                  } catch (e) {}

                  // Compute word count and visual gravity score
                  const gravity = Math.min(10, Math.max(1, Math.round(note.word_count / 4)));

                  return (
                    <div
                      key={note.id}
                      onClick={() => selectNoteForPlayback(note)}
                      className={`glass-panel glow-card relative rounded-xl p-5 cursor-pointer transition-all duration-300 shadow-lg group ${
                        activeNote?.id === note.id
                          ? "border-accent ring-1 ring-accent bg-surface/80 shadow-[0_0_15px_rgba(52,211,153,0.08)]"
                          : "border-border hover:border-accent/40 hover:bg-surface-elevated/50"
                      }`}
                    >
                      {/* Header: Title and tags */}
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <h3 className="font-sans font-bold text-lg text-text-primary group-hover:text-accent transition-colors">
                          {note.title}
                        </h3>
                        <div className="flex flex-wrap gap-1">
                          {tagsArr.map((t) => (
                            <span 
                              key={t}
                              className="bg-surface-elevated border border-border text-accent text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Preview Content snippet */}
                      <p className="text-sm text-text-secondary font-sans leading-relaxed line-clamp-2 mb-4">
                        {note.content}
                      </p>

                      {/* Footer: Date, word count, gravity and delete button */}
                      <div className="flex justify-between items-center border-t border-border pt-3 text-[11px] text-text-muted font-mono">
                        <div className="flex items-center gap-4">
                          <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span>•</span>
                          <span>{note.word_count} words</span>
                          <span>•</span>
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-accent" />
                            <span>Gravity: {gravity}/10</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="p-1 text-text-dim hover:text-danger hover:bg-danger/10 rounded transition-all"
                          title="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          {/* Right Column - Voice Player details Pane (5 cols) */}
          <aside className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass-panel rounded-2xl p-6 shadow-xl sticky top-8 flex flex-col gap-6">
              
              {activeNote ? (
                <>
                  {/* Meta details header */}
                  <div className="border-b border-border pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-text-secondary" />
                      <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-text-secondary">Voice Transcription Node</span>
                    </div>
                    <h2 className="text-2xl font-sans font-extrabold text-text-primary">{activeNote.title}</h2>
                    <div className="text-xs text-text-muted font-mono mt-1">
                      Recorded {new Date(activeNote.created_at).toLocaleString()}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-border/40">
                      <div className="text-[9px] uppercase tracking-widest font-mono font-bold text-text-muted mb-2">Assign Project Tag</div>
                      <div className="flex flex-wrap gap-2">
                        {["Rudder", "Flow", "Amulet", "Ranger"].map((proj) => {
                          let isAssigned = false;
                          try {
                            const parsed = JSON.parse(activeNote.tags);
                            isAssigned = Array.isArray(parsed) && parsed.includes(proj);
                          } catch (e) {}

                          const colorClasses = 
                            proj === "Rudder" ? "border-cyan-500/40 text-cyan-400 bg-cyan-950/20" :
                            proj === "Flow" ? "border-purple-500/40 text-purple-400 bg-purple-950/20" :
                            proj === "Amulet" ? "border-amber-500/40 text-amber-400 bg-amber-950/20" :
                            "border-emerald-500/40 text-emerald-400 bg-emerald-950/20";

                          return (
                            <button
                              key={proj}
                              onClick={() => handleToggleProjectTag(activeNote, proj)}
                              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all duration-200 ${
                                isAssigned 
                                  ? `${colorClasses} shadow-[0_0_10px_rgba(52,211,153,0.05)]` 
                                  : "border-border text-text-muted hover:border-border-hover hover:text-text-secondary bg-surface/30"
                              }`}
                            >
                              {proj}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Tagging Section */}
                    <div className="mt-4 pt-3 border-t border-border/40">
                      <div className="text-[9px] uppercase tracking-widest font-mono font-bold text-text-muted mb-2">Custom Tags</div>
                      {(() => {
                        let parsedTags: string[] = [];
                        try {
                          parsedTags = JSON.parse(activeNote.tags) || [];
                        } catch {
                          parsedTags = [];
                        }
                        const customTags = parsedTags.filter((t) => !["Rudder", "Flow", "Amulet", "Ranger"].includes(t));

                        return (
                          <>
                            {customTags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {customTags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="bg-white/5 border border-white/10 text-text-secondary text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 group"
                                  >
                                    {tag}
                                    <button
                                      onClick={() => handleRemoveCustomTag(activeNote, tag)}
                                      className="text-text-muted hover:text-red-400 font-bold font-sans text-xs pl-1"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-text-dim italic mb-2">No custom tags added.</div>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add custom tag..."
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomTag(activeNote);
                            }
                          }}
                          className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1 font-mono text-[10px] focus:outline-none focus:border-accent text-text-primary placeholder-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomTag(activeNote)}
                          className="px-2.5 py-1 bg-white/5 border border-border hover:bg-white/10 rounded-lg text-[10px] font-mono font-bold text-text-primary"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Convert to Task Section */}
                    <div className="mt-4 pt-3 border-t border-border/40">
                      <button
                        onClick={() => setShowTaskPlanner(!showTaskPlanner)}
                        className="w-full flex items-center justify-between py-2 px-3 bg-white/5 border border-border hover:bg-white/10 rounded-lg text-xs font-mono font-bold text-text-primary transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <ClipboardList className="w-3.5 h-3.5 text-accent" />
                          Convert to Scheduled Task
                        </span>
                        <span className="text-[10px] opacity-60">{showTaskPlanner ? "Close" : "Open"}</span>
                      </button>

                      {showTaskPlanner && (
                        <div className="mt-3 p-4 bg-background border border-border rounded-xl flex flex-col gap-3 shadow-inner">
                          <div className="text-[9px] uppercase tracking-widest font-mono font-bold text-text-muted">Convert note to task</div>
                          
                          <div>
                            <label className="block text-[9px] font-mono text-text-muted mb-1 uppercase">Priority Level</label>
                            <select
                              value={taskPriority}
                              onChange={(e) => setTaskPriority(parseInt(e.target.value))}
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-text-secondary focus:outline-none focus:border-accent"
                            >
                              <option value={0}>None (Standard)</option>
                              <option value={1}>Low Priority</option>
                              <option value={2}>Medium Priority</option>
                              <option value={3}>High Priority</option>
                              <option value={4}>Urgent</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[9px] font-mono text-text-muted mb-1 uppercase">Due Date (Optional)</label>
                            <div className="relative">
                              <input
                                type="date"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-text-secondary focus:outline-none focus:border-accent uppercase"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleConvertToTask(activeNote)}
                            disabled={isCreatingTask || taskCreateSuccess}
                            className={`w-full py-2 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all duration-200 mt-2 ${
                              taskCreateSuccess
                                ? "bg-accent text-background"
                                : "bg-white/5 border border-border hover:bg-white/10 text-white"
                            }`}
                          >
                            {isCreatingTask ? (
                              "Creating Task..."
                            ) : taskCreateSuccess ? (
                              "Task Created Successfully!"
                            ) : (
                              "Confirm Task Conversion"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Simulated Audio Waveform Player */}
                  <div className="bg-background border border-border p-4 rounded-xl flex flex-col gap-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-3 bg-accent hover:bg-accent-hover text-background rounded-full shadow-lg hover:shadow-[#34d399]/20 transition-all duration-200"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                      <div className="flex-1 px-4">
                        {/* Stylized CSS Waveform lines */}
                        <div className="flex items-end justify-between h-8 gap-0.5">
                          {[4, 8, 15, 6, 9, 24, 18, 12, 5, 14, 28, 22, 10, 8, 16, 20, 12, 6, 8, 14, 25, 10, 5, 8, 12, 16, 4].map((height, i) => {
                            const active = isPlaying && (i / 27) * 15 <= playbackTime;
                            return (
                              <div
                                key={i}
                                style={{ height: `${height * 1.1}%` }}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  active ? "bg-accent shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" : "bg-surface-elevated"
                                }`}
                              ></div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-xs font-mono font-bold text-text-secondary">
                        0:{(playbackTime < 10 ? "0" : "") + playbackTime} / 0:15
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-2 text-[10px] text-text-secondary font-mono font-bold justify-center">
                      <Volume2 className="w-3.5 h-3.5 text-accent" />
                      <span>Raw Duplex Audio Stream: resp_{activeNote.id}.wav</span>
                    </div>
                  </div>

                  {/* Main Transcript Content area */}
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-mono font-bold text-text-muted mb-2">Transcript Body</h4>
                    <div className="bg-surface/50 border border-border rounded-xl p-5 font-sans text-sm leading-relaxed text-text-primary min-h-[160px] shadow-inner">
                      {activeNote.content}
                    </div>
                  </div>

                  {/* 10D Metadata Insights Panel */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs uppercase tracking-widest font-mono font-bold text-text-muted mb-3">10D Reality Insights</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-surface border border-border p-3 rounded-lg flex flex-col justify-between">
                        <span className="text-text-muted block font-bold uppercase tracking-wider text-[9px] mb-0.5">Who</span>
                        <span className="font-extrabold text-text-primary">You (Author)</span>
                      </div>
                      <div className="bg-surface border border-border p-3 rounded-lg flex flex-col justify-between">
                        <span className="text-text-muted block font-bold uppercase tracking-wider text-[9px] mb-0.5">Where</span>
                        <span className="font-extrabold text-text-primary">Home Studio / Local Wifi</span>
                      </div>
                      <div className="bg-surface border border-border p-3 rounded-lg flex flex-col justify-between">
                        <span className="text-text-muted block font-bold uppercase tracking-wider text-[9px] mb-0.5">Focus</span>
                        <span className="font-extrabold text-text-primary">
                          {(() => {
                            try {
                              const parsed = JSON.parse(activeNote.tags);
                              return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : "General";
                            } catch (e) {
                              return "General";
                            }
                          })()}
                        </span>
                      </div>
                      <div className="bg-surface border border-border p-3 rounded-lg flex flex-col justify-between">
                        <span className="text-text-muted block font-bold uppercase tracking-wider text-[9px] mb-0.5">Density</span>
                        <span className="font-extrabold text-accent">{activeNote.word_count} words / 15s</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-center text-text-muted">
                  <BookOpen className="w-8 h-8 text-text-dim animate-pulse" />
                  <div className="text-sm font-mono leading-relaxed">Select a voice memo to view the full transcription, play audio, and inspect 10D reality dimensions.</div>
                </div>
              )}

            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
