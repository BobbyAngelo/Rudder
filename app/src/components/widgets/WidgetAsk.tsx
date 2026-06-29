"use client";

import { useState } from "react";
import { Search, Loader2, Bot, Volume2, VolumeX } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

export function WidgetAsk() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muteSpeech, setMuteSpeech] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const playSpeech = async (text: string) => {
    if (muteSpeech) return;
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        // Stop any currently playing audio
        if (audioObj) {
          audioObj.pause();
        }
        
        const audio = new Audio(url);
        setAudioObj(audio);
        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const fetchAvatar = async (text: string) => {
    try {
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, seed: "Robert" }),
      });
      const data = await res.json();
      setAvatarUrl(data.avatar_url || data.video_url || "");
    } catch { /* fallback */ }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    setIsPlaying(false);
    
    // Clean up old audio
    if (audioObj) {
      audioObj.pause();
      setAudioObj(null);
    }

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const ans = data.answer || "⚠️ No response";
      setAnswer(ans);
      
      await fetchAvatar(ans);
      playSpeech(ans);
    } catch {
      setAnswer("⚠️ Error connecting to Biographer.");
    } finally {
      setLoading(false);
      setQuestion("");
    }
  };

  const toggleMute = () => {
    if (!muteSpeech && audioObj) {
      audioObj.pause();
      setIsPlaying(false);
    }
    setMuteSpeech(!muteSpeech);
  };

  return (
    <WidgetCard title="Ask Rudder" icon={<Bot size={14} />} className="col-span-2 md:col-span-2 row-span-2">
      <div className="flex flex-col h-full space-y-4">
        {/* Answer Box */}
        {answer && (
          <div className="flex-1 overflow-y-auto p-4 rounded-xl text-[13px] leading-relaxed border animate-fade-in flex flex-col space-y-3" 
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}>
            
            {/* Avatar Header */}
            {avatarUrl && (
              <div className="flex items-center space-x-3">
                <div className={`relative w-10 h-10 rounded-full overflow-hidden border transition-all ${isPlaying ? 'ring-2 ring-emerald-400 animate-pulse scale-105' : ''}`}
                  style={{ borderColor: "var(--color-border)" }}>
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[12px]">Knowledge Navigator</span>
                  <span className="text-[10px] text-[var(--color-text-dim)]">{isPlaying ? "Speaking..." : "Offline Butler Mode"}</span>
                </div>
              </div>
            )}
            
            <div>{answer}</div>
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
        <div className="relative mt-auto pt-2 border-t flex items-center space-x-2" style={{ borderColor: "var(--color-border)" }}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-dim)" }} />
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
          <button 
            onClick={toggleMute} 
            title={muteSpeech ? "Unmute Voice Briefing" : "Mute Voice Briefing"}
            className="p-3 rounded-xl border hover:opacity-80 transition-all flex items-center justify-center"
            style={{ background: "var(--color-surface-elevated)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
            {muteSpeech ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </WidgetCard>
  );
}
