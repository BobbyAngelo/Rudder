"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  PenTool, Plus, Search, FileText, Loader2, Save, BookOpen, Zap, Mic, Film,
  StickyNote, LayoutList, MessageSquare, Bot, Send, Maximize2, Minimize2,
  Type, Trash2, Eye, Check, Sparkles, X, Folder,
  FolderOpen, ChevronRight, ChevronDown, Printer, Brain
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Zenith Canvas Writing Studio v2.0
   Col 1: Mode Navigation
   Col 2: Hierarchical Folders & Document Index
   Col 3: Full-Page Workspace (Games, Novel Hub, Fountain Preview)
   ═══════════════════════════════════════════════════════ */

interface EntryListItem {
  id: number;
  title: string;
  mode: string;
  word_count: number;
  wpm: number | null;
  tags: string;
  parent_id: number | null;
  meta_json: string;
  is_folder: number;
  created_at: string;
  updated_at: string;
}

interface FullEntry extends EntryListItem {
  content: string;
}

interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  traits: string;
  bio: string;
}

const SECTION_COLOR = "#f59e0b"; // Golden/Amber for creative work

const MODE_ICONS: Record<string, React.ElementType> = {
  journal: BookOpen,
  sprint: Zap,
  biographer: Mic,
  script: Film,
  novel: LayoutList,
  note: StickyNote,
  cyrano: MessageSquare,
};

const MODE_LABELS: Record<string, string> = {
  journal: "Journal",
  sprint: "Sprint Game",
  biographer: "Biographer",
  script: "Screenplay",
  novel: "Novel Editor",
  note: "Zen Note",
  cyrano: "Cyrano Draft",
};

const FONTS = {
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
  sans: "var(--font-sans), Inter, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

// Fountain parser helper
function parseFountainToHtml(text: string): string {
  if (!text) return "<p class='text-xs italic opacity-40'>Start typing in Fountain syntax to render screenplay layout...</p>";
  const lines = text.split("\n");
  let html = "";
  let insideDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      html += '<div class="h-4"></div>';
      insideDialogue = false;
      continue;
    }

    // Centered text
    if (line.startsWith(">") && line.endsWith("<")) {
      html += `<div class="text-center font-mono py-1 text-white">${line.slice(1, -1).trim()}</div>`;
      continue;
    }

    // Scene Headings
    if (
      line.startsWith(".") ||
      line.toUpperCase().startsWith("INT.") ||
      line.toUpperCase().startsWith("EXT.") ||
      line.toUpperCase().startsWith("INT/EXT") ||
      line.toUpperCase().startsWith("EXT/INT") ||
      line.toUpperCase().startsWith("I/E")
    ) {
      const heading = line.startsWith(".") ? line.substring(1) : line;
      html += `<div class="font-mono font-bold uppercase tracking-wide mt-6 mb-2 text-white">${heading}</div>`;
      continue;
    }

    // Transitions
    if (line.endsWith("TO:") && line.toUpperCase() === line) {
      html += `<div class="text-right font-mono uppercase pr-4 py-2 text-white/80">${line}</div>`;
      continue;
    }

    // Character Name (Uppercase line preceded by blank space)
    const isUppercase = line.toUpperCase() === line && !line.match(/[0-9\-+()]/) && line.length > 1;
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
    if (isUppercase && nextLine && !line.startsWith("INT.") && !line.startsWith("EXT.")) {
      html += `<div class="text-center font-mono uppercase tracking-wider font-bold mt-4 text-amber-500" style="margin-left: 20%; margin-right: 20%;">${line}</div>`;
      insideDialogue = true;
      continue;
    }

    // Parenthetical
    if (line.startsWith("(") && line.endsWith(")")) {
      html += `<div class="text-center font-mono italic text-text-secondary" style="margin-left: 25%; margin-right: 25%;">${line}</div>`;
      continue;
    }

    // Dialogue
    if (insideDialogue) {
      html += `<div class="text-left font-mono text-text-primary leading-relaxed pr-[20%] pl-[25%]" style="text-indent: 0;">${line}</div>`;
      continue;
    }

    // Action (default)
    html += `<div class="font-mono text-text-secondary py-1.5 leading-relaxed">${line}</div>`;
  }
  return html;
}

