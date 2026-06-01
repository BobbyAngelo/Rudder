"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Badge } from "@/components/ui";
import {
  Heart, Footprints, Flame, Moon, Loader2, Plus, Phone, MapPin, Globe,
  Stethoscope, Calendar, FileText, Pill, Activity, Smartphone,
  ChevronRight, Search, Pencil, Trash2, Save, X, ExternalLink, Copy, Check,
  Zap, AlertCircle, Thermometer, Scale, Sparkles
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Health Module — Sovereign Wellness Workspace
   ═══════════════════════════════════════════════════════ */

type Section = "dashboard" | "doctors" | "medicines" | "appointments" | "results" | "devices";

interface DashboardData {
  totalRecords: number;
  dateRange: { first: string; last: string };
  latestStats: {
    steps?: number;
    distance?: string;
    activeEnergy?: number;
    flights?: number;
    heartRate?: number | null;
    date?: string;
  };
  weekSteps: { date: string; steps: number }[];
  monthSteps: { date: string; steps: number }[];
  recentSleep: { date: string; hours: number }[];
  typeBreakdown: { type: string; count: number }[];
  providers: Provider[];
  documents: HealthDocument[];
  sources?: any[];
  dataSources?: any[];
  latestMetrics?: any;
}

interface Provider {
  id: number;
  name: string;
  specialty: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  portal_url: string | null;
  notes: string;
  next_appointment: string | null;
  last_visit: string | null;
}

interface HealthDocument {
  id: number;
  title: string;
  provider: string;
  category: string;
  file_path: string;
  document_date: string | null;
  notes: string;
}

const SECTIONS: { key: Section; label: string; icon: React.ElementType; color: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: Activity, color: "text-emerald-400" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, color: "text-blue-400" },
  { key: "medicines", label: "Medicines", icon: Pill, color: "text-purple-400" },
  { key: "appointments", label: "Appointments", icon: Calendar, color: "text-amber-400" },
  { key: "results", label: "Test Results", icon: FileText, color: "text-teal-400" },
  { key: "devices", label: "Devices", icon: Smartphone, color: "text-sky-400" },
];

