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
  Folder,
  FolderSync,
  HardDrive,
  Info,
  PlusCircle,
  ArrowUpDown,
  Play
} from "lucide-react";
import { VideoTrack } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { VideoThumbnail } from "./VideoThumbnail";
import { requestNativeAndroidPermissions } from "../utils/audioScannerService";
import { storeLocalVideo } from "../utils/localMediaStorage";
import { extractVideoFrame, getOrGenerateVideoThumbnail } from "../utils/videoThumbnailGenerator";

// 5 premium local video records for screen testing, high-refresh display testing, and bass excursion visual mapping
const MEDIASTORE_VIDEO_RECORDS = [
  {
    title: "Sintel Cinematic Trailer",
    creator: "Blender Animation Studio",
    category: "Cinematic",
    duration: "0:52",
    url: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Deep Ocean Wildlife Expedition",
    creator: "Oceanic Hydroacoustics",
    category: "Acoustic Calibration",
    duration: "0:46",
    url: "https://vjs.zencdn.net/v/oceans.mp4",
    thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Big Buck Animation Excursion",
    creator: "Peach Open Movie Project",
    category: "Futuristic",
    duration: "0:33",
    url: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Botanical Color Sweep",
    creator: "Acoustic Lab Tech",
    category: "Cinematic",
    duration: "0:05",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80"
  },
  {
    title: "Motion Excursion Spectrum",
    creator: "Studio Calibration Unit",
    category: "Acoustic Calibration",
    duration: "0:10",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80"
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
  isScanning?: boolean;
  scanProgress?: number;
  currentScanFile?: string | null;
  onTriggerScan?: () => void;
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
  refreshLocalMedia,
  isScanning: propIsScanning,
  scanProgress: propScanProgress,
  currentScanFile: propCurrentScanFile,
  onTriggerScan
}) => {
  const [viewCategory, setViewCategory] = useState<"all" | "creator" | "category">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dateAdded" | "creator" | "title">("dateAdded");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const isSelectionModeRef = useRef(isSelectionMode);
  isSelectionModeRef.current = isSelectionMode;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [wasInSelectionMode, setWasInSelectionMode] = useState<boolean>(false);

  // Long press timer refs & selection mode triggers
  const longPressTimers = useRef<Record<string, any>>({});
  const isLongPressing = useRef<Record<string, boolean>>({});
  const touchStartPos = useRef<Record<string, { x: number; y: number }>>({});
  const hasMoved = useRef<Record<string, boolean>>({});

  const startLongPress = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    if (isSelectionModeRef.current) return;
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
    }
    isLongPressing.current[id] = false;
    hasMoved.current[id] = false;

    if (e && "touches" in e && e.touches && e.touches[0]) {
      touchStartPos.current[id] = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }

    longPressTimers.current[id] = setTimeout(() => {
      if (!hasMoved.current[id]) {
        isLongPressing.current[id] = true;
        isSelectionModeRef.current = true;
        if (navigator.vibrate) {
          try {
            navigator.vibrate(50);
          } catch (_) {}
        }
        setIsSelectionMode(true);
        setSelectedVideoIds(prev => {
          if (!prev.includes(id)) {
            return [...prev, id];
          }
          return prev;
        });
      }
    }, 400);
  };

  const cancelLongPress = (id: string) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
  };

  const handleTouchMove = (id: string, e: React.TouchEvent) => {
    if (!touchStartPos.current[id]) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dx = Math.abs(touch.clientX - touchStartPos.current[id].x);
    const dy = Math.abs(touch.clientY - touchStartPos.current[id].y);

    if (dx > 20 || dy > 20) {
      hasMoved.current[id] = true;
      cancelLongPress(id);
    }
  };

  const endLongPress = (id: string, action: () => void) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
    if (!isLongPressing.current[id] && !hasMoved.current[id]) {
      action();
    }
    isLongPressing.current[id] = false;
    hasMoved.current[id] = false;
  };

  const bindLongPress = (id: string, action: () => void) => {
    return {
      onMouseDown: (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[data-prevent-longpress]")) {
          return;
        }
        startLongPress(id, e);
      },
      onMouseUp: () => endLongPress(id, action),
      onMouseLeave: () => cancelLongPress(id),
      onTouchStart: (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[data-prevent-longpress]")) {
          return;
        }
        startLongPress(id, e);
      },
      onTouchEnd: () => endLongPress(id, action),
      onTouchMove: (e: React.TouchEvent) => handleTouchMove(id, e),
    };
  };

  // Scanning local states & persistent props resolution
  const [internalIsScanning, setInternalIsScanning] = useState(false);
  const [internalCurrentScanFile, setInternalCurrentScanFile] = useState<string | null>(null);
  const [internalScanProgress, setInternalScanProgress] = useState<number>(0);
  const videoScanInputRef = useRef<HTMLInputElement>(null);

  const isScanning = propIsScanning !== undefined ? propIsScanning : internalIsScanning;
  const scanProgress = propScanProgress !== undefined ? propScanProgress : internalScanProgress;
  const currentScanFile = propCurrentScanFile !== undefined ? propCurrentScanFile : internalCurrentScanFile;

  // Web-compatible HTML5 individual / multi-file local device storage scanner for videos
  const handleSmartScan = async () => {
    setUploadError("");
    setUploadSuccess("");
    if (onTriggerScan) {
      onTriggerScan();
      return;
    }
    const el = (document.getElementById("video-scanner") || document.getElementById("video-storage-browser")) as HTMLInputElement | null;
    if (el) {
      el.value = "";
      el.click();
    } else if (videoScanInputRef.current) {
      videoScanInputRef.current.value = "";
      videoScanInputRef.current.click();
    }
  };

  // Dedicated browse option for all internal and external device storage folders & files
  const handleBrowseStorage = () => {
    setUploadError("");
    setUploadSuccess("");
    const el = (document.getElementById("video-storage-browser") || document.getElementById("video-scanner")) as HTMLInputElement | null;
    if (el) {
      el.value = "";
      el.click();
    } else if (videoScanInputRef.current) {
      videoScanInputRef.current.value = "";
      videoScanInputRef.current.click();
    }
  };

  const handleBrowseFolder = () => {
    setUploadError("");
    setUploadSuccess("");
    const el = (document.getElementById("video-folder-browser") || document.getElementById("video-scanner")) as HTMLInputElement | null;
    if (el) {
      el.value = "";
      el.click();
    } else if (videoScanInputRef.current) {
      videoScanInputRef.current.value = "";
      videoScanInputRef.current.click();
    }
  };

  const handleWebFolderScanChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      return;
    }
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      return;
    }

    setInternalIsScanning(true);
    setInternalScanProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      setInternalCurrentScanFile("Reading selected video files from storage...");
      await new Promise((r) => setTimeout(r, 250));

      // Automated File Filtering Loop: Accept all local video extensions & MIME types
      const allowedExtensions = [
        ".mp4", ".webm", ".avi", ".mkv", ".mov", ".3gp", ".m4v", 
        ".ts", ".flv", ".wmv", ".ogv", ".mpg", ".mpeg", ".m2ts", 
        ".vob", ".divx", ".asf", ".f4v"
      ];
      const filteredFiles = files.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        return allowedExtensions.includes(ext) || file.type.startsWith("video/");
      });

      if (filteredFiles.length === 0) {
        throw new Error("No valid video files found in selected items (.mp4, .webm, .avi, .mkv, .mov, .3gp, .m4v, .ts, .wmv, etc.).");
      }

      const totalVideos = filteredFiles.length;
      setInternalCurrentScanFile(`Loaded ${totalVideos} video file${totalVideos === 1 ? "" : "s"}. Extracting frames and metadata...`);
      await new Promise((r) => setTimeout(r, 350));

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

        setInternalCurrentScanFile(`Extracting frame: ${file.name}`);

        let thumbnail = "";
        let durationStr = "0:30";

        try {
          const frameResult = await extractVideoFrame(file);
          thumbnail = frameResult.dataUrl;
          durationStr = frameResult.durationStr;
        } catch (frameErr) {
          console.warn("Could not capture frame during scan for", file.name, frameErr);
        }

        const videoId = `video_local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Build localized record maintaining reference to original File object
        const localVideoRecord = {
          id: videoId,
          name: title,
          creator: creator,
          category: category,
          duration: durationStr,
          thumbnail: thumbnail,
          createdAt: new Date().toISOString(),
          blob: file, // Store raw file object inside IndexedDB directly!
          uid: currentUser ? currentUser.uid : "guest"
        };

        // Write directly to IndexedDB local storage (bypass cloud, 100% local)
        await storeLocalVideo(localVideoRecord);
        processedCount++;

        // Stagger scanning progress meter
        setInternalScanProgress(Math.round((processedCount / totalVideos) * 100));
        await new Promise((r) => setTimeout(r, 20));
      }

      // Sync and populate parent application state instantly
      if (refreshLocalMedia) {
        await refreshLocalMedia();
      }

      setUploadSuccess(`Scan Complete! Successfully added ${processedCount} video${processedCount === 1 ? "" : "s"} to your offline library.`);

    } catch (err: any) {
      console.error("Local video scanner failed:", err);
      setUploadError(err.message || "An error occurred while scanning your selected video files.");
    } finally {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      if (e.target) e.target.value = "";
    }
  };

  // All uploaded and scanned videos
  const uploadedVideos = useMemo(() => {
    return videos;
  }, [videos]);

  const handleSingleDelete = (videoId: string, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // If files are currently selected, clicking trashcan deletes the selected files!
    const idsToDelete = selectedVideoIds.length > 0
      ? (selectedVideoIds.includes(videoId) ? [...selectedVideoIds] : [...selectedVideoIds, videoId])
      : [videoId];

    setWasInSelectionMode(selectedVideoIds.length > 0);
    setPendingDeleteIds(idsToDelete);
    setShowDeleteConfirm(true);
  };

  const handleBatchDelete = () => {
    if (selectedVideoIds.length === 0) return;
    setWasInSelectionMode(true);
    setPendingDeleteIds([...selectedVideoIds]);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setPendingDeleteIds([]);
  };

  const confirmDelete = async () => {
    const idsToDelete = pendingDeleteIds.length > 0 ? [...pendingDeleteIds] : [...selectedVideoIds];
    if (idsToDelete.length === 0) {
      setShowDeleteConfirm(false);
      return;
    }
    setShowDeleteConfirm(false);
    setPendingDeleteIds([]);
    setSelectedVideoIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    if (!wasInSelectionMode || idsToDelete.length >= selectedVideoIds.length) {
      setIsSelectionMode(false);
    }
    await deleteSelectedVideos(idsToDelete);
  };

  // Find target video object for single video prompt title display
  const targetVideoToDelete = useMemo(() => {
    if (pendingDeleteIds.length === 1) {
      return videos.find(v => v.id === pendingDeleteIds[0]) || null;
    }
    return null;
  }, [pendingDeleteIds, videos]);

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
        
        {/* Videos Count & Select Files Toggle */}
        <div className="self-start md:self-center flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedVideoIds([]);
              } else {
                setIsSelectionMode(true);
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              isSelectionMode 
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]" 
                : "bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSelectionMode ? "Exit Select" : "Select Files"}</span>
          </button>
          
          <span className="px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-sans tracking-wider font-semibold">
            {uploadedVideos.length === 1 ? "1 Video Mapped" : `${uploadedVideos.length} Videos Mapped`}
          </span>
        </div>
      </div>

      {/* Media Scan Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="video-scanner-station">
        {/* Scan Device Button Card */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/10 hover:border-slate-300/40 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-300/5 rounded-full blur-3xl pointer-events-none group-hover:bg-slate-300/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-slate-300/10 text-slate-100 group-hover:scale-105 group-hover:bg-slate-300/20 transition-all duration-300 flex items-center justify-center border border-slate-300/20">
              <FolderSync className="w-6 h-6 stroke-[1.5] animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-sans font-semibold text-white tracking-wide uppercase">
                Scan Device for Videos
              </span>
              <span className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                Scan and index individual video files or multi-file selections from any storage folder.
              </span>
              <span className="text-[10px] text-slate-300/90 font-medium tracking-wide uppercase mt-2.5 block border-t border-slate-300/10 pt-2.5">
                Instruction: Select individual video files or multiple files from your folders to scan and upload.
              </span>
            </div>
          </div>
          
          <button
            onClick={handleSmartScan}
            disabled={isScanning}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 hover:from-slate-300 hover:via-white hover:to-slate-300 text-stone-950 font-sans text-xs font-bold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 border-0 mt-2"
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

          {/* Dedicated Browse Options for Internal and External Storage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full">
            <button
              type="button"
              onClick={handleBrowseStorage}
              disabled={isScanning}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white font-sans text-xs font-semibold tracking-wide cursor-pointer transition-all active:scale-[98.5%] flex items-center justify-center gap-2"
              title="Browse all internal and external storage folders and files"
            >
              <Folder className="w-4 h-4 text-amber-400" />
              <span>Browse Storage</span>
            </button>
            <button
              type="button"
              onClick={handleBrowseFolder}
              disabled={isScanning}
              className="py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white font-sans text-xs font-semibold tracking-wide cursor-pointer transition-all active:scale-[98.5%] flex items-center justify-center gap-2"
              title="Browse folders across storage"
            >
              <FolderSync className="w-4 h-4 text-emerald-400" />
              <span>Browse Folders</span>
            </button>
          </div>
        </div>

        {/* Traditional Local Video Loader */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/10 hover:border-emerald-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/15 transition-all duration-300 flex items-center justify-center border border-emerald-500/20">
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
              accept="*/*,video/*,.mp4,.webm,.avi,.mkv,.mov,.3gp,.m4v,.ts,.flv,.wmv" 
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
            className="p-6 rounded-2xl bg-slate-950/20 border-2 border-slate-300/20 text-slate-200 flex flex-col md:flex-row items-center gap-6 shadow-[0_10px_30px_rgba(255,255,255,0.05)] overflow-hidden"
          >
            {/* Radar Circle */}
            <div className="w-24 h-24 rounded-full border-2 border-slate-300/30 relative flex items-center justify-center shrink-0 overflow-hidden bg-stone-950 shadow-[inset_0_0_15px_rgba(255,255,255,0.15)]">
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_60%,rgba(226,232,240,0.45)_100%)] animate-spin" style={{ animationDuration: "2.5s" }} />
              <div className="absolute w-16 h-16 rounded-full border border-slate-300/15" />
              <div className="absolute w-8 h-8 rounded-full border border-slate-300/10" />
              <div className="absolute inset-x-0 h-[2px] bg-slate-200/80 animate-[pulse_1.2s_infinite] shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <Video className="w-6 h-6 text-slate-200 stroke-[1.5] relative z-10 animate-bounce" />
            </div>

            <div className="flex flex-col gap-3 flex-1 w-full text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-ping" />
                  Automated Video Scanner Engaged
                </h4>
                <span className="font-mono text-[10px] text-slate-200 font-bold">{scanProgress}%</span>
              </div>

              <div className="bg-stone-950/70 border border-slate-300/10 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 flex items-center gap-2 min-h-[38px] truncate">
                <span className="text-slate-300 select-none">&gt;</span>
                <span className="truncate">{currentScanFile || "Initiating database handshake..."}</span>
              </div>

              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-white/5 relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-slate-400 via-white to-slate-400 shadow-[0_0_10px_rgba(255,255,255,0.4)] rounded-full"
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

        {/* Live Search Controls */}
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
              <div className="flex flex-col gap-3">
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
                      className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 select-none group ${
                        isPlayingActive
                          ? "bg-white/[0.04] border-white/30"
                          : isSelectedForDel
                            ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                            : "bg-[#0a0504]/60 hover:bg-[#150e0d]/60 border-stone-850 hover:border-slate-500/30 shadow-md"
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4">
                        {/* 1. Box for Checkmark - OFF the thumbnail, placed right NEXT TO the thumbnail picture */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectVideo(vid.id);
                          }}
                          className="p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center focus:outline-none"
                          title={isSelectedForDel ? "Deselect video" : "Select video"}
                        >
                          {isSelectedForDel ? (
                            <div className="w-6 h-6 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                          )}
                        </button>

                        {/* 2. Thumbnail Picture (Clean, NO buttons on top of it) */}
                        <div 
                          onClick={(e) => {
                            if (isSelectionMode) {
                              e.stopPropagation();
                              toggleSelectVideo(vid.id);
                            } else {
                              onPlayVideo(vid);
                            }
                          }}
                          className="w-24 sm:w-36 md:w-40 aspect-video rounded-lg overflow-hidden bg-black/70 border border-white/10 shrink-0 relative cursor-pointer group/thumb shadow-md"
                        >
                          <VideoThumbnail 
                            video={vid} 
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="p-1.5 sm:p-2 rounded-full bg-white/20 backdrop-blur-xs text-white scale-90 group-hover/thumb:scale-100 transition-all">
                              <Play className="w-3.5 h-3.5 fill-white text-white" />
                            </div>
                          </div>
                          {/* Duration tag */}
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-semibold text-white">
                            {vid.duration}
                          </span>
                        </div>

                        {/* 3. Title, Creator, Category */}
                        <div 
                          onClick={(e) => {
                            if (isSelectionMode) {
                              e.stopPropagation();
                              toggleSelectVideo(vid.id);
                            } else {
                              onPlayVideo(vid);
                            }
                          }}
                          className="flex-1 min-w-0 flex flex-col justify-center gap-1 cursor-pointer"
                        >
                          <span className={`text-sm sm:text-base font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                            {vid.name}
                          </span>
                          <div className="flex items-center gap-2 text-xs font-sans text-slate-300 truncate">
                            <span className="truncate">{vid.creator || "Local Creator"}</span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase text-[9px] tracking-wider text-slate-400 shrink-0">
                              {vid.category || "Personal Video"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Trashcan Icon - OFF the thumbnail, placed right NEXT TO the thumbnail and details */}
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleSingleDelete(vid.id, e);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          title="Delete video"
                          className="p-2 sm:p-2.5 rounded-xl bg-black/50 hover:bg-red-600 border border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 z-20 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                    <div className="flex flex-col gap-3">
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
                            className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 select-none group ${
                              isPlayingActive
                                ? "bg-white/[0.04] border-white/30"
                                : isSelectedForDel
                                  ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                  : "bg-[#0a0504]/60 hover:bg-[#150e0d]/60 border-stone-850 hover:border-slate-550/30 shadow-md"
                            }`}
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4">
                              {/* 1. Box for Checkmark - OFF the thumbnail, placed right NEXT TO the thumbnail picture */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectVideo(vid.id);
                                }}
                                className="p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center focus:outline-none"
                                title={isSelectedForDel ? "Deselect video" : "Select video"}
                              >
                                {isSelectedForDel ? (
                                  <div className="w-6 h-6 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                )}
                              </button>

                              {/* 2. Thumbnail Picture (Clean, NO buttons on top of it) */}
                              <div 
                                onClick={(e) => {
                                  if (isSelectionMode) {
                                    e.stopPropagation();
                                    toggleSelectVideo(vid.id);
                                  } else {
                                    onPlayVideo(vid);
                                  }
                                }}
                                className="w-24 sm:w-36 md:w-40 aspect-video rounded-lg overflow-hidden bg-black/70 border border-white/10 shrink-0 relative cursor-pointer group/thumb shadow-md"
                              >
                                <VideoThumbnail 
                                  video={vid} 
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                />
                                {/* Play button overlay */}
                                <div className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                                  <div className="p-1.5 sm:p-2 rounded-full bg-white/20 backdrop-blur-xs text-white scale-90 group-hover/thumb:scale-100 transition-all">
                                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                                  </div>
                                </div>
                                {/* Duration tag */}
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-semibold text-white">
                                  {vid.duration}
                                </span>
                              </div>

                              {/* 3. Title, Creator, Category */}
                              <div 
                                onClick={(e) => {
                                  if (isSelectionMode) {
                                    e.stopPropagation();
                                    toggleSelectVideo(vid.id);
                                  } else {
                                    onPlayVideo(vid);
                                  }
                                }}
                                className="flex-1 min-w-0 flex flex-col justify-center gap-1 cursor-pointer"
                              >
                                <span className={`text-sm sm:text-base font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                                  {vid.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs font-sans text-slate-300 truncate">
                                  <span className="truncate">{vid.creator || "Local Creator"}</span>
                                  <span>•</span>
                                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase text-[9px] tracking-wider text-slate-400 shrink-0">
                                    {vid.category || "Personal Video"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 4. Trashcan Icon - OFF the thumbnail, placed right NEXT TO the thumbnail and details */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleSingleDelete(vid.id, e);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Delete video"
                                className="p-2 sm:p-2.5 rounded-xl bg-black/50 hover:bg-red-600 border border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 z-20 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                    <div className="flex flex-col gap-3">
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
                            className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 select-none group ${
                              isPlayingActive
                                ? "bg-white/[0.04] border-white/30"
                                : isSelectedForDel
                                  ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                  : "bg-[#0a0504]/60 hover:bg-[#150e0d]/60 border-stone-850 hover:border-slate-550/30 shadow-md"
                            }`}
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4">
                              {/* 1. Box for Checkmark - OFF the thumbnail, placed right NEXT TO the thumbnail picture */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectVideo(vid.id);
                                }}
                                className="p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center focus:outline-none"
                                title={isSelectedForDel ? "Deselect video" : "Select video"}
                              >
                                {isSelectedForDel ? (
                                  <div className="w-6 h-6 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                )}
                              </button>

                              {/* 2. Thumbnail Picture (Clean, NO buttons on top of it) */}
                              <div 
                                onClick={(e) => {
                                  if (isSelectionMode) {
                                    e.stopPropagation();
                                    toggleSelectVideo(vid.id);
                                  } else {
                                    onPlayVideo(vid);
                                  }
                                }}
                                className="w-24 sm:w-36 md:w-40 aspect-video rounded-lg overflow-hidden bg-black/70 border border-white/10 shrink-0 relative cursor-pointer group/thumb shadow-md"
                              >
                                <VideoThumbnail 
                                  video={vid} 
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                />
                                {/* Play button overlay */}
                                <div className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                                  <div className="p-1.5 sm:p-2 rounded-full bg-white/20 backdrop-blur-xs text-white scale-90 group-hover/thumb:scale-100 transition-all">
                                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                                  </div>
                                </div>
                                {/* Duration tag */}
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-semibold text-white">
                                  {vid.duration}
                                </span>
                              </div>

                              {/* 3. Title, Creator, Category */}
                              <div 
                                onClick={(e) => {
                                  if (isSelectionMode) {
                                    e.stopPropagation();
                                    toggleSelectVideo(vid.id);
                                  } else {
                                    onPlayVideo(vid);
                                  }
                                }}
                                className="flex-1 min-w-0 flex flex-col justify-center gap-1 cursor-pointer"
                              >
                                <span className={`text-sm sm:text-base font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                                  {vid.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs font-sans text-slate-300 truncate">
                                  <span className="truncate">{vid.creator || "Local Creator"}</span>
                                  <span>•</span>
                                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase text-[9px] tracking-wider text-slate-400 shrink-0">
                                    {vid.category || "Personal Video"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 4. Trashcan Icon - OFF the thumbnail, placed right NEXT TO the thumbnail and details */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleSingleDelete(vid.id, e);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Delete video"
                                className="p-2 sm:p-2.5 rounded-xl bg-black/50 hover:bg-red-600 border border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 z-20 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      {/* HTML5 Local Storage Input Element configured for individual or multi-file selection */}
      <input 
        type="file"
        id="video-scanner"
        ref={videoScanInputRef}
        accept="*/*,video/*,.mp4,.webm,.avi,.mkv,.mov,.3gp,.m4v,.ts,.flv,.wmv"
        multiple
        onChange={handleWebFolderScanChange}
        className="hidden"
      />
      <input 
        type="file"
        id="video-storage-browser"
        accept="*/*"
        multiple
        onChange={handleWebFolderScanChange}
        className="hidden"
      />
      <input 
        type="file"
        id="video-folder-browser"
        {...({ webkitdirectory: "", directory: "" } as any)}
        multiple
        onChange={handleWebFolderScanChange}
        className="hidden"
      />

      {/* Floating Sticky Bottom Selection Action Bar */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto bg-[#140e0d]/95 backdrop-blur-xl border border-amber-500/40 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.15)] rounded-2xl px-5 py-3.5 flex items-center gap-3 sm:gap-5 max-w-xl w-full justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {selectedVideoIds.length}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white tracking-wide">
                    {selectedVideoIds.length === 1 ? "1 video selected" : `${selectedVideoIds.length} videos selected`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedVideoIds.length === filteredVideos.length ? "All videos selected" : "Tap items to toggle"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  {isAllSelected ? "Deselect All" : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedVideoIds([]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedVideoIds.length === 0}
                  onClick={handleBatchDelete}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(239,68,68,0.3)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Prompt: Delete Video? Yes or No */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#090b0f] border border-stone-800 rounded-2xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                  <Trash2 className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-wide">
                    {pendingDeleteIds.length > 1 ? "Delete Selected Videos?" : "Delete Video?"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-light">
                    System prompt confirmation
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 font-normal leading-relaxed mb-6">
                {targetVideoToDelete ? (
                  <>
                    Are you sure you want to delete <strong className="text-white font-semibold">"{targetVideoToDelete.name}"</strong>?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete {pendingDeleteIds.length > 1 ? `the ${pendingDeleteIds.length} selected videos` : "this video"}?
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="px-5 py-2.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-sans font-semibold transition-all cursor-pointer active:scale-95 min-w-[70px] text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-sans font-bold transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-500/20 min-w-[70px] text-center"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