export default function WritingPage() {
  // Library States
  const [entries, setEntries] = useState<EntryListItem[]>([]);
  const [, setModes] = useState<{ mode: string; count: number }[]>([]);
  const [filterMode, setFilterMode] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Folder Expansion State
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  // Active Entry States
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeEntry, setActiveEntry] = useState<FullEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMode, setEditMode] = useState("journal");
  const [editParentId, setEditParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Zen Mode states
  const [zenMode, setZenMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Formatting & Preview states
  const [fontFamily, setFontFamily] = useState<"serif" | "sans" | "mono">("serif");
  const [fontSize] = useState<number>(18);
  const [showPreview, setShowPreview] = useState(false);
  
  // Word Goal states
  const [wordGoal, setWordGoal] = useState<number>(300);

  // Screenplay Formatted Preview toggle
  const [screenplayFormatted, setScreenplayFormatted] = useState(false);

  // AI Assistant States
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTab, setAiTab] = useState<"interview" | "refine" | "outline">("interview");
  const [interviewHistory, setInterviewHistory] = useState<{ role: string; content: string }[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewInput, setInterviewInput] = useState("");

  // AI Refine Actions states
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [outlineContent, setOutlineContent] = useState<string | null>(null);

  // Three Brains context states
  const [editContextType, setEditContextType] = useState("");
  const [showGardenWarning, setShowGardenWarning] = useState(false);
  const [pendingAiAction, setPendingAiAction] = useState<(() => Promise<void>) | null>(null);

  // Cognitive Sprints Game State
  const [sprintState, setSprintState] = useState<"idle" | "running" | "completed">("idle");
  const [sprintTimeLimit, setSprintTimeLimit] = useState<number>(5); // minutes
  const [sprintTimeLeft, setSprintTimeLeft] = useState<number>(300); // seconds
  const [sprintStartWords, setSprintStartWords] = useState<number>(0);
  const [sprintPrompt, setSprintPrompt] = useState<string>("");
  const [sprintGenre, setSprintGenre] = useState<string>("any");
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  
  // Gamified Metrics
  const [wpmHistory, setWpmHistory] = useState<number[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);
  const lastKeyTimeRef = useRef<number | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [canvasOpacity, setCanvasOpacity] = useState<number>(1);
  const [fadeAlert, setFadeAlert] = useState<boolean>(false);

  // Novel Assistant States
  const [novelTab, setNovelTab] = useState<"draft" | "characters" | "plot">("draft");
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("protagonist");
  const [charTraits, setCharTraits] = useState("");
  const [charBio, setCharBio] = useState("");
  const [novelOutline, setNovelOutline] = useState("");

  // Fetch all folders for select inputs
  const folders = useMemo(() => {
    return entries.filter(e => e.is_folder === 1);
  }, [entries]);

  // Load word goal from localstorage on mount
  useEffect(() => {
    const savedGoal = localStorage.getItem("rudder_writing_word_goal");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted goal from localStorage once on mount
    if (savedGoal) setWordGoal(parseInt(savedGoal));
  }, []);

  const changeWordGoal = (val: number) => {
    setWordGoal(val);
    localStorage.setItem("rudder_writing_word_goal", String(val));
  };

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterMode) params.set("mode", filterMode);
      const res = await fetch(`/api/writing?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setModes(data.modes || []);
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoading(false);
    }
  }, [filterMode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch; setState runs after await, not synchronously
    fetchEntries();
  }, [fetchEntries]);

  // Handle entry loading
  const loadEntry = async (id: number) => {
    if (dirty && activeId) {
      await handleSaveDirect(activeId, editTitle, editContent, editMode, editParentId);
    }
    setActiveId(id);
    setAiSuggestion(null);
    setOutlineContent(null);
    setSprintState("idle");
    setCanvasOpacity(1);
    setFadeAlert(false);
    setScreenplayFormatted(false);
    
    try {
      const res = await fetch(`/api/writing?id=${id}`);
      const data = await res.json();
      if (data.entry) {
        setActiveEntry(data.entry);
        setEditTitle(data.entry.title);
        setEditContent(data.entry.content);
        setEditMode(data.entry.mode);
        setEditParentId(data.entry.parent_id);
        setDirty(false);

        // Load context_type from meta_json
        try {
          const meta = JSON.parse(data.entry.meta_json || "{}");
          setEditContextType(meta.context_type || "");
        } catch {
          setEditContextType("");
        }

        // Load novel metadata if applicable
        if (data.entry.mode === "novel") {
          try {
            const meta = JSON.parse(data.entry.meta_json || "{}");
            setNovelOutline(meta.outline || "");
          } catch {
            setNovelOutline("");
          }
          setNovelTab("draft");
        }

        // Reset interview history for biographer mode
        setInterviewHistory([]);
      }
    } catch (err) {
      console.error("Failed to load entry:", err);
    }
  };

  const createEntry = async (isFolder: boolean = false) => {
    try {
      const title = isFolder ? "New Folder" : "Untitled Entry";
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: "",
          mode: filterMode || "journal",
          is_folder: isFolder ? 1 : 0
        }),
      });
      const data = await res.json();
      await fetchEntries();
      if (data.id && !isFolder) {
        loadEntry(data.id);
      }
    } catch (err) {
      console.error("Failed to create entry:", err);
    }
  };

  const deleteEntry = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this entry?")) return;
    
    try {
      await fetch(`/api/writing?id=${id}`, { method: "DELETE" });
      if (activeId === id) {
        setActiveId(null);
        setActiveEntry(null);
      }
      fetchEntries();
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  // Save current entry
  const handleSave = async () => {
    if (!activeId) return;
    let metaPayload = "{}";

    try {
      const prevMeta = JSON.parse(activeEntry?.meta_json || "{}");
      if (editMode === "novel" && activeEntry) {
        prevMeta.outline = novelOutline;
      }
      prevMeta.context_type = editContextType;
      metaPayload = JSON.stringify(prevMeta);
    } catch {
      metaPayload = JSON.stringify({ context_type: editContextType });
    }

    await handleSaveDirect(activeId, editTitle, editContent, editMode, editParentId, metaPayload);
  };

  const handleSaveDirect = async (
    id: number,
    title: string,
    content: string,
    mode: string,
    parentId: number | null,
    metaJson?: string
  ) => {
    setSaving(true);
    setSaveStatus("Saving...");
    try {
      let finalMeta = metaJson || activeEntry?.meta_json || "{}";
      try {
        const parsed = JSON.parse(finalMeta);
        parsed.context_type = editContextType;
        finalMeta = JSON.stringify(parsed);
      } catch {
        finalMeta = JSON.stringify({ context_type: editContextType });
      }

      await fetch("/api/writing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          content,
          mode,
          parent_id: parentId,
          meta_json: finalMeta
        }),
      });
      setSaveStatus("Saved");
      setDirty(false);
      await fetchEntries();
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus("Error");
    } finally {
      setSaving(false);
    }
  };

  // Keyboard Shortcuts (CMD+S to save, CMD+Esc to toggle Zen)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Escape") {
        e.preventDefault();
        setZenMode(z => !z);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Track keystrokes for fade warning and latencies
  const handleTextareaChange = (val: string) => {
    setEditContent(val);
    setDirty(true);
    
    // Set typing focus state to fade out toolbars
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);

    // Track statistics for Sprint Game
    if (sprintState === "running") {
      const now = Date.now();
      if (lastKeyTimeRef.current) {
        const diff = now - lastKeyTimeRef.current;
        setLatencies(prev => [...prev.slice(-99), diff]);
      }
      lastKeyTimeRef.current = now;

      // Reset opacity and warnings on active typing
      setCanvasOpacity(1);
      setFadeAlert(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      // Begin fade countdown timer (5 seconds)
      idleTimerRef.current = setTimeout(() => {
        setFadeAlert(true);
        // Slowly drop opacity
        let currentOp = 1.0;
        const interval = setInterval(() => {
          currentOp = Math.max(0.15, currentOp - 0.15);
          setCanvasOpacity(currentOp);
          if (currentOp <= 0.15) clearInterval(interval);
        }, 1000);
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Timed writing sprint game loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sprintState === "running" && sprintTimeLeft > 0) {
      timer = setInterval(() => {
        setSprintTimeLeft(prev => {
          if (prev <= 1) {
            setSprintState("completed");
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });

        // Compute current WPM and save history
        const wordsWritten = editContent.split(/\s+/).filter(w => w.length > 0).length - sprintStartWords;
        const elapsedSeconds = (sprintTimeLimit * 60) - (sprintTimeLeft - 1);
        if (elapsedSeconds > 0) {
          const currentWpm = Math.round((wordsWritten / elapsedSeconds) * 60);
          setWpmHistory(prev => [...prev.slice(-59), currentWpm]);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 1s tick driven only by sprintState/sprintTimeLeft; adding editContent/sprintStartWords/sprintTimeLimit would restart the timer on every keystroke
  }, [sprintState, sprintTimeLeft]);

  // Sprint game trigger functions
  const startSprint = () => {
    const wordCountOnStart = editContent.split(/\s+/).filter(w => w.length > 0).length;
    setSprintStartWords(wordCountOnStart);
    setSprintTimeLeft(sprintTimeLimit * 60);
    setWpmHistory([]);
    setLatencies([]);
    lastKeyTimeRef.current = Date.now();
    setSprintState("running");
    setCanvasOpacity(1);
    setFadeAlert(false);
  };

  const generateSprintPrompt = async () => {
    setPromptLoading(true);
    try {
      const res = await fetch("/api/writing/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prompt", text: "placeholder", tone: sprintGenre })
      });
      const data = await res.json();
      if (data.result) setSprintPrompt(data.result);
    } catch (err) {
      console.error(err);
      setSprintPrompt("A lone astronaut registers a strange heartbeat signal originating from a dark cave on Jupiter's icy moon Europa.");
    } finally {
      setPromptLoading(false);
    }
  };

  const avgLatency = useMemo(() => {
    if (latencies.length === 0) return 0;
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }, [latencies]);

  const sprintPerformanceScore = useMemo(() => {
    if (wpmHistory.length === 0) return 0;
    const avgWpm = wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length;
    return Math.round(avgWpm);
  }, [wpmHistory]);

  // AI Biography Interview Submissions
  const handleInterviewSubmit = async () => {
    if (!interviewInput.trim()) return;
    const newHistory = [...interviewHistory, { role: "user", content: interviewInput }];
    setInterviewHistory(newHistory);
    setInterviewInput("");
    setInterviewLoading(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: newHistory }),
      });
      const data = await res.json();
      if (data.answer) {
        setInterviewHistory([...newHistory, { role: "assistant", content: data.answer }]);
        // Append response as a narrative record to the editing window
        setEditContent(prev => prev + `\n\nRobert: ${interviewInput}\nBiographer: ${data.answer}`);
        setDirty(true);
      }
    } catch {
      setInterviewHistory([...newHistory, { role: "assistant", content: "⚠️ Interview engine offline." }]);
    } finally {
      setInterviewLoading(false);
    }
  };

  // AI Actions (improve, refine, outlines, scene consistency analysis, copywriting polish)
  const executeAiAction = async (action: "refine" | "outline" | "continue" | "summarize" | "tone" | "novel_analyze" | "copywrite", toneVal?: string) => {
    if (editContextType === "thinking") {
      setShowGardenWarning(true);
      setPendingAiAction(() => () => proceedWithAiAction(action, toneVal));
      return;
    }
    await proceedWithAiAction(action, toneVal);
  };

  const proceedWithAiAction = async (action: "refine" | "outline" | "continue" | "summarize" | "tone" | "novel_analyze" | "copywrite", toneVal?: string) => {
    setAiActionLoading(true);
    setAiSuggestion(null);
    
    let textPayload = editContent;
    if (action === "novel_analyze" && activeEntry) {
      // Gather novel details
      const characterList = activeEntry.meta_json 
        ? (JSON.parse(activeEntry.meta_json).characters as CharacterProfile[] | undefined)?.map((c) => `${c.name} (${c.role}): ${c.bio} [Traits: ${c.traits}]`).join("\n")
        : "None declared";
      textPayload = `[Draft Scene/Chapter]\n${editContent}\n\n[Plot Outline]\n${novelOutline}\n\n[Character Profiles]\n${characterList}`;
    }

    try {
      const res = await fetch("/api/writing/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: textPayload,
          tone: toneVal
        })
      });
      const data = await res.json();
      if (data.result) {
        if (action === "outline") {
          setOutlineContent(data.result);
        } else {
          setAiSuggestion(data.result);
        }
      }
    } catch (err) {
      console.error("AI action failed:", err);
    } finally {
      setAiActionLoading(false);
    }
  };

  // Word metrics computations
  const wordCount = useMemo(() => {
    return editContent.split(/\s+/).filter(w => w.length > 0).length;
  }, [editContent]);

  const progressPercent = useMemo(() => {
    return Math.min(Math.round((wordCount / wordGoal) * 100), 100);
  }, [wordCount, wordGoal]);

  const readingTime = useMemo(() => {
    return Math.max(1, Math.round(wordCount / 200));
  }, [wordCount]);

  const filteredEntries = entries.filter(
    e => !search || e.title.toLowerCase().includes(search.toLowerCase())
  );
  const total = entries.length;

  // Hierarchical list grouping helper
  const renderEntriesHierarchy = () => {
    // Folders
    const rootFolders = filteredEntries.filter(e => e.is_folder === 1 && e.parent_id === null);
    // Unparented documents
    const rootDocs = filteredEntries.filter(e => e.is_folder === 0 && e.parent_id === null);

    return (
      <div className="space-y-2">
        {/* Render Folder Trees */}
        {rootFolders.map(folder => {
          const isExpanded = !!expandedFolders[folder.id];
          const childDocs = filteredEntries.filter(e => e.parent_id === folder.id);
          
          let folderContextType = "";
          try {
            const meta = JSON.parse(folder.meta_json || "{}");
            folderContextType = meta.context_type || "";
          } catch {}

          let folderColorClass = "text-amber-500";
          let folderTextBadge = "";
          if (folderContextType === "thinking") {
            folderColorClass = "text-accent";
            folderTextBadge = "🌿";
          } else if (folderContextType && folderContextType.startsWith("doing_")) {
            folderColorClass = "text-blue-400";
            folderTextBadge = "⚙️";
          }

          return (
            <div key={folder.id} className="space-y-0.5 rounded-xl border border-white/[0.02] bg-white/[0.01] p-1">
              <div 
                onClick={() => setExpandedFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-surface-elevated/40 select-none ${
                  activeId === folder.id ? "bg-surface-elevated border-l-2 border-amber-500" : ""
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                  {isExpanded ? <FolderOpen size={13} className={folderColorClass} /> : <Folder size={13} className={folderColorClass} />}
                  <span className="text-xs font-semibold truncate text-text-secondary">
                    {folder.title || "New Folder"} {folderTextBadge}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-text-muted">{childDocs.length}</span>
                  <button 
                    onClick={(e) => deleteEntry(folder.id, e)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1"
                  >
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="pl-5 space-y-0.5 border-l border-border ml-4 py-1">
                  {childDocs.length === 0 ? (
                    <div className="text-[10px] text-text-dim italic pl-2 py-1">Empty folder</div>
                  ) : (
                    childDocs.map(doc => {
                      const active = activeId === doc.id;
                      const Icon = MODE_ICONS[doc.mode] || FileText;
                      
                      let docContextType = "";
                      try {
                        const meta = JSON.parse(doc.meta_json || "{}");
                        docContextType = meta.context_type || "";
                      } catch {}

                      let docColorClass = active ? "text-amber-500" : "text-text-muted";
                      let docBadge = "";
                      if (docContextType === "thinking") {
                        docColorClass = "text-accent";
                        docBadge = "🌿";
                      } else if (docContextType && docContextType.startsWith("doing_")) {
                        docColorClass = "text-blue-400";
                        docBadge = "⚙️";
                      }

                      return (
                        <div
                          key={doc.id}
                          onClick={() => loadEntry(doc.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            active ? "bg-surface-elevated/80 text-white border-l-2 border-amber-500" : "hover:bg-surface-elevated/30 text-text-secondary"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                            <Icon size={11} className={docColorClass} />
                            <span className="text-xs truncate">{doc.title || "Untitled"} {docBadge}</span>
                          </div>
                          <span className="text-[9px] font-mono text-text-muted shrink-0">{doc.word_count}w</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Render Root Documents */}
        {rootDocs.map(doc => {
          const active = activeId === doc.id;
          const Icon = MODE_ICONS[doc.mode] || FileText;

          let docContextType = "";
          try {
            const meta = JSON.parse(doc.meta_json || "{}");
            docContextType = meta.context_type || "";
          } catch {}

          let docColorClass = active ? "text-amber-500" : "text-text-muted";
          let docBadge = "";
          if (docContextType === "thinking") {
            docColorClass = "text-accent";
            docBadge = "🌿";
          } else if (docContextType && docContextType.startsWith("doing_")) {
            docColorClass = "text-blue-400";
            docBadge = "⚙️";
          }

          return (
            <div
              key={doc.id}
              onClick={() => loadEntry(doc.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all cursor-pointer group ${
                active ? "bg-surface-elevated border-l-2 border-amber-500" : "hover:bg-surface-elevated/40"
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={12} className={docColorClass} />
                  <span className="text-xs font-semibold truncate block text-text-primary">
                    {doc.title || "Untitled"} {docBadge}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono text-text-muted">
                  <span>{doc.word_count}w</span>
                  <span>·</span>
                  <span className="capitalize">{doc.mode}</span>
                </div>
              </div>
              <button 
                onClick={(e) => deleteEntry(doc.id, e)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 p-1"
              >
                <Trash2 size={11} className="text-red-400/80 hover:text-red-400" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Text Template Injection
  const injectTemplate = (type: "morning" | "evening" | "gratitude") => {
    let template = "";
    if (type === "morning") {
      template = `## Morning Pages Intention\n- **Focus for today**: \n- **Key goals to lock down**: \n- **Cognitive status/energy (1-10)**: \n- **Intention statement**: today, I will focus on... \n\n---\n`;
    } else if (type === "evening") {
      template = `## Evening Retrospective\n- **Primary victories today**: \n- **Things that could have gone better**: \n- **Lessons unlocked**: \n- **Notes for tomorrow's checklist**: \n\n---\n`;
    } else if (type === "gratitude") {
      template = `## Gratitude Log\n- **I am grateful for (Person)**: \n- **I am grateful for (Opportunity)**: \n- **I am grateful for (Simple Pleasure)**: \n\n---\n`;
    }
    setEditContent(prev => template + prev);
    setDirty(true);
  };

  // Novel Characters handlers
  const activeNovelMeta = useMemo(() => {
    if (editMode !== "novel" || !activeEntry) return { characters: [] };
    try {
      return JSON.parse(activeEntry.meta_json || "{}");
    } catch {
      return { characters: [] };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dirty` kept intentionally to re-read meta_json after in-place saves; harmless extra recompute
  }, [activeEntry, editMode, dirty]);

  const addCharacterProfile = () => {
    if (!charName.trim() || !activeId) return;
    const newChar: CharacterProfile = {
      id: Math.random().toString(36).substring(2, 9),
      name: charName.trim(),
      role: charRole,
      traits: charTraits.trim(),
      bio: charBio.trim()
    };

    const nextMeta = {
      ...activeNovelMeta,
      characters: [...(activeNovelMeta.characters || []), newChar]
    };

    handleSaveDirect(activeId, editTitle, editContent, editMode, editParentId, JSON.stringify(nextMeta));
    setCharName("");
    setCharTraits("");
    setCharBio("");
  };

  const deleteCharacterProfile = (charId: string) => {
    if (!activeId) return;
    const nextMeta = {
      ...activeNovelMeta,
      characters: (activeNovelMeta.characters || []).filter((c: CharacterProfile) => c.id !== charId)
    };
    handleSaveDirect(activeId, editTitle, editContent, editMode, editParentId, JSON.stringify(nextMeta));
  };

  // Simple Markdown live renderer for the splitscreen preview panel
  const renderedMarkdownHtml = useMemo(() => {
    if (!editContent) return "<p class='text-xs italic opacity-40'>Start typing to preview rendered Markdown...</p>";
    return editContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-5 mb-2 border-b pb-1 text-amber-500">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-4 mb-2 text-amber-400">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold mt-3 mb-1 text-amber-300">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-amber-400">$1</strong>')
      .replace(/__(.*?)__/g, '<strong class="font-semibold text-amber-400">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>')
      .replace(/_(.*?)_/g, '<em class="italic opacity-90">$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-background p-3 rounded-lg font-mono text-xs my-3 overflow-x-auto border border-border text-text-secondary">$1</pre>')
      .replace(/`(.*?)`/g, '<code class="bg-surface px-1.5 py-0.5 rounded font-mono text-[11px] border border-border text-amber-400">$1</code>')
      .replace(/^\>\s+(.*$)/gim, '<blockquote class="border-l-4 border-amber-500 pl-3 italic my-3 text-text-secondary">$1</blockquote>')
      .replace(/^\s*\-\s+(.*$)/gim, '<li class="list-disc list-inside ml-2 py-0.5">$1</li>')
      .replace(/^\s*\*\s+(.*$)/gim, '<li class="list-disc list-inside ml-2 py-0.5">$1</li>')
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="list-decimal list-inside ml-2 py-0.5">$1</li>')
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<br/>';
        if (
          trimmed.startsWith('<h') || 
          trimmed.startsWith('<pre') || 
          trimmed.startsWith('<blockquote') || 
          trimmed.startsWith('<li') || 
          trimmed.startsWith('<br')
        ) {
          return line;
        }
        return `<p class="mb-3 leading-relaxed text-sm">${line}</p>`;
      })
      .join('\n');
  }, [editContent]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Dynamic Screenplay print styling */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #screenplay-print-area, #screenplay-print-area * {
            visibility: visible;
          }
          #screenplay-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 1in 1in 1in 1.5in !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12pt !important;
            line-height: 1.5 !important;
          }
          #screenplay-print-area div {
            color: black !important;
          }
        }
      `}</style>

      {/* ═══ Column 1: Mode Navigation (Hidden in Zen Mode) ═══ */}
      {!zenMode && (
        <div 
          className="w-56 flex flex-col border-r shrink-0 transition-all duration-300" 
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <PenTool size={15} style={{ color: SECTION_COLOR }} />
              <h1 className="text-sm font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Writing Studio</h1>
            </div>
            <span className="text-[10px] font-mono opacity-50">{total} entries</span>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* All Entries tab */}
            <button 
              onClick={() => { setFilterMode(""); setActiveId(null); setActiveEntry(null); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left"
              style={{
                background: filterMode === "" ? "var(--color-surface-elevated)" : "transparent",
                borderLeft: filterMode === "" ? `2.5px solid ${SECTION_COLOR}` : "2.5px solid transparent",
              }}
            >
              <div className="flex items-center gap-2">
                <LayoutList size={13} style={{ color: filterMode === "" ? SECTION_COLOR : "var(--color-text-dim)" }} />
                <span className="text-xs font-semibold" style={{ color: filterMode === "" ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                  All Drafts
                </span>
              </div>
              <span className="text-[9px] font-mono" style={{ color: "var(--color-text-dim)" }}>{total}</span>
            </button>

            {/* Default Modes Categories */}
            {["journal", "sprint", "biographer", "script", "novel", "note"].map(modeKey => {
              const active = filterMode === modeKey;
              const Icon = MODE_ICONS[modeKey] || FileText;
              return (
                <button 
                  key={modeKey} 
                  onClick={() => { setFilterMode(active ? "" : modeKey); setActiveId(null); setActiveEntry(null); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left"
                  style={{
                    background: active ? "var(--color-surface-elevated)" : "transparent",
                    borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={13} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                    <span className="text-xs font-semibold capitalize" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                      {MODE_LABELS[modeKey] || modeKey}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Create New Draft / Folders Button */}
            <div className="pt-4 mt-2 border-t space-y-1.5" style={{ borderColor: "var(--color-border)" }}>
              <button 
                onClick={() => createEntry(false)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border border-dashed transition-all hover:bg-surface-elevated/20"
                style={{ color: SECTION_COLOR, borderColor: `${SECTION_COLOR}50` }}
              >
                <Plus size={13} /> New Document
              </button>
              <button 
                onClick={() => createEntry(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border border-dashed transition-all hover:bg-surface-elevated/20 text-text-secondary border-border"
              >
                <Plus size={13} /> New Folder
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* ═══ Column 2: Search & Entries List (Hidden in Zen Mode) ═══ */}
      {!zenMode && (
        <div 
          className="w-76 flex flex-col border-r shrink-0" 
          style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}
        >
          <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold capitalize text-text-primary">
                {filterMode ? MODE_LABELS[filterMode] || filterMode : "All Files"}
              </span>
              <span className="text-[10px] font-mono text-text-muted">
                {filteredEntries.length} items
              </span>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }} 
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={16} className="animate-spin text-amber-500" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xs text-text-dim">
                  {search ? "No matches found" : "Empty section"}
                </p>
              </div>
            ) : (
              renderEntriesHierarchy()
            )}
          </nav>
        </div>
      )}

      {/* ═══ Column 3: Redesigned Writing Canvas Workspace ═══ */}
      {activeEntry ? (
        activeEntry.is_folder === 1 ? (
          /* Folder Details View */
          <div className="flex-1 flex flex-col items-center justify-center bg-background p-12">
            <div className="max-w-md w-full bg-surface border border-white/5 rounded-2xl p-6 text-center space-y-4">
              <Folder size={48} className="mx-auto text-amber-500 animate-pulse" />
              <div>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                  className="text-lg font-bold bg-transparent text-center outline-none border-b border-transparent focus:border-amber-500 pb-1 w-full text-white" 
                />
                <span className="text-[10px] text-text-muted font-mono mt-1 block">Folder Directory</span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-white/[0.02] border border-white/5 p-3 rounded-xl max-w-xs mx-auto">
                <span className="text-[9px] text-text-dim uppercase tracking-wider font-mono">Context Classification</span>
                <select
                  value={editContextType}
                  onChange={e => { setEditContextType(e.target.value); setDirty(true); }}
                  className="w-full text-xs font-semibold rounded-lg px-2 py-1.5 outline-none cursor-pointer bg-surface border border-border text-white text-center"
                >
                  <option value="">Unclassified</option>
                  <option value="thinking">Thinking Garden 🌿</option>
                  <option value="doing_about_me">AI Context: About Me 👤</option>
                  <option value="doing_frameworks">AI Context: Frameworks ⚙️</option>
                  <option value="doing_examples">AI Context: Examples 💡</option>
                  <option value="doing_knowledge_base">AI Context: Knowledge Base 📚</option>
                  <option value="doing_knowledge_map">AI Context: Knowledge Map 🗺️</option>
                </select>
              </div>
              <p className="text-xs text-text-secondary">
                Rename the folder or adjust its context classification above.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Save size={12} /> Save Folder Changes
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Document Editor View */
          <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: "var(--color-background)" }}>
            
            {/* Header Toolbar */}
            <div 
              className={`flex items-center justify-between px-6 py-3 border-b shrink-0 transition-opacity duration-500 z-20 ${
                zenMode && isTyping ? "opacity-[0.03] pointer-events-none" : "opacity-100"
              }`}
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {/* Title / Mode / Folder selectors */}
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                  className="text-sm font-bold bg-transparent outline-none border-b border-transparent focus:border-amber-500 w-44"
                  style={{ color: "var(--color-text-primary)" }} 
                />
                
                <select 
                  value={editMode}
                  onChange={e => { setEditMode(e.target.value); setDirty(true); }}
                  className="text-[10px] font-mono uppercase rounded-lg px-2 py-1 outline-none cursor-pointer bg-surface border border-border text-text-secondary"
                >
                  <option value="journal">Journal</option>
                  <option value="sprint">Sprint</option>
                  <option value="biographer">Biographer</option>
                  <option value="script">Screenplay</option>
                  <option value="novel">Novel</option>
                  <option value="note">Zen Note</option>
                </select>

                <select
                  value={editParentId || ""}
                  onChange={e => { setEditParentId(e.target.value ? parseInt(e.target.value) : null); setDirty(true); }}
                  className="text-[10px] font-mono rounded-lg px-2 py-1 outline-none cursor-pointer bg-surface border border-border text-text-secondary"
                >
                  <option value="">No Folder (Root)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>

                <select
                  value={editContextType}
                  onChange={e => { setEditContextType(e.target.value); setDirty(true); }}
                  className="text-[10px] font-mono rounded-lg px-2 py-1 outline-none cursor-pointer bg-surface border border-border text-text-secondary"
                  title="Context Classification"
                >
                  <option value="">Unclassified</option>
                  <option value="thinking">Thinking Garden 🌿</option>
                  <option value="doing_about_me">AI: About Me 👤</option>
                  <option value="doing_frameworks">AI: Frameworks ⚙️</option>
                  <option value="doing_examples">AI: Examples 💡</option>
                  <option value="doing_knowledge_base">AI: Knowledge Base 📚</option>
                  <option value="doing_knowledge_map">AI: Knowledge Map 🗺️</option>
                </select>

                {editContextType === "thinking" && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold bg-accent/10 border border-accent/20 text-accent select-none">
                    🌿 Protected Garden
                  </span>
                )}
                {editContextType && editContextType !== "thinking" && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 select-none">
                    ⚙️ AI Context
                  </span>
                )}
              </div>

              {/* Workspace tools */}
              <div className="flex items-center gap-3">
                
                {/* Font switches */}
                <div className="flex items-center rounded-lg overflow-hidden border border-border">
                  {(["serif", "sans", "mono"] as const).map(font => (
                    <button
                      key={font}
                      onClick={() => setFontFamily(font)}
                      className="p-1.5 transition-all hover:bg-surface-elevated"
                      style={{ 
                        background: fontFamily === font ? "rgba(245, 158, 11, 0.15)" : "transparent",
                        color: fontFamily === font ? "#f59e0b" : "var(--color-text-dim)" 
                      }}
                      title={`Switch to ${font} font`}
                    >
                      <Type size={11} />
                    </button>
                  ))}
                </div>

                {/* Print button (Screenplay Mode only) */}
                {editMode === "script" && (
                  <button
                    onClick={() => window.print()}
                    className="p-2 rounded-lg border border-border hover:bg-surface-elevated text-text-secondary flex items-center gap-1.5 text-xs"
                    title="Print screenplay"
                  >
                    <Printer size={12} />
                  </button>
                )}

                {/* Screenplay Formatted preview toggle */}
                {editMode === "script" && (
                  <button
                    onClick={() => setScreenplayFormatted(!screenplayFormatted)}
                    className="p-2 rounded-lg border border-border text-xs flex items-center gap-1.5 transition-all"
                    style={{ 
                      color: screenplayFormatted ? "#f59e0b" : "var(--color-text-dim)",
                      background: screenplayFormatted ? "rgba(245, 158, 11, 0.1)" : "transparent"
                    }}
                  >
                    <Film size={12} /> formatted
                  </button>
                )}

                {/* Splitscreen Preview toggle */}
                <button
                  onClick={() => setShowPreview(p => !p)}
                  className="p-2 rounded-lg border border-border hover:bg-surface-elevated text-xs flex items-center gap-1.5"
                  style={{ 
                    color: showPreview ? "#f59e0b" : "var(--color-text-dim)",
                    background: showPreview ? "rgba(245, 158, 11, 0.1)" : "transparent"
                  }}
                  title="Toggle Splitscreen Markdown Preview"
                >
                  <Eye size={12} /> <span className="hidden sm:inline">Preview</span>
                </button>

                {/* Zen Focus Mode toggle */}
                <button
                  onClick={() => setZenMode(z => !z)}
                  className="p-2 rounded-lg border border-border hover:bg-surface-elevated"
                  style={{ 
                    color: zenMode ? "#f59e0b" : "var(--color-text-dim)" 
                  }}
                  title={zenMode ? "Exit Focus Mode" : "Enter Focus Mode (CMD+ESC)"}
                >
                  {zenMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>

                <div className="h-4 w-px bg-surface-elevated" />

                {/* Status indicators */}
                {saveStatus && <span className="text-[10px] font-mono text-amber-500">{saveStatus}</span>}
                {dirty && !saveStatus && <span className="text-[10px] font-mono text-text-muted animate-pulse">Unsaved</span>}

                {/* Save action */}
                <button 
                  onClick={handleSave} 
                  disabled={saving || !dirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-surface-elevated transition-all disabled:opacity-30 disabled:pointer-events-none"
                  style={{
                    background: dirty ? "#f59e0b" : "transparent",
                    color: dirty ? "#000" : "var(--color-text-dim)"
                  }}
                >
                  <Save size={12} /> Save
                </button>

                {/* AI companion toggle */}
                <button 
                  onClick={() => setShowAiPanel(ai => !ai)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border transition-all hover:bg-surface-elevated"
                  style={{
                    color: showAiPanel ? "#f59e0b" : "var(--color-text-dim)",
                    background: showAiPanel ? "rgba(245, 158, 11, 0.1)" : "transparent"
                  }}
                >
                  <Bot size={12} /> AI Companion
                </button>

              </div>
            </div>

            {/* Central Workspace: Editor Canvas & Side Panels */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* Editor Area with split markdown preview options */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Journal Quick Templates block */}
                {editMode === "journal" && !zenMode && (
                  <div className="px-6 py-2 border-b border-white/[0.02] bg-white/[0.01] flex gap-2 shrink-0 select-none">
                    <span className="text-[10px] font-mono text-text-muted flex items-center mr-2 uppercase">Templates:</span>
                    <button 
                      onClick={() => injectTemplate("morning")}
                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-elevated border border-border text-[10px] text-text-secondary font-semibold"
                    >
                      Morning Intention
                    </button>
                    <button 
                      onClick={() => injectTemplate("evening")}
                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-elevated border border-border text-[10px] text-text-secondary font-semibold"
                    >
                      Evening retrospective
                    </button>
                    <button 
                      onClick={() => injectTemplate("gratitude")}
                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-elevated border border-border text-[10px] text-text-secondary font-semibold"
                    >
                      Gratitude Log
                    </button>
                  </div>
                )}

                {/* SPRINT GAME BOARD VIEW */}
                {editMode === "sprint" && !zenMode && (
                  <div className="px-6 py-4 border-b border-border bg-background/60 shrink-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Zap size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-text-primary uppercase">Timed Cognitive Sprint</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Duration:</span>
                          <select 
                            value={sprintTimeLimit} 
                            onChange={e => setSprintTimeLimit(parseInt(e.target.value))}
                            disabled={sprintState === "running"}
                            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-text-secondary"
                          >
                            <option value={1}>1 min</option>
                            <option value={3}>3 mins</option>
                            <option value={5}>5 mins</option>
                            <option value={10}>10 mins</option>
                            <option value={15}>15 mins</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Prompt Genre:</span>
                          <select 
                            value={sprintGenre} 
                            onChange={e => setSprintGenre(e.target.value)}
                            disabled={sprintState === "running"}
                            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-text-secondary capitalize"
                          >
                            <option value="any">Any Genre</option>
                            <option value="sci-fi">Sci-Fi</option>
                            <option value="noir">Mystery / Noir</option>
                            <option value="fantasy">High Fantasy</option>
                            <option value="cyberpunk">Cyberpunk</option>
                          </select>
                        </div>

                        <button
                          onClick={generateSprintPrompt}
                          disabled={sprintState === "running" || promptLoading}
                          className="px-2.5 py-1 rounded bg-surface border border-border text-[10px] font-mono hover:bg-surface-elevated disabled:opacity-40 text-amber-500"
                        >
                          {promptLoading ? "Generating..." : "Get AI Prompt"}
                        </button>
                      </div>

                      <button
                        onClick={sprintState === "running" ? () => setSprintState("idle") : startSprint}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01] ${
                          sprintState === "running" ? "bg-red-500 text-white" : "bg-amber-500 text-black"
                        }`}
                      >
                        {sprintState === "running" ? "Abort Game" : "Start Sprint Game"}
                      </button>
                    </div>

                    {sprintPrompt && (
                      <div className="p-3 bg-surface border border-border rounded-xl text-xs leading-relaxed text-text-secondary italic relative">
                        <span className="text-[8px] uppercase tracking-wider font-bold text-amber-500 block mb-1">Creative Kickstart prompt</span>
                        &quot;{sprintPrompt}&quot;
                        <button onClick={() => setSprintPrompt("")} className="absolute top-2 right-2 text-text-muted hover:text-text-secondary"><X size={12} /></button>
                      </div>
                    )}

                    {sprintState === "running" && (
                      <div className="grid grid-cols-4 gap-4 p-3 rounded-xl border border-border bg-surface/30 text-center">
                        <div>
                          <div className="text-[9px] font-mono text-text-muted uppercase">Time remaining</div>
                          <div className="text-base font-mono font-bold text-text-primary">
                            {Math.floor(sprintTimeLeft / 60)}:{(sprintTimeLeft % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-text-muted uppercase">Live Speed</div>
                          <div className="text-base font-mono font-bold text-text-primary">
                            {wpmHistory[wpmHistory.length - 1] || 0} WPM
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-text-muted uppercase">Avg Latency</div>
                          <div className="text-base font-mono font-bold text-text-primary">
                            {avgLatency} ms
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-text-muted uppercase">Target words</div>
                          <div className="text-base font-mono font-bold text-amber-500">
                            {editContent.split(/\s+/).filter(w => w.length > 0).length - sprintStartWords} / {wordGoal}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SPRINT GAME OVERLAY MODAL */}
                {sprintState === "completed" && (
                  <div className="absolute inset-0 bg-black/80 z-30 flex items-center justify-center p-6 backdrop-blur-md select-none">
                    <div className="max-w-md w-full bg-surface border border-border p-6 rounded-2xl space-y-5 text-center shadow-2xl animate-scale-up">
                      <Sparkles className="mx-auto text-amber-500 text-center" size={36} />
                      <div>
                        <h3 className="text-lg font-bold text-white">Sprint Completed!</h3>
                        <p className="text-xs text-text-muted font-mono">Statistical flow analysis results</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
                        <div>
                          <div className="text-[10px] text-text-muted font-mono uppercase">Avg Speed</div>
                          <div className="text-xl font-bold font-mono text-white">{sprintPerformanceScore} WPM</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-text-muted font-mono uppercase">Key Latency</div>
                          <div className="text-xl font-bold font-mono text-white">{avgLatency} ms</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-text-muted font-mono uppercase">Words Written</div>
                          <div className="text-xl font-bold font-mono text-amber-500">
                            {editContent.split(/\s+/).filter(w => w.length > 0).length - sprintStartWords}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSprintState("idle")}
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs transition-all"
                        >
                          Finish & Save Session
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* NOVEL DASHBOARD TABS */}
                {editMode === "novel" && !zenMode && (
                  <div className="px-6 border-b border-border bg-background/20 shrink-0 flex gap-4 select-none">
                    {(["draft", "characters", "plot"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setNovelTab(tab)}
                        className="py-3 px-1 text-xs font-semibold border-b-2 uppercase tracking-wide transition-all"
                        style={{
                          borderColor: novelTab === tab ? "#f59e0b" : "transparent",
                          color: novelTab === tab ? "var(--color-text-primary)" : "var(--color-text-dim)"
                        }}
                      >
                        {tab === "draft" ? "Draft Editor" : tab === "characters" ? "Characters Database" : "Story Plot Outline"}
                      </button>
                    ))}
                  </div>
                )}

                {/* EDITING INTERFACES BASED ON ACTIVE STATE */}
                <div className="flex-1 flex overflow-hidden">
                  {editMode === "novel" && novelTab === "characters" ? (
                    /* Novel Character Database View */
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <h3 className="text-sm font-bold text-text-primary uppercase">Characters Database</h3>
                        <span className="text-[10px] font-mono text-text-muted">{(activeNovelMeta.characters || []).length} registered profiles</span>
                      </div>

                      {/* Add character form */}
                      <div className="p-4 rounded-xl border border-border bg-surface/30 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-text-muted uppercase">Name</label>
                          <input 
                            type="text" 
                            placeholder="Character Name..."
                            value={charName}
                            onChange={e => setCharName(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none text-white focus:border-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-text-muted uppercase">Role / Archetype</label>
                          <select 
                            value={charRole}
                            onChange={e => setCharRole(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none text-white focus:border-amber-500"
                          >
                            <option value="protagonist">Protagonist</option>
                            <option value="antagonist">Antagonist</option>
                            <option value="mentor">Mentor</option>
                            <option value="sidekick">Sidekick</option>
                            <option value="love_interest">Love Interest</option>
                            <option value="supporting">Supporting Character</option>
                          </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] font-mono text-text-muted uppercase">Core Traits (comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. ambitious, quick-tempered, loyal..."
                            value={charTraits}
                            onChange={e => setCharTraits(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none text-white focus:border-amber-500"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] font-mono text-text-muted uppercase">Biography / Notes</label>
                          <textarea 
                            placeholder="Write character history, motives, or narrative arc..."
                            value={charBio}
                            onChange={e => setCharBio(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none text-white focus:border-amber-500 h-16 resize-none"
                          />
                        </div>
                        <div className="col-span-2 pt-1">
                          <button
                            onClick={addCharacterProfile}
                            disabled={!charName.trim()}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
                          >
                            <Plus size={13} /> Add Character to Codex
                          </button>
                        </div>
                      </div>

                      {/* Characters Profiles Cards List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(activeNovelMeta.characters || []).map((char: CharacterProfile) => (
                          <div key={char.id} className="p-4 rounded-xl border border-border bg-surface/50 space-y-3 relative group">
                            <button
                              onClick={() => deleteCharacterProfile(char.id)}
                              className="absolute top-3 right-3 text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Profile"
                            >
                              <Trash2 size={13} />
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{char.name}</span>
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded capitalize">
                                {char.role.replace("_", " ")}
                              </span>
                            </div>
                            {char.traits && (
                              <div className="flex flex-wrap gap-1">
                                {char.traits.split(",").map(t => t.trim()).filter(Boolean).map(trait => (
                                  <span key={trait} className="text-[8px] bg-surface-elevated text-text-secondary px-1.5 py-0.5 rounded">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            )}
                            {char.bio && (
                              <p className="text-[11px] leading-relaxed text-text-secondary border-t border-border pt-2">
                                {char.bio}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : editMode === "novel" && novelTab === "plot" ? (
                    /* Novel Story Outline View */
                    <div className="flex-1 flex flex-col p-6 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
                        <h3 className="text-sm font-bold text-text-primary uppercase">Story Plot Outline</h3>
                        <span className="text-[10px] font-mono text-text-muted">Auto-saves in project database</span>
                      </div>
                      <textarea
                        value={novelOutline}
                        onChange={e => { setNovelOutline(e.target.value); setDirty(true); }}
                        placeholder="Outline chapter plot beats, narrative acts, or major twists here..."
                        className="flex-1 w-full bg-background/60 border border-border rounded-2xl p-4 text-sm outline-none text-text-primary focus:border-amber-500 resize-none font-mono leading-relaxed"
                      />
                    </div>
                  ) : (
                    /* Default Canvas Editor */
                    <div className="flex-1 flex overflow-hidden">
                      {/* Actual Writing Textarea */}
                      <div 
                        className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center transition-all duration-700 relative"
                        style={{ opacity: canvasOpacity }}
                      >
                        {fadeAlert && (
                          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-25 bg-red-500/25 border border-red-500/30 backdrop-blur-md rounded-full px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase animate-pulse shadow-lg">
                            ⚠️ Flow state fading! Keep typing...
                          </div>
                        )}

                        <div className="w-full max-w-3xl h-full flex flex-col">
                          {screenplayFormatted ? (
                            /* SCREENPLAY PREVIEW AREA */
                            <div 
                              id="screenplay-print-area"
                              className="w-full p-8 md:p-12 bg-white text-black rounded-2xl shadow-xl min-h-[70vh] selection:bg-amber-100"
                            >
                              <div dangerouslySetInnerHTML={{ __html: parseFountainToHtml(editContent) }} />
                            </div>
                          ) : (
                            /* RAW EDIT CANVAS */
                            <textarea
                              className="w-full flex-1 bg-transparent resize-none outline-none leading-relaxed placeholder:opacity-20 transition-all duration-300"
                              style={{ 
                                color: "var(--color-text-primary)", 
                                fontFamily: FONTS[fontFamily],
                                fontSize: `${fontSize}px`, 
                                minHeight: "70vh",
                                lineHeight: "1.75"
                              }}
                              placeholder="Enter focus state and write..."
                              value={editContent}
                              onChange={e => handleTextareaChange(e.target.value)}
                              spellCheck={false} 
                            />
                          )}
                        </div>
                      </div>

                      {/* Splitscreen HTML/Markdown Preview */}
                      {showPreview && (
                        <div 
                          className="w-1/2 border-l overflow-y-auto p-6 md:p-10" 
                          style={{ borderColor: "var(--color-border)", background: "rgba(0,0,0,0.08)" }}
                        >
                          <div className="max-w-2xl mx-auto prose prose-invert font-sans">
                            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-4">Live Preview</div>
                            <div dangerouslySetInnerHTML={{ __html: renderedMarkdownHtml }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* AI Assistant Right Panel */}
              {showAiPanel && (
                <div 
                  className={`w-80 border-l flex flex-col shrink-0 animate-fade-in transition-opacity duration-500 z-10 ${
                    zenMode && isTyping ? "opacity-[0.03] pointer-events-none" : "opacity-100"
                  }`} 
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  {/* AI Panel Header */}
                  <div className="px-3 pt-3 border-b flex flex-col gap-2" style={{ borderColor: "var(--color-border)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-amber-500">
                        <Sparkles size={13} /> AI Companion
                      </span>
                      <button onClick={() => setShowAiPanel(false)} className="text-text-muted hover:text-text-secondary"><X size={15} /></button>
                    </div>
                    
                    {/* AI Tabs */}
                    <div className="flex border-b border-transparent">
                      {(["interview", "refine", "outline"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setAiTab(tab)}
                          className="flex-1 py-1.5 text-[10px] font-mono uppercase border-b-2 text-center"
                          style={{
                            borderColor: aiTab === tab ? "#f59e0b" : "transparent",
                            color: aiTab === tab ? "var(--color-text-primary)" : "var(--color-text-dim)"
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Panel Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    
                    {/* TAB 1: Conversational Biographer Interview */}
                    {aiTab === "interview" && (
                      <div className="flex flex-col h-full space-y-4">
                        <div className="flex-1 overflow-y-auto space-y-3 max-h-[50vh]">
                          {interviewHistory.length === 0 && (
                            <div className="text-center py-10 space-y-2">
                              <Bot size={28} className="mx-auto text-amber-500" />
                              <p className="text-[11px] px-4 leading-normal text-text-secondary">
                                I am Robert&apos;s biographer. Speak to me to automatically record transcripts and memories.
                              </p>
                            </div>
                          )}
                          {interviewHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div 
                                className={`max-w-[95%] rounded-xl px-3 py-2 text-[11px] leading-relaxed border ${
                                  msg.role === 'user' 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                                    : 'bg-surface border-border text-text-primary'
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {interviewLoading && (
                            <div className="flex justify-start">
                              <div className="bg-surface border border-border rounded-xl px-3 py-2 text-[11px] flex items-center gap-2">
                                <Loader2 size={10} className="animate-spin text-amber-500" />
                                <span className="text-text-muted font-mono">Biographer thinking...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 border border-border mt-auto bg-background">
                          <input 
                            type="text" 
                            value={interviewInput}
                            onChange={e => setInterviewInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleInterviewSubmit()}
                            placeholder="Answer the biographer..."
                            className="flex-1 bg-transparent text-[11px] outline-none text-white placeholder:text-text-dim"
                          />
                          <button onClick={handleInterviewSubmit} disabled={interviewLoading || !interviewInput.trim()} className="hover:opacity-80">
                            <Send size={12} className="text-amber-500" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Refine Options (rewrites, tones, novel analysis) */}
                    {aiTab === "refine" && (
                      <div className="space-y-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-2">Refine Canvas</div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => executeAiAction("refine")}
                            disabled={aiActionLoading || !editContent}
                            className="p-2.5 border border-border rounded-xl text-left text-[11px] transition-all hover:bg-surface disabled:opacity-40"
                          >
                            <div className="font-semibold text-text-primary">✨ Improve</div>
                            <div className="text-[9px] text-text-muted">Grammar & style</div>
                          </button>
                          <button
                            onClick={() => executeAiAction("summarize")}
                            disabled={aiActionLoading || !editContent}
                            className="p-2.5 border border-border rounded-xl text-left text-[11px] transition-all hover:bg-surface disabled:opacity-40"
                          >
                            <div className="font-semibold text-text-primary">📝 Summarize</div>
                            <div className="text-[9px] text-text-muted">Condense paragraphs</div>
                          </button>
                          <button
                            onClick={() => executeAiAction("continue")}
                            disabled={aiActionLoading || !editContent}
                            className="p-2.5 border border-border rounded-xl text-left text-[11px] transition-all hover:bg-surface disabled:opacity-40"
                          >
                            <div className="font-semibold text-text-primary">🪄 Co-Write</div>
                            <div className="text-[9px] text-text-muted">Generate next sentences</div>
                          </button>

                          <button
                            onClick={() => executeAiAction("copywrite")}
                            disabled={aiActionLoading || !editContent}
                            className="p-2.5 border border-border rounded-xl text-left text-[11px] transition-all hover:bg-surface disabled:opacity-40"
                          >
                            <div className="font-semibold text-text-primary">📣 Copywrite</div>
                            <div className="text-[9px] text-text-muted">Harry Dry rules</div>
                          </button>
                          
                          {/* Novel Consistency Review option */}
                          {editMode === "novel" && (
                            <button
                              onClick={() => executeAiAction("novel_analyze")}
                              disabled={aiActionLoading || !editContent}
                              className="p-2.5 border border-border rounded-xl text-left text-[11px] transition-all hover:bg-surface disabled:opacity-40"
                            >
                              <div className="font-semibold text-amber-500">📊 Audit scene</div>
                              <div className="text-[9px] text-text-muted">Consistency review</div>
                            </button>
                          )}
                        </div>

                        {/* Tone Shift tools */}
                        <div className="border-t border-border pt-3">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">Shift Style/Tone</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(["poetic", "professional", "journalistic", "minimalist", "philosophical"] as const).map(tone => (
                              <button
                                key={tone}
                                onClick={() => executeAiAction("tone", tone)}
                                disabled={aiActionLoading || !editContent}
                                className="px-2 py-1 border border-border rounded-lg text-[10px] font-medium capitalize transition-all hover:bg-surface disabled:opacity-40 text-text-secondary"
                              >
                                {tone}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* AI Suggestion Box */}
                        {aiActionLoading && (
                          <div className="p-3 border border-border rounded-xl flex items-center gap-2 bg-surface">
                            <Loader2 size={12} className="animate-spin text-amber-500" />
                            <span className="text-[10px] font-mono text-text-secondary">Analyzing writing context...</span>
                          </div>
                        )}

                        {aiSuggestion && (
                          <div className="border border-border rounded-xl p-3 space-y-3 bg-background">
                            <div className="flex items-center justify-between pb-1 border-b border-border">
                              <span className="text-[9px] font-mono text-amber-500">AI Suggestion</span>
                              <button onClick={() => setAiSuggestion(null)} className="opacity-60 hover:opacity-100 text-text-muted"><X size={10} /></button>
                            </div>
                            <p className="text-[11px] leading-relaxed max-h-[180px] overflow-y-auto pr-1 select-all text-text-secondary whitespace-pre-wrap">
                              {aiSuggestion}
                            </p>
                            <div className="flex gap-2 text-[10px]">
                              <button
                                onClick={() => { handleTextareaChange(editContent + "\n\n" + aiSuggestion); setAiSuggestion(null); }}
                                className="flex-1 py-1 rounded bg-amber-500 text-[10px] font-mono text-black font-semibold text-center hover:scale-[1.01]"
                              >
                                Append
                              </button>
                              <button
                                onClick={() => { handleTextareaChange(aiSuggestion); setAiSuggestion(null); }}
                                className="flex-1 py-1 rounded border border-border text-[10px] font-mono text-text-secondary text-center hover:bg-surface"
                              >
                                Replace
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: Outlines */}
                    {aiTab === "outline" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500">Outline Analysis</span>
                          <button 
                            onClick={() => executeAiAction("outline")}
                            className="text-[9px] font-mono bg-amber-500 text-black font-bold px-2 py-0.5 rounded"
                            disabled={aiActionLoading || !editContent}
                          >
                            Generate
                          </button>
                        </div>

                        {aiActionLoading ? (
                          <div className="flex items-center gap-2 py-4">
                            <Loader2 size={12} className="animate-spin text-amber-500" />
                            <span className="text-[10px] font-mono text-text-muted">Structuring outline...</span>
                          </div>
                        ) : outlineContent ? (
                          <div 
                            className="prose prose-invert text-[11px] leading-relaxed max-h-[60vh] overflow-y-auto font-mono bg-surface p-3 rounded-xl border border-border text-text-secondary"
                          >
                            {outlineContent.split("\n").map((line, i) => (
                              <div key={i} className="py-0.5 whitespace-pre-wrap">{line}</div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-10 text-xs text-text-muted">
                            Click Generate above to parse current text structures.
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>

            {/* Status Bar / Goals metrics */}
            <div 
              className={`px-6 py-2 border-t flex flex-wrap items-center justify-between shrink-0 transition-opacity duration-500 z-20 text-[10px] font-mono uppercase tracking-wider ${
                zenMode && isTyping ? "opacity-[0.03] pointer-events-none" : "opacity-100"
              }`}
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}
            >
              <div className="flex items-center gap-4">
                <span>{wordCount} words</span>
                <span>{editContent.length} characters</span>
                <span>{readingTime} min read</span>
              </div>

              {/* Word Goal Progress Bar */}
              <div className="flex items-center gap-3">
                <span>Target:</span>
                <input
                  type="number"
                  value={wordGoal}
                  onChange={e => changeWordGoal(Math.max(10, parseInt(e.target.value) || 0))}
                  className="w-12 bg-transparent border-b border-border text-center outline-none text-amber-500 font-bold"
                  min="10"
                  step="50"
                />
                <span>words</span>
                
                {/* Progress track */}
                <div className="w-24 h-1.5 rounded-full overflow-hidden border border-border bg-background">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${progressPercent}%`, 
                      background: progressPercent === 100 ? "#10b981" : "#f59e0b",
                      boxShadow: progressPercent === 100 ? "0 0 8px #10b981" : "none" 
                    }}
                  />
                </div>
                <span className={progressPercent === 100 ? "text-accent font-bold" : ""}>
                  {progressPercent}%
                </span>
                {progressPercent === 100 && <Check size={12} className="text-accent font-bold" />}
              </div>
            </div>

          </div>
        )
      ) : (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center" style={{ background: "var(--color-background)" }}>
          <div className="text-center p-8 max-w-sm">
            <PenTool size={36} className="mx-auto mb-4 text-amber-500 animate-pulse" />
            <h2 className="text-base font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>The Zenith Canvas</h2>
            <p className="text-xs mb-4 text-text-muted">
              Welcome to Sovereign User&apos;s distraction-free writing environment. Create a new document or folder, or select an existing draft.
            </p>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => createEntry(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.01] bg-amber-500 text-black"
              >
                <Plus size={14} /> New Document
              </button>
              <button 
                onClick={() => createEntry(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-surface transition-all text-text-secondary"
              >
                <Plus size={14} /> New Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sacred Thinking Garden Protection Modal ── */}
      {showGardenWarning && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-accent/20 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto text-accent animate-pulse">
              <Brain size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                🌿 Thinking Garden Protection Active
              </h3>
              <p className="text-[11px] text-text-dim font-mono uppercase tracking-wider">sacred cognitive space</p>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              This note is part of your **Sacred Thinking Garden**. Running AI actions on this note will mix human - authored insights with AI - generated text, polluting your Zettelkasten garden.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowGardenWarning(false);
                  setPendingAiAction(null);
                }}
                className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-black text-xs font-mono uppercase tracking-wider font-bold rounded-xl transition-all cursor-pointer"
              >
                Protect Garden
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowGardenWarning(false);
                  if (pendingAiAction) {
                    await pendingAiAction();
                    setPendingAiAction(null);
                  }
                }}
                className="flex-1 py-2.5 border border-border hover:border-red-500/30 text-text-muted hover:text-red-400 text-xs font-mono uppercase tracking-wider font-bold rounded-xl transition-all cursor-pointer"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
