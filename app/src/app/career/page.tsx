"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Briefcase, Sparkles, Trophy, Calendar, Users, Cpu, Mic, MicOff,
  Video, Compass, Award, ExternalLink, Link2, Plus, Play, Info,
  TrendingUp, Send, CheckCircle2, AlertCircle, RefreshCw, Layers,
  FileText, Printer, Download, MapPin, Mail, Phone, Globe
} from "lucide-react";

// Types matching career-data.json
interface Person {
  name: string;
  headline?: string;
  location: string;
  linkedin: string;
  imdb: string;
  instagram: string;
  reel: string;
  websites: string[];
}

interface Education {
  degree: string;
  school: string;
  location: string;
}

interface EmmyWin {
  year: number;
  show: string;
  category: string;
  result: string;
}

interface OtherAward {
  title: string;
  project: string;
  org: string;
  year?: number;
}

interface Awards {
  television_academy_url: string;
  summary: string;
  emmys: EmmyWin[];
  other: OtherAward[];
}

interface CareerTimelineItem {
  company: string;
  title: string;
  division?: string;
  start: string;
  end: string;
  highlights: string[];
}

interface Skills {
  creative: string[];
  production: string[];
  technical: string[];
  tools: string[];
}

interface JobApplication {
  company: string;
  role: string;
  year: string;
  docs: string[];
}

interface OriginalIP {
  title: string;
  format: string;
  pitched_to?: string;
  status: string;
}

interface CareerData {
  person: Person;
  education: Education[];
  awards: Awards;
  career_timeline: CareerTimelineItem[];
  skills: Skills;
  job_applications: JobApplication[];
  original_ip: OriginalIP[];
  clients_and_brands: string[];
}

