"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Check, 
  Activity, 
  Brain, 
  Cpu, 
  Terminal, 
  Users, 
  Heart, 
  User, 
  Sparkles, 
  Calendar,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight
} from "lucide-react";

interface FaceCluster {
  id: number;
  clusterLabel: string;
  representativePhoto: string;
  photoCount: number;
  personId: number | null;
  name: string;
  relationship: string;
}

interface InsightsData {
  quietestWeek: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    eventCount: number;
    avgSleep: number;
    avgRestingHR: number;
    avgHRV: number;
  };
  bestSleepMonth: {
    monthName: string;
    avgSleepHours: number;
    avgRestingHR: number;
    quietWeekAvgSleep: number;
    quietWeekAvgRestingHR: number;
    busyWeekAvgSleep: number;
    busyWeekAvgRestingHR: number;
    correlationDescription: string;
  };
  fivePeople: FaceCluster[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  
  /* Editing states for face clusters */
  const [clusterNames, setClusterNames] = useState<Record<string, string>>({});
  const [clusterRelationships, setClusterRelationships] = useState<Record<string, string>>({});
  const [savingClusters, setSavingClusters] = useState(false);

  /* Biographer generation states */
  const [generatingBio, setGeneratingBio] = useState(false);
  const [bioStep, setBioStep] = useState(0);
  const [generatedBio, setGeneratedBio] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const bioSteps = [
    "Opening sovereign data ledger (sqlite)...",
    "Analysing smart ring sleep biometric arrays...",
    "Cross referencing calendar meetings density...",
    "Correlating face cluster social matrix...",
    "Formulating serif pre writing biographer prompt...",
    "Invoking local LLM (Ollama) to synthesise life prose..."
  ];

  useEffect(() => {
    document.title = "Onboarding | Rudder";
    fetchInsights();
  }, []);

  async function fetchInsights() {
    try {
      setLoadingInsights(true);
      const res = await fetch("/api/celf-insights");
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
        
        /* Initialize editing states from database values */
        const names: Record<string, string> = {};
        const rels: Record<string, string> = {};
        data.fivePeople.forEach((p: FaceCluster) => {
          names[p.clusterLabel] = p.name === "Unrecognized Face" ? "" : p.name;
          rels[p.clusterLabel] = p.relationship || "unsorted";
        });
        setClusterNames(names);
        setClusterRelationships(rels);
      }
    } catch (err: any) {
      console.error("Failed to fetch insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  }

  async function saveFaceLinks() {
    if (!insights) return;
    setSavingClusters(true);
    try {
      /* Loop through face clusters and save named ones to the database */
      for (const p of insights.fivePeople) {
        const name = clusterNames[p.clusterLabel]?.trim();
        const relationship = clusterRelationships[p.clusterLabel] || "unsorted";
        if (name) {
          await fetch("/api/celf-insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clusterLabel: p.clusterLabel,
              name,
              relationship
            })
          });
        }
      }
      /* Refresh insights to sync names */
      await fetchInsights();
      setStep(3);
    } catch (err: any) {
      console.error("Failed to save face links:", err);
    } finally {
      setSavingClusters(false);
    }
  }

  async function triggerBiographer() {
    setGeneratingBio(true);
    setBioStep(0);
    setErrorMsg("");

    /* Interval to simulate loading steps */
    const interval = setInterval(() => {
      setBioStep((prev) => {
        if (prev < bioSteps.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 2800);

    try {
      const res = await fetch("/api/celf-biographer", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      clearInterval(interval);
      if (res.ok) {
        const data = await res.json();
        setGeneratedBio(data.paragraph);
        setStep(4);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Generation failed.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setGeneratingBio(false);
    }
  }

  async function finishOnboarding() {
    try {
      /* Mark onboarding as completed in user preferences */
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_completed: 1,
          theme: "dark"
        })
      });
      router.push("/");
    } catch (err) {
      console.error(err);
      router.push("/");
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-text-primary overflow-x-hidden flex flex-col justify-between selection:bg-accent/25 selection:text-white">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(59,130,246,0.03),transparent_60%)] pointer-events-none z-0" />
      
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-lg">
            🧭
          </div>
          <span className="font-semibold text-xs tracking-wider text-text-secondary uppercase font-mono">
            Rudder // Celf OS
          </span>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? "w-8 bg-accent shadow-[0_0_10px_rgba(52,211,153,0.4)]" : "w-1.5 bg-surface-elevated"}`}
            />
          ))}
        </div>

        <div className="text-[10px] font-mono text-accent/60 uppercase">
          Local Sandbox Sync
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center max-w-5xl w-full mx-auto px-6 py-6">
        
        {/* STEP 1: WELCOME & SOVEREIGN OATH */}
        {step === 1 && (
          <div className="max-w-xl w-full space-y-8 animate-fade-in">
            <div className="text-center space-y-3">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest bg-accent/5 border border-accent/10 px-3 py-1 rounded-full">
                Sovereign Welcome
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                Tell us your name
              </h1>
              <p className="text-sm text-text-secondary max-w-sm mx-auto">
                Rudder runs completely on-device, organizing your biological ledger and social graph privately.
              </p>
            </div>

            <div className="bg-surface/30 border border-border/60 rounded-2xl p-6 backdrop-blur-md space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-text-secondary uppercase tracking-wider block">
                  Display Name
                </label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent/50 transition-all font-mono"
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-border/40">
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider block">
                  The Sovereignty Promises
                </span>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-accent">
                      <Lock size={10} />
                    </div>
                    <div className="text-xs leading-relaxed text-text-secondary">
                      <strong className="text-white block font-medium">100% On-Device Compute</strong>
                      Your physiological sleep telemetry, social networks, and journals never upload to external servers.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-accent">
                      <Cpu size={10} />
                    </div>
                    <div className="text-xs leading-relaxed text-text-secondary">
                      <strong className="text-white block font-medium">Local AI Synthesis</strong>
                      Reflective text and narrative pre-writings are composed by your local Ollama node cluster.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <button 
                onClick={() => setStep(2)}
                disabled={!displayName.trim()}
                className="px-8 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2 mx-auto"
                style={{ backgroundColor: "rgb(52, 211, 153)", color: "#070709" }}
              >
                Proceed to Social Clustering <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PHOTOS WOW (FACE CLUSTERING naming loop) */}
        {step === 2 && (
          <div className="w-full max-w-4xl space-y-8 animate-fade-in">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest bg-accent/5 border border-accent/10 px-3 py-1 rounded-full">
                Wow 01 // Social Clustering
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">Your Social Inner Circle</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Our local facial scanner analysed your robust photo archive. We clustered these 5 recurring individuals: name them to link your contact registry.
              </p>
            </div>

            {loadingInsights ? (
              <div className="text-center py-12 space-y-3 font-mono text-xs text-text-muted">
                <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
                <span>Reading media indices...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {insights?.fivePeople.map((p, idx) => {
                  const initials = p.clusterLabel.replace("cluster_", "C");
                  const hasDBName = p.name !== "Unrecognized Face" && p.name !== "";
                  
                  return (
                    <div 
                      key={p.clusterLabel}
                      className="bg-surface/30 border border-border/60 rounded-2xl p-5 flex flex-col items-center text-center space-y-4 backdrop-blur-md group hover:border-accent/25 transition-all duration-300"
                    >
                      {/* Avatar container */}
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-surface via-surface-elevated to-surface-hover border border-border-hover/80 flex items-center justify-center text-lg font-bold text-white shadow-inner font-mono relative overflow-hidden">
                          {initials}
                          <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent pointer-events-none" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 bg-accent/10 text-accent border border-accent/25 text-[8px] font-mono px-1.5 py-0.5 rounded-full">
                          {p.photoCount}px
                        </span>
                      </div>

                      {/* Name input / display */}
                      <div className="w-full space-y-2">
                        {hasDBName ? (
                          <div className="text-xs font-semibold text-white font-mono truncate px-2">
                            {p.name}
                          </div>
                        ) : (
                          <input 
                            type="text"
                            value={clusterNames[p.clusterLabel] || ""}
                            onChange={(e) => setClusterNames({
                              ...clusterNames,
                              [p.clusterLabel]: e.target.value
                            })}
                            placeholder="Identify..."
                            className="w-full bg-background/80 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-white text-center focus:outline-none focus:border-accent/50 transition-all font-mono placeholder:text-text-dim"
                          />
                        )}

                        {/* Relationship Chip selector */}
                        <div className="flex flex-wrap gap-1 justify-center">
                          {["friend", "colleague", "family"].map((r) => {
                            const activeRel = clusterRelationships[p.clusterLabel] || "unsorted";
                            const isSelected = activeRel === r;
                            
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setClusterRelationships({
                                  ...clusterRelationships,
                                  [p.clusterLabel]: isSelected ? "unsorted" : r
                                })}
                                className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded transition-all ${isSelected ? "bg-accent/10 text-accent border border-accent/30" : "bg-transparent text-text-dim border border-border/80 hover:text-text-secondary"}`}
                              >
                                {r.slice(0, 4)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-border/60 max-w-xl mx-auto">
              <button 
                onClick={() => setStep(1)}
                className="text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Back
              </button>
              <button 
                onClick={saveFaceLinks}
                disabled={savingClusters}
                className="px-8 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                style={{ backgroundColor: "rgb(52, 211, 153)", color: "#070709" }}
              >
                {savingClusters ? "Linking..." : "Confirm & Continue"} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CALENDAR & HEALTH WOWS */}
        {step === 3 && (
          <div className="w-full max-w-4xl space-y-8 animate-fade-in">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest bg-accent/5 border border-accent/10 px-3 py-1 rounded-full">
                Wow 02 // Physiological Correlation
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">The Biology of Open Time</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                By pairing your Colmi Smart Ring metrics (via HealthKit) with your work calendar, Rudder uncovered a stark biological convergence.
              </p>
            </div>

            {insights && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                {/* Calendar Density Display */}
                <div className="md:col-span-5 bg-surface/20 border border-border/60 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-amber-400" />
                      <span className="text-[10px] font-mono text-amber-300 uppercase tracking-wider">
                        Calendar Density
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-text-secondary text-xs font-mono">Week 16 (April 13 - 19)</div>
                      <div className="text-3xl font-bold text-white tracking-tight">
                        {insights.quietestWeek.eventCount} Meetings
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        Your absolute quietest calendar week this spring. Open time expanded by 88% compared to busy launch weeks.
                      </p>
                    </div>
                  </div>

                  {/* Glass Visual meter */}
                  <div className="space-y-2 pt-6 border-t border-border/40 mt-4">
                    <div className="flex justify-between text-[9px] font-mono text-text-muted">
                      <span>QUIET WEEK</span>
                      <span>{insights.quietestWeek.eventCount} MEETINGS</span>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: "10%" }} />
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-text-muted pt-1">
                      <span>BUSY LAUNCH WEEKS</span>
                      <span>14 MEETINGS AVG</span>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-surface-elevated rounded-full" style={{ width: "90%" }} />
                    </div>
                  </div>
                </div>

                {/* Smart Ring Correlation Indicators */}
                <div className="md:col-span-7 bg-surface/20 border border-border/60 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-accent/5 to-transparent blur-3xl pointer-events-none" />
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <Activity size={15} className="text-accent" />
                      <span className="text-[10px] font-mono text-accent uppercase tracking-wider">
                        Colmi Ring Sleep Vitals
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white">How Your Sleep Attuned</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      With the friction of meetings lifted, your body transitioned into a state of active recovery:
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-background/40 rounded-xl border border-border/40 text-left">
                        <span className="text-[9px] font-mono text-text-muted block uppercase">Sleep Duration</span>
                        <span className="text-base font-bold text-white block mt-0.5">{insights.quietestWeek.avgSleep} hrs</span>
                        <span className="text-[8px] font-mono text-accent font-semibold block mt-0.5">+{parseFloat((insights.quietestWeek.avgSleep - insights.bestSleepMonth.busyWeekAvgSleep).toFixed(1))} hrs</span>
                      </div>

                      <div className="p-3 bg-background/40 rounded-xl border border-border/40 text-left">
                        <span className="text-[9px] font-mono text-text-muted block uppercase">Resting HR</span>
                        <span className="text-base font-bold text-white block mt-0.5">{insights.quietestWeek.avgRestingHR} bpm</span>
                        <span className="text-[8px] font-mono text-accent font-semibold block mt-0.5">-{parseFloat((insights.bestSleepMonth.busyWeekAvgRestingHR - insights.quietestWeek.avgRestingHR).toFixed(1))} bpm</span>
                      </div>

                      <div className="p-3 bg-background/40 rounded-xl border border-border/40 text-left">
                        <span className="text-[9px] font-mono text-text-muted block uppercase">HRV Average</span>
                        <span className="text-base font-bold text-white block mt-0.5">{insights.quietestWeek.avgHRV} ms</span>
                        <span className="text-[8px] font-mono text-accent font-semibold block mt-0.5">high vitality</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-accent/10 bg-accent/5 mt-6 text-left relative z-10 flex items-start gap-3">
                    <Heart size={14} className="text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary leading-relaxed font-mono">
                      {insights.bestSleepMonth.correlationDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-border/60 max-w-xl mx-auto">
              <button 
                onClick={() => setStep(2)}
                className="text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Back
              </button>
              <button 
                onClick={triggerBiographer}
                disabled={generatingBio}
                className="px-8 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                style={{ backgroundColor: "rgb(52, 211, 153)", color: "#070709" }}
              >
                {generatingBio ? "Composing..." : "Begin AI Pre-Writing"} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: THE ULTIMATE WOW (BIOGRAPHER PRE-WRITING OR LOADING SCREEN) */}
        {step === 4 && (
          <div className="max-w-2xl w-full space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest bg-accent/5 border border-accent/10 px-3 py-1 rounded-full">
                Ultimate Wow // The Biographer
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">Story of My Life</h2>
              <p className="text-xs text-text-secondary leading-relaxed max-w-sm mx-auto">
                Local Ollama model synthesised these observations into elegant, reflective biographer prose.
              </p>
            </div>

            {generatedBio ? (
              <div className="space-y-6">
                {/* The Paper-like Serif Biographer Card */}
                <div className="bg-background border border-border/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative">
                  <div className="absolute top-4 left-6 flex items-center gap-1.5 text-text-dim text-[10px] font-mono">
                    <FileText size={12} />
                    <span>PRE-WRITING SYNTHESIS (CHAPTER 1)</span>
                  </div>

                  <div className="absolute top-4 right-6 flex items-center gap-1 bg-accent/10 text-accent border border-accent/25 px-2 py-0.5 rounded text-[8px] font-mono uppercase">
                    <Check size={9} strokeWidth={3} /> Saved to journal_entries
                  </div>

                  {/* Prose Container in beautiful Serif formatting */}
                  <div className="pt-6 font-serif text-lg md:text-xl leading-relaxed text-text-primary antialiased italic border-l-2 border-accent pl-6 my-2">
                    {generatedBio}
                  </div>
                </div>

                <div className="text-center pt-2">
                  <button 
                    onClick={finishOnboarding}
                    className="px-10 py-4 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-accent/10 flex items-center gap-2 mx-auto"
                    style={{ backgroundColor: "rgb(52, 211, 153)", color: "#070709" }}
                  >
                    Enter Your Dashboard <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* LOADING SCREEN DURING GENERATION */}
        {generatingBio && (
          <div className="max-w-md w-full space-y-6 animate-fade-in text-center py-12">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full border-2 border-accent/10 border-t-accent animate-spin mx-auto flex items-center justify-center text-lg">
                💫
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Synthesising Biography Prose</h2>
              <p className="text-xs text-text-secondary">Please wait while your local Ollama node cluster processes the ledger...</p>
            </div>

            {/* Matrix logs terminal simulator */}
            <div className="dot-matrix rounded-xl p-5 font-mono text-[10px] leading-relaxed shadow-2xl relative text-left min-h-[160px] bg-background/80 border border-border">
              <div className="absolute top-3 right-4 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-accent/20" />
                <span className="w-2 h-2 rounded-full bg-accent/40" />
                <span className="w-2 h-2 rounded-full bg-accent/60 animate-ping" />
              </div>
              
              <div className="space-y-1.5 glow-text-accent">
                {bioSteps.slice(0, bioStep + 1).map((stepTxt, idx) => (
                  <div key={idx} className="text-accent/80 flex items-center gap-2">
                    <span className="text-accent">{idx === bioStep ? "▹" : "✓"}</span>
                    {stepTxt}
                  </div>
                ))}
                {bioStep < bioSteps.length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-accent ml-1 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {errorMsg && (
          <div className="max-w-md w-full space-y-6 animate-fade-in text-center py-12">
            <div className="bg-red-500/5 border border-red-500/15 p-6 rounded-2xl space-y-4">
              <AlertCircle className="text-red-400 mx-auto" size={32} />
              <h3 className="text-sm font-semibold text-white">Pre Writing Generation Failed</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {errorMsg}
              </p>
              <button 
                onClick={triggerBiographer}
                className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
              >
                Retry Local LLM call
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-[9px] font-mono text-text-dim border-t border-border/40">
        <span>© 2026 Sovereign Exo Cluster. All credentials on-device.</span>
        <span>Version 1.0.0 V2 Roadmap</span>
      </footer>
    </div>
  );
}
