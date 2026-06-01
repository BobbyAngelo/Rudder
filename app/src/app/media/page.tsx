"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Database, 
  Image as ImageIcon, 
  Video, 
  MapPin, 
  HardDrive,
  File,
  RefreshCw,
  FolderOpen,
  Search,
  SlidersHorizontal,
  Play,
  Film,
  Camera,
  Layers,
  Map,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Users,
  Heart,
  CalendarDays,
  Shuffle,
  Trash2,
  Star,
  RotateCcw,
  SkipForward
} from "lucide-react";
import ZenithLightbox from "@/components/media/ZenithLightbox";

interface MediaRecord {
  id: number;
  filename: string;
  extension: string;
  type: "photo" | "video";
  sizeBytes: number;
  sourceVolume: string;
  relativePath: string;
  dateCreated: string | null;
  city: string | null;
  country: string | null;
  camera: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  lat: number | null;
  lng: number | null;
  hasGeo: number;
  title?: string | null;
  content?: string | null;
  userTags?: string | null;
  caption?: string | null;
  category?: string | null;
  license?: string | null;
  privacyStatus?: string | null;
  madeForKids?: number | null;
  virtualAlbums?: string | null;
  faces?: string | null;
  favorite?: number | null;
}


function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Custom card for local videos with YouTube-style hover-loop play
function VideoCard({ record, onClick }: { record: MediaRecord; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (hovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [hovered]);

  return (
    <div 
      className="relative group rounded-xl overflow-hidden cursor-pointer border border-white/[0.06] hover:border-orange-500/40 bg-surface aspect-video flex flex-col justify-between transition-all duration-300 hover:shadow-[0_8px_30px_rgba(249,115,22,0.15)] hover:-translate-y-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-background">
        {hovered ? (
          <video 
            ref={videoRef}
            src={`/api/media/stream?id=${record.id}`}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full relative flex items-center justify-center">
            <Film size={32} className="text-white/10 group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white/95 border border-white/10 group-hover:scale-110 group-hover:bg-orange-600 transition-all duration-300 shadow-lg animate-fade-in">
                <Play size={18} fill="currentColor" className="ml-0.5 text-white" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {record.duration && (
        <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-black/80 text-white border border-white/10 z-10 shadow-md">
          {Math.floor(record.duration / 60)}:{Math.floor(record.duration % 60).toString().padStart(2, '0')}
        </span>
      )}

      {/* Card Info Overlay */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <span className="text-[12px] font-bold text-white truncate block drop-shadow">
          {record.title || record.filename}
        </span>
        <span className="text-[9px] text-white/50 font-mono block">
          {record.extension.toUpperCase()} • {record.category || "Uncategorized"}
        </span>
      </div>
    </div>
  );
}

// Card for images (iPhoto visual-first borderless grid card)
function PhotoCard({ record, onClick }: { record: MediaRecord; onClick: () => void }) {
  const [error, setError] = useState(false);
  const ext = record.extension.toLowerCase();
  const isRaw = [".dng", ".cr2", ".cr3", ".nef", ".arw", ".raf", ".orf", ".rwl", ".pef", ".raw"].includes(ext) || ["dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rwl", "pef", "raw"].includes(ext);

  return (
    <div 
      className="relative group overflow-hidden cursor-pointer bg-background aspect-square transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      onClick={onClick}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="w-full h-full bg-surface flex flex-col items-center justify-center gap-1 text-white/30 text-center p-2">
            <ImageIcon size={20} />
            <span className="text-[9px] truncate max-w-full font-mono">{record.filename}</span>
          </div>
        ) : (
          <img 
            src={`/api/media/stream?id=${record.id}`}
            alt={record.filename}
            loading="lazy"
            onError={() => setError(true)}
            className="w-full h-full object-cover transition-transform duration-550 ease-out group-hover:scale-105"
          />
        )}
      </div>

      {isRaw && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/90 text-background backdrop-blur-md border border-amber-400/20 select-none z-10 shadow-sm font-mono">
          RAW
        </span>
      )}
      
      {/* iPhoto Hover Overlay */}
      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
        <span className="text-[11px] font-bold text-white truncate drop-shadow">
          {record.title || record.filename}
        </span>
        <span className="text-[9px] text-white/70 font-mono flex items-center gap-1">
          <ImageIcon size={10} className="text-orange-400" />
          {record.extension.toUpperCase()}
          {record.camera && ` • ${record.camera}`}
        </span>
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: any;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  activeColor?: string;
}

function SidebarItem({ icon: Icon, label, count, active, onClick, activeColor = "text-orange-500" }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150 group ${
        active 
          ? "bg-surface-elevated/80 text-white border border-white/[0.04]" 
          : "hover:bg-surface-elevated/30 text-text-secondary hover:text-text-primary border border-transparent"
      }`}
    >
      <div className="flex items-center gap-2.5 truncate">
        <Icon 
          size={14} 
          className={`shrink-0 transition-transform group-hover:scale-105 ${
            active ? activeColor : "text-text-muted group-hover:text-text-secondary"
          }`} 
        />
        <span className="truncate">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono transition-colors ${
          active 
            ? "bg-orange-500/10 text-orange-400" 
            : "bg-surface-elevated/40 text-text-muted group-hover:bg-surface-elevated/80 group-hover:text-text-secondary"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

function SidebarSection({ title, isOpen, onToggle, children, rightElement }: SidebarSectionProps) {
  return (
    <div className="space-y-1">
      <div className="w-full flex items-center justify-between px-2 py-1.5 transition-colors">
        <button 
          onClick={onToggle}
          className="flex-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-text-muted hover:text-text-secondary uppercase mr-2"
        >
          <span>{title}</span>
          {isOpen ? <ChevronDown size={11} className="text-text-dim" /> : <ChevronRight size={11} className="text-text-dim" />}
        </button>
        {rightElement && (
          <div className="shrink-0 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {isOpen && (
        <div className="space-y-0.5 pl-1 transition-all duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MediaPage() {
  // Aggregate data state
  const [metaData, setMetaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apple Photos sync states
  const [syncingApple, setSyncingApple] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [customLibraryPath, setCustomLibraryPath] = useState("");
  const [useSystemLibrary, setUseSystemLibrary] = useState(true);

  const triggerApplePhotosSync = async (dryRun: boolean) => {
    setSyncingApple(true);
    setSyncMessage(dryRun ? "Starting dry run check..." : "Starting metadata sync...");
    setSyncError("");
    try {
      const res = await fetch("/api/media/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "apple",
          library_path: useSystemLibrary ? "" : customLibraryPath.trim(),
          dry_run: dryRun
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger sync");
      }
      setSyncMessage(dryRun 
        ? "Dry run scheduled in background!" 
        : "Live sync scheduled in background!"
      );
      setTimeout(() => setSyncMessage(""), 5000);
      setTimeout(() => fetchMediaData(true), 3000);
    } catch (e: any) {
      setSyncError(e.message);
      setSyncMessage("");
    } finally {
      setSyncingApple(false);
    }
  };

  // Listing / Filter States
  const [viewMode, setViewMode] = useState<"photos" | "videos">("photos");
  const [triageActive, setTriageActive] = useState(false);
  const [triageIndex, setTriageIndex] = useState(0);
  const [deletePhysical, setDeletePhysical] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"up" | "down" | "left" | "right" | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Chronicles / Journey Storyteller States
  const [chroniclesOpen, setChroniclesOpen] = useState(true);
  const [journeysList, setJourneysList] = useState<any[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [essences, setEssences] = useState<Record<number, string>>({});
  const [manualProses, setManualProses] = useState<Record<number, string>>({});
  const [savingNarrative, setSavingNarrative] = useState<Record<number, boolean>>({});

  const handleJourneySelect = async (id: string) => {
    setSelectedJourneyId(id);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedFace("");
    setSelectedCity("");
    setSelectedVolume("");
    setSelectedCamera("");
    setSelectedFavorite(false);
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedUnorganized(false);
    
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

  useEffect(() => {
    fetch("/api/media/chronicles")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setJourneysList(d.journeys || []);
        }
      })
      .catch(e => console.error("Failed to load journeys:", e));
  }, [refreshing]);
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"" | "photo" | "video">("photo");
  const [selectedVolume, setSelectedVolume] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedYoutubeStatus, setSelectedYoutubeStatus] = useState<"" | "ready" | "draft">("");
  const [selectedMemory, setSelectedMemory] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [selectedVirtualAlbum, setSelectedVirtualAlbum] = useState("");
  const [selectedFace, setSelectedFace] = useState("");
  const [selectedRawOnly, setSelectedRawOnly] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState(false);
  const [selectedUnorganized, setSelectedUnorganized] = useState(false);
  const [triageUndoStack, setTriageUndoStack] = useState<any[]>([]);
  const [folderFilter, setFolderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Floating Year-Slider and Infinite Scroll states & refs
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sidebar Folders Expansion States
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [placesOpen, setPlacesOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [camerasOpen, setCamerasOpen] = useState(true);
  const [albumsOpen, setAlbumsOpen] = useState(true);
  const [dateArchiveOpen, setDateArchiveOpen] = useState(true);
  const [smartAlbumsOpen, setSmartAlbumsOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [chronologyView, setChronologyView] = useState<"month" | "week" | "day">("month");

  // Album creation modal state
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumDescription, setNewAlbumDescription] = useState("");
  const [newAlbumCriteriaType, setNewAlbumCriteriaType] = useState("manual");
  const [newAlbumCriteriaValue, setNewAlbumCriteriaValue] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [albumError, setAlbumError] = useState("");

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const fetchMediaData = (reset = false) => {
    if (reset) {
      setPage(1);
    }
    setRefreshing(true);
    
    const queryPage = reset ? 1 : page;
    const params = new URLSearchParams({
      q: searchQuery,
      type: selectedType,
      volume: selectedVolume,
      city: selectedCity,
      category: selectedCategory,
      youtubeStatus: selectedYoutubeStatus,
      memory: selectedMemory ? "true" : "",
      camera: selectedCamera,
      album: selectedAlbum,
      virtualAlbum: selectedVirtualAlbum,
      face: selectedFace,
      favorite: selectedFavorite ? "true" : "",
      rawOnly: selectedRawOnly ? "true" : "",
      unorganized: selectedUnorganized ? "true" : "",
      page: queryPage.toString(),
      limit: "48"
    });

    fetch(`/api/media?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (queryPage === 1) {
          setRecords(d.records || []);
          setTriageIndex(0);
        } else {
          setRecords(prev => [...prev, ...(d.records || [])]);
        }
        setTotalCount(d.filteredCount || 0);
        
        // Save metadata on first/general load
        if (!metaData || reset) {
          setMetaData(d);
        }
        setLoading(false);
        setTimeout(() => setRefreshing(false), 300);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
        setRefreshing(false);
      });
  };

  // Load view mode from query parameter if present on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const view = searchParams.get("view");
      if (view === "photos" || view === "videos") {
        setViewMode(view);
        setSelectedType(view === "photos" ? "photo" : "video");
      }
    }
  }, []);

  useEffect(() => {
    fetchMediaData(true);
  }, [searchQuery, selectedType, selectedVolume, selectedCity, selectedCategory, selectedYoutubeStatus, selectedMemory, selectedCamera, selectedAlbum, selectedRawOnly, selectedVirtualAlbum, selectedFace, selectedFavorite, selectedUnorganized]);

  useEffect(() => {
    if (page > 1) {
      fetchMediaData(false);
    }
  }, [page]);

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  // Dynamically extract distinct years from chronological records
  const getDistinctYears = () => {
    const years = new Set<string>();
    records.forEach((record) => {
      if (record.dateCreated) {
        const date = new Date(record.dateCreated);
        const year = date.getFullYear();
        if (!isNaN(year)) {
          years.add(year.toString());
        }
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  };

  const distinctYears = getDistinctYears();

  // Scroll-spy to highlight the active year in viewport
  useEffect(() => {
    const container = document.getElementById("media-scroll-container");
    if (!container || distinctYears.length <= 1) return;

    const handleScroll = () => {
      const headers = container.querySelectorAll("[id^='header-']");
      let currentActive: string | null = null;
      
      headers.forEach((header) => {
        const rect = header.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // If the header's top is near or past the top of the viewport container, it is our active year
        if (rect.top - containerRect.top <= 120) {
          currentActive = header.id.replace("header-", "");
        }
      });
      
      if (currentActive) {
        setActiveYear(currentActive);
      }
    };

    container.addEventListener("scroll", handleScroll);
    // Initial run
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [records, distinctYears.length]);

  // Infinite scroll IntersectionObserver hook
  useEffect(() => {
    if (loading || records.length >= totalCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !refreshing) {
          setPage(prev => prev + 1);
        }
      },
      {
        root: document.getElementById("media-scroll-container"),
        rootMargin: "300px", // prefetch 300px before reaching the bottom
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [records.length, totalCount, loading, refreshing]);

  const handleRecordUpdated = (id: number, updatedFields: Partial<MediaRecord>) => {
    setRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updatedFields } : rec));
  };

  const handleRefresh = () => {
    setSearchQuery("");
    setSelectedType(viewMode === "photos" ? "photo" : "video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
    setPage(1);
    fetchMediaData(true);
  };

  // Apple/YouTube Style Sidebar Filter Selectors
  const selectLibraryAll = () => {
    setSelectedType(viewMode === "photos" ? "photo" : "video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
  };

  const selectLibraryPhotos = () => {
    setSelectedType("photo");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
  };

  const selectLibraryRaw = () => {
    setSelectedType("photo");
    setSelectedRawOnly(true);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectLibraryVideos = () => {
    setSelectedType("video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectLibraryMemories = () => {
    setSelectedType("photo");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(true);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectAlbum = (albumName: string) => {
    setSelectedAlbum(albumName);
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
  };

  const selectVirtualAlbum = (albumName: string) => {
    setSelectedVirtualAlbum(albumName);
    setSelectedAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
  };

  const selectUnorganized = () => {
    setSelectedUnorganized(true);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
    setTriageActive(true);
  };

  const selectYoutubeReady = () => {
    setSelectedType("video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("ready");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectYoutubeDrafts = () => {
    setSelectedType("video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("draft");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedType("video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectCity = (city: string) => {
    setSelectedCity(city);
    setSelectedType(viewMode === "photos" ? "photo" : "video");
    setSelectedVolume("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectVolume = (vol: string) => {
    setSelectedVolume(vol);
    setSelectedType(viewMode === "photos" ? "photo" : "video");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedCamera("");
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectCamera = (cam: string) => {
    setSelectedCamera(cam);
    setSelectedType(viewMode === "photos" ? "photo" : "video");
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedYoutubeStatus("");
    setSelectedMemory(false);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedRawOnly(false);
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectScreenshots = () => {
    setSelectedAlbum("Screenshots");
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectAIArt = () => {
    setSelectedAlbum("AI_Art");
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectFace = (faceName: string) => {
    setSelectedFace(faceName);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFavorite(false);
    setSelectedJourneyId(null);
  };

  const selectFavorites = () => {
    setSelectedFavorite(true);
    setSelectedAlbum("");
    setSelectedVirtualAlbum("");
    setSelectedType("photo");
    setSelectedRawOnly(false);
    setSelectedMemory(false);
    setSelectedVolume("");
    setSelectedCity("");
    setSelectedCamera("");
    setSelectedFace("");
    setSelectedJourneyId(null);
    setSelectedUnorganized(false);
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;
    setCreatingAlbum(true);
    setAlbumError("");

    const criteria: any = {};
    if (newAlbumCriteriaType === "camera" && newAlbumCriteriaValue) {
      criteria.camera = newAlbumCriteriaValue;
    } else if (newAlbumCriteriaType === "city" && newAlbumCriteriaValue) {
      criteria.city = newAlbumCriteriaValue;
    }

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createAlbum",
          name: newAlbumName.trim(),
          description: newAlbumDescription.trim(),
          criteria
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create smart album");
      }

      setShowCreateAlbumModal(false);
      setNewAlbumName("");
      setNewAlbumDescription("");
      setNewAlbumCriteriaType("manual");
      setNewAlbumCriteriaValue("");
      
      // Refresh database records and metadata
      fetchMediaData(true);
    } catch (e: any) {
      setAlbumError(e.message);
    } finally {
      setCreatingAlbum(false);
    }
  };

  // Helper to get week number of the year
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Group records by selected chronological breakdown (Month, Week, or Day)
  const getGroupedRecords = (items: MediaRecord[]) => {
    const groups: { [key: string]: MediaRecord[] } = {};
    
    items.forEach((record) => {
      let groupKey = "Unknown Date";
      if (record.dateCreated) {
        const date = new Date(record.dateCreated);
        if (!isNaN(date.getTime())) {
          if (chronologyView === "month") {
            groupKey = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          } else if (chronologyView === "week") {
            const weekNum = getWeekNumber(date);
            const monthShort = date.toLocaleDateString("en-US", { month: "short" });
            groupKey = `${date.getFullYear()} — Week ${weekNum} (${monthShort})`;
          } else if (chronologyView === "day") {
            groupKey = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          }
        }
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(record);
    });
    
    return groups;
  };

  const groupedTimeline = getGroupedRecords(records);

  const getActiveSectionTitle = () => {
    const typeLabel = viewMode === "photos" ? "Photos" : "Videos";
    if (selectedMemory) return "Photos > Memories (AI Captioned)";
    if (selectedRawOnly) return "Photos > RAW Masters";
    if (selectedFavorite) return "Photos > Favorites (Hearted)";
    if (selectedAlbum === "Screenshots") return "Photos > Screenshots";
    if (selectedAlbum === "AI_Art") return "Photos > AI Generated Art";
    if (selectedAlbum) return `Photos > Album > ${selectedAlbum}`;
    if (selectedVirtualAlbum) return `Photos > Smart Album > ${selectedVirtualAlbum}`;
    if (selectedFace) return `Photos > People > ${selectedFace}`;
    if (selectedYoutubeStatus === "ready") return "YouTube Theater > Ready to Export";
    if (selectedYoutubeStatus === "draft") return "YouTube Theater > Drafts & Review";
    if (selectedCategory) return `YouTube Channels > ${selectedCategory}`;
    if (selectedCity) return `${typeLabel} > Captured Places > ${selectedCity}`;
    if (selectedVolume) return `${typeLabel} > Storage Archives > ${selectedVolume}`;
    if (selectedCamera) return `${typeLabel} > Cameras > ${selectedCamera}`;
    if (viewMode === "photos") return "Photos > Library";
    return "YouTube Theater > Videos Feed";
  };

  const allMediaCount = metaData?.totalFiles || 0;
  const photoCount = metaData?.types?.find((t: any) => t.type === "photo")?.count || 0;
  const videoCount = metaData?.types?.find((t: any) => t.type === "video")?.count || 0;
  const memoriesCount = metaData?.memoriesCount || 0;
  const rawCount = metaData?.rawCount || 0;
  const screenshotsCount = metaData?.screenshotsCount || 0;
  const aiArtCount = metaData?.aiArtCount || 0;
  const favoriteCount = metaData?.favoriteCount || 0;
  const youtubeReadyCount = metaData?.youtubeReadyCount || 0;
  const youtubeDraftCount = metaData?.youtubeDraftCount || 0;

  // --- SLIDEBOX TRIAGE INTERFACE & MECHANICS ---

  // Deletion helper: Files into a virtual album named "Trash"
  const handleTriageDelete = async () => {
    if (isSwiping || records.length === 0 || triageIndex >= records.length) return;
    const currentRecord = records[triageIndex];

    setIsSwiping(true);
    setSwipeDirection("up");

    try {
      // Find or create "Trash" virtual album
      let trashAlbum = metaData?.virtualAlbums?.find((va: any) => va.name === "Trash");
      let trashAlbumId = trashAlbum?.id;

      if (!trashAlbumId) {
        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createAlbum", name: "Trash", description: "Safe buffer for pending deletion" })
        });
        const data = await res.json();
        if (data.success) {
          trashAlbumId = data.albumId;
        } else {
          throw new Error(data.error || "Failed to create Trash album");
        }
      }

      // Add media to Trash virtual album
      const fileRes = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addMediaToAlbum", albumId: trashAlbumId, mediaIds: [currentRecord.id] })
      });
      const fileData = await fileRes.json();
      if (!fileRes.ok) {
        throw new Error(fileData.error || "Failed to file to Trash");
      }

      // Save to undo stack
      setTriageUndoStack(prev => [...prev, { record: currentRecord, actionType: "delete", albumId: trashAlbumId, albumName: "Trash" }]);

      setTimeout(() => {
        // Remove from local records array since it's now deleted/filed in Trash
        setRecords(prev => prev.filter(r => r.id !== currentRecord.id));
        setTotalCount(prev => Math.max(0, prev - 1));
        setMetaData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            unorganizedCount: Math.max(0, (prev.unorganizedCount || 0) - 1),
            virtualAlbums: prev.virtualAlbums ? prev.virtualAlbums.map((va: any) => 
              va.id === trashAlbumId ? { ...va, count: va.count + 1 } : va
            ) : []
          };
        });
        setSwipeDirection(null);
        setIsSwiping(false);
      }, 250);

    } catch (err: any) {
      alert(`Error during deletion: ${err.message}`);
      setSwipeDirection(null);
      setIsSwiping(false);
    }
  };

  // Skip helper: Cycles the skipped card to the end of the loaded records queue
  const handleTriageSkip = () => {
    if (isSwiping || records.length === 0 || triageIndex >= records.length) return;
    const currentRecord = records[triageIndex];

    setIsSwiping(true);
    setSwipeDirection("right");

    // Save to undo stack
    setTriageUndoStack(prev => [...prev, { record: currentRecord, actionType: "skip" }]);

    setTimeout(() => {
      setRecords(prev => {
        const nextRecords = [...prev];
        // Splice from current index and push to back
        const [item] = nextRecords.splice(triageIndex, 1);
        nextRecords.push(item);
        return nextRecords;
      });
      setSwipeDirection(null);
      setIsSwiping(false);
    }, 200);
  };

  // Undo helper: Reverts the last action, pulls the card back, and removes it from the album
  const handleTriageUndo = async () => {
    if (isSwiping || triageUndoStack.length === 0) return;
    const lastAction = triageUndoStack[triageUndoStack.length - 1];

    setIsSwiping(true);
    setSwipeDirection("left");

    try {
      if (lastAction.actionType === "file" || lastAction.actionType === "delete") {
        // Remove from album in DB
        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "removeMediaFromAlbum", 
            albumId: lastAction.albumId, 
            mediaIds: [lastAction.record.id] 
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to revert album filing");
        }

        // Locally update folder count
        setMetaData((prev: any) => {
          if (!prev || !prev.virtualAlbums) return prev;
          return {
            ...prev,
            unorganizedCount: (prev.unorganizedCount || 0) + 1,
            virtualAlbums: prev.virtualAlbums.map((va: any) => 
              va.id === lastAction.albumId ? { ...va, count: Math.max(0, va.count - 1) } : va
            )
          };
        });
      }

      setTimeout(() => {
        // Re-insert record back into records array at current triage index
        setRecords(prev => {
          const nextRecords = [...prev];
          
          if (lastAction.actionType === "skip") {
            // Remove from the back of the queue and insert back at triageIndex
            // Since it was pushed to the end, find its last index
            const lastIdx = nextRecords.lastIndexOf(lastAction.record);
            if (lastIdx !== -1) {
              const [item] = nextRecords.splice(lastIdx, 1);
              nextRecords.splice(triageIndex, 0, item);
            }
          } else {
            // Just insert it back
            nextRecords.splice(triageIndex, 0, lastAction.record);
          }
          return nextRecords;
        });

        // Pop from undo stack
        setTriageUndoStack(prev => prev.slice(0, -1));
        setSwipeDirection(null);
        setIsSwiping(false);
      }, 250);

    } catch (err: any) {
      alert(`Error during Undo: ${err.message}`);
      setSwipeDirection(null);
      setIsSwiping(false);
    }
  };

  // Folder Tap Filing helper
  const handleTriageFolderTap = async (album: any) => {
    if (isSwiping || records.length === 0 || triageIndex >= records.length) return;
    const currentRecord = records[triageIndex];

    setIsSwiping(true);
    setSwipeDirection("right");

    try {
      // Add photo to virtual album
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "addMediaToAlbum", 
          albumId: album.id, 
          mediaIds: [currentRecord.id] 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to file to folder");
      }

      // Save to undo stack
      setTriageUndoStack(prev => [...prev, { record: currentRecord, actionType: "file", albumId: album.id, albumName: album.name }]);

      setTimeout(() => {
        // Remove from local records array (filed and organized!)
        setRecords(prev => prev.filter(r => r.id !== currentRecord.id));
        setTotalCount(prev => Math.max(0, prev - 1));
        setMetaData((prev: any) => {
          if (!prev || !prev.virtualAlbums) return prev;
          return {
            ...prev,
            unorganizedCount: Math.max(0, (prev.unorganizedCount || 0) - 1),
            virtualAlbums: prev.virtualAlbums.map((va: any) => 
              va.id === album.id ? { ...va, count: va.count + 1 } : va
            )
          };
        });
        setSwipeDirection(null);
        setIsSwiping(false);
      }, 200);

    } catch (err: any) {
      alert(`Error filing to folder: ${err.message}`);
      setSwipeDirection(null);
      setIsSwiping(false);
    }
  };

  // Hotkey listener for triage keyboard controls
  useEffect(() => {
    if (!triageActive) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      switch (e.key) {
        case "ArrowLeft":
        case "u":
        case "U":
          e.preventDefault();
          handleTriageUndo();
          break;
        case "ArrowRight":
        case "Spacebar":
        case " ":
        case "s":
        case "S":
          e.preventDefault();
          handleTriageSkip();
          break;
        case "ArrowUp":
        case "Backspace":
        case "Delete":
        case "d":
        case "D":
          e.preventDefault();
          handleTriageDelete();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triageActive, triageIndex, records, triageUndoStack, isSwiping, metaData]);

  // Main UI Renderer for Triage Deck
  const renderTriageDeck = () => {
    const isCompleted = records.length > 0 && triageIndex >= records.length;
    const hasNoItems = records.length === 0;

    // Filter virtual albums to find only the manual Folders, sorted alphabetically
    const manualFolders = (metaData?.virtualAlbums || [])
      .filter((va: any) => {
        try {
          const crit = JSON.parse(va.criteria_json || '{}');
          return (crit.source === 'ApplePhotos' || va.criteria_json === '{}' || !crit.source) && va.name !== 'Trash';
        } catch (e) {
          return va.name !== 'Trash';
        }
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Filter folder list based on search query
    const filteredFolders = manualFolders.filter((folder: any) =>
      folder.name.toLowerCase().includes(folderFilter.toLowerCase())
    );

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "rgba(9, 9, 11, 0.3)" }}>
        {/* Triage Mode Custom Header Banner */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-background/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              <Shuffle size={16} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white tracking-wide">Slidebox Triage Deck</h2>
              <p className="text-[10px] text-text-muted font-medium">
                Active Cohort: <span className="text-text-secondary font-semibold">{selectedUnorganized ? "Unorganized Photos" : getActiveSectionTitle()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Safe Deletion Switch */}
            <div className="flex items-center gap-2 bg-surface/60 border border-white/[0.04] px-3.5 py-1.5 rounded-xl backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Delete Physical Files</span>
              <button
                onClick={() => setDeletePhysical(prev => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  deletePhysical ? "bg-red-500" : "bg-surface-hover"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    deletePhysical ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Exit Triage Button */}
            <button
              onClick={() => {
                setTriageActive(false);
                setSelectedUnorganized(false);
                selectLibraryPhotos();
              }}
              className="px-3.5 py-1.5 bg-surface hover:bg-surface-elevated border border-white/[0.05] text-[10px] font-bold text-text-secondary hover:text-white rounded-xl shadow-sm cursor-pointer transition-all hover:scale-102 active:scale-98"
            >
              Exit Triage
            </button>
          </div>
        </div>

        {/* Triage Body Workspace split layout */}
        <div className="flex-1 flex items-center justify-center p-6 relative select-none overflow-hidden bg-background/10">
          {hasNoItems ? (
            <div className="flex flex-col items-center text-center p-12 max-w-sm rounded-3xl border border-white/[0.04] bg-background/20 backdrop-blur-xl animate-fade-in shadow-xl">
              <FolderOpen size={44} className="text-text-dim mb-4" />
              <h4 className="text-[14px] font-bold text-white">Empty Triage Deck</h4>
              <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                No unorganized photos remaining in your library. You have successfully sorted everything into folders!
              </p>
            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-center text-center p-12 max-w-sm rounded-3xl border border-white/[0.04] bg-background/20 backdrop-blur-xl animate-fade-in shadow-xl">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                <CheckCircle size={24} />
              </div>
              <h4 className="text-[14px] font-bold text-white">Session Complete!</h4>
              <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                You have reviewed all photos loaded in this session. Select another folder or import more photos to keep organizing.
              </p>
              <button
                onClick={() => setTriageIndex(0)}
                className="mt-5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-[11px] font-bold rounded-xl cursor-pointer shadow-md transition-all duration-150"
              >
                Review Cohort Again
              </button>
            </div>
          ) : (() => {
            const record = records[triageIndex];
            
            // CSS Transition direction mappings
            let swipeClass = "transform translate-x-0 translate-y-0 opacity-100 rotate-0 scale-100 transition-all duration-200";
            if (isSwiping) {
              if (swipeDirection === "up") {
                swipeClass = "transform -translate-y-[150%] opacity-0 rotate-[-12deg] scale-95 transition-all duration-300";
              } else if (swipeDirection === "down") {
                swipeClass = "transform translate-y-[150%] opacity-0 rotate-[12deg] scale-95 transition-all duration-300";
              } else if (swipeDirection === "left") {
                swipeClass = "transform -translate-x-[150%] opacity-0 rotate-[-8deg] scale-95 transition-all duration-200";
              } else if (swipeDirection === "right") {
                swipeClass = "transform translate-x-[150%] opacity-0 rotate-[8deg] scale-95 transition-all duration-200";
              }
            }

            return (
              <div className="flex flex-row gap-8 items-stretch w-full max-w-6xl h-full max-h-[75vh] overflow-hidden">
                
                {/* Left Side: Photo Card + Navigation buttons (Undo, Skip, Delete) */}
                <div className="flex-[3] flex flex-col justify-between items-center gap-4 overflow-hidden">
                  
                  {/* Immersive Photo Card Container */}
                  <div 
                    className={`w-full flex-1 min-h-0 flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-background/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-xl ${swipeClass}`}
                  >
                    {/* Streaming viewport image */}
                    <div className="flex-1 w-full h-full relative overflow-hidden bg-black flex items-center justify-center p-2">
                      <img 
                        src={`/api/media/stream?id=${record.id}`}
                        alt={record.filename}
                        className="max-w-full max-h-full object-contain select-none pointer-events-none rounded-xl"
                      />
                      
                      {/* Glowing swipe overlay status indicators */}
                      {isSwiping && swipeDirection === "up" && (
                        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/30 rounded-3xl animate-pulse">
                          <div className="px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md text-[14px] uppercase tracking-wider font-extrabold shadow-lg">Trash</div>
                        </div>
                      )}
                      {isSwiping && (swipeDirection === "right") && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30 rounded-3xl animate-pulse">
                          <div className="px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md text-[14px] uppercase tracking-wider font-extrabold shadow-lg flex items-center gap-1.5">
                            Filed!
                          </div>
                        </div>
                      )}
                      {isSwiping && swipeDirection === "left" && (
                        <div className="absolute inset-0 bg-text-dim/10 flex items-center justify-center text-text-secondary font-bold border border-white/20 rounded-3xl animate-pulse">
                          <div className="px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md text-[14px] uppercase tracking-wider font-extrabold shadow-lg">
                            Undo...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Glassmorphic Metadata Overlay Panel */}
                    <div className="px-5 py-3.5 bg-background/70 border-t border-white/[0.04] backdrop-blur-md shrink-0 flex items-center justify-between text-left">
                      <div className="space-y-0.5 overflow-hidden pr-4">
                        <div className="text-[11px] font-bold text-white tracking-wide truncate">{record.filename}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-text-muted font-semibold">
                          {record.dateCreated && (
                            <span>📅 {new Date(record.dateCreated).toLocaleDateString()}</span>
                          )}
                          {record.city && (
                            <span className="text-orange-400">📍 {record.city}</span>
                          )}
                          {record.camera && (
                            <span>📷 {record.camera}</span>
                          )}
                          <span>💾 {(record.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sleek Navigation Bar directly under the photo */}
                  <div className="w-full flex items-center justify-between bg-background/40 border border-white/[0.04] rounded-2xl px-5 py-3.5 backdrop-blur-md shrink-0 shadow-lg">
                    {/* Undo button */}
                    <button
                      onClick={handleTriageUndo}
                      disabled={triageUndoStack.length === 0}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all border cursor-pointer select-none ${
                        triageUndoStack.length === 0
                          ? "bg-surface/20 border-white/[0.02] text-text-dim cursor-not-allowed"
                          : "bg-surface hover:bg-surface-elevated border-white/[0.05] text-text-secondary hover:text-white active:scale-95"
                      }`}
                      title="Undo last action (Key: U)"
                    >
                      <RotateCcw size={13} />
                      Undo
                    </button>

                    {/* Skip button */}
                    <button
                      onClick={handleTriageSkip}
                      className="flex items-center gap-2 px-5 py-2.5 bg-surface hover:bg-surface-elevated border border-white/[0.05] text-text-secondary hover:text-white rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer select-none active:scale-95"
                      title="Skip and return in loop later (Key: Space or S)"
                    >
                      Skip
                      <SkipForward size={13} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={handleTriageDelete}
                      className="flex items-center gap-2 px-4 py-2 bg-red-950/20 hover:bg-red-500 hover:text-black border border-red-500/20 hover:border-red-400 text-red-500 rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer select-none active:scale-95 animate-pulse"
                      title="Move to Trash folder (Key: Delete or D)"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>

                  {/* Progress Indicator */}
                  <div className="w-full shrink-0 space-y-1.5 px-1">
                    <div className="flex items-center justify-between text-[9px] font-extrabold text-text-muted tracking-wider uppercase">
                      <span>Organizing Deck</span>
                      <span className="font-mono text-text-dim">{Math.round(((triageIndex) / records.length) * 100)}% Done</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-surface border border-white/[0.02] overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        style={{ width: `${((triageIndex) / records.length) * 100}%` }}
                      />
                    </div>
                  </div>

                </div>

                {/* Right Side: Folders search & scrollable tap list */}
                <div className="flex-[2] flex flex-col gap-4 bg-background/25 border border-white/[0.05] p-5 rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                  
                  {/* Search / Filter for folders */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[12px] font-bold text-white uppercase tracking-wider">File into Folder</h3>
                      <button
                        onClick={() => setShowCreateAlbumModal(true)}
                        className="p-1 px-2 rounded-lg bg-surface hover:bg-surface-elevated border border-white/[0.05] text-[9px] font-bold text-text-secondary hover:text-white transition-all select-none"
                        title="Create a new album folder"
                      >
                        + New Folder
                      </button>
                    </div>
                    
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-2.5 text-text-muted" />
                      <input
                        type="text"
                        placeholder="Search folders..."
                        value={folderFilter}
                        onChange={(e) => setFolderFilter(e.target.value)}
                        className="w-full text-[11px] pl-8 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/20 bg-surface/60 border border-white/[0.05] text-white"
                      />
                    </div>
                  </div>

                  {/* Alphabetical list grid */}
                  <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5 space-y-1">
                    {filteredFolders.length > 0 ? (
                      filteredFolders.map((folder: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleTriageFolderTap(folder)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/[0.02] bg-surface/20 hover:bg-amber-500 hover:text-black hover:border-amber-400 transition-all duration-100 cursor-pointer active:scale-[0.98] select-none text-left group"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <Folder size={13} className="text-text-muted group-hover:text-black shrink-0" />
                            <span className="text-[11px] font-bold truncate tracking-wide">{folder.name}</span>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-surface/60 text-text-secondary border border-white/[0.02] group-hover:bg-black/20 group-hover:text-black group-hover:border-black/5 shrink-0">
                            {folder.count}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/[0.04] rounded-2xl">
                        <FolderOpen size={20} className="text-text-dim mb-1.5" />
                        <span className="text-[10px] text-text-muted font-semibold italic">No folders match "{folderFilter}"</span>
                      </div>
                    )}
                  </div>

                  {/* Desktop Hotkey Legend */}
                  <div className="p-3 bg-surface/20 border border-white/[0.02] rounded-2xl text-[9px] font-bold text-text-muted tracking-wider uppercase space-y-1 shrink-0">
                    <div className="flex justify-between">
                      <span>Undo Action:</span>
                      <span className="text-text-secondary font-mono">← Arrow / U</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Skip Photo:</span>
                      <span className="text-text-secondary font-mono">→ Arrow / Space / S</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delete Safe Buffer:</span>
                      <span className="text-text-secondary font-mono">↑ Arrow / Del / D</span>
                    </div>
                  </div>

                </div>

              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderJourneyScrapbook = () => {
    if (loadingJourney) {
      return (
        <div className="flex-1 flex flex-col justify-center items-center h-full text-[var(--color-text-dim)] font-mono text-[12px] uppercase gap-3">
          <RefreshCw size={24} className="animate-spin text-emerald-400" />
          Analyzing spatial travelogues...
        </div>
      );
    }

    if (!journeyDetails) {
      return (
        <div className="flex-1 flex flex-col justify-center items-center text-center p-12 text-[var(--color-text-dim)]">
          <AlertCircle size={48} className="text-gray-600 mb-4" />
          <h4 className="text-[14px] font-bold text-[var(--color-text-primary)]">No Details Available</h4>
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
      <div className="flex-1 flex overflow-hidden w-full h-full text-white bg-background screen-only-layout">
        
        {/* Left Side: Map-First Spatial Navigation View */}
        <div className="w-[45%] shrink-0 border-r border-white/[0.04] p-6 flex flex-col gap-6 bg-background/80 scroll-mt-24 select-none print:hidden">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sovereign Relive Trail
            </span>
            <h3 className="text-[16px] font-bold tracking-tight text-white mt-1">Spatial Route Navigation</h3>
            <p className="text-[11px] text-text-muted mt-1">
              Locations act as the main navigation anchor. Click on any city to skip directly to its day logs.
            </p>
          </div>

          <div 
            className="flex-1 rounded-2xl border border-white/[0.05] relative flex items-center justify-center overflow-hidden aspect-square bg-background/60 backdrop-blur-sm shadow-inner"
            style={{ minHeight: "360px" }}
          >
            {projectedPoints.length > 0 ? (
              <svg className="w-full h-full max-w-[400px] max-h-[400px]" viewBox="0 0 400 400">
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
        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-background/20" id="scrapbook-scroll-pane">
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-white/[0.04]">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-white flex items-center gap-2">
                <Map size={18} className="text-emerald-400" />
                {journeyDetails.name}
              </h2>
              <p className="text-[11px] text-text-muted font-medium mt-1">
                {journeyDetails.startDate} to {journeyDetails.endDate} • {journeyDetails.photoCount} assets • with {journeyDetails.people.length > 0 ? journeyDetails.people.join(", ") : "myself"}
              </p>
            </div>
            
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-[11px] font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              Print Memoir Book
            </button>
          </div>

          {/* Day-by-Day scroll list */}
          <div className="space-y-12">
            {journeyDetails.itinerary.map((day: any) => {
              const charCount = (essences[day.dayIndex] || "").length;
              const isOverLimit = charCount > 30;

              return (
                <div 
                  key={day.dayIndex} 
                  id={`journey-day-${day.dayIndex}`}
                  className="p-6 rounded-2xl border border-white/[0.04] bg-surface/10 hover:bg-surface/20 transition-all duration-300 space-y-6 scroll-mt-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-[14px] font-bold text-emerald-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Day {day.dayIndex} — {day.displayDate}
                      </h4>
                      {day.cities.length > 0 && (
                        <span className="text-[10px] text-text-muted block font-semibold mt-1">
                          📍 {day.cities.join(" • ")}
                        </span>
                      )}
                    </div>

                    {day.vitals.sleep_hours && (
                      <div className="flex items-center gap-3 px-3 py-1 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[10px]">
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
                        className="flex-1 text-[12px] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/20 font-semibold"
                        style={{ 
                          background: "rgba(24, 24, 27, 0.6)", 
                          border: `1px solid ${isOverLimit ? "rgba(239, 68, 68, 0.4)" : "rgba(255,255,255,0.06)"}`,
                          color: "white"
                        }}
                      />
                      <button
                        disabled={savingNarrative[day.dayIndex] || isOverLimit}
                        onClick={() => handleSaveDayReflections(day.dayIndex, true)}
                        className="px-3.5 py-1 bg-surface-elevated hover:bg-surface-elevated border border-white/[0.04] text-[11px] font-bold text-text-secondary hover:text-white rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center cursor-pointer disabled:opacity-40"
                      >
                        {savingNarrative[day.dayIndex] ? "Weaving..." : "AI Storyteller"}
                      </button>
                    </div>
                  </div>

                  {day.photos.length > 0 && (
                    <div 
                      className="flex items-center gap-3 overflow-x-auto py-1 no-scrollbar shrink-0 select-none cursor-grab active:cursor-grabbing"
                      style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                    >
                      {day.photos.map((record: any) => {
                        const absoluteIndex = records.findIndex(r => r.id === record.id);
                        return (
                          <div 
                            key={record.id} 
                            onClick={() => { if (absoluteIndex !== -1) setLightboxIndex(absoluteIndex); }}
                            className="w-[110px] aspect-square rounded-lg overflow-hidden border border-white/[0.04] shrink-0 hover:scale-103 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer bg-background"
                          >
                            <img 
                              src={`/api/media/stream?id=${record.id}`} 
                              alt={record.filename} 
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        );
                      })}
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
                      className="w-full text-[12px] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/20 font-semibold resize-none"
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
                      className="px-3.5 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-white/[0.04] text-[10px] font-bold text-emerald-400 hover:text-emerald-300 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-40"
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
    <div className="flex flex-col h-screen overflow-hidden page-container animate-fade-in" style={{ padding: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 shrink-0 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/10 text-orange-500">
            <FolderOpen size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Memories & Archives</h1>
            <p className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>
              Sovereign gallery catalog & local streaming player
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--color-surface-elevated)] border" 
            style={{ color: "var(--color-text-dim)", borderColor: "var(--color-border)" }}
            title="Reload Media"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Stats Header Ribbon */}
      {!loading && metaData && (
        <div className="grid grid-cols-4 gap-4 px-6 py-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-background-elevated)" }}>
          {[
            { label: "Total Storage Volume", value: formatBytes(metaData.totalBytes), icon: Database, color: "#3b82f6" },
            { label: "Total Indexed Media", value: allMediaCount.toLocaleString(), icon: File, color: "#a855f7" },
            { label: "AI Captioned Memories", value: memoriesCount.toLocaleString(), icon: Sparkles, color: "#f97316" },
            { label: "Geotagged Locations", value: metaData.geotagged?.toLocaleString() || "0", icon: MapPin, color: "#34d399" },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={15} />
              </div>
              <div>
                <div className="text-[11px] font-medium" style={{ color: "var(--color-text-dim)" }}>{stat.label}</div>
                <div className="text-[15px] font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dual Pane Layout */}
      <div className="flex-1 flex overflow-hidden" style={{ background: "var(--color-background)" }}>
        
        {/* Left Sidebar Navigation Pane */}
        <div className="w-[280px] shrink-0 border-r flex flex-col p-4 gap-5 overflow-y-auto bg-surface/10" style={{ borderColor: "var(--color-border)" }}>
          
          {/* Search Box */}
          <div className="space-y-1.5 px-1">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-text-muted" />
              <input 
                type="text"
                placeholder="Search name, city, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[12px] pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                style={{ 
                  background: "var(--color-surface)", 
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)"
                }}
              />
            </div>
          </div>



          {viewMode === "photos" && (
            <>
              {/* Library Section */}
              <div className="space-y-0.5">
                <h3 className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-text-muted uppercase">Library</h3>
                <SidebarItem 
                  icon={ImageIcon} 
                  label="Photos" 
                  count={photoCount} 
                  active={selectedType === "photo" && !selectedRawOnly && !selectedMemory && !selectedAlbum && !selectedVirtualAlbum && !selectedCity && !selectedVolume && !selectedCamera && !selectedFace && !selectedFavorite && !selectedUnorganized} 
                  onClick={() => {
                    setTriageActive(false);
                    selectLibraryPhotos();
                  }} 
                  activeColor="text-orange-500"
                />
                <SidebarItem 
                  icon={Shuffle} 
                  label="Unorganized" 
                  count={metaData?.unorganizedCount || 0} 
                  active={selectedUnorganized} 
                  onClick={selectUnorganized} 
                  activeColor="text-emerald-400"
                />
              </div>

              {/* Folders Section */}
              {(() => {
                const manualAlbums = (metaData?.virtualAlbums || [])
                  .filter((va: any) => {
                    try {
                      const crit = JSON.parse(va.criteria_json || '{}');
                      return (crit.source === 'ApplePhotos' || va.criteria_json === '{}' || !crit.source) && va.name !== 'Trash';
                    } catch (e) {
                      return va.name !== 'Trash';
                    }
                  })
                  .sort((a: any, b: any) => a.name.localeCompare(b.name));

                return (
                  <SidebarSection 
                    title="Folders" 
                    isOpen={albumsOpen} 
                    onToggle={() => setAlbumsOpen(!albumsOpen)}
                  >
                    {manualAlbums.map((va: any, i: number) => (
                      <SidebarItem 
                        key={i}
                        icon={Folder}
                        label={va.name}
                        count={va.count}
                        active={selectedVirtualAlbum === va.name}
                        onClick={() => selectVirtualAlbum(va.name)}
                        activeColor="text-amber-400"
                      />
                    ))}
                  </SidebarSection>
                );
              })()}
            </>
          )}
        </div>

        {/* Gallery / Feed Panel Wrapper */}
        <div className="flex-1 relative flex overflow-hidden">
          
          <style dangerouslySetInnerHTML={{ __html: `
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          ` }} />

          {selectedJourneyId ? (
            renderJourneyScrapbook()
          ) : triageActive ? (
            renderTriageDeck()
          ) : (
            <>
              {/* Gallery / Feed Panel */}
              <div 
                id="media-scroll-container"
                className="flex-1 overflow-y-auto p-6 space-y-8 flex flex-col justify-between" 
                style={{ scrollbarGutter: "stable" }}
              >
                {loading ? (
                  <div className="flex-1 flex flex-col justify-center items-center h-full text-[var(--color-text-dim)] font-mono text-[12px] uppercase gap-3">
                    <RefreshCw size={24} className="animate-spin text-orange-500" />
                    Scanning media index...
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-12 text-[var(--color-text-dim)]">
                    <FolderOpen size={48} className="text-gray-600 mb-4 animate-pulse" />
                    <h4 className="text-[14px] font-bold text-[var(--color-text-primary)]">No Media Found</h4>
                    <p className="text-[12px] mt-1 max-w-sm">
                      No matching media files were found in this section. Try relaxing your search query or filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8 flex-1">
                    
                    {/* Header Feed Banner */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                      <div>
                        <h2 className="text-[16px] font-bold tracking-tight text-white capitalize">
                          {getActiveSectionTitle()}
                        </h2>
                        <p className="text-[11px] text-text-muted font-medium">
                          Showing {records.length} of {totalCount} matching items
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Chronology Switcher */}
                        {(viewMode === "photos" && (selectedType === "photo" || !selectedType) && !selectedRawOnly && !selectedMemory && !selectedCity && !selectedVolume && !selectedCamera && !selectedFace && !selectedFavorite && (!selectedAlbum || /^\d{4}$/.test(selectedAlbum))) && (
                          <div className="flex items-center bg-surface/60 border border-white/[0.04] p-0.5 rounded-lg shadow-inner backdrop-blur-md">
                            <button
                              onClick={() => setChronologyView("month")}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-150 ${
                                chronologyView === "month"
                                  ? "bg-orange-500 text-white shadow-sm"
                                  : "text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Month
                            </button>
                            <button
                              onClick={() => setChronologyView("week")}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-150 ${
                                chronologyView === "week"
                                  ? "bg-orange-500 text-white shadow-sm"
                                  : "text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Week
                            </button>
                            <button
                              onClick={() => setChronologyView("day")}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-150 ${
                                chronologyView === "day"
                                  ? "bg-orange-500 text-white shadow-sm"
                                  : "text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Day
                            </button>
                          </div>
                        )}

                        {/* Reset Filters Button */}
                        {(searchQuery || selectedType || selectedVolume || selectedCity || selectedCategory || selectedYoutubeStatus || selectedMemory || selectedCamera || selectedAlbum || selectedVirtualAlbum || selectedRawOnly || selectedFace || selectedFavorite) && (
                          <button 
                            onClick={handleRefresh}
                            className="text-[11px] text-orange-500 hover:text-orange-400 font-semibold flex items-center gap-1 transition-colors"
                          >
                            <SlidersHorizontal size={11} />
                            Reset Filters
                          </button>
                        )}

                        {/* Apple Photos Sync Button */}
                        <button
                          onClick={() => setShowSyncModal(true)}
                          className="px-3 py-1.5 bg-surface-elevated/60 hover:bg-surface-elevated border border-white/[0.05] text-[10px] font-bold text-text-secondary hover:text-white rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer backdrop-blur-md"
                        >
                          <RefreshCw size={11} className={syncingApple ? "animate-spin text-orange-500" : "text-orange-500"} />
                          Sync
                        </button>
                      </div>
                    </div>

                    {/* Interactive Search Capsule Ribbon */}
                    <div 
                      className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0 select-none"
                      style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                    >
                      {[
                        { 
                          label: "❤️ Favorites", 
                          active: selectedFavorite, 
                          onClick: () => {
                            if (selectedFavorite) {
                              setSelectedFavorite(false);
                            } else {
                              selectFavorites();
                            }
                          }
                        },
                        { 
                          label: "📸 RAW Masters", 
                          active: selectedRawOnly, 
                          onClick: () => {
                            if (selectedRawOnly) {
                              setSelectedRawOnly(false);
                            } else {
                              selectLibraryRaw();
                            }
                          }
                        },
                        { 
                          label: "💻 Screenshots", 
                          active: selectedAlbum === "Screenshots", 
                          onClick: () => {
                            if (selectedAlbum === "Screenshots") {
                              setSelectedAlbum("");
                            } else {
                              selectScreenshots();
                            }
                          }
                        },
                        { 
                          label: "✨ AI Art", 
                          active: selectedAlbum === "AI_Art", 
                          onClick: () => {
                            if (selectedAlbum === "AI_Art") {
                              setSelectedAlbum("");
                            } else {
                              selectAIArt();
                            }
                          }
                        },
                        { 
                          label: "🧠 Memories", 
                          active: selectedMemory, 
                          onClick: () => {
                            if (selectedMemory) {
                              setSelectedMemory(false);
                            } else {
                              selectLibraryMemories();
                            }
                          }
                        },
                        ...(metaData?.people?.slice(0, 3).map((p: any) => ({
                          label: `👤 ${p.name}`,
                          active: selectedFace === p.name,
                          onClick: () => {
                            if (selectedFace === p.name) {
                              setSelectedFace("");
                            } else {
                              selectFace(p.name);
                            }
                          }
                        })) || []),
                        ...(metaData?.cities?.slice(0, 2).map((c: any) => ({
                          label: `📍 ${c.city}`,
                          active: selectedCity === c.city,
                          onClick: () => {
                            if (selectedCity === c.city) {
                              setSelectedCity("");
                            } else {
                              selectCity(c.city);
                            }
                          }
                        })) || [])
                      ].map((capsule, i) => (
                        <button
                          key={i}
                          onClick={capsule.onClick}
                          className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 whitespace-nowrap border flex items-center gap-1.5 hover:scale-102 active:scale-98 cursor-pointer ${
                            capsule.active
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_2px_10px_rgba(249,115,22,0.15)]"
                              : "bg-surface/60 hover:bg-surface-elevated/80 text-text-secondary hover:text-text-primary border-white/[0.04]"
                          }`}
                        >
                          {capsule.label}
                        </button>
                      ))}
                    </div>

                    {/* Timeline month-by-month */}
                    {(() => {
                      const seenYears = new Set<string>();
                      
                      return Object.keys(groupedTimeline).map((monthYear) => {
                        const items = groupedTimeline[monthYear];
                        const year = monthYear.split(" ").pop();
                        const isFirstOfYear = year && !seenYears.has(year) && !isNaN(parseInt(year, 10));
                        if (year) seenYears.add(year);

                        return (
                          <div 
                            key={monthYear} 
                            className="space-y-4 scroll-mt-24"
                            id={isFirstOfYear ? `header-${year}` : undefined}
                          >
                            {/* Sticky chronological month-by-month header */}
                            <div className="sticky top-[-24px] z-20 backdrop-blur-md bg-background/80 px-4 py-2.5 rounded-xl border border-white/[0.04] flex items-center justify-between shadow-sm">
                              <h3 className="text-[13px] font-bold tracking-tight text-orange-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                {monthYear}
                              </h3>
                              <span className="text-[10px] font-mono text-text-muted bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.02]">
                                {items.length} file{items.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            
                            {/* Media Grid */}
                            <div className={
                              viewMode === "photos" 
                                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 rounded-xl overflow-hidden" 
                                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            }>
                              {items.map((record) => {
                                const absoluteIndex = records.findIndex(r => r.id === record.id);
                                
                                return record.type === "video" ? (
                                  <VideoCard 
                                    key={record.id}
                                    record={record}
                                    onClick={() => setLightboxIndex(absoluteIndex)}
                                  />
                                ) : (
                                  <PhotoCard 
                                    key={record.id}
                                    record={record}
                                    onClick={() => setLightboxIndex(absoluteIndex)}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Sentinel for Infinite Scroll */}
                    {records.length < totalCount && (
                      <div ref={sentinelRef} className="w-full h-16 flex items-center justify-center text-text-muted font-mono text-[11px] uppercase tracking-wider py-8">
                        <RefreshCw size={14} className="animate-spin text-orange-500 mr-2" />
                        Loading more memories...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vertical Floating Year Slider */}
              {distinctYears.length > 1 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 p-2 rounded-full bg-background/60 hover:bg-background/80 border border-white/[0.05] backdrop-blur-md shadow-2xl transition-all duration-300 pointer-events-auto select-none">
                  {distinctYears.map((year) => {
                    const isActive = activeYear === year;
                    return (
                      <button
                        key={year}
                        onClick={() => {
                          setActiveYear(year);
                          document.getElementById(`header-${year}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all duration-200 cursor-pointer ${
                          isActive 
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md scale-110" 
                            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40"
                        }`}
                        title={`Jump to ${year}`}
                      >
                        {year.substring(2)}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Zenith Immersive Lightbox Modal */}
      {lightboxIndex !== null && (
        <ZenithLightbox 
          records={records}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onRecordUpdated={handleRecordUpdated}
          virtualAlbums={metaData?.virtualAlbums || []}
        />
      )}

      {/* Album Creation Modal */}
      {showCreateAlbumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div 
            className="w-full max-w-md p-6 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 animate-fade-in"
            style={{ background: "rgba(24, 24, 27, 0.9)", backdropFilter: "blur(16px)" }}
          >
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-orange-500" />
                Create Smart Virtual Album
              </h3>
              <p className="text-[11px] text-text-secondary mt-1">
                Define a relational collection or a dynamic photo tag group.
              </p>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Album Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Morrison Summer 2016"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  className="w-full text-[12px] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30 font-semibold"
                  style={{ 
                    background: "rgba(39, 39, 42, 0.6)", 
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "white"
                  }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Description</label>
                <textarea 
                  placeholder="What is this collection about?"
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  rows={2}
                  className="w-full text-[12px] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30 resize-none font-semibold"
                  style={{ 
                    background: "rgba(39, 39, 42, 0.6)", 
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "white"
                  }}
                />
              </div>

              {/* Rule Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Criteria Rule</label>
                <select 
                  value={newAlbumCriteriaType}
                  onChange={(e) => {
                    setNewAlbumCriteriaType(e.target.value);
                    setNewAlbumCriteriaValue("");
                  }}
                  className="w-full text-[12px] px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30 cursor-pointer font-semibold"
                  style={{ 
                    background: "rgba(39, 39, 42, 0.6)", 
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "white"
                  }}
                >
                  <option value="manual" className="bg-background">Manual Selection (Custom Group)</option>
                  <option value="camera" className="bg-background">Filter by Camera Profile</option>
                  <option value="city" className="bg-background">Filter by Geotagged City</option>
                </select>
              </div>

              {/* Dynamic Criteria Values */}
              {newAlbumCriteriaType === "camera" && metaData?.cameras && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Select Camera</label>
                  <select 
                    value={newAlbumCriteriaValue}
                    onChange={(e) => setNewAlbumCriteriaValue(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30 cursor-pointer font-semibold"
                    style={{ 
                      background: "rgba(39, 39, 42, 0.6)", 
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "white"
                    }}
                  >
                    <option value="" className="bg-background">Select a camera...</option>
                    {metaData.cameras.map((c: any, idx: number) => (
                      <option key={idx} value={c.camera} className="bg-background">{c.camera} ({c.count} items)</option>
                    ))}
                  </select>
                </div>
              )}

              {newAlbumCriteriaType === "city" && metaData?.cities && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Select City</label>
                  <select 
                    value={newAlbumCriteriaValue}
                    onChange={(e) => setNewAlbumCriteriaValue(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/30 cursor-pointer font-semibold"
                    style={{ 
                      background: "rgba(39, 39, 42, 0.6)", 
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "white"
                    }}
                  >
                    <option value="" className="bg-background">Select a city...</option>
                    {metaData.cities.map((c: any, idx: number) => (
                      <option key={idx} value={c.city} className="bg-background">{c.city}, {c.country} ({c.count} items)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {albumError && (
              <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg flex items-center gap-1.5 font-semibold">
                <AlertCircle size={12} />
                {albumError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                onClick={() => {
                  setShowCreateAlbumModal(false);
                  setNewAlbumName("");
                  setNewAlbumDescription("");
                  setNewAlbumCriteriaType("manual");
                  setNewAlbumCriteriaValue("");
                  setAlbumError("");
                }}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-text-secondary hover:text-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateAlbum}
                disabled={creatingAlbum || !newAlbumName}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-[12px] rounded-xl transition-all shadow-md disabled:opacity-40"
              >
                {creatingAlbum ? "Creating..." : "Create Smart Album"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple Photos Sync Control Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div 
            className="w-full max-w-md p-6 rounded-3xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-4 animate-scale-up"
            style={{ background: "rgba(20, 20, 22, 0.9)", backdropFilter: "blur(20px)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-orange-500 animate-pulse" />
                Apple Photos Synchronization
              </h3>
              <button 
                onClick={() => setShowSyncModal(false)}
                className="text-text-muted hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-text-secondary">
              Synchronize Apple Photos albums, favorites, facial identities, and reverse-geocoded places with your local catalog.
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2.5 text-[11px] text-text-secondary font-semibold cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={useSystemLibrary}
                  onChange={(e) => setUseSystemLibrary(e.target.checked)}
                  className="rounded border-border text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                Use Local Database Copy
              </label>

              {!useSystemLibrary && (
                <div className="space-y-1 animate-fade-in">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Legacy Library Path</span>
                  <input 
                    type="text"
                    placeholder="e.g. /Volumes/Backup/Photos.sqlite"
                    value={customLibraryPath}
                    onChange={(e) => setCustomLibraryPath(e.target.value)}
                    className="w-full text-[12px] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/20 font-semibold"
                    style={{ 
                      background: "rgba(39, 39, 42, 0.4)", 
                      border: "1px solid rgba(255,255,255,0.05)",
                      color: "white"
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  disabled={syncingApple}
                  onClick={() => triggerApplePhotosSync(true)}
                  className="px-4 py-2.5 bg-surface-elevated hover:bg-surface-elevated border border-white/[0.04] text-[11px] font-bold text-text-secondary hover:text-white rounded-xl transition-all text-center cursor-pointer disabled:opacity-40"
                >
                  Dry Run
                </button>
                <button
                  disabled={syncingApple}
                  onClick={() => triggerApplePhotosSync(false)}
                  className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-[11px] font-bold text-white rounded-xl transition-all shadow-sm text-center cursor-pointer disabled:opacity-40"
                >
                  Sync Live
                </button>
              </div>
            </div>

            {syncMessage && (
              <div className="text-[11px] text-orange-400 bg-orange-500/5 border border-orange-500/10 px-3.5 py-2 rounded-xl flex items-start gap-2 font-semibold animate-fade-in max-h-32 overflow-y-auto">
                <RefreshCw size={12} className="animate-spin text-orange-500 shrink-0 mt-0.5" />
                <span>{syncMessage}</span>
              </div>
            )}

            {syncError && (
              <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/10 px-3.5 py-2 rounded-xl flex items-start gap-2 font-semibold animate-fade-in">
                <AlertCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                <span>{syncError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-white/[0.04]">
              <button 
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 bg-surface border border-white/[0.05] hover:bg-surface-elevated rounded-xl text-[12px] font-semibold text-text-secondary hover:text-white transition-all cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
