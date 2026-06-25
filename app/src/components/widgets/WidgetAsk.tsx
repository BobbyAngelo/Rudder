"use client";

import { useState } from "react";
import { Search, Loader2, MessageSquare, Bot } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetAsk() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer || "⚠️ No response");
    } catch {
      setAnswer("⚠️ Error connecting to Biographer.");
    } finally {
      setLoading(false);
      setQuestion("");
    }
  };

  return (
    <WidgetCard title="Ask Rudder" icon={<Bot size={14} />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-4">
        {/* Answer Box */}
        {answer && (
          <div className="flex-1 overflow-y-auto p-4 rounded-xl text-[13px] leading-relaxed border animate-fade-in" 
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}>
            {answer}
          </div>
        )}
        {!answer && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2" style={{ color: "var(--color-text-dim)" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
              <Bot size={24} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>How can I help you today?</p>
            <p className="text-[12px] max-w-[200px]">Query your schedule, tasks, or sovereign ledger.</p>
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
