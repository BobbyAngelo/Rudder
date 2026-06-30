"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui";
import {
  Cpu, Server, Box, Search, Loader2,
  FolderOpen, Package, CircleDot, HardDrive,
  RefreshCw
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Hardware — 3-Column Fleet, Project & Storage Registry
   Col 1: Section nav (Cluster, Projects, Parts, Storage Drives)
   Col 2: Entry list
   Col 3: Detail card & Folder Explorer
   ═══════════════════════════════════════════════════════ */

interface ClusterNode {
  name: string; type: string; hw: string;
  ip: string; user: string; role: string; status: string;
}

interface HwProject {
  slug: string; name: string; path: string;
  files: number; has_readme: boolean; status: string;
}

interface Part {
  id: string; name: string; category: string;
  quantity: number; location: string; status: string; notes: string;
}

interface DriveInfo {
  id: string;
  name: string;
  mountPath: string;
  description: string;
  manifestFile: string;
  capacity?: string;
  status: string;
  tags: string[];
  mounted: boolean;
  hasManifest: boolean;
  scanDate: string | null;
  totals: { images: number; videos: number; imageSizeBytes: number; videoSizeBytes: number } | null;
  folderCount: number;
}

interface HardwareData {
  cluster?: ClusterNode[];
  projects?: HwProject[];
  parts?: Part[];
}

interface DriveDetail {
  tree?: FolderNode[];
  folderCount?: number;
  totals?: { images?: number; videos?: number; imageSizeBytes?: number; videoSizeBytes?: number } | null;
  [key: string]: unknown;
}

type Section = "cluster" | "projects" | "parts" | "drives";

const SECTION_COLOR = "var(--color-section-infra)";

const STATUS_COLORS: Record<string, string> = {
  active: "#34d399", pending: "#f59e0b", undocumented: "#6b7280",
  Unallocated: "#6b7280", Allocated: "#60a5fa", Depleted: "#ef4444",
};

const TAG_COLORS: Record<string, string> = {
  "photo-archive": "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "primary": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "chronological": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "project-assets": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "personal": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "active": "bg-green-500/20 text-green-400 border-green-500/30",
  "working-drive": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "unregistered": "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 Bytes";
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + " TB";
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

export default function HardwarePage() {
  const [data, setData] = useState<HardwareData | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("cluster");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Storage drive specific states
  const [selectedDriveDetail, setSelectedDriveDetail] = useState<DriveDetail | null>(null);
  const [loadingDriveDetail, setLoadingDriveDetail] = useState(false);
  const [driveFolderSearch, setDriveFolderSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/hardware").then(r => r.json()),
      fetch("/api/drives").then(r => r.json()).catch(() => ({ drives: [] }))
    ]).then(([hwData, drivesData]) => {
      setData(hwData);
      setDrives(drivesData.drives || []);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load hardware page data", err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-text-dim)" }} />
    </div>;
  }

  const cluster: ClusterNode[] = data?.cluster || [];
  const projects: HwProject[] = data?.projects || [];
  const parts: Part[] = data?.parts || [];

  const q = search.toLowerCase();
  const filteredCluster = cluster.filter(n => !q || n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q));
  const filteredProjects = projects.filter(p => !q || p.name.toLowerCase().includes(q));
  const filteredParts = parts.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  const filteredDrives = drives.filter(d => !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));

  const sections: { key: Section; label: string; icon: React.ElementType; count: number }[] = [
    { key: "cluster", label: "Exo Cluster", icon: Server, count: cluster.length },
    { key: "projects", label: "Projects", icon: FolderOpen, count: projects.length },
    { key: "parts", label: "Parts Inventory", icon: Package, count: parts.length },
    { key: "drives", label: "Storage Drives", icon: HardDrive, count: drives.length },
  ];

  const handleSelectDrive = async (index: number, driveId: string) => {
    setSelectedIndex(index);
    setLoadingDriveDetail(true);
    setSelectedDriveDetail(null);
    setDriveFolderSearch("");
    try {
      const res = await fetch(`/api/drives?drive=${driveId}`);
      const detail = await res.json();
      setSelectedDriveDetail(detail);
    } catch (e) {
      console.error("Error loading drive detail tree", e);
    } finally {
      setLoadingDriveDetail(false);
    }
  };

  const getDetail = () => {
    if (selectedIndex === null) return null;
    if (activeSection === "cluster") return filteredCluster[selectedIndex];
    if (activeSection === "projects") return filteredProjects[selectedIndex];
    if (activeSection === "parts") return filteredParts[selectedIndex];
    if (activeSection === "drives") return filteredDrives[selectedIndex];
    return null;
  };

  const detail = getDetail();

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ═══ Column 1: Section Nav ═══ */}
      <div className="w-52 flex flex-col border-r shrink-0" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Cpu size={14} style={{ color: SECTION_COLOR }} />
            <h1 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Hardware</h1>
          </div>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--color-text-dim)" }}>
            {cluster.length} nodes · {projects.length} proj · {drives.length} drives
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sections.map(s => {
            const active = activeSection === s.key;
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => { setActiveSection(s.key); setSelectedIndex(null); setSearch(""); setSelectedDriveDetail(null); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left"
                style={{
                  background: active ? "var(--color-surface-elevated)" : "transparent",
                  borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                }}>
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                  <span className="text-[12px] font-medium" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>{s.label}</span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: "var(--color-text-dim)" }}>{s.count}</span>
              </button>
            );
          })}

          {/* Cluster health */}
          <div className="pt-3 mt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <span className="text-[9px] uppercase tracking-wider font-mono px-3" style={{ color: "var(--color-text-dim)" }}>Cluster Status</span>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {cluster.map(n => (
              <div key={n.name} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[n.status] || "#6b7280" }} />
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>{n.name}</span>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* ═══ Column 2: Entry List ═══ */}
      <div className="w-80 flex flex-col border-r shrink-0" style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}>
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium capitalize font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {activeSection === "cluster" ? "Exo Cluster" : activeSection === "drives" ? "Storage Drives" : activeSection}
            </span>
            <span className="text-[9px] font-mono" style={{ color: "var(--color-text-dim)" }}>
              {activeSection === "cluster" ? filteredCluster.length : activeSection === "projects" ? filteredProjects.length : activeSection === "parts" ? filteredParts.length : filteredDrives.length}
            </span>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-dim)" }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 rounded-md text-[11px] outline-none border"
              style={{ background: "var(--color-surface)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }} />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {activeSection === "cluster" && filteredCluster.map((node, i) => {
            const active = selectedIndex === i;
            return (
              <button key={node.name} onClick={() => setSelectedIndex(i)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: active ? "var(--color-surface-elevated)" : "transparent",
                  borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Server size={11} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                  <span className="text-[11px] font-medium font-mono" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                    {node.name}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: STATUS_COLORS[node.status] || "#6b7280" }} />
                </div>
                <div className="text-[9px] ml-5 truncate" style={{ color: "var(--color-text-dim)" }}>{node.hw}</div>
              </button>
            );
          })}

          {activeSection === "projects" && filteredProjects.map((proj, i) => {
            const active = selectedIndex === i;
            return (
              <button key={proj.slug} onClick={() => setSelectedIndex(i)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: active ? "var(--color-surface-elevated)" : "transparent",
                  borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Box size={11} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                  <span className="text-[11px] font-medium truncate" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                    {proj.name}
                  </span>
                  {proj.has_readme && <CircleDot size={8} style={{ color: "#34d399" }} />}
                </div>
                <div className="flex items-center gap-2 ml-5">
                  <span className="text-[9px] font-mono" style={{ color: "var(--color-text-dim)" }}>{proj.files} files</span>
                </div>
              </button>
            );
          })}

          {activeSection === "parts" && filteredParts.map((part, i) => {
            const active = selectedIndex === i;
            return (
              <button key={part.id} onClick={() => setSelectedIndex(i)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: active ? "var(--color-surface-elevated)" : "transparent",
                  borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Package size={11} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                  <span className="text-[11px] font-medium truncate" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
                    {part.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-5">
                  <span className="text-[9px] font-mono" style={{ color: "var(--color-text-dim)" }}>×{part.quantity}</span>
                  <span className="text-[9px] font-mono capitalize" style={{ color: "var(--color-text-dim)" }}>{part.category}</span>
                </div>
              </button>
            );
          })}

          {activeSection === "drives" && filteredDrives.map((drive, i) => {
            const active = selectedIndex === i;
            return (
              <button key={drive.id} onClick={() => handleSelectDrive(i, drive.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: active ? "var(--color-surface-elevated)" : "transparent",
                  borderLeft: active ? `2px solid ${SECTION_COLOR}` : "2px solid transparent",
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <HardDrive size={11} style={{ color: active ? SECTION_COLOR : "var(--color-text-dim)" }} />
                  <span className="text-[11px] font-medium truncate text-[var(--color-text-primary)]">
                    {drive.name}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full ml-auto shrink-0" style={{ background: drive.mounted ? "#34d399" : "#ef4444" }} />
                </div>
                <div className="flex items-center justify-between text-[9px] ml-5" style={{ color: "var(--color-text-dim)" }}>
                  <span>{drive.capacity || "Offline"}</span>
                  <span>{drive.hasManifest ? "Scanned" : "Unscanned"}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══ Column 3: Detail ═══ */}
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-background)" }}>
        <div className="p-6 max-w-2xl">
          {detail ? (
            <div className="space-y-4 animate-fade-in">
              {activeSection === "cluster" && <NodeDetail node={detail as ClusterNode} />}
              {activeSection === "projects" && <ProjectDetail project={detail as HwProject} />}
              {activeSection === "parts" && <PartDetail part={detail as Part} />}
              {activeSection === "drives" && (
                <DriveDetailView 
                  drive={detail as DriveInfo} 
                  loadingDetail={loadingDriveDetail}
                  detail={selectedDriveDetail}
                  folderSearch={driveFolderSearch}
                  setFolderSearch={setDriveFolderSearch}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Cpu size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-dim)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Select an item to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Collapsible Folder Tree Item ═══ */

interface FolderNode {
  name: string;
  path: string;
  images: number;
  videos: number;
  imageSize: number;
  videoSize: number;
  sampleImages: string[];
  sampleVideos: string[];
  children: FolderNode[];
}

function FolderTreeItem({ node, depth = 0, search }: { node: FolderNode; depth?: number; search: string }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const matchesSearch = search && node.name.toLowerCase().includes(search.toLowerCase());

  // Check if any children match the search
  const childMatches = search ? JSON.stringify(node).toLowerCase().includes(search.toLowerCase()) : false;
  const shouldShow = !search || matchesSearch || childMatches;

  if (!shouldShow) return null;

  const isOpen = open || (search.length > 0 && childMatches);

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }} className="font-mono">
      <div
        onClick={() => setOpen(!isOpen)}
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-all group ${
          matchesSearch ? "bg-orange-500/10 border-l border-orange-500" : "hover:bg-white/5"
        }`}
      >
        {hasChildren ? (
          <span className={`text-[8px] text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
        ) : (
          <span className="text-[8px] text-gray-700">·</span>
        )}
        <span className="text-[11px] shrink-0 select-none">📁</span>
        <span className={`text-[11px] font-medium truncate ${matchesSearch ? "text-orange-400 font-bold" : "text-gray-300 group-hover:text-white"}`}>
          {node.name}
        </span>
        {node.images > 0 && (
          <span className="text-[9px] text-sky-400/80 ml-auto shrink-0">{node.images.toLocaleString()} imgs</span>
        )}
        {node.videos > 0 && (
          <span className="text-[9px] text-orange-400/80 ml-1 shrink-0">{node.videos.toLocaleString()} vids</span>
        )}
        {(node.imageSize + node.videoSize) > 0 && (
          <span className="text-[9px] text-gray-500 ml-2 shrink-0">{formatBytes(node.imageSize + node.videoSize)}</span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className="border-l border-white/5 ml-1.5 pl-1 space-y-0.5">
          {node.children.map(child => (
            <FolderTreeItem key={child.path} node={child} depth={depth + 1} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Drive Detail View ═══ */

function DriveDetailView({ 
  drive, 
  loadingDetail, 
  detail, 
  folderSearch, 
  setFolderSearch 
}: { 
  drive: DriveInfo;
  loadingDetail: boolean;
  detail: DriveDetail | null;
  folderSearch: string;
  setFolderSearch: (s: string) => void;
}) {
  return (
    <>
      <Card><CardBody>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(249,115,22,0.08)", color: "#f97316" }}>
            <HardDrive size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold truncate text-[var(--color-text-primary)]">{drive.name}</h2>
              {drive.capacity && (
                <span className="text-[10px] text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">{drive.capacity}</span>
              )}
              <span className={`text-[9px] font-bold tracking-wide shrink-0 ${drive.mounted ? "text-emerald-400" : "text-red-400"}`}>
                {drive.mounted ? "● ONLINE" : "○ OFFLINE"}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)] mb-3">{drive.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {drive.tags.map(tag => (
                <span
                  key={tag}
                  className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${TAG_COLORS[tag] || "bg-white/10 text-gray-400 border-white/10"}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardBody></Card>

      {/* Metadata Stats Card */}
      {drive.hasManifest && (
        <Card><CardBody>
          <span className="text-[10px] uppercase tracking-wider font-mono block mb-3 text-[var(--color-text-dim)]">Scan Intelligence</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/10">
              <div className="text-[9px] uppercase tracking-wider font-mono text-[var(--color-text-dim)]">Total Folders</div>
              <div className="text-[14px] font-bold mt-0.5 text-[var(--color-text-primary)]">{(drive.folderCount || detail?.folderCount || 0).toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/10">
              <div className="text-[9px] uppercase tracking-wider font-mono text-[var(--color-text-dim)]">Photos</div>
              <div className="text-[14px] font-bold mt-0.5 text-[var(--color-text-primary)]">{(drive.totals?.images || detail?.totals?.images || 0).toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/10">
              <div className="text-[9px] uppercase tracking-wider font-mono text-[var(--color-text-dim)]">Videos</div>
              <div className="text-[14px] font-bold mt-0.5 text-[var(--color-text-primary)]">{(drive.totals?.videos || detail?.totals?.videos || 0).toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg border border-white/5 bg-black/10">
              <div className="text-[9px] uppercase tracking-wider font-mono text-[var(--color-text-dim)]">Total Indexed Size</div>
              <div className="text-[14px] font-bold mt-0.5 text-[var(--color-text-primary)]">
                {formatBytes((drive.totals?.imageSizeBytes || 0) + (drive.totals?.videoSizeBytes || 0))}
              </div>
            </div>
          </div>
          {drive.scanDate && (
            <div className="text-[10px] font-mono mt-3 text-[var(--color-text-dim)] text-right">
              Last cataloged scan: {new Date(drive.scanDate).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
        </CardBody></Card>
      )}

      {/* Folder Explorer Card */}
      <Card><CardBody>
        <span className="text-[10px] uppercase tracking-wider font-mono block mb-3 text-[var(--color-text-dim)]">File System Archive</span>
        
        {!drive.hasManifest ? (
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
              <span>⚠️</span> Uncataloged Storage Device
            </h4>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mb-4">
              Volume <strong>{drive.name}</strong> hasn&apos;t been scanned for system cataloging yet. You can trigger a deep-scan from the server terminal:
            </p>
            <div className="bg-background border border-white/10 rounded-lg p-3 flex items-center justify-between group">
              <code className="text-[10px] text-emerald-400 font-mono select-all">
                npx tsx scripts/scan-drive.ts &quot;{drive.mountPath}&quot;
              </code>
              <button
                onClick={(e) => {
                  navigator.clipboard.writeText(`npx tsx scripts/scan-drive.ts "${drive.mountPath}"`);
                  e.currentTarget.textContent = "Copied!";
                  setTimeout(() => { if (e.currentTarget) e.currentTarget.textContent = "📋"; }, 1500);
                }}
                className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded"
              >
                📋
              </button>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="flex items-center gap-3 py-6 text-[12px] font-mono text-[var(--color-text-dim)] uppercase animate-pulse">
            <RefreshCw size={14} className="animate-spin text-orange-500" />
            Loading offline directory map...
          </div>
        ) : detail && detail.tree ? (
          <div className="space-y-4">
            {/* Search Box */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
              <input
                type="text"
                placeholder="Search catalog folders... (e.g., photostructure, projects, backups)"
                value={folderSearch}
                onChange={e => setFolderSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none border bg-background border-white/10 text-[var(--color-text-primary)] placeholder-gray-600 focus:border-orange-500/50"
              />
              {folderSearch && (
                <button onClick={() => setFolderSearch("")} className="absolute right-3 top-2 text-gray-500 hover:text-white text-xs">✕</button>
              )}
            </div>

            {/* Tree Container */}
            <div className="max-h-[420px] overflow-y-auto pr-1 space-y-0.5 border border-white/5 rounded-lg p-2 bg-black/10">
              {detail.tree.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-[var(--color-text-dim)]">No folders found in manifest</div>
              ) : (
                detail.tree.map((node: FolderNode) => (
                  <FolderTreeItem key={node.path} node={node} search={folderSearch} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-red-400 py-3">Could not load scanned file structure directory catalog.</div>
        )}
      </CardBody></Card>
    </>
  );
}

/* ═══ Details Component helpers ═══ */

function NodeDetail({ node }: { node: ClusterNode }) {
  return (
    <>
      <Card><CardBody>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(96,165,250,0.1)", color: SECTION_COLOR }}>
            <Server size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold font-mono" style={{ color: "var(--color-text-primary)" }}>{node.name}</h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{node.hw}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[node.status] || "#6b7280" }} />
            <span className="text-[10px] font-mono capitalize" style={{ color: "var(--color-text-dim)" }}>{node.status}</span>
          </div>
        </div>
      </CardBody></Card>

      <Card><CardBody>
        <span className="text-[10px] uppercase tracking-wider font-mono block mb-3" style={{ color: "var(--color-text-dim)" }}>Network</span>
        <div className="space-y-2">
          <DetailRow label="IP Address" value={node.ip} />
          <DetailRow label="SSH User" value={node.user} />
          <DetailRow label="Role" value={node.role} />
          {node.ip !== "TBD" && <DetailRow label="SSH Command" value={`ssh ${node.name.toLowerCase()}`} />}
        </div>
      </CardBody></Card>
    </>
  );
}

function ProjectDetail({ project: p }: { project: HwProject }) {
  return (
    <>
      <Card><CardBody>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(96,165,250,0.1)", color: SECTION_COLOR }}>
            <Box size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{p.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono" style={{ color: "var(--color-text-dim)" }}>{p.files} files</span>
              {p.has_readme && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>README</span>}
            </div>
          </div>
        </div>
      </CardBody></Card>

      <Card><CardBody>
        <span className="text-[10px] uppercase tracking-wider font-mono block mb-3" style={{ color: "var(--color-text-dim)" }}>Details</span>
        <div className="space-y-2">
          <DetailRow label="Slug" value={p.slug} />
          <DetailRow label="Path" value={p.path.replace("/Users/sovereign/Developer/", "~/Developer/")} />
          <DetailRow label="Status" value={p.status} />
        </div>
      </CardBody></Card>
    </>
  );
}

function PartDetail({ part }: { part: Part }) {
  return (
    <Card><CardBody>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(96,165,250,0.1)", color: SECTION_COLOR }}>
          <Package size={22} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{part.name}</h2>
          <span className="text-[10px] font-mono capitalize" style={{ color: "var(--color-text-dim)" }}>{part.category}</span>
        </div>
      </div>
      <div className="space-y-2">
        <DetailRow label="Quantity" value={String(part.quantity)} />
        <DetailRow label="Location" value={part.location || "—"} />
        <DetailRow label="Status" value={part.status} />
        {part.notes && <DetailRow label="Notes" value={part.notes} />}
      </div>
    </CardBody></Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <div className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "var(--color-text-dim)" }}>{label}</div>
      <span className="text-[12px] font-mono font-medium" style={{ color: "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}
