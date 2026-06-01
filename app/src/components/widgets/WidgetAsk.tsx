"use client";

import { useState } from "react";
import { Search, Loader2, MessageSquare, Bot } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface AskSource {
  id: string;
  source: string;
  title: string;
  date?: string;
  snippet: string;
}

export function WidgetAsk() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer || "⚠️ No response");
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setAnswer("⚠️ Error connecting to Rudder.");
    } finally {
      setLoading(false);
      setQuestion("");
    }
  };

  return (
    <WidgetCard title="Ask Rudder" icon={<Bot size={14} />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-4">
        {/* Answer + Sources (the receipts) */}
        {answer && (
          <div className="flex-1 overflow-y-auto space-y-3 animate-fade-in">
            <div className="p-4 rounded-xl text-[13px] leading-relaxed border"
              style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}>
              {answer}
            </div>
            {sources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>
                  Sources
                </p>
                {sources.map((s, i) => (
                  <div key={s.id} className="flex items-start gap-2 p-2.5 rounded-lg border"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                    <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                          {s.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                          style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-dim)" }}>
                          {s.source}
                        </span>
                        {s.date && (
                          <span className="text-[9px]" style={{ color: "var(--color-text-dim)" }}>{s.date}</span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{s.snippet}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!answer && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2" style={{ color: "var(--color-text-dim)" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
              <Bot size={24} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>Ask anything about your life</p>
            <p className="text-[12px] max-w-[220px]">Answered from your own data, on your machine — with sources.</p>
          </div>
        )}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-text-dim)" }} />
          </div>
        )}

        {/* Input Box */}
        <div className="relative mt-auto pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 mt-1" style={{ color: "var(--color-text-dim)" }} />
          <input 
            type="text" 
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Search reality nodes..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[13px] outline-none transition-all"
            style={{ background: "var(--color-background)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
          />
        </div>
      </div>
    </WidgetCard>
  );
}