export default function CareerPage() {
  const [activeTab, setActiveTab] = useState<"vault" | "tracker" | "copilot" | "resume">("copilot");
  const [careerData, setCareerData] = useState<CareerData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Resume builder targets state
  const [resumeTarget, setResumeTarget] = useState<string>("Standard");

  // Copilot Live States
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [targetCompany, setTargetCompany] = useState<string>("Custom");
  const [customTargetRole, setCustomTargetRole] = useState<string>("");
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isAudioStreaming, setIsAudioStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [copilotText, setCopilotText] = useState<string>("");
  const [transcription, setTranscription] = useState<string>("Copilot is idle. Connect to begin listening.");
  const [chatInput, setChatInput] = useState<string>("");

  // Refs for Web Audio & WebSockets
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);

  // Static target companies derived from applications
  const applicationTargets = [
    { company: "Red Bull", role: "Digital Creative Producer" },
    { company: "Netflix", role: "Creative Producer" },
    { company: "Paramount+", role: "Strategy Director" },
    { company: "Dhar Mann Studios", role: "Creative Producer" },
    { company: "Treyarch", role: "Producer" },
    { company: "TikTok", role: "Producer" },
    { company: "Sphere", role: "Producer" },
    { company: "DJI", role: "Creative Director" }
  ];

  // Fetch Career data from local API
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/career");
        if (!res.ok) throw new Error("Failed to load career data");
        const data = await res.json();
        setCareerData(data);
      } catch (err: any) {
        setDataError(err.message);
      } finally {
        setDataLoading(false);
      }
    }
    
    async function loadConfig() {
      try {
        const res = await fetch("/api/copilot/config");
        if (!res.ok) throw new Error("GEMINI_API_KEY is missing");
        const data = await res.json();
        setApiKey(data.geminiApiKey);
      } catch (err: any) {
        setConfigError("GEMINI_API_KEY is not set in .env.local. Provide a key to run the live assistant.");
      }
    }

    loadData();
    loadConfig();
  }, []);

  // Visualizer loop
  useEffect(() => {
    if (connectionState === "connected" && isAudioStreaming && canvasRef.current && audioAnalyserRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const analyser = audioAnalyserRef.current;
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvas || !ctx || !analyser) return;
        const width = canvas.width;
        const height = canvas.height;
        
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = "rgba(7, 7, 9, 0.25)";
        ctx.fillRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * height * 0.85;

          // Harmonic color gradient (emerald-teal to golden)
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, "rgba(52, 211, 153, 0.05)");
          grad.addColorStop(0.5, "rgba(52, 211, 153, 0.4)");
          grad.addColorStop(1, "rgba(234, 179, 8, 0.8)");

          ctx.fillStyle = grad;
          // Symmetrical drawing
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          ctx.fillRect(width - x - barWidth, height - barHeight, barWidth - 2, barHeight);

          x += barWidth;
        }
      };

      draw();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Draw flatline
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.fillStyle = "#070709";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(115, 115, 115, 0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [connectionState, isAudioStreaming]);

  // Audio downsampling conversion to Int16 PCM (little-endian)
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Compile detailed prompt preamble tailored with the user's own career ledger
  const buildSystemPreamble = () => {
    const activeTarget = applicationTargets.find(t => t.company === targetCompany);
    const targetRole = customTargetRole || activeTarget?.role || "Creative Producer";
    
    // Parse career highlights to seed preamble
    const timelineStr = careerData?.career_timeline.map(t => 
      `- ${t.company} (${t.start}-${t.end}): ${t.title} ${t.division ? `(${t.division})` : ""}. Achievements: ${t.highlights.join("; ")}`
    ).join("\n") || "";

    const emmysStr = careerData?.awards.emmys.map(e => 
      `- ${e.year} Emmy for ${e.show} as ${e.category} (${e.result})`
    ).join("\n") || "";

    const originalIpStr = careerData?.original_ip.map(ip => 
      `- "${ip.title}" (${ip.format}) - Status: ${ip.status}`
    ).join("\n") || "";

    const clientsStr = careerData?.clients_and_brands.join(", ") || "";

    const candidateName = careerData?.person?.name?.trim() || "the candidate";
    const awardsSummary = careerData?.awards?.summary?.trim() || "";

    return `You are ${candidateName}'s high-fidelity, real-time silent Interview Copilot.
You run securely in the background on their local system during a live job interview.
Your goal is to listen to the interviewer's spoken questions and instantly provide a real-time Markdown cheat-sheet on screen to guide their answers.

Base everything ONLY on the candidate's own career data below. Never invent achievements, employers, or metrics that aren't present.

---
CANDIDATE CAREER LEDGER:
Name: ${candidateName}
${awardsSummary ? `Awards summary: ${awardsSummary}` : ""}
Timeline Highlights:
${timelineStr}

Awards Detail:
${emmysStr}

Original IP Developed/Pitched:
${originalIpStr}

Clients & Brands: ${clientsStr}

---
CURRENT TARGET:
Role: ${targetRole}
Company: ${targetCompany}

INTERVIEW GUIDANCE CONSTRAINTS:
1. Tailor your answer strategies to the target role and company above, drawing only on the candidate's real experience.
2. Address the candidate directly as their supportive, hyper-intelligent operations partner.
3. Be ultra-compact, structured, and easy to scan in 2 seconds. Use bullet points and bold headers only. No long essays.
4. Listen to the spoken audio. As soon as you hear a question from the interviewer, transcribe it in the Heard Question header and instantly flash an update of the copilot teleprompter card. If the speaker is just chatting, keep quiet.

YOUR HUD OUTPUT SCHEMA FORMAT MUST EXACTLY MATCH THIS TEMPLATE ON EVERY UPDATE:
---
### 🎤 Heard Question:
"[Transcribe the question you just heard in 1 clear, concise sentence]"

### 💡 Core Strategy:
*   **The Hook**: [A 1-sentence opening hook tailored to the candidate's background matching the question]
*   **The Story**: [The single best project/anecdote from the candidate's career that matches this question]
*   **The Killer Stat**: [Exact numeric metrics to quote from the candidate's ledger]

### 📌 Bullet Talking Points:
*   [Talking point 1 with bold terms]
*   [Talking point 2 with bold terms]
*   [Talking point 3 with bold terms]
---
`;
  };

  // Connect to Gemini Live WS
  const handleConnect = async () => {
    if (!apiKey) {
      alert("GEMINI_API_KEY is not loaded. Please set it in .env.local.");
      return;
    }

    setConnectionState("connecting");
    setCopilotText("Connecting to Gemini Live API stateful gateway...");

    try {
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionState("connected");
        setCopilotText("### 🟢 Copilot Online\nWebSocket connected securely. Formulating preamble and waiting for audio stream...");
        setTranscription("Live. Speak into your mic or start typing prompts below.");
        
        // Send session setup message
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["TEXT"]
            },
            systemInstruction: {
              parts: [
                {
                  text: buildSystemPreamble()
                }
              ]
            }
          }
        };
        socket.send(JSON.stringify(setupMessage));
        
        // Start streaming mic audio immediately if not muted
        startAudioStreaming(socket);
      };

      socket.onmessage = async (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.serverContent) {
            const { modelTurn, turnComplete, interrupted } = response.serverContent;
            
            if (interrupted) {
              setCopilotText(prev => prev + "\n\n*[Interrupted by speech]*\n");
            }

            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                if (part.text) {
                  // Capture stream chunks and update copilot teleprompter HUD
                  setCopilotText(prev => {
                    // If starting a new stream block, wipe previous status strings
                    if (prev.includes("Waiting for audio stream") || prev.includes("Copilot Online")) {
                      return part.text;
                    }
                    return prev + part.text;
                  });

                  // Capture transcribed question if parsed
                  const heardMatch = part.text.match(/Heard Question:\s*\n*"(.*?)"/i);
                  if (heardMatch && heardMatch[1]) {
                    setTranscription(`Heard: "${heardMatch[1]}"`);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      socket.onerror = (e) => {
        console.error("WS error:", e);
        setCopilotText("### ⚠️ Connection Error\nFailed to hold WebSocket socket. Verify your network or API Key credentials.");
        setConnectionState("disconnected");
        stopAudioStreaming();
      };

      socket.onclose = () => {
        setConnectionState("disconnected");
        setCopilotText("### ⚪ Disconnected\nWebSocket stream closed.");
        setTranscription("Copilot is idle. Connect to begin listening.");
        stopAudioStreaming();
      };

    } catch (err: any) {
      console.error(err);
      setConnectionState("disconnected");
      setCopilotText(`### ⚠️ Connection Failed\nError: ${err.message}`);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    stopAudioStreaming();
  };

  // Request mic and stream PCM audio
  const startAudioStreaming = async (socket: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      // Downsampling setup: standard 16kHz context
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      
      // Analyser Node for visualizer
      const analyser = audioCtx.createAnalyser();
      audioAnalyserRef.current = analyser;
      source.connect(analyser);

      // ScriptProcessorNode downsample pipeline
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || socket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0); // 16kHz Float32 array
        
        // Convert Float32 to Int16 PCM (little endian)
        const pcmBuffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert Int16 PCM to Base64
        const base64Audio = arrayBufferToBase64(pcmBuffer.buffer);

        // Stream PCM base64 payload to Gemini Bidi
        socket.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsAudioStreaming(true);
    } catch (err) {
      console.error("Failed to capture mic:", err);
      setCopilotText(prev => prev + "\n\n⚠️ *Mic Access Blocked. Copilot cannot listen.*");
    }
  };

  const stopAudioStreaming = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsAudioStreaming(false);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  // Text-Barge In (Manual override to query Copilot)
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || connectionState !== "connected") return;

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: chatInput
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    wsRef.current.send(JSON.stringify(payload));
    setTranscription(`Prompted: "${chatInput}"`);
    setCopilotText("Formulating target points based on prompt override...");
    setChatInput("");
  };

  // Click on a timeline highlight/anecdote to instantly query
  const handleTriggerAnecdote = (text: string) => {
    if (connectionState !== "connected" || !wsRef.current) {
      alert("Connect the Live Copilot first to query this anecdote.");
      return;
    }
    setChatInput(text);
  };

  // Custom client-side Markdown rendering helper
  const renderMarkdown = (text: string) => {
    if (!text) return "";
    
    // Basic escapes
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    // Custom header tags matching premium style
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs font-mono uppercase tracking-wider text-emerald-400 border-b border-border pb-1 mt-5 mb-2">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mt-4 mb-1.5">$1</h4>');
    
    // Bold styles
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-300 font-semibold">$1</strong>');
    
    // Markdown bullet list item styling
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-text-secondary py-1 font-sans text-[13px] leading-relaxed">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-text-secondary py-1 font-sans text-[13px] leading-relaxed">$1</li>');
    
    // Horizontal dividers
    html = html.replace(/^---$/gim, '<hr class="my-4 border-border" />');
    
    // Linebreaks
    html = html.replace(/\n/g, '<br />');
    
    return html;
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-primary">
      
      {/* ═══ COLUMN 1: LEFT PANEL: Active Stats, Timeline & Anecdotes Vault ═══ */}
      <div 
        className="w-full md:w-96 border-r flex flex-col shrink-0 overflow-y-auto" 
        style={{ borderColor: "var(--color-border)", background: "var(--color-sidebar-bg)" }}
      >
        
        {/* Module Header Title */}
        <div className="p-6 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Briefcase size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Career Vault</h1>
              <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Sovereign Profile & Live Copilot</p>
            </div>
          </div>
        </div>

        {/* Global Statistics Panel */}
        <div className="p-6 border-b space-y-4" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold">Ledger Scorecard</span>
          {dataLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw size={16} className="animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-background/40">
                <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Award wins</div>
                <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center gap-1.5">
                  <Trophy size={14} className="text-amber-400" /> {careerData?.awards.emmys.filter(e => /won/i.test(e.result)).length ?? 0}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-background/40">
                <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Nominations</div>
                <div className="text-lg font-bold font-mono text-white mt-0.5">{careerData?.awards.emmys.length ?? 0} total</div>
              </div>
              {careerData?.awards.other?.[0] && (
                <div className="p-3.5 rounded-xl border border-border bg-background/40 col-span-2 flex justify-between items-center">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">{careerData.awards.other[0].title}</div>
                    <div className="text-xs font-semibold text-text-secondary mt-0.5">{careerData.awards.other[0].project}</div>
                  </div>
                  <Award size={18} className="text-emerald-400" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Premium Anecdote & Fun Facts Cheat Deck */}
        <div className="p-6 flex-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold">Biographer Anecdotes Cheat Deck</span>
            <span className="text-[9px] font-mono text-emerald-500/80 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Active</span>
          </div>

          <div className="space-y-3.5">
            {(careerData?.career_timeline ?? []).slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleTriggerAnecdote(`Tell me about my time as ${item.title} at ${item.company}`)}
                className="p-3 rounded-xl border border-border bg-background/20 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-[11px] font-bold text-text-secondary group-hover:text-emerald-400 transition-colors">{item.title} — {item.company}</h4>
                  <Plus size={10} className="text-text-dim group-hover:text-emerald-400" />
                </div>
                {item.highlights?.[0] && (
                  <p className="text-[10px] leading-relaxed text-text-muted mt-1">{item.highlights[0]}</p>
                )}
              </div>
            ))}
            {(careerData?.career_timeline?.length ?? 0) === 0 && (
              <p className="text-[10px] leading-relaxed text-text-dim italic">
                No career history yet. Add your timeline (e.g. run the identity importer) and your anecdotes will appear here for the Copilot.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* ═══ COLUMN 2: MAIN PANEL (Interactive Tabs & Live Dashboard) ═══ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-background)" }}>
        
        {/* Dynamic Tab Navigation Bar */}
        <div 
          className="flex items-center justify-between p-6 shrink-0 border-b relative z-20 print-hide" 
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("copilot")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "copilot" ? "bg-emerald-500/10 border border-emerald-500/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Sparkles size={12} className={activeTab === "copilot" ? "text-emerald-400" : ""} /> Live Copilot HUD
            </button>
            <button
              onClick={() => setActiveTab("vault")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "vault" ? "bg-emerald-500/10 border border-emerald-500/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Layers size={12} /> Timeline Ledger
            </button>
            <button
              onClick={() => setActiveTab("tracker")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "tracker" ? "bg-emerald-500/10 border border-emerald-500/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Briefcase size={12} /> Target Job Tracker
            </button>
            <button
              onClick={() => setActiveTab("resume")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "resume" ? "bg-emerald-500/10 border border-emerald-500/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <FileText size={12} className={activeTab === "resume" ? "text-emerald-400" : ""} /> Resume Builder
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Model Status */}
            {connectionState === "connected" && (
              <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded bg-emerald-500/5 border border-emerald-500/10 text-text-secondary">
                <Cpu size={10} className="text-emerald-400 animate-pulse" /> models/gemini-2.0-live
              </span>
            )}
            {connectionState === "connecting" && (
              <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded bg-amber-500/5 border border-amber-500/10 text-text-secondary animate-pulse">
                <RefreshCw size={10} className="animate-spin text-amber-400" /> SECURING CONNECTION
              </span>
            )}
            {connectionState === "disconnected" && (
              <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded bg-surface border border-border text-text-muted">
                ⚪ OFFLINE
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Display Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-area" style={{ background: "#09090b" }}>
          
          {/* ════ TAB 1: PORTFOLIO TIMELINE LEDGER ════ */}
          {activeTab === "vault" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers size={16} className="text-emerald-400" /> Your Sourced Chronology
                </h2>
                <span className="text-[10px] font-mono text-text-muted">Verified from career-data.json</span>
              </div>

              {dataLoading ? (
                <div className="flex justify-center py-20">
                  <RefreshCw size={24} className="animate-spin text-emerald-400" />
                </div>
              ) : dataError ? (
                <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} /> Failed to parse chronology: {dataError}
                </div>
              ) : (
                <div className="relative border-l border-border pl-6 ml-4 space-y-8">
                  {careerData?.career_timeline.map((item, idx) => (
                    <div key={idx} className="relative group">
                      {/* Timeline anchor node */}
                      <span className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border border-emerald-500 bg-background transition-transform group-hover:scale-125 shadow-lg shadow-emerald-500/10" />
                      
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.company}</h3>
                          {item.division && (
                            <span className="text-[10px] font-mono bg-surface border border-border text-text-muted px-1.5 py-0.5 rounded">
                              {item.division}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-text-muted bg-background px-2 py-0.5 border border-border rounded">
                          {item.start} — {item.end}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-text-secondary mt-1">{item.title}</h4>
                      
                      <ul className="mt-3 space-y-1.5">
                        {item.highlights.map((highlight, hIdx) => (
                          <li key={hIdx} className="text-xs leading-relaxed text-text-secondary pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-surface-elevated">
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 2: TARGET JOB APPLICATION TRACKER ════ */}
          {activeTab === "tracker" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase size={16} className="text-emerald-400" /> Active Job Application Substrates
                </h2>
                <span className="text-[10px] font-mono text-text-muted">Sync status: Ledger Direct</span>
              </div>

              {dataLoading ? (
                <div className="flex justify-center py-20">
                  <RefreshCw size={24} className="animate-spin text-emerald-400" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {careerData?.job_applications.map((app, idx) => (
                    <div 
                      key={idx} 
                      className="p-5 rounded-2xl border border-border bg-background/40 hover:border-emerald-500/20 transition-all space-y-3.5"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-bold text-white">{app.company}</h3>
                          <p className="text-xs text-text-secondary font-semibold mt-0.5">{app.role}</p>
                        </div>
                        <span className="text-[9px] font-mono text-text-muted bg-background px-2 py-0.5 border border-border rounded">
                          {app.year}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-border/60 flex flex-wrap gap-2">
                        {app.docs.map((doc, dIdx) => (
                          <span 
                            key={dIdx} 
                            className="text-[9px] font-mono uppercase bg-surface border border-border text-text-secondary px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            <Link2 size={8} /> {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 3: LIVE INTERVIEW COPILOT HUD ════ */}
          {activeTab === "copilot" && (
            <div className="h-full flex flex-col gap-6">
              
              {/* Target Selection & Visualizer Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
                
                {/* Control Panel Card */}
                <div className="p-5 rounded-2xl border border-border bg-background/20 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold block">Target Selection</span>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted block uppercase">Target Company</label>
                      <select 
                        value={targetCompany}
                        onChange={e => {
                          setTargetCompany(e.target.value);
                          setCustomTargetRole("");
                          if (connectionState === "connected") {
                            handleDisconnect();
                            setTimeout(handleConnect, 500); // Re-establish with new tailored prompt
                          }
                        }}
                        className="w-full bg-background text-text-primary border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        {applicationTargets.map((t, idx) => (
                          <option key={idx} value={t.company}>{t.company} — {t.role}</option>
                        ))}
                        <option value="Custom">-- Custom Role --</option>
                      </select>
                    </div>

                    {targetCompany === "Custom" && (
                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] font-mono text-text-muted block uppercase">Custom Target Role</label>
                        <input
                          type="text"
                          value={customTargetRole}
                          placeholder="e.g. Creative Lead"
                          onChange={e => setCustomTargetRole(e.target.value)}
                          className="w-full bg-background text-text-primary border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Primary Connection Toggle */}
                  <div className="flex gap-2">
                    {connectionState === "disconnected" ? (
                      <button
                        onClick={handleConnect}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Play size={12} fill="black" /> Connect Copilot
                      </button>
                    ) : (
                      <button
                        onClick={handleDisconnect}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all"
                      >
                        Disconnect
                      </button>
                    )}

                    {connectionState === "connected" && (
                      <button
                        onClick={handleMuteToggle}
                        className={`w-10 rounded-xl flex items-center justify-center border transition-all ${
                          isMuted 
                            ? "bg-red-500/10 border-red-500/30 text-red-400" 
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}
                        title={isMuted ? "Unmute Mic" : "Mute Mic"}
                      >
                        {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>
                    )}
                  </div>

                </div>

                {/* Live soundwave oscilloscope card */}
                <div className="lg:col-span-2 p-5 rounded-2xl border border-border bg-background/20 flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold block">Live Listening Feed</span>
                    {connectionState === "connected" && isAudioStreaming && !isMuted ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Streaming Mic (16kHz PCM)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-text-dim uppercase">Mic is silent</span>
                    )}
                  </div>

                  <div className="flex-1 h-20 rounded-xl overflow-hidden bg-background/60 relative border border-border">
                    <canvas ref={canvasRef} width={600} height={80} className="w-full h-full block" />
                  </div>

                  <div className="flex gap-2 items-center text-[10px] text-text-muted font-mono">
                    <Info size={11} className="text-text-muted shrink-0" />
                    <span>The copilot listens to spoken audio. When a question is detected, updates stream below.</span>
                  </div>
                </div>

              </div>

              {/* Secure API Key Missing Alert */}
              {configError && (
                <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 text-xs text-amber-400 flex items-center gap-3 shrink-0">
                  <AlertCircle size={16} className="shrink-0 text-amber-500" />
                  <div>
                    <h5 className="font-bold text-amber-500">Missing Configuration</h5>
                    <p className="text-[11px] text-text-secondary mt-0.5">{configError}</p>
                  </div>
                </div>
              )}

              {/* 🎤 Live Heard Question Board */}
              <div className="p-5 rounded-2xl border border-border bg-background/20 space-y-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold block">Live Question Feed</span>
                <div className="px-4 py-3 rounded-xl bg-background/50 border border-border text-xs font-mono text-text-secondary truncate leading-relaxed">
                  {transcription}
                </div>
              </div>

              {/* 💡 SENSORY COPILOT HUD TELEPROMPTER */}
              <div className="flex-1 min-h-[300px] p-6 rounded-2xl border border-border bg-background/20 flex flex-col gap-4 overflow-hidden relative">
                
                {/* Floating dynamic glow header badge */}
                <div className="flex justify-between items-center border-b border-border/60 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-400 font-bold">Copilot HUD Teleprompter</span>
                  </div>
                  <span className="text-[9px] font-mono text-text-dim bg-background px-2 py-0.5 rounded border border-border uppercase">
                    Target: {targetCompany}
                  </span>
                </div>

                {/* Scrollable teleprompter panel */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-[13px] leading-relaxed select-text font-sans scrollbar-thin">
                  {copilotText ? (
                    <div 
                      className="whitespace-pre-wrap leading-loose" 
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(copilotText) }}
                    />
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center py-10 text-center space-y-2 text-text-dim">
                      <Sparkles size={24} className="text-background animate-pulse" />
                      <p className="text-xs italic">HUD is blank. Connect and speak to generate real-time metrics & answers.</p>
                    </div>
                  )}
                </div>

                {/* Quick Manual text override / Barge-in */}
                <form 
                  onSubmit={handleSendText}
                  className="mt-2 relative flex items-center bg-background/60 border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/30 shrink-0"
                >
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    disabled={connectionState !== "connected"}
                    placeholder={
                      connectionState === "connected"
                        ? "Type a keyword (e.g. 'leadership') to guide the Copilot manually..."
                        : "Connect to use text overrides..."
                    }
                    className="flex-1 py-3 px-4 bg-transparent outline-none text-xs text-text-secondary"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || connectionState !== "connected"}
                    className="w-8 h-8 mr-2 rounded-lg flex items-center justify-center bg-emerald-500 text-black hover:scale-105 disabled:opacity-30 disabled:scale-100 transition-all"
                  >
                    <Send size={12} />
                  </button>
                </form>

              </div>

            </div>
          )}

          {/* ════ TAB 4: PRINT-OPTIMIZED RESUME BUILDER ════ */}
          {activeTab === "resume" && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Screen Only Target Tuning Panel */}
              <div className="p-5 rounded-2xl border border-border bg-background/20 flex flex-col md:flex-row items-center justify-between gap-4 print-hide">
                <div className="space-y-1 text-left">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-400" /> Target Role Highlight Tuner
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Dynamically filters and elevates chronological achievements matching your specific interview target.
                  </p>
                </div>

                <div className="flex gap-2">
                  <select 
                    value={resumeTarget}
                    onChange={e => setResumeTarget(e.target.value)}
                    className="bg-background text-text-primary border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                  >
                    <option value="Standard">Standard (Full Portfolio)</option>
                    <option value="Tailored">Tailored (Emphasize target role/company)</option>
                  </select>

                  <button
                    onClick={() => window.print()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <Printer size={12} /> Print Resume
                  </button>
                </div>
              </div>

              {/* The Pristine Printable Serif Resume Layout */}
              <div className="print-resume bg-white text-black p-8 font-serif leading-relaxed max-w-4xl mx-auto shadow-sm rounded-xl">
                
                {/* Header Profile */}
                <div className="text-center space-y-2 border-b-2 border-black pb-5">
                  <h1 className="text-3xl font-bold tracking-wide uppercase">{careerData?.person.name || "Your Name"}</h1>
                  <p className="text-[11px] font-sans tracking-widest uppercase text-text-dim font-semibold">
                    {careerData?.person.headline || "Your headline · role · specialty"}
                  </p>
                  
                  <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-sans text-text-muted pt-1">
                    <span className="flex items-center gap-1"><MapPin size={9} /> {careerData?.person.location}</span>
                    <span className="flex items-center gap-1"><Globe size={9} /> {careerData?.person.websites[0]}</span>
                    <span className="flex items-center gap-1"><Link2 size={9} /> {careerData?.person.linkedin}</span>
                  </div>
                </div>

                {/* Professional Summary */}
                <div className="py-5 space-y-2 border-b border-border">
                  <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-background">Professional Summary</h2>
                  <p className="text-xs text-text-dim leading-relaxed font-serif">
                    {careerData?.awards.summary || "Your professional summary will appear here once you add it to your career data."}
                  </p>
                </div>

                {/* Grid for Skills and Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-5 border-b border-border">
                  
                  {/* Left Column: Awards & Education */}
                  <div className="md:col-span-1 space-y-4 text-left border-r border-border pr-4">
                    <div className="space-y-2">
                      <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-background">Distinctions</h2>
                      <div className="space-y-2">
                        {(careerData?.awards.other ?? []).map((a, idx) => (
                          <div key={idx} className="text-xs font-serif leading-tight">
                            <strong className="block text-black font-semibold">{a.title}</strong>
                            <span className="text-[10px] text-text-muted font-sans block">{[a.project, a.org, a.year].filter(Boolean).join(" • ")}</span>
                          </div>
                        ))}
                        {(careerData?.awards.other?.length ?? 0) === 0 && (
                          <p className="text-[10px] text-text-muted font-sans italic">Add awards to your career data to list them here.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-background">Education</h2>
                      {careerData?.education.map((edu, idx) => (
                        <div key={idx} className="text-xs leading-tight font-serif">
                          <strong className="block text-background font-semibold">{edu.degree}</strong>
                          <span className="text-[10px] text-text-muted font-sans block">{edu.school} &bull; {edu.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Dynamic Skills Map */}
                  <div className="md:col-span-2 space-y-4 text-left pl-2">
                    <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-background">Core Competencies</h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-sans uppercase font-bold text-text-secondary block tracking-wider">Creative Strategy</span>
                        <ul className="text-[11px] text-text-dim space-y-0.5 list-disc pl-3">
                          {careerData?.skills.creative.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-sans uppercase font-bold text-text-secondary block tracking-wider">Production Operations</span>
                        <ul className="text-[11px] text-text-dim space-y-0.5 list-disc pl-3">
                          {careerData?.skills.production.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>

                      <div className="space-y-1 col-span-2">
                        <span className="text-[9px] font-sans uppercase font-bold text-text-secondary block tracking-wider">Technical Toolkit</span>
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-sans text-text-dim">
                          {careerData?.skills.technical.map((s, i) => <span key={i} className="bg-text-primary px-1.5 py-0.5 rounded">&bull; {s}</span>)}
                          {careerData?.skills.tools.map((s, i) => <span key={i} className="bg-text-primary px-1.5 py-0.5 rounded">&bull; {s}</span>)}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Professional Chronology */}
                <div className="py-5 space-y-4 text-left">
                  <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-background">Professional Chronology</h2>
                  
                  <div className="space-y-6">
                    {careerData?.career_timeline.map((item, idx) => {
                      /* Dynamic tailoring highlight query sorting */
                      const getOptimizedHighlights = (company: string, highlights: string[]) => {
                        if (!highlights) return [];
                        const target = (resumeTarget === "Tailored" ? targetCompany : resumeTarget === "Standard" ? "" : resumeTarget).trim();
                        if (!target) return highlights;
                        // Generic: surface highlights that mention the target role/company
                        // or carry universal impact signals — no hardcoded brands.
                        const impactTerms = ["led", "launched", "grew", "award", "produced", "built", "managed", "increased", "directed", "shipped"];
                        const keyTerms = [target.toLowerCase(), ...target.toLowerCase().split(/\s+/), ...impactTerms];
                        return [...highlights].sort((a, b) => {
                          const aM = keyTerms.some(t => a.toLowerCase().includes(t));
                          const bM = keyTerms.some(t => b.toLowerCase().includes(t));
                          return aM === bM ? 0 : aM ? -1 : 1;
                        });
                      };

                      const highlights = getOptimizedHighlights(item.company, item.highlights);
                      
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-baseline">
                            <div className="text-xs font-serif font-bold text-black">
                              {item.company} &bull; <span className="font-semibold text-text-dim italic">{item.title}</span>
                              {item.division && <span className="text-[10px] font-sans font-medium text-text-secondary ml-1">({item.division})</span>}
                            </div>
                            <span className="text-[10px] font-sans text-text-muted font-semibold">
                              {item.start} — {item.end}
                            </span>
                          </div>
                          
                          <ul className="text-xs text-text-dim space-y-1 list-disc pl-4 font-serif leading-relaxed">
                            {highlights.map((hl, hIdx) => {
                              /* Bold matching terms based on active resume target */
                              const renderBoldHighlights = (text: string) => {
                                let formatted = text;
                                // Bold the target role/company when tailoring — no hardcoded brands.
                                const target = (resumeTarget === "Tailored" ? targetCompany : "").trim();
                                if (target) {
                                  const terms = target.split(/\s+/).filter(t => t.length > 2).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
                                  if (terms.length) {
                                    formatted = formatted.replace(new RegExp(`(${terms.join("|")})`, "gi"), '<strong class="font-bold text-black">$1</strong>');
                                  }
                                }
                                return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
                              };

                              return (
                                <li key={hIdx}>
                                  {renderBoldHighlights(hl)}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Dynamic CSS animations styles injected directly */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(115, 115, 115, 0.1);
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(52, 211, 153, 0.2);
        }

        /* ── PRINT-ONLY STYLING MATRICES ── */
        @media print {
          body, html, #__next, .h-screen, .flex-col, .flex-row {
            background: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          header, nav, aside, .shrink-0, form, button, select, .print-hide, .no-print, .border-r {
            display: none !important;
          }
          .scroll-area, .flex-1, main, .overflow-y-auto {
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-resume {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          li {
            color: #1a1a1a !important;
          }
        }
      `}</style>
    </div>
  );
}

