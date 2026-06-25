"use client";

import { useState, useEffect } from "react";
import {
  Target, Plus, Trash2, Copy, Download, Check, RefreshCw,
  HelpCircle, Zap, Sparkles, Brain, Terminal, ExternalLink,
  Eye, BookOpen, Settings, AlertCircle, ChevronRight, Loader2
} from "lucide-react";
import { getModuleById } from "@/lib/modules";

interface HarnessConfig {
  id: number;
  name: string;
  slug: string;
  description: string;
  system_instructions: string;
  target_ai: string;
  sourcesCount?: number;
}

interface HarnessSource {
  id?: number;
  source_type: string;
  source_target_id: string | null;
  is_active: number;
  sort_order: number;
}

interface WritingFolder {
  id: number;
  title: string;
}

export default function HarnessPage() {
  const [harnesses, setHarnesses] = useState<HarnessConfig[]>([]);
  const [selectedHarness, setSelectedHarness] = useState<HarnessConfig | null>(null);
  const [sources, setSources] = useState<HarnessSource[]>([]);
  const [writingFolders, setWritingFolders] = useState<WritingFolder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit states
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editTargetAi, setEditTargetAi] = useState("claude");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Compilation states
  const [compiledMarkdown, setCompiledMarkdown] = useState<string>("");
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);
  const [compiling, setCompiling] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // New Harness Dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Load all harnesses and writing folders
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/harness");
        const data = await res.json();
        if (data.success) {
          setHarnesses(data.harnesses);
          if (data.harnesses.length > 0) {
            handleSelectHarness(data.harnesses[0]);
          }
        }

        const writingRes = await fetch("/api/writing");
        const writingData = await writingRes.json();
        if (writingData.entries) {
          const folders = writingData.entries
            .filter((e: any) => e.is_folder === 1)
            .map((e: any) => ({ id: e.id, title: e.title }));
          setWritingFolders(folders);
        }
      } catch (err) {
        console.error("Failed to load harnesses:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSelectHarness = async (harness: HarnessConfig) => {
    setSelectedHarness(harness);
    setEditName(harness.name);
    setEditSlug(harness.slug);
    setEditDescription(harness.description);
    setEditInstructions(harness.system_instructions);
    setEditTargetAi(harness.target_ai);
    setSaveStatus(null);
    setCompiledMarkdown("");
    setTokenEstimate(0);

    try {
      const res = await fetch(`/api/harness/${harness.id}`);
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
        triggerCompile(harness.slug);
      }
    } catch (err) {
      console.error("Error loading harness sources:", err);
    }
  };

  const triggerCompile = async (slug: string) => {
    setCompiling(true);
    try {
      const res = await fetch(`/api/harness/compile?slug=${slug}`);
      const data = await res.json();
      if (data.success && data.compiled) {
        setCompiledMarkdown(data.compiled.compiled_markdown);
        setTokenEstimate(data.compiled.token_estimate);
      }
    } catch (err) {
      console.error("Error compiling harness context:", err);
    } finally {
      setCompiling(false);
    }
  };

  // Toggle active status of a source type
  const handleToggleSource = (sourceType: string, targetId: string | null = null) => {
    const existing = sources.find(s => s.source_type === sourceType && s.source_target_id === targetId);
    
    if (existing) {
      // Toggle active state or remove
      setSources(sources.map(s => 
        s.source_type === sourceType && s.source_target_id === targetId
          ? { ...s, is_active: s.is_active === 1 ? 0 : 1 }
          : s
      ));
    } else {
      // Add as new active source
      const newSource: HarnessSource = {
        source_type: sourceType,
        source_target_id: targetId,
        is_active: 1,
        sort_order: sources.length
      };
      setSources([...sources, newSource]);
    }
  };

  const handleFolderSourceChange = (sourceType: string, folderIdStr: string) => {
    // Remove existing sources of this type
    const filtered = sources.filter(s => s.source_type !== sourceType);
    
    if (folderIdStr !== "none") {
      const newSource: HarnessSource = {
        source_type: sourceType,
        source_target_id: folderIdStr,
        is_active: 1,
        sort_order: filtered.length
      };
      setSources([...filtered, newSource]);
    } else {
      setSources(filtered);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedHarness) return;
    setSaving(true);
    setSaveStatus("Saving context configuration...");

    try {
      const res = await fetch(`/api/harness/${selectedHarness.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          slug: editSlug,
          description: editDescription,
          system_instructions: editInstructions,
          target_ai: editTargetAi,
          sources
        })
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus("Saved successfully!");
        
        // Refresh harness list
        const listRes = await fetch("/api/harness");
        const listData = await listRes.json();
        if (listData.success) {
          setHarnesses(listData.harnesses);
          const updated = listData.harnesses.find((h: any) => h.id === selectedHarness.id);
          if (updated) {
            setSelectedHarness(updated);
          }
        }
        
        triggerCompile(editSlug);
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateHarness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          system_instructions: "You are a professional assistant helpfully solving tasks.",
          target_ai: "claude",
          sources: [
            { source_type: "identity_profile", source_target_id: null, sort_order: 0 }
          ]
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewName("");
        setNewDesc("");
        
        // Reload harnesses
        const listRes = await fetch("/api/harness");
        const listData = await listRes.json();
        if (listData.success) {
          setHarnesses(listData.harnesses);
          const newHarness = listData.harnesses.find((h: any) => h.id === data.id);
          if (newHarness) {
            handleSelectHarness(newHarness);
          }
        }
      }
    } catch (err) {
      console.error("Error creating harness:", err);
    }
  };

  const handleDeleteHarness = async () => {
    if (!selectedHarness) return;
    if (!confirm(`Are you sure you want to delete the "${selectedHarness.name}" context harness?`)) return;

    try {
      const res = await fetch(`/api/harness/${selectedHarness.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const listRes = await fetch("/api/harness");
        const listData = await listRes.json();
        if (listData.success) {
          setHarnesses(listData.harnesses);
          if (listData.harnesses.length > 0) {
            handleSelectHarness(listData.harnesses[0]);
          } else {
            setSelectedHarness(null);
          }
        }
      }
    } catch (err) {
      console.error("Error deleting harness:", err);
    }
  };

  const handleCopyToClipboard = () => {
    if (!compiledMarkdown) return;
    navigator.clipboard.writeText(compiledMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceActive = (sourceType: string, targetId: string | null = null): boolean => {
    const src = sources.find(s => s.source_type === sourceType && s.source_target_id === targetId);
    return src ? src.is_active === 1 : false;
  };

  const activeWritingFolderId = sources.find(s => s.source_type === "writing_folder" && s.is_active === 1)?.source_target_id || "none";
  const activeFrameworksFolderId = sources.find(s => s.source_type === "doing_frameworks" && s.is_active === 1)?.source_target_id || "none";
  const activeExamplesFolderId = sources.find(s => s.source_type === "doing_examples" && s.is_active === 1)?.source_target_id || "none";
  const activeKbFolderId = sources.find(s => s.source_type === "doing_knowledge_base" && s.is_active === 1)?.source_target_id || "none";
  const activeMapFolderId = sources.find(s => s.source_type === "doing_knowledge_map" && s.is_active === 1)?.source_target_id || "none";

  const getTokenEstimateColor = () => {
    if (tokenEstimate < 4000) return "text-accent bg-accent/10 border-accent/20";
    if (tokenEstimate < 16000) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-screen text-[var(--color-text-dim)] font-mono text-[12px] uppercase gap-3">
        <Loader2 size={24} className="animate-spin text-accent" />
        Synchronizing context arrays...
      </div>
    );
  }

  const activeHarnessMeta = getModuleById("harness");

  return (
    <div className="page-container flex flex-col h-screen overflow-hidden text-text-primary bg-background">
      
      {/* ── HEADER ── */}
      <header className="h-14 flex items-center justify-between border-b shrink-0 px-6" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-accent/10 text-accent">
            <Target size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Context Harness</h1>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              {activeHarnessMeta?.description || "Build custom AI context packages to bypass the friction tax"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-black text-[11px] font-mono uppercase tracking-wider font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-98"
        >
          <Plus size={14} /> New Harness
        </button>
      </header>

      {/* ── COLUMN LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden w-full">
        
        {/* COLUMN 1: HARNESS SELECTOR (Sidebar-like list) */}
        <div className="w-64 border-r shrink-0 flex flex-col overflow-y-auto bg-sidebar-bg/60 p-4 gap-4" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold block">Active Personas</span>
          {harnesses.length === 0 ? (
            <div className="text-[11px] text-text-dim italic text-center py-8">No configurations found.</div>
          ) : (
            <div className="space-y-1.5">
              {harnesses.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleSelectHarness(h)}
                  className={`w-full flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    selectedHarness?.id === h.id
                      ? "bg-accent/10 border-accent/30 text-white"
                      : "border-border bg-background/20 hover:bg-surface-elevated/40 text-text-secondary"
                  }`}
                >
                  <span className="text-xs font-bold truncate">{h.name}</span>
                  <span className="text-[9px] font-mono text-text-dim mt-1 flex items-center justify-between w-full">
                    <span>Target: {h.target_ai.toUpperCase()}</span>
                    <span>{h.sourcesCount || 0} active</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedHarness ? (
          <>
            {/* COLUMN 2: HARNESS CONFIGURATION & SOURCES */}
            <div className="w-[40%] border-r flex flex-col overflow-y-auto p-6 space-y-6" style={{ borderColor: "var(--color-border)" }}>
              
              {/* Core Specs */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Configuration Parameters</h3>
                  <button
                    onClick={handleDeleteHarness}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-text-dim hover:text-rose-400 transition-colors"
                    title="Delete Harness"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-dim">Harness Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                      }}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-dim">Sovereign Slug</label>
                    <input
                      type="text"
                      value={editSlug}
                      readOnly
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated/40 font-mono text-text-dim cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-dim">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-dim">Target AI Platform</label>
                  <select
                    value={editTargetAi}
                    onChange={(e) => setEditTargetAi(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                  >
                    <option value="claude">Claude (Anthropic Projects)</option>
                    <option value="chatgpt">ChatGPT (Custom GPTs / Threads)</option>
                    <option value="gemini">Gemini (NotebookLM / Flash)</option>
                    <option value="cursor">Cursor (IDE Context)</option>
                    <option value="ollama">Ollama (Local Swarms / CLI)</option>
                  </select>
                </div>
              </div>

              <hr className="border-border" />

              {/* Source Selectors */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Dynamic Data Sources</h3>
                
                <div className="space-y-2">
                  <div 
                    onClick={() => handleToggleSource("identity_profile")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("identity_profile") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("identity_profile")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Identity Core Profile</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Robert's bio, location, contact, and website details</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleSource("identity_values")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("identity_values") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("identity_values")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Core Values & Telos</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Prioritized personal philosophy statement blocks</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleSource("career_timeline")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("career_timeline") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("career_timeline")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Professional Experience</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Chronological job titles, divisions, and highlights</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleSource("career_skills")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("career_skills") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("career_skills")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Skills & Expertise</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Categorized expert skill tags (tech, production, tools)</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleSource("career_awards")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("career_awards") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("career_awards")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Awards & Recognitions</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Emmy and Webby wins and results tracker</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleSource("health_vitals")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      getSourceActive("health_vitals") ? "bg-surface border-accent/20" : "bg-transparent border-border hover:bg-surface/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={getSourceActive("health_vitals")}
                        readOnly
                        className="rounded border-border text-accent focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Recent Biometrics (7 days)</div>
                        <div className="text-[10px] text-text-dim mt-0.5">Heart rate, steps, sleep, and mood trends</div>
                      </div>
                    </div>
                  </div>

                  {/* About Me / Writing Folder */}
                  <div className="p-3.5 rounded-xl border border-border bg-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">About Me / Profile Folder</div>
                      <span className="text-[9px] font-mono text-text-muted">TIER 1 DATA</span>
                    </div>
                    <select
                      value={activeWritingFolderId}
                      onChange={(e) => handleFolderSourceChange("writing_folder", e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    >
                      <option value="none">None - Do not bundle profile references</option>
                      {writingFolders.map(f => (
                        <option key={f.id} value={String(f.id)}>Folder: {f.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Frameworks Folder */}
                  <div className="p-3.5 rounded-xl border border-border bg-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">Frameworks (SOPs) Folder</div>
                      <span className="text-[9px] font-mono text-text-muted">TIER 2 DATA</span>
                    </div>
                    <select
                      value={activeFrameworksFolderId}
                      onChange={(e) => handleFolderSourceChange("doing_frameworks", e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    >
                      <option value="none">None - Do not bundle frameworks</option>
                      {writingFolders.map(f => (
                        <option key={f.id} value={String(f.id)}>Folder: {f.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Examples Folder */}
                  <div className="p-3.5 rounded-xl border border-border bg-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">Examples (Benchmarks) Folder</div>
                      <span className="text-[9px] font-mono text-text-muted">TIER 2 DATA</span>
                    </div>
                    <select
                      value={activeExamplesFolderId}
                      onChange={(e) => handleFolderSourceChange("doing_examples", e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    >
                      <option value="none">None - Do not bundle examples</option>
                      {writingFolders.map(f => (
                        <option key={f.id} value={String(f.id)}>Folder: {f.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Knowledge Base Folder */}
                  <div className="p-3.5 rounded-xl border border-border bg-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">Knowledge Base Folder</div>
                      <span className="text-[9px] font-mono text-text-muted">TIER 3 DATA</span>
                    </div>
                    <select
                      value={activeKbFolderId}
                      onChange={(e) => handleFolderSourceChange("doing_knowledge_base", e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    >
                      <option value="none">None - Do not bundle knowledge base</option>
                      {writingFolders.map(f => (
                        <option key={f.id} value={String(f.id)}>Folder: {f.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Knowledge Map Folder */}
                  <div className="p-3.5 rounded-xl border border-border bg-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">Knowledge Map Folder</div>
                      <span className="text-[9px] font-mono text-text-muted">TIER 3 DATA</span>
                    </div>
                    <select
                      value={activeMapFolderId}
                      onChange={(e) => handleFolderSourceChange("doing_knowledge_map", e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                    >
                      <option value="none">None - Do not bundle knowledge maps</option>
                      {writingFolders.map(f => (
                        <option key={f.id} value={String(f.id)}>Folder: {f.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Instructions */}
              <div className="space-y-2 flex-1 flex flex-col min-h-[220px]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">System Persona & Guidelines</h3>
                <textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="e.g., You write raw, high-impact posts. Avoid generic adjectives. Never use em-dashes..."
                  rows={4}
                  className="w-full flex-1 text-xs px-3.5 py-3 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none font-sans"
                />
              </div>

              {/* Save Panel */}
              <div className="pt-4 border-t flex items-center justify-between gap-4 shrink-0" style={{ borderColor: "var(--color-border)" }}>
                <span className="text-xs text-accent font-semibold">{saveStatus}</span>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-6 py-2.5 bg-accent text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl hover:opacity-90 transition-all active:scale-98 cursor-pointer disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Commit Settings"}
                </button>
              </div>
            </div>

            {/* COLUMN 3: LIVE COMPILED VIEW */}
            <div className="flex-1 flex flex-col overflow-hidden bg-surface/10 p-6 space-y-4">
              
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-text-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Live Compiled Context</h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono ${getTokenEstimateColor()}`}>
                    Tokens: ~{tokenEstimate.toLocaleString()}
                  </div>
                  <button
                    onClick={() => triggerCompile(selectedHarness.slug)}
                    disabled={compiling}
                    className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-white transition-colors cursor-pointer"
                    title="Recompile"
                  >
                    <RefreshCw size={12} className={compiling ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Compiled Markdown View */}
              <div className="flex-1 rounded-2xl border border-border bg-background/50 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap select-text selection:bg-accent/20 select-all">
                  {compiling ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-dim text-[11px] uppercase tracking-wider font-sans gap-2 animate-pulse">
                      <Sparkles size={16} className="animate-spin text-accent" />
                      Parsing Sovereign Data Nodes...
                    </div>
                  ) : compiledMarkdown ? (
                    compiledMarkdown
                  ) : (
                    <div className="flex items-center justify-center h-full text-text-dim italic text-center">
                      No sources compiled yet. Click Recompile or enable data sources.
                    </div>
                  )}
                </div>
                
                {/* Actions Panel */}
                <div className="h-14 border-t border-border bg-surface/30 px-5 flex items-center justify-between shrink-0">
                  <button
                    onClick={handleCopyToClipboard}
                    disabled={!compiledMarkdown}
                    className="px-4 py-2 bg-surface-elevated border border-border hover:border-accent/30 text-xs text-text-secondary hover:text-white rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 active:scale-98 cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Harness Context"}
                  </button>

                  <a
                    href={`/api/harness/export?slug=${selectedHarness.slug}`}
                    download
                    className={`px-4 py-2 bg-accent text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl transition-all flex items-center gap-2 hover:opacity-90 active:scale-98 ${
                      !compiledMarkdown ? "opacity-45 pointer-events-none" : ""
                    }`}
                  >
                    <Download size={14} /> Download Project ZIP
                  </a>
                </div>
              </div>

              {/* Swarm / External Integration Hook */}
              <div className="p-4 rounded-xl border border-border bg-surface/20 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-1.5">
                    <Terminal size={12} /> Sovereign Swarm Hook
                  </span>
                  <span className="text-[9px] font-mono text-text-dim">CURL ENDPOINT</span>
                </div>
                <div className="p-3.5 rounded-lg bg-black/60 border border-white/5 font-mono text-[10px] text-accent select-all overflow-x-auto whitespace-nowrap">
                  curl http://localhost:3000/api/harness/compile?slug={selectedHarness.slug}
                </div>
                <p className="text-[9px] text-text-dim">
                  Pass this endpoint to external Python CLI tools, terminal aliases, or local swarm agents on CASE/KIPP to inject live context.
                </p>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-12 text-text-dim">
            <AlertCircle size={48} className="text-text-dim mb-4 animate-pulse" />
            <h4 className="text-[14px] font-bold text-white">Select a Persona Harness</h4>
            <p className="text-[12px] mt-1 max-w-sm">
              Choose one of your AI context harnesses in the left panel to configure its prompt guidelines, active sources, and preview its markdown bundle.
            </p>
          </div>
        )}

      </div>

      {/* ── CREATE HARNESS DIALOG OVERLAY ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateHarness}
            className="w-full max-w-md rounded-2xl border flex flex-col p-6 animate-scale-up"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2 pb-4 border-b mb-4" style={{ borderColor: "var(--color-border)" }}>
              <Brain size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-white">Create New Persona Harness</h3>
            </div>

            <div className="space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-dim">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Blog Copywriter"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-dim">Brief Description</label>
                <input
                  type="text"
                  placeholder="e.g., Tone guidelines for technical documentation"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-surface font-semibold text-white focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-border bg-transparent text-white text-xs font-mono uppercase tracking-wider font-bold rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="flex-1 py-2.5 bg-accent text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl hover:opacity-90 transition-all active:scale-[0.99] cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
