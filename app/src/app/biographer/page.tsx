"use client";

import { useState, useRef, useEffect } from "react";
import { 
  BookOpen, Send, Bot, User, Loader2, Sparkles, Database, Cpu, 
  Calendar, RefreshCw, Save, CheckCircle2, ChevronRight, ChevronDown, Clock, HelpCircle,
  Map, AlertCircle, MapPin, SlidersHorizontal, FolderOpen, Camera
} from "lucide-react";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Chapter {
  title: string;
  emoji: string;
  content: string;
  sources: string[];
  wordCount: number;
}

interface LifeEvent {
  id: string;
  title: string;
  type: string;
  description: string;
  date: string;
  location?: string;
  tags?: string[];
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
};

export default function BiographerPage() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<"rag" | "interview" | "memoirs">("rag");

  // Memoirs / Chronicles States
  const [journeysList, setJourneysList] = useState<any[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [essences, setEssences] = useState<Record<number, string>>({});
  const [manualProses, setManualProses] = useState<Record<number, string>>({});
  const [savingNarrative, setSavingNarrative] = useState<Record<number, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // API Stats & Metadata States
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalWords, setTotalWords] = useState<number>(0);
  const [totalAnswers, setTotalAnswers] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Accordion state
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // RAG Chat States
  const [ragMessages, setRagMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello. I'm connected to your local model. What would you like to ask about your data?" }
  ]);
  const [ragInput, setRagInput] = useState("");
  const [ragLoading, setRagLoading] = useState(false);

  // Interview States
  const [interviewMessages, setInterviewMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello. I am your sovereign biographer interviewer. Let's capture your history. Are you ready to begin our conversation?" }
  ]);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);

  // General Status
  const [status, setStatus] = useState<{ online: boolean; host: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);

  const endOfRagMessagesRef = useRef<HTMLDivElement>(null);
  const endOfInterviewMessagesRef = useRef<HTMLDivElement>(null);

  // Fetch biographer stats on load
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/biographer");
      const data = await res.json();
      setChapters(data.chapters || []);
      setTotalWords(data.totalWords || 0);
      setTotalAnswers(data.totalAnswers || 0);
      setLastUpdated(data.lastUpdated || null);
      setLifeEvents(data.lifeEvents || []);
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("Failed to load biography data:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch travel journeys list on load
  useEffect(() => {
    fetch("/api/media/chronicles")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setJourneysList(d.journeys || []);
        }
      })
      .catch(e => console.error("Failed to load journeys:", e));
  }, []);

  const handleJourneySelect = async (id: string) => {
    setSelectedJourneyId(id);
    setLoadingJourney(true);
    setJourneyDetails(null);
    
    try {
      const res = await fetch(`/api/media/chronicles?journeyId=${id}`);
      const data = await res.json();
      if (data.success) {
        setJourneyDetails(data.journey);
        
        // Initialize editing states
        const initialEssences: Record<number, string> = {};
        const initialManualProses: Record<number, string> = {};
        
        data.journey.itinerary.forEach((day: any) => {
          initialEssences[day.dayIndex] = day.narrative?.essence || "";
          initialManualProses[day.dayIndex] = day.narrative?.manual_prose || "";
        });
        
        setEssences(initialEssences);
        setManualProses(initialManualProses);
      }
    } catch (e) {
      console.error("Failed to load journey details:", e);
    } finally {
      setLoadingJourney(false);
    }
  };

  // Check Ollama status on load
  useEffect(() => {
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "ping" })
    }).then(res => res.json())
      .then(data => {
        if (data.online) {
          setStatus({ online: true, host: data.host });
        }
      })
      .catch(e => console.error(e));
  }, []);

  useEffect(() => {
    if (activeTab === "rag") {
      endOfRagMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      endOfInterviewMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ragMessages, interviewMessages, activeTab]);

  const handleSendRag = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ragInput.trim() || ragLoading) return;

    const query = ragInput;
    setRagInput("");
    
    const newMessages: Message[] = [...ragMessages, { role: "user", content: query }];
    setRagMessages(newMessages);
    setRagLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query,
          messages: ragMessages.filter(m => m.role !== "system").slice(-4)
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch response");
      }

      setStatus({ online: true, host: data.host });
      setRagMessages([...newMessages, { role: "assistant", content: data.text }]);
    } catch (err: any) {
      setRagMessages([...newMessages, { role: "assistant", content: `[SYSTEM ERROR]: ${err.message}` }]);
    } finally {
      setRagLoading(false);
    }
  };

  const handleSendInterview = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!interviewInput.trim() || interviewLoading) return;

    const query = interviewInput;
    setInterviewInput("");

    const newMessages: Message[] = [...interviewMessages, { role: "user", content: query }];
    setInterviewMessages(newMessages);
    setInterviewLoading(true);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newMessages
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch interview response");
      }

      setInterviewMessages([...newMessages, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      setInterviewMessages([...newMessages, { role: "assistant", content: `[SYSTEM ERROR]: ${err.message}` }]);
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (interviewMessages.length <= 1) return;
    if (!confirm("Are you ready to end this interview and save the transcript to your sovereign ledger?")) return;

    setSavingSession(true);
    setSaveStatus("Saving session...");

    // Compile transcript markdown
    const dateStr = new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    let transcript = `# Biographer Interview Session - ${dateStr}\n\n`;
    const qaPairs: { question: string; answer: string; timestamp: string }[] = [];

    for (let i = 0; i < interviewMessages.length; i++) {
      const msg = interviewMessages[i];
      if (msg.role === "assistant") {
        transcript += `*Biographer*: ${msg.content}\n\n`;
      } else {
        transcript += `**You**: ${msg.content}\n\n`;
        // Match with preceding assistant question
        const prev = interviewMessages[i - 1];
        if (prev && prev.role === "assistant") {
          qaPairs.push({
            question: prev.content,
            answer: msg.content,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    try {
      const res = await fetch("/api/biographer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Biographer Interview - ${dateStr}`,
          content: transcript,
          qaPairs
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save session");
      }

      setSaveStatus("Session saved!");
      setInterviewMessages([
        { role: "assistant", content: "Session successfully logged. Would you like to start a new biographer interview chapter?" }
      ]);
      await fetchStats();
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveStatus("Error saving session");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSavingSession(false);
    }
  };

  const renderJourneyScrapbook = () => {
    if (loadingJourney) {
      return (
        <div className="flex-1 flex flex-col justify-center items-center h-full text-[var(--color-text-dim)] font-mono text-[12px] uppercase gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
          Analyzing spatial travelogues...
        </div>
      );
    }

    if (!journeyDetails) {
      return (
        <div className="flex-1 flex flex-col justify-center items-center text-center p-12 text-[var(--color-text-dim)]">
          <AlertCircle size={48} className="text-text-dim mb-4 animate-pulse" />
          <h4 className="text-[14px] font-bold text-[var(--color-text-primary)]">Select a Spatial Chronicle</h4>
          <p className="text-[12px] mt-1 max-w-sm">
            Click on one of your travel journey stories in the left panel to relive the map trail and chapter stories.
          </p>
        </div>
      );
    }

    // Project coordinates onto a 2D plane for the beautiful SVG map trail
    const projectRouteCoords = () => {
      const coords = journeyDetails.polyline;
      if (!coords || coords.length === 0) return { pathData: "", projectedPoints: [] };

      // Find bounds
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      coords.forEach(([lat, lng]: [number, number]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });

      // Bounding box size (add padding)
      const latRange = maxLat - minLat || 0.1;
      const lngRange = maxLng - minLng || 0.1;
      
      const width = 360;
      const height = 360;
      const padding = 30;

      const projectedPoints = coords.map(([lat, lng]: [number, number], idx: number) => {
        // Simple linear interpolation to fit bounds
        const x = padding + ((lng - minLng) / lngRange) * (width - 2 * padding);
        // Invert Y axis for screen space
        const y = padding + (1 - (lat - minLat) / latRange) * (height - 2 * padding);
        
        // Find if this point belongs to an itinerary day
        let cityName = "";
        let dayIndex = 1;
        
        journeyDetails.itinerary.forEach((day: any) => {
          day.photos.forEach((p: any) => {
            if (p.lat === lat && p.lng === lng && p.city) {
              cityName = p.city;
              dayIndex = day.dayIndex;
            }
          });
        });

        return { x, y, lat, lng, cityName, dayIndex };
      });

      // Construct SVG line data path
      const pathData = projectedPoints.map((p: any, i: number) => 
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      ).join(" ");

      return { pathData, projectedPoints };
    };

    const { pathData, projectedPoints } = projectRouteCoords();

    const handleSaveDayReflections = async (dayIndex: number, triggerAI: boolean) => {
      setSavingNarrative(prev => ({ ...prev, [dayIndex]: true }));
      const day = journeyDetails.itinerary.find((d: any) => d.dayIndex === dayIndex);
      
      try {
        const res = await fetch("/api/media/chronicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journeyId: journeyDetails.id,
            dayIndex,
            essence: essences[dayIndex] || "",
            manual_prose: manualProses[dayIndex] || "",
            triggerAI,
            dateStr: day.date,
            cities: day.cities,
            people: day.people,
            vitals: day.vitals
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to save reflections");
        }

        // Update local journey details state with new narrative
        const updatedItinerary = journeyDetails.itinerary.map((d: any) => {
          if (d.dayIndex === dayIndex) {
            return {
              ...d,
              narrative: {
                essence: essences[dayIndex] || "",
                manual_prose: manualProses[dayIndex] || "",
                ai_narrative: triggerAI ? data.ai_narrative : d.narrative.ai_narrative
              }
            };
          }
          return d;
        });

        setJourneyDetails({
          ...journeyDetails,
          itinerary: updatedItinerary
        });

      } catch (e: any) {
        alert(e.message);
      } finally {
        setSavingNarrative(prev => ({ ...prev, [dayIndex]: false }));
      }
    };

    return (
      <div className="flex-1 flex overflow-hidden w-full h-full text-white bg-background screen-only-layout rounded-2xl border border-white/[0.04]">
        
        {/* Left Side: Map-First Spatial Navigation View */}
        <div className="w-[40%] shrink-0 border-r border-white/[0.04] p-6 flex flex-col gap-6 bg-background/80 scroll-mt-24 select-none print:hidden">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sovereign Relive Trail
            </span>
            <h3 className="text-[14px] font-bold tracking-tight text-white mt-1">Spatial Route Navigation</h3>
            <p className="text-[10px] text-text-muted mt-1">
              Locations act as the main navigation anchor. Click on any city to skip directly to its day logs.
            </p>
          </div>

          <div 
            className="flex-1 rounded-2xl border border-white/[0.05] relative flex items-center justify-center overflow-hidden aspect-square bg-background/60 backdrop-blur-sm shadow-inner"
            style={{ minHeight: "300px" }}
          >
            {projectedPoints.length > 0 ? (
              <svg className="w-full h-full max-w-[340px] max-h-[340px]" viewBox="0 0 400 400">
                <defs>
                  <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="200" cy="200" r="180" fill="url(#mapGlow)" />
                
                {pathData && (
                  <path 
                    d={pathData} 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="2.5" 
                    strokeDasharray="6,4"
                  />
                )}

                {projectedPoints.map((pt: any, idx: number) => {
                  const hasLabel = !!pt.cityName;
                  if (!hasLabel && idx !== 0 && idx !== projectedPoints.length - 1) return null;
                  
                  const labelName = pt.cityName || `Checkpoint ${idx + 1}`;
                  
                  return (
                    <g 
                      key={idx} 
                      className="cursor-pointer group"
                      onClick={() => {
                        document.getElementById(`journey-day-${pt.dayIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="12" 
                        fill="#10b981" 
                        fillOpacity="0.15" 
                        className="animate-ping" 
                      />
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="6" 
                        fill="#09090b" 
                        stroke="#10b981" 
                        strokeWidth="2" 
                        className="group-hover:scale-125 transition-transform duration-200"
                      />
                      <circle cx={pt.x} cy={pt.y} r="2.5" fill="#10b981" />
                      
                      <text 
                        x={pt.x} 
                        y={pt.y - 12} 
                        textAnchor="middle" 
                        fill="#e4e4e7" 
                        fontSize="9" 
                        fontWeight="bold"
                        className="opacity-60 group-hover:opacity-100 transition-opacity bg-black px-1 pointer-events-none drop-shadow"
                      >
                        {labelName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="text-[11px] text-text-dim italic">No GPS coordinates recorded for this trip.</div>
            )}
          </div>
        </div>

        {/* Right Side: Editorial Scrapbook Itinerary Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background/20" id="scrapbook-scroll-pane">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.04]">
            <div>
              <h2 className="text-[16px] font-bold tracking-tight text-white flex items-center gap-2">
                <Map size={16} className="text-emerald-400" />
                {journeyDetails.name}
              </h2>
              <p className="text-[11px] text-text-muted font-medium mt-1">
                {journeyDetails.startDate} to {journeyDetails.endDate} • {journeyDetails.photoCount} assets • with {journeyDetails.people.length > 0 ? journeyDetails.people.join(", ") : "myself"}
              </p>
            </div>
            
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-[10px] font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              Print Memoir Book
            </button>
          </div>

          {/* Day-by-Day scroll list */}
          <div className="space-y-10">
            {journeyDetails.itinerary.map((day: any) => {
              const charCount = (essences[day.dayIndex] || "").length;
              const isOverLimit = charCount > 30;

              return (
                <div 
                  key={day.dayIndex} 
                  id={`journey-day-${day.dayIndex}`}
                  className="p-5 rounded-xl border border-white/[0.04] bg-surface/10 hover:bg-surface/20 transition-all duration-300 space-y-4 scroll-mt-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-[12px] font-bold text-emerald-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Day {day.dayIndex} - {day.displayDate}
                      </h4>
                      {day.cities.length > 0 && (
                        <span className="text-[10px] text-text-muted block font-semibold mt-1">
                          📍 {day.cities.join(" • ")}
                        </span>
                      )}
                    </div>

                    {day.vitals.sleep_hours && (
                      <div className="flex items-center gap-3 px-2 py-0.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[9px]">
                        <span className="text-text-muted">🛌 {day.vitals.sleep_hours.toFixed(1)}h</span>
                        <span className="text-text-muted">💓 {day.vitals.resting_hr} bpm</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Capture the Essence (Max 30 characters)</label>
                      <span className={`text-[9px] font-mono font-bold ${isOverLimit ? "text-red-400" : charCount === 30 ? "text-orange-400" : "text-text-dim"}`}>
                        {charCount}/30
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="e.g. Sunset over rooftops"
                        maxLength={30}
                        value={essences[day.dayIndex] || ""}
                        onChange={(e) => setEssences(prev => ({ ...prev, [day.dayIndex]: e.target.value.substring(0, 30) }))}
                        className="flex-1 text-[12px] px-3.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/20 font-semibold"
                        style={{ 
                          background: "rgba(24, 24, 27, 0.6)", 
                          border: `1px solid ${isOverLimit ? "rgba(239, 68, 68, 0.4)" : "rgba(255,255,255,0.06)"}`,
                          color: "white"
                        }}
                      />
                      <button
                        disabled={savingNarrative[day.dayIndex] || isOverLimit}
                        onClick={() => handleSaveDayReflections(day.dayIndex, true)}
                        className="px-3 py-1 bg-surface-elevated hover:bg-surface-elevated border border-white/[0.04] text-[10px] font-bold text-text-secondary hover:text-white rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        {savingNarrative[day.dayIndex] ? "Weaving..." : "AI Storyteller"}
                      </button>
                    </div>
                  </div>

                  {day.photos.length > 0 && (
                    <div 
                      className="flex items-center gap-3 overflow-x-auto py-1 no-scrollbar shrink-0 select-none cursor-grab active:cursor-grabbing"
                      style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
                    >
                      {day.photos.map((record: any) => (
                        <div 
                          key={record.id} 
                          onClick={() => setLightboxImage(`/api/media/stream?id=${record.id}`)}
                          className="w-[100px] aspect-square rounded-lg overflow-hidden border border-white/[0.04] shrink-0 hover:scale-103 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer bg-background"
                        >
                          <img 
                            src={`/api/media/stream?id=${record.id}`} 
                            alt={record.filename} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {day.narrative?.ai_narrative && (
                    <div className="p-4 rounded-xl border border-emerald-500/5 bg-emerald-500/[0.01] space-y-2">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">memoir chapter prose</span>
                      <p className="text-[12px] font-serif leading-relaxed text-text-secondary first-letter:text-2xl first-letter:font-bold first-letter:text-emerald-400 first-letter:mr-2 first-letter:float-left">
                        {day.narrative.ai_narrative}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Personal Reflections (Takes precedence)</label>
                    <textarea 
                      placeholder="Write your deeper thoughts and observations here..."
                      value={manualProses[day.dayIndex] || ""}
                      onChange={(e) => setManualProses(prev => ({ ...prev, [day.dayIndex]: e.target.value }))}
                      rows={2}
                      className="w-full text-[12px] px-3.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/20 font-semibold resize-none"
                      style={{ 
                        background: "rgba(24, 24, 27, 0.6)", 
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "white"
                      }}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      disabled={savingNarrative[day.dayIndex]}
                      onClick={() => handleSaveDayReflections(day.dayIndex, false)}
                      className="px-3 py-1 bg-surface-elevated hover:bg-surface-elevated border border-white/[0.04] text-[9px] font-bold text-emerald-400 hover:text-emerald-300 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-40"
                    >
                      {savingNarrative[day.dayIndex] ? "Saving..." : "Commit Daily Logs"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .page-container, .screen-only-layout, header, nav, button, input, textarea, label, span[class*="count"], select {
              display: none !important;
            }
            #scrapbook-scroll-pane, #scrapbook-scroll-pane * {
              visibility: visible;
            }
            #scrapbook-scroll-pane {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
              color: black !important;
            }
            #scrapbook-scroll-pane h2, #scrapbook-scroll-pane h4, #scrapbook-scroll-pane p {
              color: black !important;
            }
            #scrapbook-scroll-pane div[class*="border"] {
              border-color: #ddd !important;
            }
            #scrapbook-scroll-pane div[class*="rounded"] {
              border: none !important;
              background: transparent !important;
              page-break-inside: avoid;
            }
            #scrapbook-scroll-pane p[class*="font-serif"] {
              color: #222 !important;
              font-size: 14pt !important;
              line-height: 1.6 !important;
            }
          }
        ` }} />
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-primary">
      
         {/* ═══ COLUMN 1: LEFT SIDEBAR (Stats, Chapters & Timeline) ═══ */}
         <div className="w-full md:w-96 border-r flex flex-col shrink-0 overflow-y-auto" style={{ borderColor: "var(--color-border)", background: "var(--color-sidebar-bg)" }}>
           {activeTab === "memoirs" ? (
             <>
               {/* Header Title */}
               <div className="p-6 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                     <Map size={20} />
                   </div>
                   <div>
                     <h1 className="text-base font-bold text-white">Travel Memoirs</h1>
                     <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Spatial Chronicles</p>
                   </div>
                 </div>
               </div>
 
               {/* Journeys List */}
               <div className="p-6 flex-1 min-h-[300px]">
                 <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold block mb-4">Seeded Journey Stories</span>
                 {journeysList.length === 0 ? (
                   <div className="text-xs text-text-muted italic text-center py-10">No travel logs found. Import photos to auto-cluster.</div>
                 ) : (
                   <div className="space-y-2">
                     {journeysList.map((j, i) => (
                       <button
                         key={i}
                         onClick={() => handleJourneySelect(j.id)}
                         className={`w-full flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                           selectedJourneyId === j.id
                             ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                             : "border-border bg-background/40 hover:bg-surface/30 text-text-secondary"
                         }`}
                       >
                         <span className="text-xs font-bold truncate">{j.name}</span>
                         <span className="text-[9px] font-mono text-text-muted mt-1">
                           {j.startDate} to {j.endDate} • {j.photoCount} assets
                         </span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
             </>
           ) : (
             <>
               {/* Header Title */}
               <div className="p-6 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-section-creative/10 text-section-creative">
                     <BookOpen size={20} />
                   </div>
                   <div>
                     <h1 className="text-base font-bold text-white">Biographer Hub</h1>
                     <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Sovereign Memoir Engine</p>
                   </div>
                 </div>
               </div>
 
               {/* Stats Grid Panel */}
               <div className="p-6 border-b space-y-4" style={{ borderColor: "var(--color-border)" }}>
                 <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold">Autobiographical Ledger</span>
                 
                 {statsLoading ? (
                   <div className="flex items-center justify-center py-4">
                     <Loader2 size={16} className="animate-spin text-section-creative" />
                   </div>
                 ) : (
                   <div className="grid grid-cols-2 gap-3">
                     <div className="p-3.5 rounded-xl border border-border bg-background/40">
                       <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Total Words</div>
                       <div className="text-base font-bold font-mono text-white mt-0.5">{totalWords.toLocaleString()}</div>
                     </div>
                     <div className="p-3.5 rounded-xl border border-border bg-background/40">
                       <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Answers Logged</div>
                       <div className="text-base font-bold font-mono text-white mt-0.5">{totalAnswers}</div>
                     </div>
                     <div className="p-3.5 rounded-xl border border-border bg-background/40 col-span-2">
                       <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Last Synced Record</div>
                       <div className="text-[11px] font-medium text-text-secondary mt-0.5 truncate">{formatDate(lastUpdated)}</div>
                     </div>
                   </div>
                 )}
               </div>
 
               {/* Chapters Accordion */}
               <div className="p-6 border-b flex-1 min-h-[300px]" style={{ borderColor: "var(--color-border)" }}>
                 <div className="flex justify-between items-center mb-4">
                   <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold">Life Story Chapters</span>
                   <span className="text-[9px] font-mono text-text-dim bg-background px-1.5 py-0.5 rounded border border-border">{chapters.length} chapters</span>
                 </div>
 
                 {statsLoading ? (
                   <div className="flex justify-center py-10">
                     <Loader2 size={16} className="animate-spin text-text-muted" />
                   </div>
                 ) : chapters.length === 0 ? (
                   <div className="text-xs text-text-muted italic text-center py-6">No chapters indexed. Start interviewing.</div>
                 ) : (
                   <div className="space-y-2">
                     {chapters.map((ch, idx) => {
                       const isExpanded = expandedChapter === ch.title;
                       return (
                         <div key={idx} className="rounded-xl border border-border overflow-hidden bg-background/20">
                           <button 
                             onClick={() => setExpandedChapter(isExpanded ? null : ch.title)}
                             className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface/30 transition-all text-left"
                           >
                             <div className="flex items-center gap-2 truncate">
                               <span className="text-xs">{ch.emoji}</span>
                               <span className="text-xs font-semibold text-text-secondary truncate">{ch.title}</span>
                             </div>
                             <div className="flex items-center gap-2 shrink-0">
                               <span className="text-[9px] font-mono text-text-muted">{ch.wordCount}w</span>
                               {isExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                             </div>
                           </button>
                           
                           {isExpanded && (
                             <div className="px-3.5 pb-3.5 pt-1 text-[11px] leading-relaxed text-text-secondary border-t border-border/40 space-y-2">
                               <p className="whitespace-pre-line">{ch.content}</p>
                               {ch.sources && ch.sources.length > 0 && (
                                 <div className="pt-2 mt-2 border-t border-border/20 text-[9px] font-mono text-text-dim flex flex-wrap gap-1">
                                   <span className="mr-1">Sources:</span>
                                   {ch.sources.map((s, si) => (
                                     <span key={si} className="bg-background px-1 rounded text-text-muted border border-border">{s}</span>
                                   ))}
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
 
               {/* Timeline Events Panel */}
               <div className="p-6">
                 <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted font-semibold block mb-4">Historical Milestones</span>
                 {statsLoading ? (
                   <div className="flex justify-center py-6">
                     <Loader2 size={14} className="animate-spin text-text-dim" />
                   </div>
                 ) : lifeEvents.length === 0 ? (
                   <p className="text-xs text-text-muted italic">No historical events recorded.</p>
                 ) : (
                   <div className="relative border-l border-border pl-4 ml-2 space-y-5">
                     {lifeEvents.map((ev, idx) => (
                       <div key={idx} className="relative group">
                         {/* Timeline dot */}
                         <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-section-creative bg-background transition-transform group-hover:scale-125" />
                         <div className="flex items-center justify-between gap-2">
                           <span className="text-[9px] font-mono text-text-muted bg-background px-1.5 py-0.5 border border-border rounded">
                             {new Date(ev.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                           </span>
                           <span className="text-[8px] font-mono uppercase text-section-creative font-semibold">{ev.type}</span>
                         </div>
                         <h4 className="text-[11px] font-bold text-text-secondary mt-1">{ev.title}</h4>
                         <p className="text-[10px] leading-relaxed text-text-muted mt-0.5">{ev.description}</p>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </>
           )}
         </div>

      {/* ═══ COLUMN 2: MAIN PANEL (Interactive Tabs, Chats & Submissions) ═══ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-background)" }}>
        
        {/* Navigation & Toolbar Header */}
        <div className="flex items-center justify-between p-6 shrink-0 border-b relative z-20" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border">
            <button
              onClick={() => {
                setActiveTab("rag");
                setSelectedJourneyId(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "rag" ? "bg-section-creative/10 border border-section-creative/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Database size={12} /> Ask Twin
            </button>
            <button
              onClick={() => {
                setActiveTab("interview");
                setSelectedJourneyId(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "interview" ? "bg-section-creative/10 border border-section-creative/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Sparkles size={12} /> Interviewer
            </button>
            <button
              onClick={() => setActiveTab("memoirs")}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "memoirs" ? "bg-emerald-500/10 border border-emerald-500/30 text-white" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <Map size={12} /> Memoirs
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Status cluster host badge */}
            {status?.host && (
              <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded bg-section-creative/5 border border-section-creative/10 text-text-secondary">
                <Cpu size={10} className="text-section-creative" /> {status.host.includes("localhost") || status.host.includes("127.") ? "LOCAL" : "REMOTE"}
              </span>
            )}

            {/* End session helper button for interview mode */}
            {activeTab === "interview" && interviewMessages.length > 1 && (
              <button
                onClick={handleEndSession}
                disabled={savingSession}
                className="px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider bg-section-creative hover:bg-section-creative text-black font-bold transition-all flex items-center gap-1.5"
              >
                {savingSession ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                End & Save Session
              </button>
            )}
            
            {saveStatus && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> {saveStatus}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable messages log pane / Memoirs View */}
        {activeTab === "memoirs" ? (
          <div className="flex-1 p-6 overflow-hidden">
            {renderJourneyScrapbook()}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ background: "#09090b" }}>
              {activeTab === "rag" ? (
                /* ── RAG Messages view ── */
                <>
                  {ragMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 max-w-3xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                        style={{ 
                          background: msg.role === "user" ? "var(--color-surface-elevated)" : "rgba(168,85,247,0.15)",
                          color: msg.role === "user" ? "var(--color-text-primary)" : "#a855f7",
                          border: "1px solid var(--color-border)"
                        }}
                      >
                        {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div 
                        className="px-5 py-4 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap"
                        style={{ 
                          background: msg.role === "user" ? "var(--color-surface-elevated)" : "transparent",
                          border: msg.role === "user" ? "1px solid var(--color-border)" : "none",
                          color: msg.role === "user" ? "var(--color-text-primary)" : "var(--color-text-primary)",
                        }}
                      >
                        {msg.role === "assistant" && msg.content.includes("[SYSTEM ERROR]") ? (
                          <span className="text-red-500 font-mono text-xs">{msg.content}</span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {ragLoading && (
                    <div className="flex gap-4 max-w-3xl animate-pulse">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                         <Loader2 size={14} className="animate-spin" />
                       </div>
                       <div className="px-5 py-4 text-[11px] font-mono uppercase tracking-wider text-text-muted">
                         Querying Sovereign Ledger...
                       </div>
                    </div>
                  )}
                  <div ref={endOfRagMessagesRef} />
                </>
              ) : (
                /* ── Interactive Interview messages view ── */
                <>
                  {interviewMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 max-w-3xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                        style={{ 
                          background: msg.role === "user" ? "var(--color-surface-elevated)" : "rgba(168,85,247,0.15)",
                          color: msg.role === "user" ? "var(--color-text-primary)" : "#a855f7",
                          border: "1px solid var(--color-border)"
                        }}
                      >
                        {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div 
                        className="px-5 py-4 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap"
                        style={{ 
                          background: msg.role === "user" ? "var(--color-surface-elevated)" : "transparent",
                          border: msg.role === "user" ? "1px solid var(--color-border)" : "none",
                          color: msg.role === "user" ? "var(--color-text-primary)" : "var(--color-text-primary)",
                        }}
                      >
                        {msg.role === "assistant" && msg.content.includes("[SYSTEM ERROR]") ? (
                          <span className="text-red-500 font-mono text-xs">{msg.content}</span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {interviewLoading && (
                    <div className="flex gap-4 max-w-3xl animate-pulse">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                         <Loader2 size={14} className="animate-spin" />
                       </div>
                       <div className="px-5 py-4 text-[11px] font-mono uppercase tracking-wider text-text-muted">
                         Biographer formulating response...
                       </div>
                    </div>
                  )}
                  <div ref={endOfInterviewMessagesRef} />
                </>
              )}
            </div>
 
            {/* Input Bar Form */}
            <div className="p-6 shrink-0 bg-gradient-to-t from-[var(--color-background)] to-transparent">
              <form 
                onSubmit={activeTab === "rag" ? handleSendRag : handleSendInterview}
                className="max-w-3xl mx-auto relative flex items-center bg-[var(--color-surface)] border rounded-2xl shadow-xl overflow-hidden transition-all focus-within:ring-2 ring-section-creative/30"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="pl-4 pr-2 text-text-muted">
                  <Sparkles size={18} />
                </div>
                <input
                  value={activeTab === "rag" ? ragInput : interviewInput}
                  onChange={e => activeTab === "rag" ? setRagInput(e.target.value) : setInterviewInput(e.target.value)}
                  disabled={activeTab === "rag" ? ragLoading : interviewLoading}
                  placeholder={
                    activeTab === "rag" 
                      ? "Ask Twin about history, events, or biography facts..." 
                      : "Type your thoughts to proceed with the interview..."
                  }
                  className="flex-1 py-4 px-2 bg-transparent outline-none text-[14px]"
                  style={{ color: "var(--color-text-primary)" }}
                />
                <button 
                  type="submit"
                  disabled={
                    activeTab === "rag" 
                      ? (!ragInput.trim() || ragLoading) 
                      : (!interviewInput.trim() || interviewLoading)
                  }
                  className="w-10 h-10 mr-2 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 bg-section-creative text-black"
                >
                  <Send size={16} />
                </button>
              </form>
              <div className="max-w-3xl mx-auto mt-3 flex justify-between px-2">
                <p className="text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 text-text-muted">
                  <Database size={10} /> {activeTab === "rag" ? "LLaMA 3.2 Context Retrieval RAG" : "Active Conversational Interview Mode"}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  Press Enter to Send
                </p>
              </div>
            </div>
          </>
        )}

      {/* Dynamic Image Overlay Modal */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[85vh] p-4 flex items-center justify-center">
            <img 
              src={lightboxImage} 
              alt="High resolution memory" 
              className="max-w-full max-h-full object-contain rounded-xl border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      )}
 
      </div>
    </div>
  );
}
