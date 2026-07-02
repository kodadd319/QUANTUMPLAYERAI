import React, { useState, useMemo, useRef } from "react";
import { 
  Video, 
  Upload, 
  Trash2, 
  CheckSquare, 
  Square, 
  ChevronDown,
  Search,
  Check,
  FolderSync,
  HardDrive,
  Info,
  PlusCircle,
  ArrowUpDown,
  Play
} from "lucide-react";
import { VideoTrack } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { requestNativeAndroidPermissions } from "../utils/audioScannerService";
import { storeLocalVideo } from "../utils/localMediaStorage";

// 5 premium local video records for screen testing, high-refresh display testing, and bass excursion visual mapping
const MEDIASTORE_VIDEO_RECORDS = [
  {
    title: "Neon Night Highway Sweep",
    creator: "Acoustic Car Club",
    category: "Cinematic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Subwoofer Cone Excursion Pattern",
    creator: "Decibel Lab Tech",
    category: "Acoustic Calibration",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Vaporwave Retro Horizon Drive",
    creator: "Studio Calibration Unit",
    category: "Futuristic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Deep Sea Sub-Bass Thermal Wave",
    creator: "Oceanic Hydroacoustics",
    category: "Acoustic Calibration",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Cybernetic Laser Light Matrix",
    creator: "RGB Laser Engineers",
    category: "Cinematic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80"
  }
];

interface MyVideosViewProps {
  videos: VideoTrack[];
  selectedVideo: VideoTrack | null;
  currentUser: any;
  isUploading: boolean;
  uploadProgress: number | null;
  uploadError: string;
  uploadSuccess: string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  deleteSelectedVideos: (videoIds: string[]) => Promise<void>;
  onPlayVideo: (video: VideoTrack) => void;
  setUploadError: (msg: string) => void;
  setUploadSuccess: (msg: string) => void;
  refreshLocalMedia?: () => Promise<{ songs: any[]; vids: VideoTrack[] }>;
}

