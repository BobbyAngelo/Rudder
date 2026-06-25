"use client";

import { useState, useEffect } from "react";
import { Mail, MessageSquare, Sparkles, Copy, Check, ChevronDown, ChevronUp, RefreshCw, Send } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface Message {
  id: number;
  sender: string;
  recipient: string;
  subject: string | null;
  body: string;
  platform: string;
  direction: string;
  decision_log: string | null;
  created_at: string;
}

export function WidgetCorrespondence() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [harnessSlug, setHarnessSlug] = useState("linkedin-ghostwriter");
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const fetchMessages = () => {
    setLoading(true);
    fetch("/api/correspondence?limit=10")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setMessages(d.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setGeneratedDraft("");
    } else {
      setExpandedId(id);
      setGeneratedDraft("");
    }
  };

  const handleGenerateReply = async (id: number) => {
    setGeneratingId(id);
    setGeneratedDraft("");
    try {
      const res = await fetch("/api/correspondence/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id, harnessSlug })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedDraft(data.draft);
      } else {
        setGeneratedDraft(`Error: ${data.error}`);
      }
    } catch {
      setGeneratedDraft("Failed to connect to the local LLM drafting server.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "email":
        return "#3b82f6"; // Blue
      case "slack":
        return "#10b981"; // Green
      case "linkedin":
        return "#06b6d4"; // Cyan
      default:
        return "#8b5cf6"; // Purple (iMessage, etc.)
    }
  };

  return (
    <WidgetCard title="Inbox & Correspondence" icon={<Mail size={14} />} loading={loading} className="col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
        {/* Onboarding / Connection Notice */}
        <div className="p-3 rounded-xl border border-dashed flex flex-col gap-1.5 text-[10px] bg-[var(--color-accent-dim)]" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 font-bold" style={{ color: "var(--color-text-primary)" }}>
            <Sparkles size={11} className="text-accent" />
            <span>Connect Social & Email Profiles</span>
          </div>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
            Currently displaying seeded preview messages. To ingest your own Outlook OLM emails or LinkedIn archives, run the Rudder CLI scripts or configure an MCP server. See the setup guide in <a href="/settings/integrations" className="text-accent hover:underline font-semibold">Settings - Integrations</a>.
          </p>
        </div>

        {messages.length === 0 && !loading && (
          <div className="text-[11px] p-3 text-center rounded-lg" style={{ color: "var(--color-text-dim)", background: "var(--color-surface-elevated)" }}>
            Inbox clean. No incoming or outgoing messages.
          </div>
        )}

        <div className="space-y-2">
          {messages.map(msg => {
            const isExpanded = expandedId === msg.id;
            const isIncoming = msg.direction === "incoming";
            const dateObj = new Date(msg.created_at);
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

            return (
              <div 
                key={msg.id} 
                className="rounded-xl border transition-all duration-200"
                style={{ 
                  background: isExpanded ? "var(--color-surface-hover)" : "var(--color-surface-elevated)",
                  borderColor: isExpanded ? "var(--color-accent)" : "var(--color-border)"
                }}
              >
                {/* Header Summary */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  onClick={() => toggleExpand(msg.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider"
                      style={{ 
                        background: `${getPlatformColor(msg.platform)}1A`,
                        color: getPlatformColor(msg.platform),
                        border: `1px solid ${getPlatformColor(msg.platform)}33`
                      }}
                    >
                      {msg.platform}
                    </span>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                          {isIncoming ? `From: ${msg.sender.split("@")[0]}` : `To: ${msg.recipient.split("@")[0]}`}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>
                          {isIncoming ? "← in" : "→ out"}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                        {msg.subject || msg.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>
                      {dateStr} {timeStr}
                    </span>
                    {isExpanded ? <ChevronUp size={12} style={{ color: "var(--color-text-dim)" }} /> : <ChevronDown size={12} style={{ color: "var(--color-text-dim)" }} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-dashed space-y-3" style={{ borderColor: "var(--color-border)" }}>
                    {/* Message Body */}
                    <div className="text-xs p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed" style={{ background: "var(--color-background)", color: "var(--color-text-primary)" }}>
                      {msg.body}
                    </div>

                    {/* AI-Extracted Decisions */}
                    {isIncoming && msg.decision_log && (
                      <div className="p-3 rounded-lg border" style={{ background: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles size={11} className="text-emerald-500" />
                          <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-500 font-sans">AI Decision Summary</span>
                        </div>
                        <p className="text-xs font-serif italic leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
                          {msg.decision_log}
                        </p>
                      </div>
                    )}

                    {/* Draft Reply Area */}
                    {isIncoming && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>Tone:</label>
                            <select 
                              value={harnessSlug} 
                              onChange={e => setHarnessSlug(e.target.value)}
                              className="text-[10px] py-0.5 px-2 rounded outline-none border cursor-pointer font-sans"
                              style={{ background: "var(--color-background)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}
                            >
                              <option value="linkedin-ghostwriter">Robert's Public Voice</option>
                              <option value="technical-architect">Technical Architect</option>
                              <option value="reflective-coach">Reflective Coach</option>
                            </select>
                          </div>

                          <button
                            onClick={() => handleGenerateReply(msg.id)}
                            disabled={generatingId !== null}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all font-sans"
                            style={{ 
                              background: "var(--color-accent)", 
                              color: "var(--color-background)",
                              opacity: generatingId !== null ? 0.7 : 1 
                            }}
                          >
                            {generatingId === msg.id ? (
                              <>
                                <RefreshCw size={10} className="animate-spin" />
                                Drafting...
                              </>
                            ) : (
                              <>
                                <Sparkles size={10} />
                                Draft Voice Reply
                              </>
                            )}
                          </button>
                        </div>

                        {generatedDraft && (
                          <div className="relative rounded-lg p-2.5 border" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
                            <p className="text-xs font-serif leading-relaxed pr-8 whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                              {generatedDraft}
                            </p>
                            <button
                              onClick={handleCopy}
                              className="absolute top-2 right-2 p-1.5 rounded transition-all hover:bg-neutral-800"
                              style={{ color: copied ? "#10b981" : "var(--color-text-dim)" }}
                            >
                              {copied ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}