export default function HealthPage() {
  const [section, setSection] = useState<Section>("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Selection States
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Form States
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const [isLoggingVitals, setIsLoggingVitals] = useState(false);
  const [vitalsDraft, setVitalsDraft] = useState<any>({
    date: new Date().toISOString().split("T")[0],
    steps: "",
    sleep_hours: "",
    resting_hr: "",
    hrv: "",
    blood_pressure_systolic: "",
    blood_pressure_diastolic: "",
    blood_glucose: "",
    temperature: "",
    weight: "",
    mood: 5,
    energy: 5,
    notes: "",
  });
  
  // Search & Filter
  const [search, setSearch] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // SEO Hook
  useEffect(() => {
    document.title = "Sovereign Wellness | Rudder";
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/health?action=dashboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load health dashboard:", err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().catch(console.error).finally(() => setLoading(false));
  }, [refresh]);

  // Handle Copy Actions
  const handleCopy = (val: string, field: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenVitalsLog = () => {
    const today = new Date().toISOString().split("T")[0];
    const latest = data?.latestMetrics || {};
    setVitalsDraft({
      date: today,
      steps: latest.steps !== null && latest.steps !== undefined ? latest.steps : "",
      sleep_hours: latest.sleep_hours !== null && latest.sleep_hours !== undefined ? latest.sleep_hours : "",
      resting_hr: latest.resting_hr !== null && latest.resting_hr !== undefined ? latest.resting_hr : "",
      hrv: latest.hrv !== null && latest.hrv !== undefined ? latest.hrv : "",
      blood_pressure_systolic: latest.blood_pressure_systolic !== null && latest.blood_pressure_systolic !== undefined ? latest.blood_pressure_systolic : "",
      blood_pressure_diastolic: latest.blood_pressure_diastolic !== null && latest.blood_pressure_diastolic !== undefined ? latest.blood_pressure_diastolic : "",
      blood_glucose: latest.blood_glucose !== null && latest.blood_glucose !== undefined ? latest.blood_glucose : "",
      temperature: latest.temperature !== null && latest.temperature !== undefined ? latest.temperature : "",
      weight: latest.weight !== null && latest.weight !== undefined ? latest.weight : "",
      mood: latest.mood !== null && latest.mood !== undefined ? latest.mood : 5,
      energy: latest.energy !== null && latest.energy !== undefined ? latest.energy : 5,
      notes: latest.notes || "",
    });
    setIsLoggingVitals(true);
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/health?action=metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vitalsDraft),
      });
      const resData = await res.json();
      if (resData.error) {
        console.error("Error saving vitals:", resData.error);
      } else {
        setIsLoggingVitals(false);
        refresh();
      }
    } catch (err) {
      console.error("Failed to save vitals:", err);
    } finally {
      setSaving(false);
    }
  };

  // CRUD Operations — Doctors/Providers
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/health?action=provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const resData = await res.json();
      await refresh();
      setIsAdding(false);
      setEditing(false);
      
      // Update selected item state
      if (draft.id) {
        setSelectedItem(draft);
      } else if (resData.id) {
        const matching = (data?.providers || []).find(p => p.id === resData.id) || draft;
        setSelectedItem({ ...matching, id: resData.id });
      }
    } catch (err) {
      console.error("Failed to save provider:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!confirm("Are you sure you want to delete this physician? All consulting logs for this provider will be archived.")) return;
    try {
      await fetch(`/api/health?action=provider&id=${id}`, { method: "DELETE" });
      setSelectedItem(null);
      await refresh();
    } catch (err) {
      console.error("Failed to delete provider:", err);
    }
  };

  // CRUD Operations — Health Documents (Meds, Labs, Appts)
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/health?action=document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const resData = await res.json();
      await refresh();
      setIsAdding(false);
      setEditing(false);
      
      if (draft.id) {
        setSelectedItem(draft);
      } else if (resData.id) {
        const matching = (data?.documents || []).find(d => d.id === resData.id) || draft;
        setSelectedItem({ ...matching, id: resData.id });
      }
    } catch (err) {
      console.error("Failed to save document:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await fetch(`/api/health?action=document&id=${id}`, { method: "DELETE" });
      setSelectedItem(null);
      await refresh();
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
          <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Initializing Vitals...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if ("error" in data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 text-center">
        <div className="max-w-md bg-surface/30 border border-red-950/40 rounded-2xl p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-red-400">Database Connection Error</h2>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">{(data as any).error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-background rounded-xl text-xs font-semibold font-mono uppercase tracking-wider transition-all"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  // Get items for current section
  const getItems = (): { id: string | number; title: string; subtitle: string; badge?: string; badgeVariant?: any; raw: any }[] => {
    const providers = data?.providers || [];
    const documents = data?.documents || [];
    const totalRecords = data?.totalRecords || 0;

    switch (section) {
      case "doctors":
        return providers.map(p => ({
          id: p.id, title: p.name, subtitle: p.specialty || "General Care",
          badge: p.last_visit ? `Visited: ${p.last_visit}` : undefined, raw: p,
        }));
      case "medicines":
        return documents.filter(d => d.category === "medication" || d.category === "immunization").map(d => ({
          id: d.id, title: d.title, subtitle: d.provider,
          badge: d.category === "immunization" ? "Immunity" : "Rx Rx",
          badgeVariant: d.category === "immunization" ? "info" : "neutral", raw: d,
        }));
      case "appointments":
        return documents.filter(d => ["appointment", "discharge", "procedure"].includes(d.category)).map(d => ({
          id: d.id, title: d.title, subtitle: d.provider,
          badge: d.category, badgeVariant: d.category === "procedure" ? "warning" : "neutral", raw: d,
        }));
      case "results":
        return documents.filter(d => ["lab_result", "imaging", "pathology", "patient_record"].includes(d.category)).map(d => ({
          id: d.id, title: d.title, subtitle: d.provider,
          badge: d.category.replace(/_/g, " "), badgeVariant: catVariant(d.category), raw: d,
        }));
      case "devices":
        const dbSources = data?.sources || [];
        const configSources = data?.dataSources || [];
        const deviceList: any[] = [];

        // Add database-configured data sources first
        configSources.forEach((src: any) => {
          deviceList.push({
            id: `config_${src.id}`,
            title: src.name,
            subtitle: src.path,
            badge: src.status === "active" ? "Active" : "Disconnected",
            badgeVariant: src.status === "active" ? "success" : "neutral",
            raw: {
              type: "data_source",
              name: src.name,
              icon: src.type === "healthkit_export" ? "📦" : "📁",
              status: src.status === "active" ? "Active" : "Disconnected",
              lastSync: src.last_scanned ? `Scanned: ${src.last_scanned}` : "Never scanned",
              syncMethod: `Local ingestion path (${src.type})`,
              dataTypes: src.type === "healthkit_export" ? ["Apple HealthKit Ingest XML"] : ["JSON / CSV Exports"],
              notes: `Path on disk: ${src.path}`,
              integration: `Configured as integration type: '${src.type}'. Created: ${src.created_at}.`
            }
          });
        });

        // Add dynamic active record sources
        dbSources.forEach((src: any) => {
          const sName = src.source;
          let title = sName;
          let icon = "📡";
          let subtitle = "Active Database Source";
          let badgeVariant = "success";
          let dataTypes = ["Biometric Records"];
          
          if (sName.toLowerCase().includes("iphone")) {
            title = "iPhone Health";
            icon = "📱";
            subtitle = "Primary Apple HealthKit Aggregator";
            dataTypes = ["Steps", "Heart Rate", "Sleep Analysis", "Active Energy", "Distance", "Flights Climbed", "HRV", "Resting HR", "Oxygen Saturation"];
          } else if (sName === "Zepp") {
            title = "Amazfit Band (Zepp)";
            icon = "⚡";
            subtitle = "Zepp wearable tracker";
            dataTypes = ["Vitals Tracker", "Stress Index", "Sleep Metrics", "PAI Score"];
          } else if (sName === "QRing") {
            title = "Colmi R02 Ring (QRing)";
            icon = "💍";
            subtitle = "Sovereign wearable tracker";
            dataTypes = ["Heart Rate", "SpO2 Sleep Tracker", "Step Counter", "Skin Temperature", "HRV Pulse"];
          } else if (sName === "Clock") {
            title = "System Clock / Sleep";
            icon = "⏰";
            subtitle = "Clock app sleeping states";
          }
          
          deviceList.push({
            id: `source_${sName}`,
            title,
            subtitle,
            badge: `${src.count.toLocaleString()} records`,
            badgeVariant,
            raw: {
              type: "device",
              name: title,
              icon,
              status: "Active",
              lastSync: `${src.count.toLocaleString()} records (${src.first_sync} to ${src.last_sync})`,
              syncMethod: "Imported telemetry log",
              dataTypes,
              notes: `Registered name: "${sName}". Row count: ${src.count.toLocaleString()}.`,
              integration: "Continuous tracking synced via Apple Health XML export."
            }
          });
        });

        // If no sources are present, show a placeholder warning card
        if (deviceList.length === 0) {
          deviceList.push({
            id: "placeholder_device",
            title: "No Wearables Configured",
            subtitle: "SQLite databases are empty of sources",
            badge: "Warning",
            badgeVariant: "warning",
            raw: {
              type: "device",
              name: "No Wearables Detected",
              icon: "⚠️",
              status: "Offline",
              lastSync: "No records ingested",
              syncMethod: "None",
              dataTypes: [],
              notes: "No active wearable data has been uploaded to the database yet. Run migrate-health scripts or configure a directory scan.",
              integration: "Follow integration tutorials under the user profile."
            }
          });
        }

        return deviceList;
      default:
        return [];
    }
  };

  const filteredItems = getItems().filter(i => 
    !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const counts: Record<Section, number> = {
    dashboard: data?.totalRecords || 0,
    doctors: (data?.providers || []).length,
    medicines: (data?.documents || []).filter(d => d.category === "medication" || d.category === "immunization").length,
    appointments: (data?.documents || []).filter(d => ["appointment", "discharge", "procedure"].includes(d.category)).length,
    results: (data?.documents || []).filter(d => ["lab_result", "imaging", "pathology", "patient_record"].includes(d.category)).length,
    devices: 5,
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-black text-text-primary">
      
      {/* ═══ Column 1: Navigation Sidebar ═══ */}
      <div className="w-60 shrink-0 border-r border-border bg-background/40 backdrop-blur-md flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-mono font-bold text-white tracking-widest uppercase">Wellness Hub</h1>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-text-muted">
            <span>Aggregated Vitals</span>
            <span className="text-emerald-500 font-bold">{(data?.totalRecords || 0).toLocaleString()} recs</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setSection(s.key);
                  setSelectedItem(null);
                  setIsAdding(false);
                  setEditing(false);
                  setSearch("");
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-left ${
                  active 
                    ? "bg-surface/60 border border-border text-white shadow-lg" 
                    : "text-text-muted hover:text-text-secondary hover:bg-background/60 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={14} className={active ? s.color : "text-text-dim group-hover:text-text-secondary"} />
                  <span className="text-xs font-semibold tracking-wide">{s.label}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-background/80 border border-border/50 text-text-secondary group-hover:text-text-secondary">
                  {counts[s.key] > 999 ? `${(counts[s.key] / 1000).toFixed(1)}k` : counts[s.key]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══ Column 2: Items Feed ═══ */}
      {section !== "dashboard" && (
        <div className="w-80 shrink-0 border-r border-border bg-background/20 flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary">
                {SECTIONS.find(s => s.key === section)?.label} Feed
              </span>
              {(section !== "devices") && (
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setEditing(false);
                    setSelectedItem(null);
                    setDraft(
                      section === "doctors"
                        ? { name: "", specialty: "", phone: "", address: "", website: "", portal_url: "", notes: "", next_appointment: "", last_visit: "" }
                        : { title: "", provider: "", category: section === "medicines" ? "medication" : section === "appointments" ? "appointment" : "lab_result", file_path: "", document_date: "", notes: "" }
                    );
                  }}
                  className="px-2.5 py-1 rounded-lg border border-emerald-950/40 bg-emerald-950/10 hover:bg-emerald-900/20 text-emerald-400 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={11} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter index..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background/80 border border-border text-[11px] text-white placeholder-neutral-600 outline-none focus:border-border transition-all font-sans"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-10 font-mono text-[10px] text-text-dim">
                {search ? "No indices match" : "No records mapped"}
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedItem?.id === item.raw?.id && !isAdding;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item.raw);
                      setIsAdding(false);
                      setEditing(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? "bg-surface/40 border-border shadow-md"
                        : "bg-transparent border-transparent hover:bg-background/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[12px] font-semibold truncate ${isSelected ? "text-white" : "text-text-secondary"}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <Badge variant={item.badgeVariant || "neutral"}>
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-text-muted">
                      <span className="truncate">{item.subtitle}</span>
                      {item.raw.document_date && <span>{item.raw.document_date}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══ Column 3: Detail Panels ═══ */}
      <div className="flex-1 overflow-y-auto bg-black relative">
        {/* Neon Gradient Background Spot */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-emerald-500/5 to-transparent pointer-events-none z-0" />
        
        <div className="p-6 max-w-4xl space-y-6 relative z-10">
          
          {section === "dashboard" && data && (
            isLoggingVitals ? (
              <LogVitalsForm 
                vitalsDraft={vitalsDraft}
                onChange={setVitalsDraft}
                onClose={() => setIsLoggingVitals(false)}
                onSave={handleSaveVitals}
                saving={saving}
              />
            ) : (
              <DashboardPanel data={data} onLogVitals={handleOpenVitalsLog} />
            )
          )}
          
          {section !== "dashboard" && !selectedItem && !isAdding && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center">
              <Activity className="text-background animate-pulse mb-3" size={32} />
              <p className="text-xs font-mono text-text-muted uppercase tracking-widest">
                Select index node to load parameters
              </p>
            </div>
          )}

          {/* ADD / EDIT Physician form */}
          {section === "doctors" && (isAdding || editing) && (
            <form onSubmit={handleSaveProvider} className="bg-surface/20 backdrop-blur-md border border-border rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {isAdding ? "Register Physician" : "Modify Care Profile"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditing(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Name" value={draft.name || ""} onChange={val => setDraft({ ...draft, name: val })} placeholder="Dr. Sarah Chen" required />
                <FormInput label="Specialty" value={draft.specialty || ""} onChange={val => setDraft({ ...draft, specialty: val })} placeholder="Cardiologist" />
                <FormInput label="Phone" value={draft.phone || ""} onChange={val => setDraft({ ...draft, phone: val })} placeholder="(555) 123-4567" />
                <FormInput label="Address" value={draft.address || ""} onChange={val => setDraft({ ...draft, address: val })} placeholder="12 Medical Dr, Suite 300" />
                <FormInput label="Website" value={draft.website || ""} onChange={val => setDraft({ ...draft, website: val })} placeholder="https://clinic.org" />
                <FormInput label="Patient Portal" value={draft.portal_url || ""} onChange={val => setDraft({ ...draft, portal_url: val })} placeholder="https://portal.myhealth.com" />
                <FormInput label="Next Appointment" type="date" value={draft.next_appointment || ""} onChange={val => setDraft({ ...draft, next_appointment: val })} />
                <FormInput label="Last Visit" type="date" value={draft.last_visit || ""} onChange={val => setDraft({ ...draft, last_visit: val })} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">Consultation Log & Clinical Notes</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Record summary of diagnoses, test referrals, or specific prescriptions..."
                  rows={4}
                  className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-border transition-all font-sans"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditing(false);
                  }}
                  className="px-4 py-2 border border-border hover:bg-surface text-text-secondary rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-background rounded-xl text-xs font-semibold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={11} /> {saving ? "Saving..." : "Save Log"}
                </button>
              </div>
            </form>
          )}

          {/* VIEW Physician Details */}
          {section === "doctors" && selectedItem && !isAdding && !editing && (
            <div className="space-y-5">
              <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold font-mono">
                      MD
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">{selectedItem.name}</h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="info">{selectedItem.specialty || "Primary Care"}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDraft(selectedItem);
                        setEditing(true);
                      }}
                      className="px-3 py-1.5 border border-border bg-background/30 hover:bg-surface text-text-secondary rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(selectedItem.id)}
                      className="px-3 py-1.5 border border-red-950/50 bg-red-950/10 hover:bg-red-900/20 text-red-400 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Archive
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  {selectedItem.phone && (
                    <ActionField
                      label="Phone"
                      value={selectedItem.phone}
                      icon={<Phone size={12} />}
                      onAction={() => handleCopy(selectedItem.phone, "phone")}
                      actionIcon={copiedField === "phone" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    />
                  )}
                  {selectedItem.address && (
                    <ActionField
                      label="Address"
                      value={selectedItem.address}
                      icon={<MapPin size={12} />}
                      onAction={() => window.open(`https://maps.apple.com/?q=${encodeURIComponent(selectedItem.address)}`)}
                      actionIcon={<ExternalLink size={11} />}
                    />
                  )}
                  {selectedItem.website && (
                    <ActionField
                      label="Website"
                      value={selectedItem.website}
                      icon={<Globe size={12} />}
                      onAction={() => window.open(selectedItem.website, "_blank")}
                      actionIcon={<ExternalLink size={11} />}
                    />
                  )}
                  {selectedItem.portal_url && (
                    <ActionField
                      label="Patient Portal"
                      value={selectedItem.portal_url}
                      icon={<Globe size={12} />}
                      onAction={() => window.open(selectedItem.portal_url, "_blank")}
                      actionIcon={<ExternalLink size={11} />}
                    />
                  )}
                  <ActionField
                    label="Next Scheduled Visit"
                    value={selectedItem.next_appointment ? new Date(selectedItem.next_appointment).toLocaleDateString() : "No upcoming visits"}
                    icon={<Calendar size={12} />}
                  />
                  <ActionField
                    label="Last Visit Logged"
                    value={selectedItem.last_visit ? new Date(selectedItem.last_visit).toLocaleDateString() : "No logged visit"}
                    icon={<Calendar size={12} />}
                  />
                </div>
              </div>

              {selectedItem.notes && (
                <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Consultation History & Notes</span>
                  <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed font-sans">{selectedItem.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ADD / EDIT Document form */}
          {["medicines", "appointments", "results"].includes(section) && (isAdding || editing) && (
            <form onSubmit={handleSaveDocument} className="bg-surface/20 backdrop-blur-md border border-border rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {isAdding ? "Register Health Record" : "Modify Health Record"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditing(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Title" value={draft.title || ""} onChange={val => setDraft({ ...draft, title: val })} placeholder="Comprehensive Lipid Panel" required />
                
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">Link Care Provider</label>
                  <select
                    value={draft.provider_id || ""}
                    onChange={e => {
                      const idVal = e.target.value;
                      const providerId = idVal ? parseInt(idVal, 10) : null;
                      const selectedProv = (data?.providers || []).find(p => p.id === providerId);
                      setDraft({
                        ...draft,
                        provider_id: providerId,
                        provider: selectedProv ? selectedProv.name : draft.provider
                      });
                    }}
                    className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-border transition-all font-sans"
                  >
                    <option value="">-- None / Custom Provider --</option>
                    {(data?.providers || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.specialty})</option>
                    ))}
                  </select>
                </div>

                <FormInput label="Healthcare Provider Name" value={draft.provider || ""} onChange={val => setDraft({ ...draft, provider: val })} placeholder="One Medical" required />
                
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">Category</label>
                  <select
                    value={draft.category || "patient_record"}
                    onChange={e => setDraft({ ...draft, category: e.target.value })}
                    className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-border transition-all font-sans"
                  >
                    <option value="medication">Medication (Rx)</option>
                    <option value="immunization">Immunization / Vaccine</option>
                    <option value="appointment">Clinic Visit</option>
                    <option value="procedure">Clinical Procedure</option>
                    <option value="lab_result">Lab Results</option>
                    <option value="imaging">Medical Imaging</option>
                    <option value="patient_record">Raw Document / General</option>
                  </select>
                </div>

                <FormInput label="File Path (Local Reference)" value={draft.file_path || ""} onChange={val => setDraft({ ...draft, file_path: val })} placeholder="~/Documents/health/lipids.pdf" />
                <FormInput label="Document Date" type="date" value={draft.document_date || ""} onChange={val => setDraft({ ...draft, document_date: val })} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">Report Summary / Instructions</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Record clinical readings (e.g. cholesterol values), dosage patterns, or post-visit guidelines..."
                  rows={4}
                  className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-border transition-all font-sans"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditing(false);
                  }}
                  className="px-4 py-2 border border-border hover:bg-surface text-text-secondary rounded-xl text-xs font-mono uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-background rounded-xl text-xs font-semibold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={11} /> {saving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          )}

          {/* VIEW Document Details */}
          {["medicines", "appointments", "results"].includes(section) && selectedItem && !isAdding && !editing && (
            <div className="space-y-5">
              <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-lg">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">{selectedItem.title}</h2>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={catVariant(selectedItem.category)}>
                          {selectedItem.category.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[11px] font-mono text-text-muted">{selectedItem.provider}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDraft(selectedItem);
                        setEditing(true);
                      }}
                      className="px-3 py-1.5 border border-border bg-background/30 hover:bg-surface text-text-secondary rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(selectedItem.id)}
                      className="px-3 py-1.5 border border-red-950/50 bg-red-950/10 hover:bg-red-900/20 text-red-400 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  {selectedItem.provider_id ? (
                    <ActionField
                      label="Healthcare Provider"
                      value={selectedItem.provider}
                      icon={<Stethoscope size={12} />}
                      onAction={() => {
                        const prov = (data?.providers || []).find(p => p.id === selectedItem.provider_id);
                        if (prov) {
                          setSection("doctors");
                          setSelectedItem(prov);
                        }
                      }}
                    />
                  ) : (
                    <ActionField
                      label="Healthcare Provider"
                      value={selectedItem.provider}
                      icon={<Stethoscope size={12} />}
                    />
                  )}
                  <ActionField
                    label="Document Date"
                    value={selectedItem.document_date ? new Date(selectedItem.document_date).toLocaleDateString() : "Unspecified"}
                    icon={<Calendar size={12} />}
                  />
                </div>
              </div>

              {selectedItem.file_path && (
                <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Sovereign File Reference</span>
                  <div className="flex items-center justify-between gap-4 bg-background/80 border border-border rounded-xl px-4 py-2.5">
                    <span className="text-[11px] font-mono text-text-secondary truncate max-w-lg">{selectedItem.file_path}</span>
                    <button
                      onClick={() => handleCopy(selectedItem.file_path, "path")}
                      className="text-text-muted hover:text-emerald-400 transition-all cursor-pointer shrink-0"
                    >
                      {copiedField === "path" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {selectedItem.notes && (
                <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Clinical Summary & Transcripts</span>
                  <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed font-sans">{selectedItem.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW Wearable Devices status board */}
          {section === "devices" && selectedItem && (
            <DeviceDetail device={selectedItem} />
          )}

        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard Panel — Modern Wellness Dashboard
   ═══════════════════════════════════════════════════════ */
function DashboardPanel({ data, onLogVitals }: { data: DashboardData; onLogVitals: () => void }) {
  const { latestStats = {}, weekSteps = [], monthSteps = [], recentSleep = [], typeBreakdown = [], latestMetrics = {} } = data || {};
  
  // Calculate average sleep hours
  const sleepAvg = recentSleep && recentSleep.length > 0 ? (recentSleep.reduce((a: number, b: any) => a + b.hours, 0) / recentSleep.length) : 0;
  
  const STEP_GOAL = 10000;
  const ENERGY_GOAL = 500;
  const SLEEP_GOAL = 8;

  const stepPct = Math.min((latestStats.steps || 0) / STEP_GOAL, 1);
  const energyPct = Math.min((latestStats.activeEnergy || 0) / ENERGY_GOAL, 1);
  const sleepPct = Math.min(sleepAvg / SLEEP_GOAL, 1);

  return (
    <div className="space-y-6">
      
      {/* ── Dashboard Header ── */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Wellness Dashboard</h2>
          <p className="text-[10px] text-text-muted font-mono">Last pipeline update: {latestStats.date || "Never"}</p>
        </div>
        <button 
          onClick={onLogVitals} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-background text-[10px] font-mono font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/5"
        >
          <Plus size={11} />
          LOG DAILY VITALS
        </button>
      </div>

      {/* ── Ring Tracker & Stat Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Ring widget */}
        <div className="lg:col-span-1 bg-surface/20 border border-border rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="relative" style={{ width: 160, height: 160 }}>
            <Ring pct={stepPct} color="#10b981" radius={68} stroke={9} />
            <Ring pct={energyPct} color="#f59e0b" radius={54} stroke={9} />
            <Ring pct={sleepPct} color="#6366f1" radius={40} stroke={9} />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-mono tracking-tighter text-white">
                {latestStats.steps?.toLocaleString() || "—"}
              </span>
              <span className="text-[8px] uppercase tracking-widest font-mono text-text-muted mt-0.5">steps</span>
            </div>
          </div>

          <div className="flex gap-6 mt-6">
            <RingLabel color="#10b981" label="Steps" value={`${Math.round(stepPct * 100)}%`} />
            <RingLabel color="#f59e0b" label="Cal" value={`${Math.round(energyPct * 100)}%`} />
            <RingLabel color="#6366f1" label="Sleep" value={`${Math.round(sleepPct * 100)}%`} />
          </div>
        </div>

        {/* Glow vitals matrix */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
          <GlowCard 
            title="Steps" 
            value={latestStats.steps?.toLocaleString() || "—"} 
            subtitle={`Goal: ${STEP_GOAL.toLocaleString()}`} 
            icon={<Footprints size={18} />}
            color="emerald"
            date={latestStats.date}
          />
          <GlowCard 
            title="Active Energy" 
            value={`${latestStats.activeEnergy || 0} kcal`} 
            subtitle={`Goal: ${ENERGY_GOAL} kcal`} 
            icon={<Flame size={18} />}
            color="amber"
            date={latestStats.date}
          />
          <GlowCard 
            title="Heart Rate" 
            value={latestStats.heartRate ? `${latestStats.heartRate} bpm` : "—"} 
            subtitle="Resting + Active pulse" 
            icon={<Heart size={18} />}
            color="red"
            date={latestStats.date}
          />
          <GlowCard 
            title="Sleep" 
            value={sleepAvg > 0 ? `${sleepAvg.toFixed(1)} hrs` : "—"} 
            subtitle={`14-Day Average · Goal: ${SLEEP_GOAL}h`} 
            icon={<Moon size={18} />}
            color="indigo"
          />
          <GlowCard 
            title="Blood Pressure" 
            value={latestMetrics?.blood_pressure_systolic && latestMetrics?.blood_pressure_diastolic 
              ? `${latestMetrics.blood_pressure_systolic}/${latestMetrics.blood_pressure_diastolic} mmHg` 
              : "—"
            } 
            subtitle="Manual Log" 
            icon={<Activity size={18} />}
            color="rose"
            date={latestMetrics?.date}
          />
          <GlowCard 
            title="Blood Glucose" 
            value={latestMetrics?.blood_glucose ? `${latestMetrics.blood_glucose} mg/dL` : "—"} 
            subtitle="Manual Log" 
            icon={<Zap size={18} />}
            color="purple"
            date={latestMetrics?.date}
          />
          <GlowCard 
            title="Body Temp" 
            value={latestMetrics?.temperature ? `${latestMetrics.temperature} °F` : "—"} 
            subtitle="Manual Log" 
            icon={<Thermometer size={18} />}
            color="orange"
            date={latestMetrics?.date}
          />
          <GlowCard 
            title="Weight" 
            value={latestMetrics?.weight ? `${latestMetrics.weight} lbs` : "—"} 
            subtitle="Manual Log" 
            icon={<Scale size={18} />}
            color="sky"
            date={latestMetrics?.date}
          />
          <GlowCard 
            title="Mood & Energy" 
            value={latestMetrics?.mood && latestMetrics?.energy ? `Mood: ${latestMetrics.mood} · Energy: ${latestMetrics.energy}` : "—"} 
            subtitle="Self-Reported" 
            icon={<Sparkles size={18} />}
            color="teal"
            date={latestMetrics?.date}
          />
        </div>

      </div>

      {/* ── Weekly step matrix heatmap ── */}
      <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-emerald-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">Daily Steps Stream</span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">weekly performance index</span>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {(() => {
            const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            const maxVal = Math.max(...weekSteps.map(s => s.steps), 1);
            // Reverse to read chronological Mon-Sun
            const chronSteps = [...weekSteps].reverse();
            
            return weekdays.map((day, i) => {
              const matching = chronSteps[i];
              const steps = matching?.steps || 0;
              const ratio = steps / maxVal;
              const active = steps > 0;
              
              // Calculate glow shade based on step completion ratio
              const borderStyle = active ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.03)";
              const bgStyle = active 
                ? `rgba(16, 185, 129, ${0.1 + ratio * 0.7})` 
                : "rgba(255,255,255,0.02)";

              return (
                <div key={day} className="flex flex-col items-center gap-2">
                  <span className="text-[9px] font-mono text-text-muted">{day}</span>
                  <div 
                    className="w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 border shadow-inner"
                    style={{ background: bgStyle, borderColor: borderStyle }}
                  >
                    <span className={`text-xs font-bold font-mono ${active ? "text-white" : "text-text-dim"}`}>
                      {active ? (steps / 1000).toFixed(1) + "k" : "—"}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* ── Sleep BarChart + 30-Day Activity BarChart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">Sleep Consistency</span>
            <span className="text-[9px] font-mono text-text-muted">last 14 nights</span>
          </div>
          <BarChart 
            data={[...recentSleep].reverse()} 
            valueKey="hours"
            colorFn={(v) => v >= 7 ? "#6366f1" : v >= 5.5 ? "#f59e0b" : "#f87171"}
            labelFn={(d) => d.date ? d.date.split("-")[2] : ""}
          />
        </div>

        <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">30-Day Activity Trend</span>
            <span className="text-[9px] font-mono text-text-muted">total steps per day</span>
          </div>
          <BarChart 
            data={monthSteps} 
            valueKey="steps" 
            color="#10b981" 
            height="h-24"
            gap="gap-[2px]" 
          />
        </div>
      </div>

      {/* ── Integrated Record Types ── */}
      <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white block">Ingested Record Indexes</span>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {typeBreakdown.map(t => (
            <div key={t.type} className="bg-background/60 border border-border rounded-xl p-3">
              <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted truncate" title={t.type}>
                {t.type}
              </div>
              <div className="text-base font-black font-mono text-white mt-1">
                {t.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Supporting Visual UI Components
   ═══════════════════════════════════════════════════════ */

function Ring({ pct, color, radius, stroke }: { pct: number; color: string; radius: number; stroke: number }) {
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  return (
    <svg className="absolute inset-0" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth={stroke} />
      <circle cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </svg>
  );
}

function RingLabel({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <div>
        <div className="text-[8px] font-mono text-text-muted">{label}</div>
        <div className="text-[11px] font-bold font-mono" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

// Glow stat card
interface GlowCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: "emerald" | "amber" | "red" | "indigo" | "teal" | "rose" | "purple" | "orange" | "sky";
  date?: string;
}

function GlowCard({ title, value, subtitle, icon, color, date }: GlowCardProps) {
  const colors = {
    emerald: "from-emerald-500/10 to-transparent border-emerald-900/30 text-emerald-400",
    amber: "from-amber-500/10 to-transparent border-amber-900/30 text-amber-400",
    red: "from-red-500/10 to-transparent border-red-900/30 text-red-400",
    indigo: "from-indigo-500/10 to-transparent border-indigo-900/30 text-indigo-400",
    teal: "from-teal-500/10 to-transparent border-teal-900/30 text-teal-400",
    rose: "from-rose-500/10 to-transparent border-rose-900/30 text-rose-400",
    purple: "from-purple-500/10 to-transparent border-purple-900/30 text-purple-400",
    orange: "from-orange-500/10 to-transparent border-orange-900/30 text-orange-400",
    sky: "from-sky-500/10 to-transparent border-sky-900/30 text-sky-400"
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-4 flex flex-col justify-between shadow-inner`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">{title}</span>
        <span className="text-text-muted">{icon}</span>
      </div>
      
      <div className="mt-4">
        <span className="text-xl font-black font-mono text-white tracking-tight">{value}</span>
        <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-text-muted">
          <span>{subtitle}</span>
          {date && <span>{date}</span>}
        </div>
      </div>
    </div>
  );
}

// Actionable details block
interface ActionFieldProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

function ActionField({ label, value, icon, onAction, actionIcon }: ActionFieldProps) {
  return (
    <div className="space-y-1">
      <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">{label}</span>
      <div className="flex items-center justify-between gap-4 bg-background/80 border border-border/60 rounded-xl px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-text-muted">{icon}</span>}
          <span className="text-xs text-text-secondary truncate font-medium">{value}</span>
        </div>
        {onAction && actionIcon && (
          <button
            onClick={onAction}
            className="text-text-muted hover:text-white transition-all cursor-pointer shrink-0"
          >
            {actionIcon}
          </button>
        )}
      </div>
    </div>
  );
}

// Device configuration details page
function DeviceDetail({ device }: { device: any }) {
  const badgeVariants = {
    Active: "success",
    "Setup Required": "warning",
    "Beta Testing": "info"
  } as const;

  const currentVariant = badgeVariants[device.status as keyof typeof badgeVariants] || "neutral";

  return (
    <div className="space-y-5">
      <div className="bg-surface/20 border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-background/80 border border-border flex items-center justify-center text-3xl shadow-inner">
            {device.icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{device.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={currentVariant}>{device.status}</Badge>
              <span className="text-[10px] font-mono text-text-muted">{device.subtitle}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <ActionField label="Last Scan State" value={device.lastSync} icon={<Calendar size={12} />} />
          <ActionField label="Ingestion Method" value={device.syncMethod} icon={<Activity size={12} />} />
        </div>
      </div>

      <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Sovereign Data Types</span>
        <div className="flex flex-wrap gap-1.5">
          {device.dataTypes.map((dt: string) => (
            <span key={dt} className="px-2 py-0.5 rounded-lg text-[9px] font-mono bg-background border border-border text-text-secondary">
              {dt}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Integration Pipeline Script</span>
        <p className="text-xs text-text-secondary leading-relaxed font-sans">{device.integration}</p>
      </div>

      {device.notes && (
        <div className="bg-surface/10 border border-border/60 rounded-2xl p-5 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">Technical Notes</span>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">{device.notes}</p>
        </div>
      )}
    </div>
  );
}

// Simple form input field
function FormInput({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">
        {label} {required && <span className="text-red-400 font-bold">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-border transition-all font-sans"
      />
    </div>
  );
}

// Dynamic trend charts
function BarChart({ data, valueKey, color, colorFn, labelFn, height = "h-28", gap = "gap-1" }: {
  data: any[]; valueKey: string; color?: string; colorFn?: (v: number) => string; labelFn?: (d: any) => string; height?: string; gap?: string;
}) {
  if (!data || !data.length) {
    return (
      <div className={`${height} flex items-center justify-center border border-dashed border-border rounded-2xl bg-background/20`}>
        <span className="text-[10px] font-mono text-text-dim">No data points aggregated</span>
      </div>
    );
  }
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className={`flex items-end ${gap} ${height} pt-4`}>
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const pct = (v / max) * 100;
        const bg = colorFn ? colorFn(v) : color || "var(--color-accent)";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
            <div 
              className="w-full rounded-t-md transition-all duration-300 relative" 
              style={{ height: `${pct}%`, minHeight: "2px", background: bg, opacity: 0.6 + (pct / 100) * 0.4 }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface border border-border text-[8px] font-mono px-1 py-0.5 rounded text-white whitespace-nowrap z-50">
                {v.toLocaleString()}
              </div>
            </div>
            {labelFn && (
              <span className="text-[8px] font-mono text-text-muted scale-90 select-none">{labelFn(d)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function catVariant(c: string): "success" | "info" | "warning" | "neutral" {
  switch (c) {
    case "lab_result":
    case "pathology":
      return "info";
    case "procedure":
      return "warning";
    case "imaging":
    case "immunization":
      return "success";
    default:
      return "neutral";
  }
}

function LogVitalsForm({
  vitalsDraft,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  vitalsDraft: any;
  onChange: (v: any) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  return (
    <form onSubmit={onSave} className="bg-surface/20 backdrop-blur-md border border-border rounded-2xl p-5 space-y-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Log Daily Vitals & Biometrics
          </h2>
          <p className="text-[10px] text-text-muted font-mono">Store biometric data in local SQLite database</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-secondary transition-all cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormInput 
          label="Log Date" 
          type="date" 
          value={vitalsDraft.date || ""} 
          onChange={val => onChange({ ...vitalsDraft, date: val })} 
          required 
        />
        <FormInput 
          label="Steps Count" 
          type="number" 
          value={vitalsDraft.steps || ""} 
          onChange={val => onChange({ ...vitalsDraft, steps: val })} 
          placeholder="e.g. 8500" 
        />
        <FormInput 
          label="Sleep Hours" 
          type="number" 
          value={vitalsDraft.sleep_hours || ""} 
          onChange={val => onChange({ ...vitalsDraft, sleep_hours: val })} 
          placeholder="e.g. 7.5" 
        />
        <FormInput 
          label="Resting HR (bpm)" 
          type="number" 
          value={vitalsDraft.resting_hr || ""} 
          onChange={val => onChange({ ...vitalsDraft, resting_hr: val })} 
          placeholder="e.g. 62" 
        />
        <FormInput 
          label="HRV (ms)" 
          type="number" 
          value={vitalsDraft.hrv || ""} 
          onChange={val => onChange({ ...vitalsDraft, hrv: val })} 
          placeholder="e.g. 55" 
        />
        <FormInput 
          label="Body Weight (lbs)" 
          type="number" 
          value={vitalsDraft.weight || ""} 
          onChange={val => onChange({ ...vitalsDraft, weight: val })} 
          placeholder="e.g. 175.4" 
        />
        <FormInput 
          label="BP Systolic (mmHg)" 
          type="number" 
          value={vitalsDraft.blood_pressure_systolic || ""} 
          onChange={val => onChange({ ...vitalsDraft, blood_pressure_systolic: val })} 
          placeholder="e.g. 120" 
        />
        <FormInput 
          label="BP Diastolic (mmHg)" 
          type="number" 
          value={vitalsDraft.blood_pressure_diastolic || ""} 
          onChange={val => onChange({ ...vitalsDraft, blood_pressure_diastolic: val })} 
          placeholder="e.g. 80" 
        />
        <FormInput 
          label="Blood Glucose (mg/dL)" 
          type="number" 
          value={vitalsDraft.blood_glucose || ""} 
          onChange={val => onChange({ ...vitalsDraft, blood_glucose: val })} 
          placeholder="e.g. 95" 
        />
        <FormInput 
          label="Body Temp (°F)" 
          type="number" 
          value={vitalsDraft.temperature || ""} 
          onChange={val => onChange({ ...vitalsDraft, temperature: val })} 
          placeholder="e.g. 98.6" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">
            Mood Rating ({vitalsDraft.mood || 5}/10)
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={vitalsDraft.mood || 5}
            onChange={e => onChange({ ...vitalsDraft, mood: parseInt(e.target.value, 10) })}
            className="w-full h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">
            Energy Level ({vitalsDraft.energy || 5}/10)
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={vitalsDraft.energy || 5}
            onChange={e => onChange({ ...vitalsDraft, energy: parseInt(e.target.value, 10) })}
            className="w-full h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-mono uppercase tracking-wider text-text-muted block">Daily Notes</label>
        <textarea
          value={vitalsDraft.notes || ""}
          onChange={e => onChange({ ...vitalsDraft, notes: e.target.value })}
          placeholder="Any symptoms, exercise details, dietary notes, or comments..."
          rows={3}
          className="w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-border transition-all font-sans"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-border hover:bg-surface text-text-secondary rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-background rounded-xl text-xs font-semibold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Save size={11} /> {saving ? "Saving..." : "Save Daily Log"}
        </button>
      </div>
    </form>
  );
}
