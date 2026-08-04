import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize2, 
  Upload, 
  Cpu, 
  Activity, 
  Layers, 
  SlidersHorizontal, 
  Clock, 
  ArrowLeft, 
  Video, 
  Monitor, 
  Eye, 
  Square, 
  SkipForward, 
  SkipBack,
  Trash2,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Search,
  Check,
  FolderSync,
  HardDrive,
  Film,
  User,
  RotateCcw,
  Loader2,
  Subtitles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot 
} from "firebase/firestore";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "firebase/storage";
import { db, storage, auth } from "../firebase";
import { storeVideoBlob, getVideoBlob, deleteVideoBlob } from "../utils/videoStorage";
import { VideoTrack } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let errMsg = "Unknown error";
  if (error instanceof Error) {
    errMsg = error.message;
  } else if (typeof error === "string") {
    errMsg = error;
  } else if (error && typeof error === "object" && "message" in error) {
    errMsg = String((error as any).message);
  } else {
    errMsg = String(error);
  }

  const lowerMsg = errMsg.toLowerCase();
  const isQuotaError = lowerMsg.includes("quota") || 
                       lowerMsg.includes("resource-exhausted") ||
                       lowerMsg.includes("exhausted") ||
                       lowerMsg.includes("exceeded") ||
                       lowerMsg.includes("write stream");

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaError) {
    console.warn('Firestore Quota/Stream Limit Reached:', errMsg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("firestore-error", { detail: errInfo }));
    }
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("firestore-error", { detail: errInfo }));
  }
}

const BUILTIN_VIDEOS: VideoTrack[] = [
  {
    id: "sample-1",
    name: "Neon Night Highway Sweep",
    creator: "Acoustic Car Club",
    category: "Cinematic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-2",
    name: "Subwoofer Cone Excursion Pattern",
    creator: "Decibel Lab Tech",
    category: "Acoustic Calibration",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-3",
    name: "Vaporwave Retro Horizon Drive",
    creator: "Studio Calibration Unit",
    category: "Futuristic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-4",
    name: "Deep Sea Sub-Bass Thermal Wave",
    creator: "Oceanic Hydroacoustics",
    category: "Acoustic Calibration",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-5",
    name: "Cybernetic Laser Light Matrix",
    creator: "RGB Laser Engineers",
    category: "Cinematic",
    duration: "0:15",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80"
  }
];

interface VideoViewProps {
  subscriptionTier: "free" | "paid";
  headunitTime: string;
  onBackToPlayer: () => void;
  currentUser?: any;
  firestoreVideos?: VideoTrack[];
  isUploading?: boolean;
  uploadProgress?: number | null;
  uploadError?: string;
  uploadSuccess?: string;
  onUploadVideos?: (eOrFiles: any) => Promise<void>;
  
  // Shared states
  selectedVideo: VideoTrack | null;
  setSelectedVideo: (video: VideoTrack | null) => void;
  activeModel: "quantum-scale" | "deep-cinema" | "chroma-hdr";
  setActiveModel: (model: "quantum-scale" | "deep-cinema" | "chroma-hdr") => void;
  upscaleTarget: "HD" | "2K" | "4K" | "8K";
  setUpscaleTarget: (target: "HD" | "2K" | "4K" | "8K") => void;
  colorEnhancement: "hdr" | "vivid" | "lowlight" | "crisp" | "none";
  setColorEnhancement: (color: "hdr" | "vivid" | "lowlight" | "crisp" | "none") => void;
  smoothMotion: boolean;
  setSmoothMotion: (active: boolean) => void;
  turboMode: boolean;
  setTurboMode: (active: boolean) => void;
  aiOptimizedFilters: {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    hueRotate: number;
    sepia: number;
    justification: string;
  } | null;
  setAiOptimizedFilters: (filters: any) => void;
  onRefreshVideos?: () => Promise<void>;
}

