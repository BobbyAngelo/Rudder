"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, Send, Shield, RefreshCw } from "lucide-react";
import { Card, CardBody } from "@/components/ui";

export default function OverlayPage() {
  const [listening, setListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  
  const [inputText, setInputText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize Web Speech API Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setListening(true);
          setStatus("listening");
          setTranscript("");
        };

        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          setTranscript(resultText);
          setInputText(resultText);
          handleSubmitQuery(resultText);
        };

        rec.onerror = (e: any) => {
          console.error("Speech Recognition Error:", e);
          setListening(false);
          setStatus("idle");
        };

        rec.onend = () => {
          setListening(false);
          if (status === "listening") {
            setStatus("idle");
          }
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [status]);

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setResponse("");
      recognitionRef.current?.start();
    }
  };

  const handleSubmitQuery = async (queryText: string) => {
    if (!queryText || queryText.trim().length < 3) return;

    setLoading(true);
    setStatus("thinking");
    setResponse("");

    try {
      // 1. Fetch AI Answer from RAG query endpoint
      const askRes = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText })
      });
      const askData = await askRes.json();
      const aiAnswer = askData.answer || "No response received.";
      setResponse(aiAnswer);

      if (speechEnabled && askData.online) {
        // 2. Synthesize TTS speech
        setStatus("speaking");
        const ttsRes = await fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiAnswer })
        });

        if (ttsRes.ok) {
          const audioBlob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          
          if (audioRef.current) {
            audioRef.current.pause();
          }
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => {
            setStatus("idle");
          };
          audio.play().catch(() => {
            setStatus("idle");
          });
        } else {
          setStatus("idle");
        }
      } else {
        setStatus("idle");
      }
    } catch (e) {
      console.error(e);
      setResponse("An error occurred connecting to the local AI backend.");
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (typeof window !== "undefined") {
      window.close();
    }
  };

  return (
    <div 
      className="h-screen w-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ 
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)"
      }}
    >
      <div className="absolute inset-0 bg-radial-gradient from-amber-500/5 to-transparent pointer-events-none" />

      {/* Frame Container */}
      <div className="w-full max-w-lg animate-fade-in relative z-10">
        <Card hover={false} className="border-amber-500/20 bg-black/60 shadow-2xl relative overflow-hidden">
          {/* Accent light indicator */}
          <div className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
            status === "listening" ? "bg-amber-500 animate-pulse" :
            status === "thinking" ? "bg-purple-500 animate-pulse" :
            status === "speaking" ? "bg-emerald-500 animate-pulse" :
            "bg-zinc-800"
          }`} />

          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-neutral-800 transition-colors"
          >
            <X size={14} />
          </button>

          <CardBody className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2">
              <Shield size={16} className="text-amber-500 shrink-0" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500/70">
                RUDDER SOVEREIGN ASSISTANT
              </span>
            </div>

            {/* Mic Visualizer Area */}
            <div className="flex flex-col items-center py-4 space-y-4">
              <button
                onClick={toggleListening}
                className={`relative flex items-center justify-center w-20 h-20 rounded-full border transition-all duration-300 ${
                  listening ? "bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]" :
                  status === "thinking" ? "bg-purple-500/10 border-purple-500" :
                  status === "speaking" ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]" :
                  "bg-neutral-900 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                {/* Ripple waves when active */}
                {listening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                    <span className="absolute -inset-2 rounded-full bg-amber-500/10 animate-ping delay-300" />
                  </>
                )}
                {status === "speaking" && (
                  <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse" />
                )}

                {listening ? (
                  <Mic size={28} className="text-amber-500" />
                ) : (
                  <MicOff size={28} className="text-zinc-400" />
                )}
              </button>

              <div className="text-center">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {status === "listening" ? "Listening to voice..." :
                   status === "thinking" ? "Retrieving from ledger..." :
                   status === "speaking" ? "Reading response aloud..." :
                   "Click to dictate or ask a question"}
                </span>
                {transcript && (
                  <p className="text-[11px] text-amber-400/90 mt-1 italic font-medium">
                    "{transcript}"
                  </p>
                )}
              </div>
            </div>

            {/* Search/Type Box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuery(inputText);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-zinc-800 bg-black/40"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about your metrics, tasks, or emails..."
                className="flex-1 bg-transparent border-none text-xs text-[var(--color-text-primary)] focus:outline-none px-2 py-1 placeholder-zinc-600"
              />
              
              <button
                type="button"
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  speechEnabled ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-zinc-800 text-zinc-500 hover:bg-neutral-800"
                }`}
                title={speechEnabled ? "Mute TTS Feedback" : "Enable TTS Feedback"}
              >
                {speechEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              <button
                type="submit"
                disabled={loading || inputText.trim().length < 3}
                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </form>

            {/* Response Area */}
            {response && (
              <div 
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-[var(--color-text-secondary)] font-serif leading-relaxed max-h-[160px] overflow-y-auto"
                style={{ scrollbarWidth: "thin" }}
              >
                {response}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