export const MyVideosView: React.FC<MyVideosViewProps> = ({
  videos,
  selectedVideo,
  currentUser,
  isUploading,
  uploadProgress,
  uploadError,
  uploadSuccess,
  handleFileUpload,
  deleteSelectedVideos,
  onPlayVideo,
  setUploadError,
  setUploadSuccess,
  refreshLocalMedia
}) => {
  const [viewCategory, setViewCategory] = useState<"all" | "creator" | "category">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dateAdded" | "creator" | "title">("dateAdded");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Long press timer refs & selection mode triggers
  const longPressTimers = useRef<Record<string, any>>({});
  const isLongPressing = useRef<Record<string, boolean>>({});

  const startLongPress = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
    }
    isLongPressing.current[id] = false;

    longPressTimers.current[id] = setTimeout(() => {
      isLongPressing.current[id] = true;
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
      setIsSelectionMode(true);
      setSelectedVideoIds(prev => {
        if (!prev.includes(id)) {
          return [...prev, id];
        }
        return prev;
      });
    }, 600);
  };

  const cancelLongPress = (id: string) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
  };

  const endLongPress = (id: string, action: () => void) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
    if (!isLongPressing.current[id]) {
      action();
    }
    isLongPressing.current[id] = false;
  };

  const bindLongPress = (id: string, action: () => void) => {
    return {
      onMouseDown: (e: React.MouseEvent) => startLongPress(id, e),
      onMouseUp: () => endLongPress(id, action),
      onMouseLeave: () => cancelLongPress(id),
      onTouchStart: (e: React.TouchEvent) => startLongPress(id, e),
      onTouchEnd: () => endLongPress(id, action),
      onTouchMove: () => cancelLongPress(id),
    };
  };

  // Scanning local states
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanFile, setCurrentScanFile] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const videoScanInputRef = useRef<HTMLInputElement>(null);

  // Web-compatible HTML5 folder / local device storage scanner for videos
  const handleSmartScan = async () => {
    setUploadError("");
    setUploadSuccess("");
    if (videoScanInputRef.current) {
      videoScanInputRef.current.click();
    } else {
      const el = document.getElementById("video-scanner");
      if (el) el.click();
    }
  };

  const handleWebFolderScanChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      setIsScanning(false);
      setCurrentScanFile(null);
      return;
    }
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) {
      setIsScanning(false);
      setCurrentScanFile(null);
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      setCurrentScanFile("Initializing local device video structure query...");
      await new Promise((r) => setTimeout(r, 400));

      // Automated File Filtering Loop: Accept all local video extensions (case-insensitive)
      const allowedExtensions = [".mp4", ".webm", ".avi", ".mkv", ".mov", ".3gp", ".m4v"];
      const filteredFiles = files.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        return allowedExtensions.includes(ext);
      });

      if (filteredFiles.length === 0) {
        throw new Error("No valid local video files found matching extensions (.mp4, .webm, .avi, .mkv, .mov, .3gp, .m4v).");
      }

      const totalVideos = filteredFiles.length;
      setCurrentScanFile(`Discovered ${totalVideos} compatible video tracks. Parsing local metadata...`);
      await new Promise((r) => setTimeout(r, 600));

      let processedCount = 0;
      for (const file of filteredFiles) {
        // Extract filename, strip extension off for a clean look
        const title = file.name.replace(/\.[^/.]+$/, "");
        
        // Parse folder path to construct creator/category hierarchy dynamically if relative path exists
        const relativePath = (file as any).webkitRelativePath || "";
        const parts = relativePath ? relativePath.split("/") : [];
        let creator = "Local Storage";
        let category = "Local Device";
        if (parts.length >= 3) {
          creator = parts[parts.length - 3];
          category = parts[parts.length - 2];
        } else if (parts.length === 2) {
          category = parts[0];
        }

        // Random dynamic thumb placeholders from high-quality curated stock images based on name tags or folder
        let thumbnail = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes("car") || lowerName.includes("drive") || lowerName.includes("speed")) {
          thumbnail = "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80";
        } else if (lowerName.includes("bass") || lowerName.includes("audio") || lowerName.includes("sound")) {
          thumbnail = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80";
        } else if (lowerName.includes("neon") || lowerName.includes("laser") || lowerName.includes("cyber")) {
          thumbnail = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80";
        } else if (lowerName.includes("ocean") || lowerName.includes("sea") || lowerName.includes("water")) {
          thumbnail = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80";
        }

        setCurrentScanFile(`Processing: ${file.name}`);

        const videoId = `video_local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Build localized record maintaining reference to original File object
        const localVideoRecord = {
          id: videoId,
          name: title,
          creator: creator,
          category: category,
          duration: "0:30", // Placeholder. Resolved dynamically on player load
          thumbnail: thumbnail,
          createdAt: new Date().toISOString(),
          blob: file // Store raw file object inside IndexedDB directly!
        };

        // Write directly to IndexedDB local storage (bypass cloud, 100% local)
        await storeLocalVideo(localVideoRecord);
        processedCount++;

        // Stagger scanning progress meter
        setScanProgress(Math.round((processedCount / totalVideos) * 100));
        await new Promise((r) => setTimeout(r, 30));
      }

      // Sync and populate parent application state instantly
      if (refreshLocalMedia) {
        await refreshLocalMedia();
      }

      setUploadSuccess(`Scan Complete! Discovered and synchronized ${processedCount} high-fidelity local videos to your offline library.`);

    } catch (err: any) {
      console.error("Local video scanner failed:", err);
      setUploadError(err.message || "An error occurred while scanning your device storage.");
    } finally {
      setIsScanning(false);
      setCurrentScanFile(null);
    }
  };

  // Filter out built-in samples to get only user uploaded / scanned videos
  const uploadedVideos = useMemo(() => {
    return videos.filter(vid => !vid.id.startsWith("sample-"));
  }, [videos]);

  // Apply search query filter and sorting dynamically
  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = [...uploadedVideos];

    if (q) {
      result = result.filter(
        v => 
          (v.name || "").toLowerCase().includes(q) ||
          (v.creator || "").toLowerCase().includes(q) ||
          (v.category || "").toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      if (sortBy === "creator") {
        const creatorA = (a.creator || "Unknown Creator").toLowerCase();
        const creatorB = (b.creator || "Unknown Creator").toLowerCase();
        if (creatorA !== creatorB) return creatorA.localeCompare(creatorB);
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
      } else if (sortBy === "title") {
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
      } else {
        // "dateAdded" (Newest first)
        const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return b.id.localeCompare(a.id);
      }
    });
  }, [uploadedVideos, searchQuery, sortBy]);

  // Compute groupings dynamically
  const videosByCreator = useMemo(() => {
    const groups: Record<string, VideoTrack[]> = {};
    filteredVideos.forEach(vid => {
      const creator = vid.creator || "Unknown Creator";
      if (!groups[creator]) groups[creator] = [];
      groups[creator].push(vid);
    });
    return groups;
  }, [filteredVideos]);

  const videosByCategory = useMemo(() => {
    const groups: Record<string, VideoTrack[]> = {};
    filteredVideos.forEach(vid => {
      const category = vid.category || "Personal Video";
      if (!groups[category]) groups[category] = [];
      groups[category].push(vid);
    });
    return groups;
  }, [filteredVideos]);

  const toggleSelectVideo = (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedVideoIds(prev => {
      const isCurrentlySelected = prev.includes(videoId);
      const next = isCurrentlySelected ? prev.filter(id => id !== videoId) : [...prev, videoId];
      if (next.length > 0) {
        setIsSelectionMode(true);
      } else {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const isAllSelected = filteredVideos.length > 0 && selectedVideoIds.length === filteredVideos.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedVideoIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedVideoIds(filteredVideos.map(v => v.id));
      setIsSelectionMode(true);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedVideoIds.length === 0) return;
    if (confirm(`Do you wish to permanently remove the selected ${selectedVideoIds.length} video(s) from your local video locker?`)) {
      const idsToDelete = [...selectedVideoIds];
      setSelectedVideoIds([]);
      setIsSelectionMode(false);
      await deleteSelectedVideos(idsToDelete);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex flex-col gap-8 text-left select-none text-slate-200 p-2 sm:p-4"
      id="elegant-my-videos-view"
    >
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-sans font-light tracking-wide text-white flex items-center gap-2.5">
            <Video className="w-6 h-6 text-white stroke-[1.5] drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
            Your Video Collection
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-light">
            Scan, organize, and inspect your local high-fidelity video files and calibration patterns.
          </p>
        </div>
        
        {/* Videos Count Badge */}
        <div className="self-start md:self-center">
          <span className="px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-sans tracking-wider font-semibold">
            {uploadedVideos.length === 1 ? "1 Video Mapped" : `${uploadedVideos.length} Videos Mapped`}
          </span>
        </div>
      </div>

      {/* Media Scan Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="video-scanner-station">
        {/* Scan Device Button Card */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#121914] to-[#050705] border border-emerald-950/40 hover:border-emerald-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/15 transition-all duration-300 flex items-center justify-center border border-emerald-500/20">
              <FolderSync className="w-6 h-6 stroke-[1.5] animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-sans font-semibold text-white tracking-wide uppercase">
                Scan Device for Videos
              </span>
              <span className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                Automated MediaStore scanning for storage directories and video container metadata indexing.
              </span>
            </div>
          </div>
          
          <button
            onClick={handleSmartScan}
            disabled={isScanning}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-stone-950 font-sans text-xs font-bold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2 border-0 mt-2"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Scanning Videos...</span>
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4 stroke-[2]" />
                <span>Scan Device for Videos</span>
              </>
            )}
          </button>
        </div>

        {/* Traditional Local Video Loader */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#121219] to-[#050507] border border-blue-950/40 hover:border-blue-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-105 group-hover:bg-blue-500/15 transition-all duration-300 flex items-center justify-center border border-blue-500/20">
              <Upload className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-sans font-semibold text-white tracking-wide uppercase">
                Open Video File
              </span>
              <span className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                Directly select and catalog specific MP4, WebM or cinematic files from your filesystem.
              </span>
            </div>
          </div>
          
          <label className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-stone-850 to-stone-950 hover:from-stone-800 hover:to-stone-900 border border-stone-750 text-white font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg flex items-center justify-center gap-2 mt-2 select-none text-center">
            <input 
              type="file" 
              accept="video/*" 
              multiple 
              onChange={(e) => {
                setUploadError("");
                setUploadSuccess("");
                handleFileUpload(e);
              }} 
              className="hidden" 
            />
            <PlusCircle className="w-4 h-4 text-slate-300" />
            <span>Select Local Video</span>
          </label>
        </div>
      </div>

      {/* Radar Scan Status Box */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 rounded-2xl bg-emerald-950/10 border-2 border-emerald-500/20 text-slate-200 flex flex-col md:flex-row items-center gap-6 shadow-[0_10px_30px_rgba(16,185,129,0.05)] overflow-hidden"
          >
            {/* Radar Circle */}
            <div className="w-24 h-24 rounded-full border-2 border-emerald-500/30 relative flex items-center justify-center shrink-0 overflow-hidden bg-stone-950 shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]">
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_60%,rgba(16,185,129,0.45)_100%)] animate-spin" style={{ animationDuration: "2.5s" }} />
              <div className="absolute w-16 h-16 rounded-full border border-emerald-500/15" />
              <div className="absolute w-8 h-8 rounded-full border border-emerald-500/10" />
              <div className="absolute inset-x-0 h-[2px] bg-emerald-400/80 animate-[pulse_1.2s_infinite] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <Video className="w-6 h-6 text-emerald-500 stroke-[1.5] relative z-10 animate-bounce" />
            </div>

            <div className="flex flex-col gap-3 flex-1 w-full text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  Automated Video Scanner Engaged
                </h4>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">{scanProgress}%</span>
              </div>

              <div className="bg-stone-950/70 border border-emerald-500/10 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 flex items-center gap-2 min-h-[38px] truncate">
                <span className="text-emerald-500 select-none">&gt;</span>
                <span className="truncate">{currentScanFile || "Initiating database handshake..."}</span>
              </div>

              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-white/5 relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-light">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Broadcasting READ_MEDIA_VIDEO permission queries and caching video metadata blobs into local sandboxed IndexedDB memory.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications and messages */}
      <AnimatePresence>
        {uploadError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/10 text-xs text-red-400"
          >
            <p className="font-light">{uploadError}</p>
          </motion.div>
        )}

        {uploadSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/10 text-xs text-emerald-400"
          >
            <p className="font-light">{uploadSuccess}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtering Options & Category Select */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-2">
        <div className="flex flex-wrap gap-2.5">
          {(["all", "creator", "category"] as const).map((catName) => {
            const label = catName === "all" ? "All Videos" : catName;
            const isActive = viewCategory === catName;
            return (
              <button
                key={catName}
                onClick={() => {
                  setViewCategory(catName);
                  setSelectedVideoIds([]);
                }}
                className={`px-5 py-2.5 rounded-xl font-sans text-xs uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white/10 text-white font-semibold border border-slate-450"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Live Search and Sorting Dropdowns */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:max-w-xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search video titles, creators, or folders..."
              className="w-full bg-stone-950/40 hover:bg-white/[0.03] focus:bg-white/[0.05] border border-stone-850 focus:border-white/20 py-3 pl-11 pr-5 rounded-xl text-xs text-white placeholder-slate-400 outline-none transition-all duration-200"
            />
          </div>

          <div className="relative w-full sm:w-auto shrink-0 flex items-center gap-2">
            <label htmlFor="video-library-sort" className="text-[11px] font-sans font-semibold tracking-wider text-slate-400 uppercase whitespace-nowrap hidden sm:inline">
              Sort:
            </label>
            <div className="relative w-full sm:w-auto">
              <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                id="video-library-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto bg-stone-950/40 hover:bg-white/[0.03] focus:bg-stone-950 border border-stone-850 focus:border-white/20 py-3 pl-10 pr-9 rounded-xl text-xs text-white appearance-none outline-none transition-all duration-200 cursor-pointer font-sans"
              >
                <option value="dateAdded" className="bg-stone-950 text-white">Date Added</option>
                <option value="creator" className="bg-stone-950 text-white">Creator</option>
                <option value="title" className="bg-stone-950 text-white">Title</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center justify-center">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {filteredVideos.length > 0 && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between bg-stone-950/30 border p-4 rounded-2xl transition-all duration-300 gap-3 ${
          isSelectionMode ? "border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.05)] bg-emerald-950/10" : "border-stone-850/60"
        }`}>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2.5 text-slate-400 hover:text-white text-xs tracking-wider transition-colors duration-150 cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-650" />
              )}
              <span>Select all ({filteredVideos.length})</span>
            </button>
            
            {!isSelectionMode ? (
              <button
                onClick={() => setIsSelectionMode(true)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] transition-all cursor-pointer font-sans"
              >
                Enter Selection Mode
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-sans font-semibold text-emerald-400 uppercase tracking-wider">
                Selection Mode Active ({selectedVideoIds.length} Selected)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode && (
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedVideoIds([]);
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 border border-transparent rounded-xl transition-all duration-150 cursor-pointer"
              >
                Cancel
              </button>
            )}

            {selectedVideoIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 active:scale-95 rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete selected ({selectedVideoIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Videos List Container */}
      <div className="flex flex-col gap-3 min-h-[220px]">
        {filteredVideos.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/5">
            <FolderSync className="w-8 h-8 text-slate-500 mx-auto mb-3 stroke-[1.5] animate-pulse" />
            <h3 className="text-sm font-sans font-medium text-slate-300">
              {searchQuery ? "No video search results match" : "Your video library is currently empty"}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 font-light">
              {searchQuery 
                ? "Try checking your spelling or search queries." 
                : "Execute an automated scan or import a local video file above to populate."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Flat list */}
            {viewCategory === "all" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredVideos.map((vid) => {
                  const isSelectedForDel = selectedVideoIds.includes(vid.id);
                  const isPlayingActive = selectedVideo && vid.id === selectedVideo.id;
                  return (
                    <div
                      key={vid.id}
                      {...bindLongPress(vid.id, () => {
                        if (isSelectionMode) {
                          toggleSelectVideo(vid.id);
                        } else {
                          onPlayVideo(vid);
                        }
                      })}
                      className={`relative rounded-xl border overflow-hidden cursor-pointer group transition-all duration-200 flex flex-col select-none ${
                        isPlayingActive
                          ? "bg-white/[0.04] border-white/30"
                          : isSelectedForDel
                            ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                            : "bg-stone-950/50 hover:bg-stone-900/40 border-stone-850 hover:border-slate-500/30 shadow-md"
                      }`}
                    >
                      {/* Thumbnail Wrapper */}
                      <div className="aspect-video w-full relative bg-black/60 overflow-hidden">
                        {vid.thumbnail ? (
                          <img 
                            src={vid.thumbnail} 
                            alt={vid.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-1 bg-gradient-to-br from-stone-900 to-black">
                            <Video className="w-8 h-8 stroke-[1]" />
                            <span className="text-[10px] font-mono tracking-widest uppercase">No Preview</span>
                          </div>
                        )}
                        
                        {/* Play button overlay */}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                          <div className="p-2.5 rounded-full bg-white/10 group-hover:bg-white/20 text-white backdrop-blur-xs scale-90 group-hover:scale-100 transition-all duration-200 shadow-md">
                            <Play className="w-4 h-4 fill-white text-white" />
                          </div>
                        </div>

                        {/* Top selection checkbox trigger */}
                        <button
                          onClick={(e) => toggleSelectVideo(vid.id, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`absolute top-3 left-3 p-1 rounded-lg bg-black/50 hover:bg-black/85 backdrop-blur-md border border-white/10 text-white z-10 transition-opacity duration-200 cursor-pointer ${
                            isSelectionMode ? "opacity-100 text-emerald-400" : "opacity-25 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100"
                          }`}
                        >
                          {isSelectedForDel ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 group-hover:text-white" />
                          )}
                        </button>

                        {/* Duration tag */}
                        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono font-semibold text-white tracking-wider">
                          {vid.duration}
                        </span>
                      </div>

                      {/* Detail metadata block */}
                      <div className="p-4 flex flex-col justify-between flex-1 gap-1 text-left">
                        <span className="font-sans text-xs font-semibold text-white tracking-wide group-hover:text-emerald-300 transition-colors line-clamp-1">
                          {vid.name}
                        </span>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                          <span className="truncate max-w-[65%]">{vid.creator}</span>
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase text-[9px] tracking-widest">
                            {vid.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grouped by Creator view */}
            {viewCategory === "creator" && (
              <div className="flex flex-col gap-6">
                {(Object.entries(videosByCreator) as [string, VideoTrack[]][]).map(([creatorName, creatorVids]) => (
                  <div key={creatorName} className="flex flex-col gap-3">
                    <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-slate-300 border-b border-white/5 pb-2">
                      {creatorName} ({creatorVids.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {creatorVids.map((vid) => {
                        const isSelectedForDel = selectedVideoIds.includes(vid.id);
                        const isPlayingActive = selectedVideo && vid.id === selectedVideo.id;
                        return (
                          <div
                            key={vid.id}
                            {...bindLongPress(vid.id, () => {
                              if (isSelectionMode) {
                                toggleSelectVideo(vid.id);
                              } else {
                                onPlayVideo(vid);
                              }
                            })}
                            className={`relative rounded-xl border overflow-hidden cursor-pointer group transition-all duration-200 flex flex-col select-none ${
                              isPlayingActive
                                ? "bg-white/[0.04] border-white/30"
                                : isSelectedForDel
                                  ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                  : "bg-stone-950/50 hover:bg-stone-900/40 border-stone-850 hover:border-slate-550/30"
                            }`}
                          >
                            <div className="aspect-video w-full relative bg-black/60 overflow-hidden">
                              {vid.thumbnail ? (
                                <img src={vid.thumbnail} alt={vid.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-stone-900"><Video className="w-8 h-8" /></div>
                              )}
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 flex items-center justify-center">
                                <div className="p-2.5 rounded-full bg-white/10 text-white backdrop-blur-xs">
                                  <Play className="w-4 h-4 fill-white text-white" />
                                </div>
                              </div>
                              <button
                                onClick={(e) => toggleSelectVideo(vid.id, e)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`absolute top-3 left-3 p-1 rounded-lg bg-black/50 hover:bg-black/85 border border-white/10 text-white z-10 transition-opacity duration-200 cursor-pointer ${
                                  isSelectionMode ? "opacity-100 text-emerald-400" : "opacity-25 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100"
                                }`}
                              >
                                {isSelectedForDel ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-400" />}
                              </button>
                              <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white">
                                {vid.duration}
                              </span>
                            </div>
                            <div className="p-4 flex flex-col justify-between flex-1 gap-1 text-left">
                              <span className="font-sans text-xs font-semibold text-white truncate">{vid.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono uppercase bg-white/5 self-start px-2 py-0.5 rounded border border-white/5 mt-1">
                                {vid.category}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped by Category view */}
            {viewCategory === "category" && (
              <div className="flex flex-col gap-6">
                {(Object.entries(videosByCategory) as [string, VideoTrack[]][]).map(([catName, catVids]) => (
                  <div key={catName} className="flex flex-col gap-3">
                    <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-slate-300 border-b border-white/5 pb-2">
                      {catName} ({catVids.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catVids.map((vid) => {
                        const isSelectedForDel = selectedVideoIds.includes(vid.id);
                        const isPlayingActive = selectedVideo && vid.id === selectedVideo.id;
                        return (
                          <div
                            key={vid.id}
                            {...bindLongPress(vid.id, () => {
                              if (isSelectionMode) {
                                toggleSelectVideo(vid.id);
                              } else {
                                onPlayVideo(vid);
                              }
                            })}
                            className={`relative rounded-xl border overflow-hidden cursor-pointer group transition-all duration-200 flex flex-col select-none ${
                              isPlayingActive
                                ? "bg-white/[0.04] border-white/30"
                                : isSelectedForDel
                                  ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                  : "bg-stone-950/50 hover:bg-stone-900/40 border-stone-850 hover:border-slate-550/30"
                            }`}
                          >
                            <div className="aspect-video w-full relative bg-black/60 overflow-hidden">
                              {vid.thumbnail ? (
                                <img src={vid.thumbnail} alt={vid.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-stone-900"><Video className="w-8 h-8" /></div>
                              )}
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 flex items-center justify-center">
                                <div className="p-2.5 rounded-full bg-white/10 text-white backdrop-blur-xs">
                                  <Play className="w-4 h-4 fill-white text-white" />
                                </div>
                              </div>
                              <button
                                onClick={(e) => toggleSelectVideo(vid.id, e)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`absolute top-3 left-3 p-1 rounded-lg bg-black/50 hover:bg-black/85 border border-white/10 text-white z-10 transition-opacity duration-200 cursor-pointer ${
                                  isSelectionMode ? "opacity-100 text-emerald-400" : "opacity-25 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100"
                                }`}
                              >
                                {isSelectedForDel ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-400" />}
                              </button>
                              <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white">
                                {vid.duration}
                              </span>
                            </div>
                            <div className="p-4 flex flex-col justify-between flex-1 gap-1 text-left">
                              <span className="font-sans text-xs font-semibold text-white truncate">{vid.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono truncate mt-1">{vid.creator}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* HTML5 Local Storage Input Element configured exactly as requested */}
      <input 
        type="file"
        id="video-scanner"
        ref={videoScanInputRef}
        accept="video/*"
        multiple
        {...{ webkitdirectory: "", directory: "" }}
        onChange={handleWebFolderScanChange}
        className="hidden"
      />
    </motion.div>
  );
};