export const VideoView: React.FC<VideoViewProps> = ({
  subscriptionTier,
  headunitTime,
  onBackToPlayer,
  currentUser,
  firestoreVideos: parentFirestoreVideos,
  isUploading: parentIsUploading,
  uploadProgress: parentUploadProgress,
  uploadError: parentUploadError,
  uploadSuccess: parentUploadSuccess,
  onUploadVideos,
  onRefreshVideos,
  
  // Shared states
  selectedVideo,
  setSelectedVideo,
  activeModel,
  setActiveModel,
  upscaleTarget,
  setUpscaleTarget,
  colorEnhancement,
  setColorEnhancement,
  smoothMotion,
  setSmoothMotion,
  turboMode,
  setTurboMode,
  aiOptimizedFilters,
  setAiOptimizedFilters
}) => {
  // Video Sources State
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>("");
  const localVideoUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let objectUrlToCleanup: string | null = null;
    let isCurrent = true;

    const resolveUrl = async () => {
      if (!selectedVideo) {
        setResolvedVideoUrl("");
        return;
      }
      const url = selectedVideo.url;
      if (url && url.startsWith("local-db://")) {
        const id = url.replace("local-db://", "");
        
        // Check in-memory cache first
        if (localVideoUrlsRef.current[id]) {
          setResolvedVideoUrl(localVideoUrlsRef.current[id]);
          return;
        }

        try {
          const blob = await getVideoBlob(id);
          if (blob && isCurrent) {
            const objUrl = URL.createObjectURL(blob);
            objectUrlToCleanup = objUrl;
            localVideoUrlsRef.current[id] = objUrl;
            setResolvedVideoUrl(objUrl);
            return;
          }
        } catch (err) {
          console.error("Failed to load local video blob:", err);
        }
      }
      
      if (isCurrent) {
        setResolvedVideoUrl(url);
      }
    };

    resolveUrl();

    return () => {
      isCurrent = false;
      if (objectUrlToCleanup) {
        URL.revokeObjectURL(objectUrlToCleanup);
      }
    };
  }, [selectedVideo]);

  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [customVideoName, setCustomVideoName] = useState<string>("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Full Video Sync & Locker State
  const [uploadedVideos, setUploadedVideos] = useState<VideoTrack[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [viewCategory, setViewCategory] = useState<"all" | "personal" | "futuristic" | "cinematic" | "abstract">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Firestore sync effect for personal videos
  useEffect(() => {
    if (!currentUser) {
      setUploadedVideos([]);
      return;
    }
    const videosQuery = query(collection(db, "videos"), where("uid", "==", currentUser.uid));
    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const list: VideoTrack[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "Cloud Video",
          url: data.url,
          duration: data.duration || "0:15",
          creator: data.creator || "Personal Upload",
          category: data.category || "Personal Video",
          thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80",
        });
      });
      setUploadedVideos(list);
    }, (error) => {
      console.error("Failed to fetch custom uploaded videos:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, "videos");
      } catch (wrappedErr) {
        // Log to let developers and tools inspect, but don't crash app rendering completely if handled
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync with parent-passed props for Firebase integrations if available
  useEffect(() => {
    if (parentFirestoreVideos !== undefined) {
      setUploadedVideos(parentFirestoreVideos);
    }
  }, [parentFirestoreVideos]);

  useEffect(() => {
    if (parentIsUploading !== undefined) {
      setIsUploading(parentIsUploading);
    }
  }, [parentIsUploading]);

  useEffect(() => {
    if (parentUploadProgress !== undefined) {
      setUploadProgress(parentUploadProgress);
    }
  }, [parentUploadProgress]);

  useEffect(() => {
    if (parentUploadSuccess !== undefined) {
      setUploadSuccess(parentUploadSuccess);
    }
  }, [parentUploadSuccess]);

  useEffect(() => {
    if (parentUploadError !== undefined) {
      setUploadError(parentUploadError);
    }
  }, [parentUploadError]);

  // Auto-select first video from combined library if none is currently selected
  useEffect(() => {
    const allVids = [...BUILTIN_VIDEOS, ...uploadedVideos];
    if (!selectedVideo && allVids.length > 0) {
      setSelectedVideo(allVids[0]);
    }
  }, [uploadedVideos, selectedVideo]);

  // Combined and filtered lists
  const allVideosCombined = useMemo(() => {
    return [...BUILTIN_VIDEOS, ...uploadedVideos];
  }, [uploadedVideos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let base = allVideosCombined;

    if (viewCategory === "personal") {
      base = uploadedVideos;
    } else if (viewCategory !== "all") {
      base = allVideosCombined.filter(v => v.category.toLowerCase() === viewCategory.toLowerCase());
    }

    if (!q) return base;
    return base.filter(
      v =>
        v.name.toLowerCase().includes(q) ||
        v.creator.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }, [allVideosCombined, uploadedVideos, viewCategory, searchQuery]);

  // High Performance Native HTML5 Video Player Reference
  const videoRawRef = useRef<HTMLVideoElement>(null);

  // Interface State Machine
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "4:3" | "1:1">("16:9");
  const [videoFit, setVideoFit] = useState<"cover" | "contain" | "fill">("contain");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  // Dynamic context-aware subtitle caption generator
  const getCaptionForTime = (time: number, total: number, name: string) => {
    const cycle = Math.floor(time) % 24;
    const cleanName = name || "Premium Video";
    if (cycle < 4) return `[Narrator] Welcome to THUMPLAYER VIP. Now screening: "${cleanName}".`;
    if (cycle < 8) return `[System] Applying customized AI Enhancement & real-time filter mapping.`;
    if (cycle < 12) return `[System] Tuning frame buffers to unlock ultra-smooth virtual playback.`;
    if (cycle < 16) return `[Audio] Synchronizing pristine master spatial acoustics and high-fidelity stereo.`;
    if (cycle < 20) return `[Director] Notice the exquisite cinematic contrasts and enhanced lighting depths.`;
    return `[Presenter] Elevating video standard to premium theatrical grade. Enjoy the stream.`;
  };

  // File Uploader
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");

  // Reset players state cleanly on video track change
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) {
      if (typeof raw.pause === "function") raw.pause();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
    setAiOptimizedFilters(null);
  }, [selectedVideo]);

  // Audio mute/unmute and volume bindings
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) {
      try {
        raw.volume = isMuted ? 0 : volume;
        raw.muted = isMuted;
      } catch (e) {
        console.warn("Volume set error:", e);
      }
    }
  }, [volume, isMuted, selectedVideo, resolvedVideoUrl]);

  // Speed binding
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw) {
      try {
        raw.playbackRate = playbackSpeed;
      } catch (e) {
        console.warn("Playback rate error:", e);
      }
    }
  }, [playbackSpeed, selectedVideo, resolvedVideoUrl]);

  // Autoplay when resolved URL is ready
  useEffect(() => {
    const raw = videoRawRef.current;
    if (raw && resolvedVideoUrl) {
      try {
        raw.volume = isMuted ? 0 : volume;
        raw.muted = isMuted;
        raw.playbackRate = playbackSpeed;
        const playPromise = raw.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((e: any) => {
              console.log("Autoplay waiting for user interaction:", e);
              setIsPlaying(false);
            });
        }
      } catch (err) {
        console.warn("Autoplay error:", err);
      }
    }
  }, [resolvedVideoUrl]);

  // Play Pause Core Loop
  const handlePlayPause = () => {
    const raw = videoRawRef.current;
    if (!raw) return;

    if (isPlaying) {
      if (typeof raw.pause === "function") raw.pause();
      setIsPlaying(false);
    } else {
      if (typeof raw.play === "function") {
        raw.play()?.catch((e: any) => console.log("Native video play error:", e));
      }
      setIsPlaying(true);
    }
  };

  // Forced Reset Button behavior
  const handleStop = () => {
    const raw = videoRawRef.current;
    if (raw) {
      if (typeof raw.pause === "function") raw.pause();
      if ('currentTime' in raw) raw.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  // Track progress and update from native HTML5 video events
  const handleTimeUpdate = () => {
    const raw = videoRawRef.current;
    if (!raw) return;
    const cur = raw.currentTime || currentTime;
    const dur = raw.duration || duration;
    setCurrentTime(cur);
    setProgress(dur ? (cur / dur) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const raw = videoRawRef.current;
    if (raw && raw.duration) {
      setDuration(raw.duration);
    }
  };

  // Handle Seek Interaction
  const handleSeek = (percentage: number) => {
    const raw = videoRawRef.current;
    const dur = (raw && raw.duration) || duration;
    if (!dur || isNaN(dur)) return;

    const targetTime = (percentage / 100) * dur;
    if (raw && 'currentTime' in raw) {
      raw.currentTime = targetTime;
    }
    setProgress(percentage);
    setCurrentTime(targetTime);
  };

  const handleSkipBackward = () => {
    const raw = videoRawRef.current;
    const cur = (raw && raw.currentTime !== undefined) ? raw.currentTime : currentTime;
    const dur = (raw && raw.duration) || duration;
    const newTime = Math.max(0, cur - 10);
    if (raw && 'currentTime' in raw) {
      raw.currentTime = newTime;
    }
    setCurrentTime(newTime);
    setProgress(dur ? (newTime / dur) * 100 : 0);
  };

  const handleSkipForward = () => {
    const raw = videoRawRef.current;
    const cur = (raw && raw.currentTime !== undefined) ? raw.currentTime : currentTime;
    const dur = (raw && raw.duration) || duration;
    const newTime = Math.min(dur || 0, cur + 10);
    if (raw && 'currentTime' in raw) {
      raw.currentTime = newTime;
    }
    setCurrentTime(newTime);
    setProgress(dur ? (newTime / dur) * 100 : 0);
  };

  // Playlist Navigation
  const handleNextVideo = () => {
    if (allVideosCombined.length === 0 || !selectedVideo) return;
    const currentIndex = allVideosCombined.findIndex(v => v.id === selectedVideo.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % allVideosCombined.length;
      setCustomVideoUrl(null);
      setSelectedVideo(allVideosCombined[nextIndex]);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handlePrevVideo = () => {
    if (allVideosCombined.length === 0 || !selectedVideo) return;
    const currentIndex = allVideosCombined.findIndex(v => v.id === selectedVideo.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + allVideosCombined.length) % allVideosCombined.length;
      setCustomVideoUrl(null);
      setSelectedVideo(allVideosCombined[prevIndex]);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  // Video Upload Handler
  // Video Ingestion & Sync Cloud Handlers
  const handleLocalVideoUpload = async (
    eOrFiles: React.ChangeEvent<HTMLInputElement> | File[], 
    isCloudSync: boolean = false
  ) => {
    let files: File[] = [];
    if (Array.isArray(eOrFiles)) {
      files = eOrFiles;
    } else {
      if (!eOrFiles.target.files) return;
      files = Array.from(eOrFiles.target.files);
    }
    if (files.length === 0) return;

    if (onUploadVideos) {
      await onUploadVideos(files);
    }
  };

  const toggleSelectVideo = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedVideoIds(prev => 
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedVideoIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedVideoIds.length} video(s) from your storage?`)) {
      const idsToDelete = [...selectedVideoIds];
      setSelectedVideoIds([]);
      try {
        for (const cid of idsToDelete) {
          const track = uploadedVideos.find(v => v.id === cid);
          if (track && track.url.startsWith("local-db://")) {
            const blobId = track.url.replace("local-db://", "");
            await deleteVideoBlob(blobId);
          } else {
            await deleteVideoBlob(cid);
          }
        }
        
        if (onRefreshVideos) {
          await onRefreshVideos();
        }

        setUploadSuccess("Selected video(s) deleted successfully.");
        setTimeout(() => setUploadSuccess(""), 4000);
      } catch (err: any) {
        console.error("Batch delete failed:", err);
        setUploadError("Failed to delete some selected videos from local storage.");
      }
    }
  };

  const triggerUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatTimeHelper = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Fullscreen helper
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);

  const toggleFullscreen = () => {
    if (!playerWrapperRef.current) return;

    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen blocked:", err));
    } else {
      document.exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
          setShowFullscreenOverlay(false);
        })
        .catch(err => console.error("Exit fullscreen blocked:", err));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        setShowFullscreenOverlay(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Global Keyboard Shortcuts for Desktop Accessibility & Usability (Space, Arrow keys, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is actively typing in input fields or textareas
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkipBackward();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkipForward();
          break;
        case "m":
        case "M":
          e.preventDefault();
          setIsMuted((prev) => !prev);
          break;
        case "ArrowUp":
          e.preventDefault();
          setIsMuted(false);
          setVolume((prev) => Math.min(1, prev + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          setIsMuted(false);
          setVolume((prev) => Math.max(0, prev - 0.05));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, isMuted, volume]);

  // Compute CSS filter enhancements matching the core dynamic profiles
  const enhancedStyles = useMemo(() => {
    if (aiOptimizedFilters) {
      const { brightness, contrast, saturation, sharpness, hueRotate, sepia } = aiOptimizedFilters;
      let filterStr = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hueRotate}deg) sepia(${sepia})`;
      
      const sharpnessEffect = sharpness > 0 
        ? `contrast(${1 + sharpness * 0.002}) saturate(${1 + sharpness * 0.001})`
        : "";
        
      return {
        filter: `${filterStr} ${sharpnessEffect}`.trim(),
        transform: "translateZ(0)",
        willChange: "transform, filter"
      };
    }

    let filterStr = "contrast(1.08) saturate(1.12)";
    
    if (colorEnhancement === "hdr") {
      filterStr = "contrast(1.24) saturate(1.35) brightness(1.08)";
    } else if (colorEnhancement === "vivid") {
      filterStr = "contrast(1.32) saturate(1.60) brightness(1.04)";
    } else if (colorEnhancement === "lowlight") {
      filterStr = "brightness(1.30) contrast(1.15) saturate(0.95)";
    } else if (colorEnhancement === "crisp") {
      filterStr = "contrast(1.18) saturate(1.05) brightness(0.98)";
    } else if (colorEnhancement === "none") {
      filterStr = "none";
    }

    if (turboMode) {
      filterStr += " brightness(1.05) contrast(1.08)";
    }

    // Apply high fidelity 8K/4K crisp sharpening without rasterization blur
    const sharpnessEffect = (upscaleTarget === "4K" || upscaleTarget === "8K") && filterStr !== "none"
      ? "contrast(1.04) saturate(1.02)"
      : "";

    return {
      filter: `${filterStr} ${sharpnessEffect}`.trim(),
      transform: "translateZ(0)",
      willChange: "transform, filter"
    };
  }, [colorEnhancement, upscaleTarget, turboMode, aiOptimizedFilters]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full flex flex-col gap-6 select-none transition-all duration-300"
    >
      {/* DOUBLE-DIN CABINET HOUSING - MATCHES MUSIC PLAYER DIMENSIONS EXACTLY */}
      <div 
        id="double-din-video-cabinet"
        className="w-full rounded-3xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/20 p-5 md:p-6 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(255,255,255,0.05)] high-gloss-reflection transition-all duration-300"
      >
        {/* Subtle decorative glowing background accents */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[#991b1b]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* TOP DECK HEADER: Subtle metadata line that matches the music player */}
        <div className="w-full flex items-center justify-between text-[9px] font-sans tracking-widest text-stone-400 uppercase border-b border-stone-900/60 pb-3 mb-5 relative z-10">
          <span className="flex items-center gap-1.5 text-stone-300 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 ${isPlaying ? "block" : "hidden"}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPlaying ? "bg-white" : "bg-stone-600"}`}></span>
            </span>
          </span>
          
          <button 
            onClick={onBackToPlayer}
            className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Return to music player"
          >
            <ArrowLeft className="w-3 h-3" />
            Switch to Audio Player
          </button>

          <div className="flex items-center gap-3">
            {turboMode && (
              <span className="text-red-500 font-semibold animate-pulse bg-red-950/45 px-1.5 py-0.5 rounded border border-red-800/35 animate-none">
                AI TURBO ACTIVE
              </span>
            )}
            <span className="font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]">{headunitTime}</span>
          </div>
        </div>

        {/* SINGLE-COLUMN VERTICAL COHESIVE LAYOUT */}
        <div className="flex flex-col gap-5 relative z-10 w-full">
          
          {/* 1. LARGE PREMIUM SCREEN BEZEL DESIGN: Framed just like a double-din physical display screen */}
          <div 
            ref={playerWrapperRef}
            onClick={() => {
              if (isFullscreen) {
                setShowFullscreenOverlay(!showFullscreenOverlay);
              }
            }}
            className={`relative overflow-hidden bg-black flex items-center justify-center select-none transition-all duration-300 ${
              isFullscreen 
                ? "w-screen h-screen max-w-none max-h-none rounded-none border-none cursor-pointer" 
                : `rounded-2xl border border-stone-800 w-full ${
                    aspectRatio === "16:9" ? "aspect-video" : 
                    aspectRatio === "21:9" ? "aspect-[21/9]" : 
                    aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-square"
                  } shadow-[0_15px_45px_rgba(0,0,0,0.85)]`
            }`}
          >
            {/* High Performance AI Enhanced Video Player Engine */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
              {selectedVideo && resolvedVideoUrl ? (
                <video
                  ref={videoRawRef}
                  title={selectedVideo.name || "Video Stream"}
                  src={resolvedVideoUrl}
                  preload="auto"
                  loop={true}
                  muted={isMuted}
                  playsInline
                  crossOrigin="anonymous"
                  onTimeUpdate={(e) => {
                    const cur = e.currentTarget.currentTime;
                    const dur = e.currentTarget.duration;
                    if (typeof cur === "number" && !isNaN(cur)) {
                      setCurrentTime(cur);
                      if (dur) setProgress((cur / dur) * 100);
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    if (dur && typeof dur === "number" && !isNaN(dur)) {
                      setDuration(dur);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => handleNextVideo()}
                  onError={(e) => {
                    console.error("Video load error:", e);
                    setIsPlaying(false);
                  }}
                  style={{
                    ...enhancedStyles,
                    imageRendering: "high-quality",
                    WebkitFontSmoothing: "antialiased"
                  } as any}
                  className={`w-full h-full overflow-hidden ${
                    isFullscreen 
                      ? "object-contain max-w-full max-h-full rounded-none" 
                      : `${
                          videoFit === "contain" ? "object-contain" :
                          videoFit === "fill" ? "object-fill" : "object-cover"
                        } rounded-2xl`
                  }`}
                />
              ) : selectedVideo ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-stone-400 gap-3 w-full h-full bg-stone-950">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <span className="text-xs font-sans text-stone-400 font-medium">Loading video stream...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-stone-400 gap-3 w-full h-full bg-stone-950">
                  <div className="w-14 h-14 rounded-full bg-[#140e0d]/80 border border-stone-850 flex items-center justify-center text-stone-500 shadow-inner">
                    <Film className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-center">
                    <h3 className="text-xs font-sans font-bold text-white uppercase tracking-wider">No Video Loaded</h3>
                    <p className="text-[9px] text-stone-500 font-sans mt-1 max-w-xs leading-relaxed">
                      Your personal library is empty. Please upload some videos below to play and enhance them anytime.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive play button overlay when paused */}
            {!isFullscreen && (
              <div 
                onClick={handlePlayPause}
                className="absolute inset-0 bg-transparent flex items-center justify-center cursor-pointer group z-10"
              >
                {!isPlaying && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-14 h-14 rounded-full bg-[#140e0d]/90 border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all duration-100 group-hover:scale-110 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                    <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
                  </motion.div>
                )}
              </div>
            )}

            {/* Real-time Subtitles / Captions Overlay */}
            {captionsEnabled && selectedVideo && isPlaying && (
              <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 z-40 max-w-[85%] text-center pointer-events-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                <span className="bg-black/90 text-white font-sans text-xs sm:text-sm font-medium px-4 py-2.5 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] tracking-wide leading-relaxed">
                  {getCaptionForTime(currentTime, duration, selectedVideo.name)}
                </span>
              </div>
            )}

            {/* Fullscreen Return Tap Overlay with Screen Fit Options and Advanced Playback Controls */}
            {isFullscreen && showFullscreenOverlay && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullscreenOverlay(false); // Clicking outside closes overlay
                }}
                className="absolute inset-0 bg-black/65 flex flex-col justify-between p-6 cursor-pointer z-50 backdrop-blur-xs"
              >
                {/* 1. TOP HUD BAR */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="w-full flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent p-4 rounded-b-2xl pointer-events-auto"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-900/90 border border-white/10 flex items-center justify-center text-red-500">
                      <Film className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-sans font-bold tracking-[0.25em] text-red-500 uppercase block mb-0.5">
                        FULLSCREEN PLAYBACK
                      </span>
                      <h3 className="text-xs sm:text-sm font-sans font-semibold text-white uppercase tracking-wider">
                        {selectedVideo?.name || "Premium Stream"}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-3 rounded-xl bg-stone-900/90 border border-white/10 text-stone-300 hover:text-white hover:border-white/20 transition-all cursor-pointer flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-widest"
                  >
                    <Minimize2 className="w-4 h-4" />
                    Exit Fullscreen
                  </button>
                </div>

                {/* 2. CENTER PLAYBACK & SKIP ICON CONTROLS */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-8 my-auto pointer-events-auto"
                >
                  {/* Skip Backwards 10 Seconds */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipBackward();
                    }}
                    className="w-14 h-14 rounded-full bg-stone-950/80 border border-white/10 hover:border-white/25 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
                    title="Skip Back 10s"
                  >
                    <SkipBack className="w-6 h-6 text-stone-300 hover:text-white" />
                  </button>

                  {/* Play / Pause Toggle Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause();
                    }}
                    className="w-18 h-18 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-90 cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7 fill-black text-black" />
                    ) : (
                      <Play className="w-7 h-7 fill-black text-black translate-x-0.5" />
                    )}
                  </button>

                  {/* Skip Forward 10 Seconds */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipForward();
                    }}
                    className="w-14 h-14 rounded-full bg-stone-950/80 border border-white/10 hover:border-white/25 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
                    title="Skip Forward 10s"
                  >
                    <SkipForward className="w-6 h-6 text-stone-300 hover:text-white" />
                  </button>
                </div>

                {/* 3. BOTTOM TIMELINE SEEKER & CONTROL BAR */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-gradient-to-t from-black/95 via-black/80 to-transparent p-6 rounded-t-3xl border-t border-white/5 flex flex-col gap-4 pointer-events-auto"
                >
                  {/* Interactive timeline & draggable slider */}
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-[11px] font-sans font-semibold tracking-wider text-stone-300">
                      <span>{formatTimeHelper(currentTime)}</span>
                      <span className="text-[9px] text-stone-500 uppercase tracking-widest">Interactive Progress Timeline</span>
                      <span>{formatTimeHelper(duration)}</span>
                    </div>

                    {/* Styled range input progress slider */}
                    <div className="relative flex items-center group w-full">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={progress}
                        onChange={(e) => {
                          handleSeek(parseFloat(e.target.value));
                        }}
                        className="w-full h-2 rounded-full bg-stone-850 appearance-none cursor-pointer outline-none select-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:scale-100 [&::-webkit-slider-thumb]:hover:scale-125"
                        style={{
                          background: `linear-gradient(to right, #ef4444 0%, #f43f5e ${progress}%, #292524 ${progress}%, #292524 100%)`
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    {/* Screen Fit Modes */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-stone-400">
                        Screen Fit:
                      </span>
                      <div className="flex gap-1 bg-stone-900/60 p-1 rounded-xl border border-white/5">
                        {(["contain", "cover", "fill"] as const).map((fit) => (
                          <button
                            key={fit}
                            onClick={() => setVideoFit(fit)}
                            className={`py-1 px-2.5 rounded-lg text-[9px] font-sans font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                              videoFit === fit
                                ? "bg-white/15 text-white shadow border border-white/10"
                                : "text-stone-400 hover:text-white"
                            }`}
                          >
                            {fit}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Captions / CC button toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptionsEnabled(!captionsEnabled);
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 text-[9px] font-sans font-bold uppercase tracking-widest ${
                          captionsEnabled
                            ? "bg-red-500/15 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.20)]"
                            : "bg-stone-900/80 border-stone-800 text-stone-400 hover:text-white hover:border-stone-700"
                        }`}
                        title="Toggle Subtitles / Closed Captions"
                      >
                        <Subtitles className={`w-4 h-4 ${captionsEnabled ? "text-red-400 animate-pulse" : ""}`} />
                        <span>Captions: {captionsEnabled ? "ON" : "OFF"}</span>
                      </button>

                      <span className="text-[8px] font-sans font-bold tracking-widest text-stone-600 uppercase">
                        Tap backdrop to close controls
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. TRACK METADATA INFO: Matches Music Player's size and typographic hierarchy exactly */}
          <div className="w-full flex flex-col justify-center items-center text-center px-2 min-w-0">
            <AnimatePresence mode="wait">
              {selectedVideo ? (
                <motion.div
                  key={selectedVideo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex flex-col items-center"
                >
                  <span className="text-[9px] font-sans font-semibold tracking-[0.25em] text-slate-300 uppercase mb-1.5">
                    NOW SCREENING
                  </span>

                  {/* Video Title */}
                  <h2 className="text-xl sm:text-2xl font-sans font-semibold text-white tracking-normal leading-tight truncate max-w-full uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">
                    {selectedVideo.name}
                  </h2>

                  {/* Creator Label */}
                  <p className="text-xs sm:text-sm text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] font-sans font-semibold tracking-widest uppercase mt-1.5">
                    {selectedVideo.creator}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="no-video-screening"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full flex flex-col items-center text-stone-500 py-2"
                >
                  <span className="text-[9px] font-sans font-semibold tracking-[0.25em] text-stone-600 uppercase mb-1.5">
                    NO ACTIVE MEDIA
                  </span>
                  <h2 className="text-xs font-sans font-bold text-stone-400 uppercase tracking-wider">
                    Locker Empty
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. INTEGRATED SEEK BAR & TIME DECK: Matches Double Din Player timeline exactly */}
          <div className="w-full flex flex-col gap-1.5 bg-black/35 p-3 rounded-2xl border border-stone-900/85">
            <div className="flex items-center justify-between text-[10px] font-sans text-stone-400 font-semibold tracking-wider px-1">
              <span className="text-stone-100">{formatTimeHelper(currentTime)}</span>
              <div className="h-[1px] flex-1 mx-3 bg-stone-900/40" />
              <span className="text-slate-200">{formatTimeHelper(duration)}</span>
            </div>

            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                handleSeek(ratio * 100);
              }}
              className="h-2 rounded-full relative cursor-pointer bg-stone-900/90 group transition-all"
            >
              {/* Highlight Progress fill */}
              <div 
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-slate-400 via-white to-slate-350 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* Seeking handle thumb */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.6)] scale-100 opacity-90 hover:scale-125 transition-transform"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          {/* 4. METALLIC DIGITAL CONTROL DECK: Centered circular buttons in physical layout */}
          <div className="flex items-center justify-between gap-4 mt-1 w-full px-1">
            
            {/* DECORATIVE MEDIA INDICATOR */}
            <div className="w-9 h-9 rounded-full border border-stone-900 bg-stone-950/45 flex items-center justify-center text-stone-600 select-none">
              <Film className="w-4 h-4 animate-pulse" />
            </div>

            {/* PREVIOUS VIDEO LOOP (SkipBack) */}
            <button
              onClick={handlePrevVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Previous Video Loop"
            >
              <SkipBack className="w-4.5 h-4.5" />
            </button>

            {/* CENTRAL PRIMARY PLAY / PAUSE SPIN BUTTON (Big metallic wheel button) */}
            <button
              onClick={handlePlayPause}
              disabled={!selectedVideo}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-400 p-0.5 border-2 border-slate-300 shadow-[0_0_24px_rgba(255,255,255,0.45)] cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all text-stone-950 flex items-center justify-center"
              title={isPlaying ? "Pause Video" : "Play Video"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-stone-900 fill-stone-900" />
              ) : (
                <Play className="w-6 h-6 text-stone-900 fill-stone-900 ml-0.5" />
              )}
            </button>

            {/* NEXT VIDEO LOOP (SkipForward) */}
            <button
              onClick={handleNextVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Next Video Loop"
            >
              <SkipForward className="w-4.5 h-4.5" />
            </button>

            {/* RESET / STOP BUTTON */}
            <button
              onClick={handleStop}
              disabled={!selectedVideo}
              className="w-9 h-9 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-red-500 hover:text-red-400 hover:border-red-950/65 active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
              title="Stop Video & Reset"
            >
              <Square className="w-3.5 h-3.5 fill-red-800/10" />
            </button>

            {/* FULL SCREEN TOGGLE */}
            <button
              onClick={toggleFullscreen}
              disabled={!selectedVideo}
              className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all disabled:opacity-20 disabled:pointer-events-none ${
                isFullscreen
                  ? "bg-white/10 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                  : "bg-transparent border-stone-850 hover:border-stone-500 text-stone-300 hover:text-white"
              }`}
              title="Toggle Full Screen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* 5. HORIZONTAL VOLUME SLIDER: Complete and matches music player volume deck layout exactly */}
          <div className="w-full mt-2 pt-4 border-t border-stone-900/60 flex items-center gap-3.5 relative select-none">
            
            {/* Volume Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-stone-400 hover:text-white transition-all cursor-pointer hover:scale-105"
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4.5 h-4.5 text-red-500 animate-pulse" />
              ) : (
                <Volume2 className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Metallic Volume Slider */}
            <div className="flex-1 flex items-center relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (isMuted && val > 0) setIsMuted(false);
                }}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer outline-none bg-stone-900 [&::-webkit-slider-runnable-track]:bg-stone-900 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white"
                style={{
                  background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${isMuted ? 0 : volume * 100}%, #1c1917 ${isMuted ? 0 : volume * 100}%, #1c1917 100%)`
                }}
              />
            </div>

            {/* Value Badge */}
            <span className="text-[10px] font-sans font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] min-w-[36px] text-right">
              {isMuted ? "MUTED" : `${Math.round(volume * 100)}%`}
            </span>

            {/* DYNAMIC TURBO HDR (Matches BASS MAX switch exactly in looks) */}
            <button
              onClick={() => setTurboMode(!turboMode)}
              className={`px-3 py-1.5 rounded-xl border font-sans text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                turboMode
                  ? "bg-[#4a1515] border-[#991b1b] text-red-100 animate-pulse shadow-[0_0_12px_rgba(153,27,27,0.5)]"
                  : "bg-stone-900 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
              }`}
              title="Super-charge visual contrast and dynamic brightness"
            >
              💥 TURBO HDR
            </button>
          </div>

          {/* Video Format Controls: Screen aspect ratio and speed */}
          <div className="mt-2 pt-4 border-t border-stone-900/60 flex flex-col gap-4">

            {/* Screen Aspect Ratio & Speed Controls */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              
              {/* Aspect Ratio Picker */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Screen Aspect Ratio
                </span>
                <div className="grid grid-cols-4 gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-900">
                  {(["16:9", "21:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        aspectRatio === ratio
                          ? "bg-stone-850 text-white"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playback speed Selection */}
              <div className="flex flex-col gap-1.5 text-left">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Speed Control
                </span>
                <div className="relative">
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="w-full appearance-none polished-metal-dropdown font-mono text-sm p-2.5 px-3.5 pr-8 rounded-xl cursor-pointer outline-none"
                  >
                    <option value="0.5">0.5x Slow</option>
                    <option value="1">1.0x Normal</option>
                    <option value="1.25">1.25x Fast</option>
                    <option value="1.5">1.5x Turbo</option>
                    <option value="2">2.0x Double</option>
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-900 font-bold z-10">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </motion.div>
  );
};
