import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  Volume1,
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
  RotateCw,
  Loader2,
  Subtitles,
  Flame,
  Cast,
  Zap,
  Repeat,
  PictureInPicture,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CastModal, CastDevice } from "./CastModal";
import { TotalQuantumConsole } from "./TotalQuantumConsole";
import { DspSettings } from "../types";
import { castSyncManager, CastMediaPayload } from "../utils/castSync";
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
    name: "Sintel Cinematic Trailer",
    creator: "Blender Animation Studio",
    category: "Cinematic",
    duration: "0:52",
    url: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-2",
    name: "Deep Ocean Wildlife Expedition",
    creator: "Oceanic Hydroacoustics",
    category: "Acoustic Calibration",
    duration: "0:46",
    url: "https://vjs.zencdn.net/v/oceans.mp4",
    thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-3",
    name: "Big Buck Animation Excursion",
    creator: "Peach Open Movie Project",
    category: "Futuristic",
    duration: "0:33",
    url: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-4",
    name: "Botanical Color Sweep",
    creator: "Acoustic Lab Tech",
    category: "Cinematic",
    duration: "0:05",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "sample-5",
    name: "Motion Excursion Spectrum",
    creator: "Studio Calibration Unit",
    category: "Acoustic Calibration",
    duration: "0:10",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80"
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
  deleteSelectedVideos?: (videoIds: string[]) => Promise<void>;

  // Total Quantum Props
  isTotalQuantumActive?: boolean;
  setIsTotalQuantumActive?: (active: boolean) => void;
  dspSettings?: DspSettings;
  setDspSettings?: React.Dispatch<React.SetStateAction<DspSettings>>;
  onUpdateBassBoost?: (val: number) => void;
  onUpdateEqBand?: (index: number, val: number) => void;
  ensureEngine?: (targetElement?: HTMLMediaElement | null) => void;
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
  deleteSelectedVideos,
  
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
  setAiOptimizedFilters,

  // Total Quantum
  isTotalQuantumActive = true,
  setIsTotalQuantumActive,
  dspSettings = {
    eqBands: [4, 1, 0, 2, 3],
    bassBoost: 50.0,
    reverbWet: 0.08,
    delayOffsetMs: 12,
    highPassFilterHz: 30,
    subCrossoverHz: 80,
    justification: "Total Quantum Audio-Video DSP Active"
  },
  setDspSettings,
  onUpdateBassBoost,
  onUpdateEqBand,
  ensureEngine
}) => {
  // Video Sources State
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>("");
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const activeBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const currentVideoIdRef = useRef<string | null>(null);

  // Clean up object URLs only when the component unmounts
  useEffect(() => {
    return () => {
      activeBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
      activeBlobUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setVideoLoadError(null);

    const resolveUrl = async () => {
      if (!selectedVideo || !selectedVideo.url) {
        if (isCurrent) setResolvedVideoUrl("");
        return;
      }
      const url = selectedVideo.url;
      if (url.startsWith("local-db://")) {
        const id = url.replace("local-db://", "");
        
        // Check in-memory cache first (unless retrying)
        if (activeBlobUrlsRef.current.has(id) && retryKey === 0) {
          const cachedUrl = activeBlobUrlsRef.current.get(id)!;
          if (isCurrent) {
            setResolvedVideoUrl(cachedUrl);
          }
          return;
        }

        try {
          const blob = await getVideoBlob(id);
          if (blob && isCurrent) {
            // Revoke old URL for this specific ID if we are explicitly retrying
            if (activeBlobUrlsRef.current.has(id)) {
              try {
                URL.revokeObjectURL(activeBlobUrlsRef.current.get(id)!);
              } catch (e) {}
            }
            const objUrl = URL.createObjectURL(blob);
            activeBlobUrlsRef.current.set(id, objUrl);
            setResolvedVideoUrl(objUrl);
            return;
          } else if (isCurrent) {
            setVideoLoadError("Local video file could not be read from storage.");
          }
        } catch (err) {
          console.warn("Failed to load local video blob:", err);
          if (isCurrent) setVideoLoadError("Local video file could not be read from storage.");
        }
      } else {
        if (isCurrent) {
          setResolvedVideoUrl(url);
        }
      }
    };

    resolveUrl();

    return () => {
      isCurrent = false;
    };
  }, [selectedVideo?.id, selectedVideo?.url, retryKey]);

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
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

  // Cast & Total Quantum states
  const [showCastModal, setShowCastModal] = useState(false);
  const [connectedCastDevice, setConnectedCastDevice] = useState<CastDevice | null>(null);
  const [showQuantumConsole, setShowQuantumConsole] = useState(false);

  // Ensure Web Audio DSP attaches to Video Element when Total Quantum is active
  useEffect(() => {
    if (isTotalQuantumActive && videoRawRef.current && ensureEngine) {
      ensureEngine(videoRawRef.current);
    }
  }, [isTotalQuantumActive, selectedVideo, resolvedVideoUrl, ensureEngine]);

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
  const [isLooping, setIsLooping] = useState(true);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [showSeekFeedback, setShowSeekFeedback] = useState<"-10s" | "+10s" | null>(null);

  const togglePictureInPicture = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const raw = videoRawRef.current;
    if (!raw) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled && typeof raw.requestPictureInPicture === "function") {
        await raw.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn("Picture-in-picture error:", err);
    }
  };

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

  // Reset players state cleanly on video track ID change
  useEffect(() => {
    if (selectedVideo?.id && currentVideoIdRef.current !== selectedVideo.id) {
      currentVideoIdRef.current = selectedVideo.id;
      setProgress(0);
      setCurrentTime(0);
      setAiOptimizedFilters(null);
    }
  }, [selectedVideo?.id]);

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
  }, [volume, isMuted]);

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
  }, [playbackSpeed]);

  // Connect Web Audio DSP when Total Quantum is active on playing media
  useEffect(() => {
    if (isTotalQuantumActive && videoRawRef.current && ensureEngine && isPlaying) {
      try {
        ensureEngine(videoRawRef.current);
      } catch (err) {
        console.warn("AudioEngine attach caught:", err);
      }
    }
  }, [isTotalQuantumActive, isPlaying, ensureEngine]);

  // Synchronize media state to active Cast receiver display
  useEffect(() => {
    if (connectedCastDevice && selectedVideo) {
      const payload: CastMediaPayload = {
        id: selectedVideo.id,
        name: selectedVideo.name || "Video Stream",
        url: resolvedVideoUrl || selectedVideo.url,
        currentTime: currentTime || 0,
        duration: duration || 0,
        isPlaying: isPlaying,
        volume: isMuted ? 0 : volume,
        isMuted: isMuted,
        updatedAt: Date.now()
      };
      castSyncManager.broadcastMediaState(payload);
    }
  }, [connectedCastDevice, selectedVideo?.id, resolvedVideoUrl, isPlaying, isMuted, volume]);

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
            .then(() => {
              setIsPlaying(true);
              setVideoLoadError(null);
            })
            .catch((e: any) => {
              console.log("Autoplay waiting for user interaction or paused state:", e);
              setIsPlaying(!raw.paused);
            });
        }
      } catch (err) {
        console.warn("Autoplay error:", err);
      }
    }
  }, [resolvedVideoUrl, retryKey]);

  // Play Pause Core Loop
  const handlePlayPause = () => {
    const raw = videoRawRef.current;
    if (!raw) return;

    if (!raw.paused) {
      raw.pause();
      setIsPlaying(false);
    } else {
      if (ensureEngine && isTotalQuantumActive) {
        try {
          ensureEngine(raw);
        } catch (e) {}
      }
      const playPromise = raw.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setVideoLoadError(null);
          })
          .catch((e: any) => {
            console.log("Native video play error:", e);
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(true);
      }
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
    setShowSeekFeedback("-10s");
    setTimeout(() => setShowSeekFeedback(null), 600);
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
    setShowSeekFeedback("+10s");
    setTimeout(() => setShowSeekFeedback(null), 600);
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

  const handleSingleDelete = (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingDeleteIds([videoId]);
    setShowDeleteConfirm(true);
  };

  const handleBatchDelete = () => {
    if (selectedVideoIds.length === 0) return;
    setPendingDeleteIds([...selectedVideoIds]);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const idsToDelete = pendingDeleteIds.length > 0 ? pendingDeleteIds : selectedVideoIds;
    if (idsToDelete.length === 0) return;

    setPendingDeleteIds([]);
    setSelectedVideoIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    setShowDeleteConfirm(false);
    if (deleteSelectedVideos) {
      await deleteSelectedVideos(idsToDelete);
    } else {
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
            <span className="hidden sm:inline tracking-widest text-stone-400 font-medium">CINEMA PRO DECK</span>
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuantumConsole(true)}
              className={`px-2.5 py-1 rounded-lg border text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                isTotalQuantumActive
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse"
                  : "bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border-stone-800"
              }`}
              title="Open Total Quantum Combined Audio-Video Console"
            >
              <Zap className="w-3 h-3 text-amber-400 fill-current" />
              {isTotalQuantumActive ? "Total Quantum: Active" : "Total Quantum"}
            </button>

            <button
              onClick={() => setShowCastModal(true)}
              className={`px-2.5 py-1 rounded-lg border text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                connectedCastDevice
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse"
                  : "bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border-stone-800"
              }`}
              title="Cast video stream to Smart TV or Streaming Device"
            >
              <Cast className="w-3 h-3 text-amber-400" />
              {connectedCastDevice ? `Cast: ${connectedCastDevice.name}` : "Cast TV"}
            </button>

            <button 
              onClick={onBackToPlayer}
              className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-[8px] font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Return to music player"
            >
              <ArrowLeft className="w-3 h-3" />
              Switch to Audio Player
            </button>
          </div>

          <div className="flex items-center gap-3">
            {turboMode && (
              <span className="text-red-500 font-semibold animate-pulse bg-red-950/45 px-1.5 py-0.5 rounded border border-red-800/35">
                AI TURBO ACTIVE
              </span>
            )}
            <span className="font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]">{headunitTime}</span>
          </div>
        </div>

        {/* SINGLE-COLUMN VERTICAL COHESIVE LAYOUT */}
        <div className="flex flex-col gap-5 relative z-10 w-full">

          {/* Active Cast Status Banner */}
          {connectedCastDevice && (
            <div className="w-full bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-amber-300 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Cast className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    Casting to {connectedCastDevice.name}
                  </div>
                  <div className="text-[10px] text-amber-400/80">
                    {selectedVideo?.name || "Video Stream"} • {connectedCastDevice.resolution}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCastModal(true)}
                className="text-[10px] font-bold uppercase tracking-wider text-stone-950 bg-amber-400 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
              >
                Cast Controls
              </button>
            </div>
          )}

          {/* 1. LARGE PREMIUM SCREEN BEZEL DESIGN: Framed with sleek double-din styling and integrated quick overlay */}
          <div 
            ref={playerWrapperRef}
            onClick={() => {
              if (isFullscreen) {
                setShowFullscreenOverlay(!showFullscreenOverlay);
              }
            }}
            className={`relative overflow-hidden bg-black flex items-center justify-center select-none transition-all duration-300 group ${
              isFullscreen 
                ? "w-screen h-screen max-w-none max-h-none rounded-none border-none cursor-pointer" 
                : `rounded-2xl border border-stone-800 w-full ${
                    aspectRatio === "16:9" ? "aspect-video" : 
                    aspectRatio === "21:9" ? "aspect-[21/9]" : 
                    aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-square"
                  } shadow-[0_15px_45px_rgba(0,0,0,0.85)] ring-1 ring-white/5`
            }`}
          >
            {/* High Performance AI Enhanced Video Player Engine */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
              {selectedVideo && videoLoadError ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-stone-400 gap-3 w-full h-full bg-stone-950/95 backdrop-blur-md z-30">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-center max-w-sm">
                    <h3 className="text-xs font-sans font-bold text-white uppercase tracking-wider">Video Stream Interrupted</h3>
                    <p className="text-[10px] text-stone-400 font-sans mt-1 leading-relaxed">
                      {videoLoadError}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      id="video-player-retry-btn"
                      onClick={() => {
                        setVideoLoadError(null);
                        setRetryKey((prev) => prev + 1);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry Stream
                    </button>
                    <button
                      id="video-player-skip-next-btn"
                      onClick={() => handleNextVideo()}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all border border-stone-700 active:scale-95"
                    >
                      Next Video
                    </button>
                  </div>
                </div>
              ) : selectedVideo && resolvedVideoUrl ? (
                <video
                  ref={videoRawRef}
                  title={selectedVideo.name || "Video Stream"}
                  src={resolvedVideoUrl}
                  preload="auto"
                  loop={isLooping}
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={(e) => {
                    const cur = e.currentTarget.currentTime;
                    const dur = e.currentTarget.duration;
                    if (typeof cur === "number" && !isNaN(cur)) {
                      setCurrentTime(cur);
                      if (dur && !isNaN(dur) && dur > 0) {
                        setProgress((cur / dur) * 100);
                      }
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    if (dur && typeof dur === "number" && !isNaN(dur)) {
                      setDuration(dur);
                    }
                    setVideoLoadError(null);
                  }}
                  onCanPlay={() => {
                    setVideoLoadError(null);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPlaying={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    if (isLooping) {
                      if (videoRawRef.current) {
                        videoRawRef.current.currentTime = 0;
                        videoRawRef.current.play()?.catch(() => {});
                      }
                    } else {
                      handleNextVideo();
                    }
                  }}
                  onError={(e) => {
                    const mediaErr = (e.currentTarget as HTMLVideoElement).error;
                    if (mediaErr && mediaErr.code === 1) return; // ignore user/script aborts
                    setIsPlaying(false);
                    setVideoLoadError("Video could not be loaded or stream was interrupted. Check connection or select another track.");
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

            {/* Interactive Quick On-Screen HUD: Sleek Top Badge Strip */}
            {!isFullscreen && selectedVideo && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-white uppercase tracking-wider">
                    {upscaleTarget === "8K" ? "8K ULTRA" : upscaleTarget === "4K" ? "4K HDR" : upscaleTarget === "2K" ? "2K PRO" : "1080p HD"}
                  </span>
                  {colorEnhancement !== "none" && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-[9px] font-sans font-bold text-amber-300 uppercase tracking-wider">
                      {colorEnhancement.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pointer-events-auto">
                  {/* Quick PiP Button */}
                  <button
                    onClick={togglePictureInPicture}
                    className={`p-1.5 rounded-md backdrop-blur-md border text-[9px] transition-all cursor-pointer ${
                      isPiPActive 
                        ? "bg-amber-500/30 border-amber-500/50 text-amber-300"
                        : "bg-black/75 hover:bg-black/90 border-white/10 text-stone-300 hover:text-white"
                    }`}
                    title="Picture-in-Picture"
                  >
                    <PictureInPicture className="w-3.5 h-3.5" />
                  </button>

                  {/* Quick Fullscreen Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-md bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/10 text-stone-300 hover:text-white transition-all cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Skip Feedback Animation Overlay */}
            <AnimatePresence>
              {showSeekFeedback && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1.1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute z-30 px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-white font-mono text-xs font-bold shadow-2xl flex items-center gap-1 pointer-events-none"
                >
                  {showSeekFeedback === "-10s" ? <RotateCcw className="w-4 h-4 text-stone-300" /> : <RotateCw className="w-4 h-4 text-stone-300" />}
                  <span>{showSeekFeedback}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interactive play button overlay when paused */}
            {!isFullscreen && (
              <div 
                onClick={handlePlayPause}
                className="absolute inset-0 bg-transparent flex items-center justify-center cursor-pointer z-10"
              >
                {!isPlaying && selectedVideo && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1 }}
                    className="w-14 h-14 rounded-full bg-black/80 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all"
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
                  setShowFullscreenOverlay(false);
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
                    <RotateCcw className="w-5 h-5 text-stone-300 hover:text-white" />
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
                    <RotateCw className="w-5 h-5 text-stone-300 hover:text-white" />
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
                  <div className="flex items-center justify-center gap-2 max-w-full px-2">
                    <h2 className="text-xl sm:text-2xl font-sans font-semibold text-white tracking-normal leading-tight truncate uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">
                      {selectedVideo.name}
                    </h2>
                    <button
                      onClick={(e) => handleSingleDelete(selectedVideo.id, e)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer shrink-0"
                      title="Delete this video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

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
          <div className="w-full flex flex-col gap-1.5 bg-black/35 p-3.5 rounded-2xl border border-stone-900/85">
            <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 font-medium tracking-wider px-1">
              <span className="text-stone-100 font-semibold">{formatTimeHelper(currentTime)}</span>
              <div className="h-[1px] flex-1 mx-3 bg-stone-900/60" />
              <span className="text-slate-200 font-semibold">{formatTimeHelper(duration)}</span>
            </div>

            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                handleSeek(ratio * 100);
              }}
              className="h-2.5 rounded-full relative cursor-pointer bg-stone-900/90 group transition-all"
            >
              {/* Highlight Progress fill */}
              <div 
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-slate-400 via-white to-slate-200 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.7)] transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* Seeking handle thumb */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-slate-300 shadow-[0_2px_6px_rgba(0,0,0,0.8)] scale-100 opacity-90 group-hover:scale-125 transition-transform"
                style={{ left: `calc(${progress}% - 7px)` }}
              />
            </div>
          </div>

          {/* 4. METALLIC DIGITAL CONTROL DECK: Centered circular buttons in physical layout */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-1 w-full px-1">
            
            {/* LOOP / AUTO-ADVANCE TOGGLE BUTTON */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                isLooping
                  ? "bg-white/10 border-white/40 text-white shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                  : "bg-transparent border-stone-850 hover:border-stone-700 text-stone-500 hover:text-stone-300"
              }`}
              title={isLooping ? "Looping Active (Repeats video)" : "Auto-advance to Next Video"}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* SKIP BACK 10 SECONDS */}
            <button
              onClick={handleSkipBackward}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-600 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer group"
              title="Skip Back 10s"
            >
              <RotateCcw className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
            </button>

            {/* PREVIOUS VIDEO */}
            <button
              onClick={handlePrevVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-600 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Previous Video"
            >
              <SkipBack className="w-4.5 h-4.5" />
            </button>

            {/* CENTRAL PRIMARY PLAY / PAUSE BUTTON (High-gloss metallic wheel) */}
            <button
              onClick={handlePlayPause}
              disabled={!selectedVideo}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-400 p-0.5 border-2 border-slate-300 shadow-[0_0_24px_rgba(255,255,255,0.45)] cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all text-stone-950 flex items-center justify-center shrink-0"
              title={isPlaying ? "Pause Video" : "Play Video"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-stone-900 fill-stone-900" />
              ) : (
                <Play className="w-6 h-6 text-stone-900 fill-stone-900 ml-0.5" />
              )}
            </button>

            {/* NEXT VIDEO */}
            <button
              onClick={handleNextVideo}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-600 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
              title="Next Video"
            >
              <SkipForward className="w-4.5 h-4.5" />
            </button>

            {/* SKIP FORWARD 10 SECONDS */}
            <button
              onClick={handleSkipForward}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-600 active:scale-90 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer group"
              title="Skip Forward 10s"
            >
              <RotateCw className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </button>

            {/* RESET / STOP BUTTON */}
            <button
              onClick={handleStop}
              disabled={!selectedVideo}
              className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-red-500 hover:text-red-400 hover:border-red-950/65 active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
              title="Stop Video & Reset"
            >
              <Square className="w-3.5 h-3.5 fill-red-800/20" />
            </button>
          </div>

          {/* 5. MASTER VOLUME & TURBO AUDIO STRIP */}
          <div className="w-full mt-2 pt-4 border-t border-stone-900/60 flex items-center gap-3.5 relative select-none">
            
            {/* Volume Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-stone-400 hover:text-white transition-all cursor-pointer hover:scale-105"
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4.5 h-4.5 text-red-500 animate-pulse" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4.5 h-4.5 text-stone-300" />
              ) : (
                <Volume2 className="w-4.5 h-4.5 text-stone-300" />
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
            <span className="text-[10px] font-mono font-bold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] min-w-[36px] text-right">
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

          {/* 6. STREAMLINED DISPLAY, RATIO & SPEED STUDIO DOCK */}
          <div className="mt-2 pt-4 border-t border-stone-900/60 flex flex-col gap-4">

            {/* Control Pods Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Pod 1: Screen Fit Mode */}
              <div className="flex flex-col gap-1.5 text-left bg-black/25 p-2.5 rounded-2xl border border-stone-900">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Screen Fit
                </span>
                <div className="grid grid-cols-3 gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-900">
                  {(["contain", "cover", "fill"] as const).map((fit) => (
                    <button
                      key={fit}
                      onClick={() => setVideoFit(fit)}
                      className={`py-1 rounded-lg text-[8px] font-sans font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        videoFit === fit
                          ? "bg-stone-850 text-white border border-white/10 shadow-sm"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pod 2: Aspect Ratio Picker */}
              <div className="flex flex-col gap-1.5 text-left bg-black/25 p-2.5 rounded-2xl border border-stone-900">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Aspect Ratio
                </span>
                <div className="grid grid-cols-4 gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-900">
                  {(["16:9", "21:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1 rounded-lg text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        aspectRatio === ratio
                          ? "bg-stone-850 text-white border border-white/10 shadow-sm"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pod 3: Playback Speed Selection */}
              <div className="flex flex-col gap-1.5 text-left bg-black/25 p-2.5 rounded-2xl border border-stone-900">
                <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-stone-400">
                  Playback Speed
                </span>
                <div className="grid grid-cols-5 gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-900">
                  {[0.5, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`py-1 rounded-lg text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        playbackSpeed === spd
                          ? "bg-stone-850 text-white border border-white/10 shadow-sm"
                          : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Quick Action Utilities Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {/* CC Captions Button */}
                <button
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 text-[9px] font-sans font-bold uppercase tracking-wider ${
                    captionsEnabled
                      ? "bg-red-500/15 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      : "bg-stone-900/80 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
                  }`}
                  title="Toggle Subtitles / Closed Captions"
                >
                  <Subtitles className={`w-3.5 h-3.5 ${captionsEnabled ? "text-red-400 animate-pulse" : ""}`} />
                  <span>CC Captions</span>
                </button>

                {/* Picture in Picture Button */}
                <button
                  onClick={togglePictureInPicture}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 text-[9px] font-sans font-bold uppercase tracking-wider ${
                    isPiPActive
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "bg-stone-900/80 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
                  }`}
                  title="Pop-out Picture-in-Picture window"
                >
                  <PictureInPicture className="w-3.5 h-3.5" />
                  <span>Pop-out PiP</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Cast TV Button */}
                <button
                  onClick={() => setShowCastModal(true)}
                  disabled={!selectedVideo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 text-[9px] font-sans font-bold uppercase tracking-wider disabled:opacity-30 disabled:pointer-events-none ${
                    connectedCastDevice
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "bg-stone-900/80 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
                  }`}
                  title="Stream Video & Audio to Smart TV"
                >
                  <Cast className="w-3.5 h-3.5" />
                  <span>{connectedCastDevice ? `Cast: ${connectedCastDevice.name}` : "Wireless Cast"}</span>
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  disabled={!selectedVideo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 text-[9px] font-sans font-bold uppercase tracking-wider disabled:opacity-30 disabled:pointer-events-none ${
                    isFullscreen
                      ? "bg-white/15 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                      : "bg-stone-900/80 hover:bg-stone-850 border-stone-800 text-stone-400 hover:text-white"
                  }`}
                  title="Toggle Fullscreen mode"
                >
                  <Maximize className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#181110] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-sans">Confirm Deletion</h3>
                  <p className="text-xs text-slate-400">
                    {(pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedVideoIds.length) === 1 
                      ? "Are you sure you want to delete this video?" 
                      : `Are you sure you want to delete these ${pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedVideoIds.length} videos?`}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                This item will be permanently removed from your videos list and local storage. This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cast to Device Overlay Modal */}
      <CastModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        videoElement={videoRawRef.current}
        videoName={selectedVideo?.name}
        videoUrl={selectedVideo?.url || resolvedVideoUrl}
        connectedDevice={connectedCastDevice}
        onSelectDevice={(device) => setConnectedCastDevice(device)}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        onPlayPause={handlePlayPause}
        onSeek={(sec) => {
          if (videoRawRef.current) videoRawRef.current.currentTime = sec;
          setCurrentTime(sec);
        }}
        onVolumeChange={(v) => {
          setVolume(v);
          if (videoRawRef.current) videoRawRef.current.volume = v;
        }}
        onToggleMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          if (videoRawRef.current) videoRawRef.current.muted = next;
        }}
      />

      {/* Total Quantum Console Overlay */}
      <TotalQuantumConsole
        isOpen={showQuantumConsole}
        onClose={() => setShowQuantumConsole(false)}
        isTotalQuantumActive={isTotalQuantumActive}
        setIsTotalQuantumActive={setIsTotalQuantumActive || (() => {})}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        upscaleTarget={upscaleTarget === "HD" ? "1080p" : upscaleTarget === "2K" ? "native" : upscaleTarget === "4K" ? "4K" : "8K"}
        setUpscaleTarget={(t) => setUpscaleTarget(t === "1080p" ? "HD" : t === "native" ? "2K" : t === "4K" ? "4K" : "8K")}
        colorEnhancement={colorEnhancement === "vivid" ? "vibrant" : colorEnhancement === "hdr" ? "hdr_pop" : colorEnhancement === "lowlight" ? "cinematic" : "off"}
        setColorEnhancement={(c) => setColorEnhancement(c === "vibrant" ? "vivid" : c === "hdr_pop" ? "hdr" : c === "cinematic" ? "lowlight" : "none")}
        smoothMotion={smoothMotion}
        setSmoothMotion={setSmoothMotion}
        turboMode={turboMode}
        setTurboMode={setTurboMode}
        dspSettings={dspSettings}
        setDspSettings={setDspSettings}
        onUpdateBassBoost={onUpdateBassBoost}
        onUpdateEqBand={onUpdateEqBand}
      />
    </motion.div>
  );
};
