"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Bot, Calendar, CheckSquare, Settings, HelpCircle, FileText, User, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Custom states for commands
  const [message, setMessage] = useState<string | null>(null);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle command palette on CMD+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
        resetState();
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      resetState();
    };
    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus input immediately when opened
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Reset states
  const resetState = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
    setMessage(null);
    setAskAnswer(null);
    setLoading(false);
  };

  // Perform search / auto-suggestions
  useEffect(() => {
    if (!query.trim() || query.startsWith("/")) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      
      const trimmed = query.trim();
      
      // 1. Process /ask command
      if (trimmed.startsWith("/ask ")) {
        const question = trimmed.replace(/^\/ask\s*/i, "");
        if (!question) return;
        setLoading(true);
        setAskAnswer(null);
        try {
          const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
          });
          const data = await res.json();
          setAskAnswer(data.answer || "⚠️ No response.");
        } catch {
          setAskAnswer("⚠️ Error connecting to Biographer.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2. Process /todo, /event, /write, /node commands
      if (trimmed.startsWith("/")) {
        setLoading(true);
        try {
          const res = await fetch("/api/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: trimmed })
          });
          const data = await res.json();
          if (data.success) {
            setMessage(data.message);
            if (data.redirect) {
              setTimeout(() => {
                router.push(data.redirect);
                setIsOpen(false);
              }, 800);
            } else {
              // Wait 1.5s and reset input
              setTimeout(() => {
                resetState();
                inputRef.current?.focus();
              }, 1500);
            }
          } else {
            setMessage(data.message || "⚠️ Command failed.");
          }
        } catch {
          setMessage("⚠️ Command error.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 3. Process normal search result selection
      if (results.length > 0) {
        const selected = results[selectedIndex];
        router.push(selected.href);
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) {
    // Render a tiny floating badge on the page to launch CMD+K
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full border bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 shadow-lg text-[10px] font-mono tracking-wider active:scale-95"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
      >
        <span>COMMAND</span>
        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px]">⌘K</span>
      </button>
    );
  }

  // Determine active helper hint
  const getHelperHint = () => {
    const trimmed = query.trim();
    if (trimmed.startsWith("/todo ")) return "Press Enter to create this task using NLP parsing.";
    if (trimmed.startsWith("/event ")) return "Press Enter to schedule this event using NLP parsing.";
    if (trimmed.startsWith("/write ")) return "Press Enter to create a new draft in Zenith Studio.";
    if (trimmed.startsWith("/ask ")) return "Press Enter to search reality nodes with AI.";
    if (trimmed.startsWith("/node ")) return "Press Enter to select your default AI model provider.";
    if (trimmed.startsWith("/scan ")) return "Press Enter to run background scans (e.g. /scan media).";
    return null;
  };

  const hint = getHelperHint();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999]" />

      {/* Palette Container */}
      <div 
        ref={containerRef}
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col z-[1000] overflow-hidden animate-scale-up"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        {/* Input Bar */}
        <div className="relative border-b" style={{ borderColor: "var(--color-border)" }}>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-dim)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setMessage(null);
              setAskAnswer(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command (e.g. /todo, /write, /ask) or search..."
            className="w-full pl-12 pr-4 py-4 bg-transparent text-[13px] outline-none transition-all"
            style={{ color: "var(--color-text-primary)" }}
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-accent" />
            </div>
          )}
        </div>

        {/* Command Helper Hint */}
        {hint && (
          <div className="px-4 py-2 border-b text-[10px] font-mono" style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}>
            {hint}
          </div>
        )}

        {/* Dynamic Display Area */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          
          {/* Ask Answer Box */}
          {askAnswer && (
            <div className="p-4 rounded-xl border m-2 text-[12px] leading-relaxed" 
              style={{ background: "var(--color-surface-elevated)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
              <div className="flex items-center gap-1.5 text-accent font-semibold mb-2">
                <Bot size={14} /> Answer
              </div>
              <p>{askAnswer}</p>
            </div>
          )}

          {/* Success/Error message box */}
          {message && (
            <div className="p-3 text-center text-[12px] font-mono rounded-lg m-2 bg-accent/10 border" style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}>
              {message}
            </div>
          )}

          {/* Search Results List */}
          {results.length > 0 && !query.startsWith("/") && (
            <div className="space-y-0.5">
              <div className="px-3 py-1 text-[9px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>Search Matches</div>
              {results.map((res, i) => {
                const isSelected = i === selectedIndex;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      router.push(res.href);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isSelected ? "bg-white/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 shrink-0">
                        {res.type === "people" && <User size={12} className="text-blue-400" />}
                        {res.type === "writing" && <FileText size={12} className="text-purple-400" />}
                        {res.type === "hardware" && <Settings size={12} className="text-yellow-400" />}
                        {!["people", "writing", "hardware"].includes(res.type) && <HelpCircle size={12} className="text-neutral-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{res.title}</div>
                        <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--color-text-dim)" }}>{res.subtitle}</div>
                      </div>
                    </div>
                    {isSelected && <ArrowRight size={12} className="text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Default Cheat Sheet */}
          {(!query.trim() || query === "/") && (
            <div className="space-y-3 p-2">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-dim)" }}>Available Action Commands</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setQuery("/todo ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/todo [item]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Add tasks via NLP</div>
                  </button>
                  <button onClick={() => setQuery("/event ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/event [item]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Schedule calendar events</div>
                  </button>
                  <button onClick={() => setQuery("/write ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/write [title]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Create a writing draft</div>
                  </button>
                  <button onClick={() => setQuery("/ask ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/ask [question]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Search ledger with AI</div>
                  </button>
                  <button onClick={() => setQuery("/node ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/node [ollama|openai]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Switch default AI engine</div>
                  </button>
                  <button onClick={() => setQuery("/scan ")} className="p-3 rounded-xl border text-left bg-white/5 hover:border-accent transition-colors" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[11px] font-bold" style={{ color: "var(--color-text-primary)" }}>/scan [media]</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--color-text-dim)" }}>Trigger background directory scan</div>
                  </button>
                </div>
              </div>

              <div className="border-t pt-3 flex items-center justify-between text-[9px] font-mono" style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}>
                <span>Use Arrow keys to navigate, Enter to select</span>
                <span>ESC to close</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
