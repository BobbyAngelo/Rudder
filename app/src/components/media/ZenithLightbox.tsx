"use client";

import { useEffect, useState, useRef } from "react";
import { 
  X, ChevronLeft, ChevronRight, Info, Calendar, HardDrive, 
  MapPin, Camera, Play, Pause, Volume2, VolumeX, Eye, EyeOff, Film,
  Edit3, Save, RotateCcw, Tag
} from "lucide-react";

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
}

interface ZenithLightboxProps {
  records: MediaRecord[];
  initialIndex: number;
  onClose: () => void;
  onRecordUpdated?: (id: number, updatedFields: Partial<MediaRecord>) => void;
  virtualAlbums?: Array<{ id: number; name: string; count: number }>;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function ZenithLightbox({ records, initialIndex, onClose, onRecordUpdated, virtualAlbums }: ZenithLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMeta, setShowMeta] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [sidebarTab, setSidebarTab] = useState<"meta" | "queue">("meta");
  const [updatingAlbums, setUpdatingAlbums] = useState<string | null>(null);
  
  // Edit State
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editUserTags, setEditUserTags] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("Science & Technology");
  const [editLicense, setEditLicense] = useState("youtube");
  const [editPrivacyStatus, setEditPrivacyStatus] = useState("private");
  const [editMadeForKids, setEditMadeForKids] = useState(false);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRecord = records[currentIndex];

  // Set the playback rate on target element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [currentIndex, playbackSpeed]);

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen().catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Sync current index state when initialIndex changes
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs internal index to the controlled initialIndex prop
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Sync editing fields with active record
  useEffect(() => {
    if (activeRecord) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the edit form fields whenever the active record changes
      setEditTitle(activeRecord.title || "");
      setEditContent(activeRecord.content || "");
      setEditUserTags(activeRecord.userTags || "");
      setEditCaption(activeRecord.caption || "");
      setEditCategory(activeRecord.category || "Science & Technology");
      setEditLicense(activeRecord.license || "youtube");
      setEditPrivacyStatus(activeRecord.privacyStatus || "private");
      setEditMadeForKids(activeRecord.madeForKids === 1);
      setEditMode(false); // cancel edit mode on navigation
    }
  }, [currentIndex, activeRecord]);

  const resetVideoState = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1.0);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : records.length - 1));
    resetVideoState();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < records.length - 1 ? prev + 1 : 0));
    resetVideoState();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger navigation keys if user is editing text inputs
      const isEditing = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && !isEditing) {
        if (activeRecord?.type === "video" && videoRef.current) {
          e.preventDefault();
          // Seek back 5 seconds
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        } else {
          handlePrev();
        }
      } else if (e.key === "ArrowRight" && !isEditing) {
        if (activeRecord?.type === "video" && videoRef.current) {
          e.preventDefault();
          // Seek forward 5 seconds
          videoRef.current.currentTime = Math.min(duration || videoRef.current.duration, videoRef.current.currentTime + 5);
        } else {
          handleNext();
        }
      } else if (e.key === " " && !isEditing) {
        // Spacebar toggles video play/pause
        if (activeRecord?.type === "video") {
          e.preventDefault();
          togglePlay();
        }
      } else if ((e.key === "m" || e.key === "M") && !isEditing) {
        if (activeRecord?.type === "video") {
          e.preventDefault();
          toggleMute();
        }
      } else if ((e.key === "f" || e.key === "F") && !isEditing) {
        if (activeRecord?.type === "video") {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are recreated each render; re-subscribing on the listed state values preserves existing behavior
  }, [currentIndex, activeRecord, isMuted, isPlaying, duration]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleSave = async () => {
    if (!activeRecord) return;
    setSaving(true);
    try {
      const res = await fetch("/api/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeRecord.id,
          title: editTitle.trim() || null,
          content: editContent.trim() || null,
          userTags: editUserTags.trim() || null,
          caption: editCaption.trim() || null,
          category: editCategory || null,
          license: editLicense || null,
          privacyStatus: editPrivacyStatus || null,
          madeForKids: editMadeForKids ? 1 : 0
        })
      });

      if (res.ok) {
        if (onRecordUpdated) {
          onRecordUpdated(activeRecord.id, {
            title: editTitle.trim() || null,
            content: editContent.trim() || null,
            userTags: editUserTags.trim() || null,
            caption: editCaption.trim() || null,
            category: editCategory || null,
            license: editLicense || null,
            privacyStatus: editPrivacyStatus || null,
            madeForKids: editMadeForKids ? 1 : 0
          });
        }
        setEditMode(false);
      } else {
        const error = await res.json();
        alert(`Error saving metadata: ${error.error}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleToggleVirtualAlbum = async (albumName: string, isCurrentlyMapped: boolean) => {
    setUpdatingAlbums(albumName);
    try {
      const action = isCurrentlyMapped ? "removeMediaFromAlbum" : "addMediaToAlbum";
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          albumName,
          mediaIds: [activeRecord.id]
        })
      });

      if (res.ok) {
        // Update local state in records list
        const currentMappedStr = activeRecord.virtualAlbums || "";
        let newMappedStr = "";
        if (isCurrentlyMapped) {
          newMappedStr = currentMappedStr
            .split(",")
            .map(x => x.trim())
            .filter(x => x && x !== albumName)
            .join(",");
        } else {
          newMappedStr = currentMappedStr 
            ? `${currentMappedStr},${albumName}` 
            : albumName;
        }

        if (onRecordUpdated) {
          onRecordUpdated(activeRecord.id, {
            virtualAlbums: newMappedStr || null
          });
        }
      } else {
        const error = await res.json();
        alert(`Error mapping album: ${error.error}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingAlbums(null);
    }
  };

  if (!activeRecord) return null;

  const streamUrl = `/api/media/stream?id=${activeRecord.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-between bg-black/95 backdrop-blur-xl animate-fade-in text-white overflow-hidden">
      
      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
        
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex flex-col pointer-events-auto">
            <h2 className="text-[15px] font-semibold text-white/90 drop-shadow-md truncate max-w-lg">
              {editTitle || activeRecord.title || activeRecord.filename}
            </h2>
            <p className="text-[12px] text-white/60 font-mono">
              {currentIndex + 1} of {records.length}
            </p>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button 
              onClick={() => setShowMeta(!showMeta)} 
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-all text-white/80 hover:text-white"
              title="Toggle Info"
            >
              {showMeta ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-all text-white/80 hover:text-white"
              title="Close (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="w-full h-full max-h-[85vh] flex items-center justify-center relative select-none">
          
          {/* Navigation Arrows */}
          <button 
            onClick={handlePrev}
            className="absolute left-2 z-15 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/5 flex items-center justify-center text-white/80 hover:text-white transition-all transform hover:scale-105"
          >
            <ChevronLeft size={24} />
          </button>
          
          <button 
            onClick={handleNext}
            className="absolute right-2 z-15 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/5 flex items-center justify-center text-white/80 hover:text-white transition-all transform hover:scale-105"
          >
            <ChevronRight size={24} />
          </button>

          {/* Render Photo */}
          {activeRecord.type === "photo" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={streamUrl}
              alt={activeRecord.filename}
              className="max-w-full max-h-full object-contain rounded shadow-2xl animate-fade-in pointer-events-none"
            />
          )}

          {/* Render Video with Custom Control Overlay */}
          {activeRecord.type === "video" && (
            <div className="relative group max-w-full max-h-full aspect-video flex items-center justify-center">
              <video 
                ref={videoRef}
                src={streamUrl} 
                className="max-w-full max-h-full object-contain rounded shadow-2xl" 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                autoPlay
              />

              {/* Video Scrubber & Play Panel */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 p-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePlay}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <span className="text-[11px] font-mono text-white/80">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  
                  {/* Slider Scrubber */}
                  <input 
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleScrub}
                    className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />

                  <button 
                    onClick={toggleMute}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all mr-1"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>

                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      const speed = parseFloat(e.target.value);
                      setPlaybackSpeed(speed);
                      if (videoRef.current) {
                        videoRef.current.playbackRate = speed;
                      }
                    }}
                    className="bg-black/80 border border-white/20 rounded-lg px-2 py-1 text-[10px] font-mono font-bold text-white outline-none cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1.0">1.0x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2.0">2.0x</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Sidebar (500px Style) */}
      {showMeta && (
        <div className="w-[360px] shrink-0 border-l border-white/10 bg-zinc-950/80 backdrop-blur-xl flex flex-col p-6 select-text overflow-y-auto animate-slide-in justify-between">
          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            
            {/* Action / Header Info */}
            <div className="flex items-start justify-between shrink-0">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] tracking-widest uppercase font-bold text-orange-500 mb-2">
                  <Film size={12} /> {activeRecord.type}
                </span>
                <h3 className="text-sm font-mono text-white/40 leading-none break-all">
                  {activeRecord.filename}
                </h3>
              </div>
              <button 
                onClick={() => setEditMode(!editMode)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                  editMode 
                    ? "bg-orange-500/20 border-orange-500/30 text-orange-400" 
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                }`}
                title="Edit details"
              >
                <Edit3 size={14} />
              </button>
            </div>

            {/* iPhoto vs YouTube Play Queue Toggle for Videos */}
            {activeRecord.type === "video" && !editMode && (
              <div className="flex bg-zinc-900/80 border border-white/10 p-0.5 rounded-xl shrink-0">
                <button
                  onClick={() => setSidebarTab("meta")}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all ${
                    sidebarTab === "meta" 
                      ? "bg-purple-500 text-white shadow-md" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setSidebarTab("queue")}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === "queue" 
                      ? "bg-purple-500 text-white shadow-md" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Play Queue ({records.filter(r => r.type === "video").length})
                </button>
              </div>
            )}

            {/* Scrollable Core Pane */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6 pt-2">
              {sidebarTab === "queue" && activeRecord.type === "video" && !editMode ? (
                // Play Queue list (YouTube-style playlist sidebar)
                <div className="space-y-2 animate-fade-in">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-purple-400 block pb-1 border-b border-white/5">Up Next</span>
                  <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                    {records
                      .map((rec, originalIdx) => ({ ...rec, originalIdx }))
                      .filter(rec => rec.type === "video")
                      .map((video) => {
                        const isActive = video.id === activeRecord.id;
                        return (
                          <div
                            key={video.id}
                            onClick={() => {
                              setCurrentIndex(video.originalIdx);
                              resetVideoState();
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                              isActive 
                                ? "bg-purple-500/10 border-purple-500/40 shadow-inner" 
                                : "bg-white/5 border-white/[0.04] hover:bg-white/10 hover:border-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive ? "bg-purple-500 text-white animate-pulse" : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700"
                              }`}>
                                <Play size={10} fill={isActive ? "currentColor" : "none"} />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[11.5px] font-bold truncate leading-tight ${isActive ? "text-purple-400" : "text-white"}`}>
                                  {video.title || video.filename}
                                </p>
                                <p className="text-[9px] text-zinc-500 font-mono truncate">{video.filename}</p>
                              </div>
                            </div>
                            {video.duration && (
                              <span className="text-[9px] font-mono text-zinc-400 shrink-0 bg-black/40 px-1.5 py-0.5 rounded">
                                {formatTime(video.duration)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : editMode ? (
                <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10 animate-fade-in max-h-[70vh] overflow-y-auto pr-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-orange-500 block">Edit Metadata</span>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-white/50 block">Title (YouTube Parity)</label>
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      maxLength={100}
                      placeholder="Enter video title..."
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs outline-none text-white focus:border-orange-500/50"
                    />
                    {activeRecord.type === "video" && (
                      <span className="text-[9px] text-white/30 text-right block font-mono">
                        {editTitle.length}/100
                      </span>
                    )}
                  </div>
  
                  {activeRecord.type === "video" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-white/50 block">Short Caption (Hook)</label>
                      <input 
                        type="text"
                        value={editCaption}
                        onChange={e => setEditCaption(e.target.value)}
                        placeholder="Catchy caption or subtitle hook..."
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs outline-none text-white focus:border-orange-500/50"
                      />
                    </div>
                  )}
  
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-white/50 block">
                      {activeRecord.type === "video" ? "Description (YouTube Parity)" : "Caption / Notes"}
                    </label>
                    <textarea 
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      maxLength={activeRecord.type === "video" ? 5000 : undefined}
                      placeholder={activeRecord.type === "video" ? "Write video description (up to 5000 characters)..." : "Describe this memory..."}
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs outline-none h-20 text-white focus:border-orange-500/50 resize-none"
                    />
                    {activeRecord.type === "video" && (
                      <span className="text-[9px] text-white/30 text-right block font-mono">
                        {editContent.length}/5000
                      </span>
                    )}
                  </div>
  
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-white/50 block">User Tags (comma separated)</label>
                    <input 
                      type="text"
                      value={editUserTags}
                      onChange={e => setEditUserTags(e.target.value)}
                      placeholder="e.g. family, summer, trip"
                      className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-xs outline-none text-white focus:border-orange-500/50"
                    />
                  </div>
  
                  {/* YouTube Parity Fields for Video files only */}
                  {activeRecord.type === "video" && (
                    <div className="pt-2 border-t border-white/10 space-y-3">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-orange-500 block">YouTube Settings</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-white/50 block">Category</label>
                          <select
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-[11px] outline-none text-white focus:border-orange-500/50 cursor-pointer"
                          >
                            <option value="Autos & Vehicles">Autos & Vehicles</option>
                            <option value="Comedy">Comedy</option>
                            <option value="Education">Education</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Film & Animation">Film & Animation</option>
                            <option value="Gaming">Gaming</option>
                            <option value="Howto & Style">Howto & Style</option>
                            <option value="Music">Music</option>
                            <option value="News & Politics">News & Politics</option>
                            <option value="Nonprofits & Activism">Nonprofits & Activism</option>
                            <option value="People & Blogs">People & Blogs</option>
                            <option value="Pets & Animals">Pets & Animals</option>
                            <option value="Science & Technology">Science & Technology</option>
                            <option value="Sports">Sports</option>
                            <option value="Travel & Events">Travel & Events</option>
                          </select>
                        </div>
  
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-white/50 block">Visibility</label>
                          <select
                            value={editPrivacyStatus}
                            onChange={e => setEditPrivacyStatus(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-[11px] outline-none text-white focus:border-orange-500/50 cursor-pointer"
                          >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                            <option value="unlisted">Unlisted</option>
                          </select>
                        </div>
                      </div>
  
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-white/50 block">License</label>
                        <select
                          value={editLicense}
                          onChange={e => setEditLicense(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-[11px] outline-none text-white focus:border-orange-500/50 cursor-pointer"
                        >
                          <option value="youtube">Standard YouTube License</option>
                          <option value="creativeCommon">Creative Commons - Attribution</option>
                        </select>
                      </div>
  
                      <div className="flex items-center gap-2 py-1 select-none cursor-pointer" onClick={() => setEditMadeForKids(!editMadeForKids)}>
                        <input 
                          type="checkbox" 
                          checked={editMadeForKids} 
                          onChange={() => {}}
                          className="rounded bg-zinc-950 border-white/10 text-orange-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-[11px] text-white/80">Made for Kids</span>
                      </div>
                    </div>
                  )}

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Save size={12} /> {saving ? "Saving..." : "Save"}
                  </button>
                  <button 
                    onClick={() => {
                      setEditTitle(activeRecord.title || "");
                      setEditContent(activeRecord.content || "");
                      setEditUserTags(activeRecord.userTags || "");
                      setEditCaption(activeRecord.caption || "");
                      setEditCategory(activeRecord.category || "Science & Technology");
                      setEditLicense(activeRecord.license || "youtube");
                      setEditPrivacyStatus(activeRecord.privacyStatus || "private");
                      setEditMadeForKids(activeRecord.madeForKids === 1);
                      setEditMode(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/85 text-xs transition-all flex items-center justify-center"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                {/* Title */}
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight break-words">
                    {activeRecord.title || "Untitled Memory"}
                  </h3>
                  {activeRecord.content && (
                    <p className="text-[13px] text-white/80 leading-relaxed mt-2 bg-white/5 p-3 rounded-xl border border-white/5 whitespace-pre-wrap">
                      {activeRecord.content}
                    </p>
                  )}
                </div>

                {/* User Tags */}
                {activeRecord.userTags && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeRecord.userTags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded">
                        <Tag size={8} /> {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* YouTube Parity display for Videos */}
                {activeRecord.type === "video" && (
                  <div className="mt-4 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 space-y-3 animate-fade-in">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-orange-500 flex items-center gap-1.5">
                      <Film size={10} /> YouTube Export Parity
                    </span>
                    {activeRecord.caption && (
                      <div className="text-[11.5px] text-white/90 italic border-l-2 border-orange-500/40 pl-2">
                        &quot;{activeRecord.caption}&quot;
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-white/40 block text-[8px] uppercase font-mono">Category</span>
                        <span className="text-white/85 font-medium">{activeRecord.category || "Science & Technology"}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8px] uppercase font-mono">Visibility</span>
                        <span className="text-white/85 font-medium capitalize">{activeRecord.privacyStatus || "private"}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8px] uppercase font-mono">License</span>
                        <span className="text-white/85 font-medium">
                          {activeRecord.license === "creativeCommon" ? "Creative Commons" : "Standard YouTube"}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8px] uppercase font-mono">Made for Kids</span>
                        <span className="text-white/85 font-medium">{activeRecord.madeForKids === 1 ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

            {/* Virtual Albums Mapping */}
            {virtualAlbums && virtualAlbums.length > 0 && !editMode && (
              <>
                <hr className="border-white/10" />
                <div className="space-y-3">
                  <h4 className="text-[12px] font-bold tracking-wider text-white/40 uppercase">Virtual Albums</h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {virtualAlbums.map((album) => {
                      const isMapped = (activeRecord.virtualAlbums || "")
                        .split(",")
                        .map(x => x.trim())
                        .includes(album.name);
                      
                      return (
                        <button
                          key={album.id}
                          disabled={updatingAlbums === album.name}
                          onClick={() => handleToggleVirtualAlbum(album.name, isMapped)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            isMapped
                              ? "bg-orange-500/20 border-orange-500/30 text-orange-400"
                              : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                          } disabled:opacity-55`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isMapped ? "bg-orange-500 animate-pulse" : "bg-zinc-650"}`} />
                          {album.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* People Tagged */}
            {activeRecord.faces && !editMode && (
              <>
                <hr className="border-white/10" />
                <div className="space-y-3">
                  <h4 className="text-[12px] font-bold tracking-wider text-white/40 uppercase">People in this Photo</h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeRecord.faces.split(",").map(f => f.trim()).filter(Boolean).map(faceName => (
                      <span 
                        key={faceName} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {faceName}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            <hr className="border-white/10" />

            {/* General Metadata */}
            <div className="space-y-4">
              <h4 className="text-[12px] font-bold tracking-wider text-white/40 uppercase">Details</h4>
              
              <div className="flex gap-3">
                <HardDrive size={16} className="text-orange-500/80 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-white/80">Source Drive</div>
                  <div className="text-[12px] text-white/50">{activeRecord.sourceVolume || "Local"}</div>
                </div>
              </div>

              {activeRecord.dateCreated && (
                <div className="flex gap-3">
                  <Calendar size={16} className="text-orange-500/80 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13px] font-semibold text-white/80">Date Created</div>
                    <div className="text-[12px] text-white/50">
                      {new Date(activeRecord.dateCreated).toLocaleDateString(undefined, { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Info size={16} className="text-orange-500/80 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-white/80">File Specs</div>
                  <div className="text-[12px] text-white/50 font-mono">
                    Size: {formatBytes(activeRecord.sizeBytes)}
                    {activeRecord.width && activeRecord.height && (
                      <> • {activeRecord.width} × {activeRecord.height} px</>
                    )}
                    {activeRecord.duration && (
                      <> • {formatTime(activeRecord.duration)} duration</>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Camera / EXIF */}
            {activeRecord.camera && (
              <>
                <hr className="border-white/10" />
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold tracking-wider text-white/40 uppercase">Camera / EXIF</h4>
                  <div className="flex gap-3">
                    <Camera size={16} className="text-orange-500/80 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-semibold text-white/80">Camera Model</div>
                      <div className="text-[12px] text-white/50">{activeRecord.camera}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Geotag Map */}
            {activeRecord.hasGeo === 1 && (activeRecord.city || activeRecord.lat) && (
              <>
                <hr className="border-white/10" />
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold tracking-wider text-white/40 uppercase">Location</h4>
                  <div className="flex gap-3">
                    <MapPin size={16} className="text-orange-500/80 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-semibold text-white/80">
                        {activeRecord.city || "Unknown Location"}
                      </div>
                      <div className="text-[12px] text-white/50">
                        {activeRecord.country || "Earth"}
                      </div>
                      {activeRecord.lat && activeRecord.lng && (
                        <div className="text-[11px] font-mono text-white/30 mt-1">
                          {activeRecord.lat.toFixed(5)}, {activeRecord.lng.toFixed(5)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {activeRecord.lat && activeRecord.lng && (
                    <a 
                      href={`https://maps.apple.com/?ll=${activeRecord.lat},${activeRecord.lng}&q=${encodeURIComponent(activeRecord.filename)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[12px] font-semibold text-orange-400 hover:bg-orange-500 hover:text-white transition-all text-center select-none"
                    >
                      <MapPin size={14} /> Open in Apple Maps
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] text-white/20 mt-6 border-t border-white/5 pt-4">
            Rudder Media Zenith Engine v1.0
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
