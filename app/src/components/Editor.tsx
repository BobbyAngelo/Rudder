"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════
   Editor — The core writing canvas for Rudder.
   
   Supports three modes:
   - journal: Free-form writing with AI assistance
   - sprint: Timed cognitive exercise with WPM tracking
   - biographer: AI-guided interview mode
   
   AI is optional — works perfectly as a plain editor.
   ═══════════════════════════════════════════════════════ */

interface EditorProps {
  documentTitle?: string;
  initialMode?: "journal" | "sprint" | "biographer";
  onSave?: (content: string, metadata: EditorMetadata) => void;
}

interface EditorMetadata {
  wordCount: number;
  mode: string;
  wpm?: number;
  hesitationMs?: number;
}

export function Editor({
  documentTitle = "Untitled",
  initialMode = "journal",
  onSave,
}: EditorProps) {
  const [content, setContent] = useState("");
  const [mode] = useState(initialMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // WPM tracking for sprint mode
  const keystrokeTimestamps = useRef<number[]>([]);
  const [wpm, setWpm] = useState(0);

  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

  const handleKeyDown = useCallback(() => {
    if (mode !== "sprint") return;
    const now = Date.now();
    keystrokeTimestamps.current.push(now);

    // Calculate WPM from last 10 seconds of keystrokes
    const cutoff = now - 10000;
    const recent = keystrokeTimestamps.current.filter((t) => t > cutoff);
    keystrokeTimestamps.current = recent;

    if (recent.length > 1) {
      const duration = (recent[recent.length - 1] - recent[0]) / 1000 / 60;
      const chars = recent.length;
      setWpm(Math.round(chars / 5 / Math.max(duration, 0.01)));
    }
  }, [mode]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    setSaveStatus("Saving...");

    try {
      if (onSave) {
        onSave(content, {
          wordCount,
          mode,
          wpm: mode === "sprint" ? wpm : undefined,
        });
      }
      setSaveStatus("Saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus("Failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div
        className="flex items-center justify-between px-6 py-2.5 border-b shrink-0"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {documentTitle}
          </span>
          <span
            className="badge-neutral"
          >
            {mode}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span
              className="text-xs font-mono"
              style={{ color: "var(--color-text-muted)" }}
            >
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="btn-ghost text-xs"
            style={{ opacity: !content.trim() ? 0.4 : 1 }}
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 overflow-y-auto p-10 lg:p-14">
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          <textarea
            className="w-full flex-1 bg-transparent resize-none outline-none text-lg leading-relaxed placeholder:opacity-30"
            style={{
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
            }}
            placeholder="Start writing..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-6 shrink-0"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: "var(--color-text-dim)" }}
        >
          {wordCount} words
        </span>
        {mode === "sprint" && (
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--color-accent)" }}
          >
            {wpm} WPM
          </span>
        )}
      </div>
    </div>
  );
}
