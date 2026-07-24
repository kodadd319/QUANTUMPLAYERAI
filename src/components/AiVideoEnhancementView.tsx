import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Sparkles, 
  ArrowLeft, 
  Cpu, 
  CheckCircle2, 
  Activity, 
  Video, 
  Layers, 
  SlidersHorizontal, 
  Clock, 
  RotateCcw, 
  Loader2, 
  Play, 
  Pause, 
  Flame, 
  Shield, 
  Zap, 
  Monitor, 
  Check, 
  Lock, 
  Settings,
  Film,
  Moon,
  Tv,
  Crown,
  Eye,
  Sliders,
  Sparkle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { getVideoBlob } from "../utils/videoStorage";


export interface VideoTrack {
  id: string;
  name: string;
  url: string;
  duration: string;
  creator: string;
  category: string;
  thumbnail: string;
}

const BUILTIN_VIDEOS: VideoTrack[] = [];

interface AiVideoEnhancementViewProps {
  subscriptionTier: "free" | "paid";
  onBackToPlayer: () => void;
  onNavigateToUpgrade: () => void;
  firestoreVideos: VideoTrack[];
  
  // Shared States from App.tsx
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
}

export const AiVideoEnhancementView: React.FC<AiVideoEnhancementViewProps> = ({
  subscriptionTier: parentSubscriptionTier,
  onBackToPlayer,
  onNavigateToUpgrade,
  firestoreVideos,
  
  // Shared States
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
  const isPremiumActive = parentSubscriptionTier === "paid";

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [videoOptimizeError, setVideoOptimizeError] = useState("");
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  // High-fidelity active calibration state
  const [isScanning, setIsScanning] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isHoldingCompare, setIsHoldingCompare] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  // Extra customizable fine-tuning toggles
  const [smartSharpness, setSmartSharpness] = useState(true);
  const [backlightStabilizer, setBacklightStabilizer] = useState(false);

  // Combine builtin and uploaded videos
  const allVideosCombined = useMemo(() => {
    return [...BUILTIN_VIDEOS, ...(firestoreVideos || [])];
  }, [firestoreVideos]);

  // Default selection
  useEffect(() => {
    if (!selectedVideo && allVideosCombined.length > 0) {
      setSelectedVideo(allVideosCombined[0]);
    }
  }, [allVideosCombined, selectedVideo, setSelectedVideo]);

  // Video URL resolution state for IndexedDB local-db blobs
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>("");
  const localVideoUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let isCurrent = true;

    const resolveUrl = async () => {
      if (!selectedVideo || !selectedVideo.url) {
        setResolvedVideoUrl("");
        return;
      }
      const url = selectedVideo.url;
      if (url.startsWith("local-db://")) {
        const id = url.replace("local-db://", "");
        if (localVideoUrlsRef.current[id]) {
          setResolvedVideoUrl(localVideoUrlsRef.current[id]);
          return;
        }
        try {
          const blob = await getVideoBlob(id);
          if (blob && isCurrent) {
            const objectUrl = URL.createObjectURL(blob);
            localVideoUrlsRef.current[id] = objectUrl;
            setResolvedVideoUrl(objectUrl);
          } else if (isCurrent) {
            setResolvedVideoUrl("");
          }
        } catch (err) {
          console.error("Error fetching video blob:", err);
          if (isCurrent) setResolvedVideoUrl("");
        }
      } else {
        setResolvedVideoUrl(url);
      }
    };

    resolveUrl();

    return () => {
      isCurrent = false;
    };
  }, [selectedVideo]);

  // Reset play preview on video change
  useEffect(() => {
    if (videoPreviewRef.current) {
      if (typeof videoPreviewRef.current.pause === "function") {
        videoPreviewRef.current.pause();
      }
      setIsPlayingPreview(false);
    }
  }, [selectedVideo]);

  const addDiagnosticLog = (msg: string) => {
    setDiagnosticLogs(prev => [msg, ...prev.slice(0, 15)]);
  };

  const handleOptimizeVideo = async (overrideParams?: {
    activeModel?: any;
    upscaleTarget?: any;
    colorEnhancement?: any;
    smoothMotion?: boolean;
    turboMode?: boolean;
  }) => {
    if (!selectedVideo) return;
    setIsOptimizing(true);
    setVideoOptimizeError("");
    setScanProgress(0);
    setIsScanning(true);

    const targetModel = overrideParams?.activeModel || activeModel;
    const targetUpscale = overrideParams?.upscaleTarget || upscaleTarget;
    const targetColor = overrideParams?.colorEnhancement || colorEnhancement;
    const targetSmooth = overrideParams?.smoothMotion !== undefined ? overrideParams.smoothMotion : smoothMotion;
    const targetTurbo = overrideParams?.turboMode !== undefined ? overrideParams.turboMode : turboMode;

    addDiagnosticLog(`Starting AI adjustments...`);
    addDiagnosticLog(`AI Method: ${targetModel.toUpperCase()}`);
    addDiagnosticLog(`Target Resolution: ${targetUpscale}`);
    addDiagnosticLog(`Color Settings: ${targetColor.toUpperCase()}`);

    // Simulation progress interval
    const progressInterval = setInterval(() => {
      setScanProgress(p => {
        const next = p + Math.floor(Math.random() * 15) + 5;
        if (next >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        
        // Output interesting technical details depending on progress
        if (next > 20 && next < 40) {
          addDiagnosticLog(`Analyzing brightness and lights...`);
        } else if (next > 50 && next < 70) {
          addDiagnosticLog(`Calculating video colors...`);
        } else if (next > 80 && next < 95) {
          addDiagnosticLog(`Setting up resolution details (${targetUpscale})...`);
        }
        return next;
      });
    }, 120);

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : "";

      const response = await fetch("/api/optimize-video", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(user?.uid ? { "x-user-uid": user.uid } : {})
        },
        body: JSON.stringify({
          videoName: selectedVideo.name,
          category: selectedVideo.category,
          activeModel: targetModel,
          upscaleTarget: targetUpscale,
          colorEnhancement: targetColor,
          smoothMotion: targetSmooth,
          turboMode: targetTurbo
        })
      });
      const data = await response.json();
      
      // Delay slightly so the user experiences the gorgeous scanner sweeps
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (data.success) {
        setAiOptimizedFilters({
          brightness: data.brightness,
          contrast: data.contrast,
          saturation: data.saturation,
          sharpness: data.sharpness,
          hueRotate: data.hueRotate,
          sepia: data.sepia,
          justification: data.justification
        });
        addDiagnosticLog(`Done! Applied new settings.`);
      } else {
        setVideoOptimizeError(data.error || "Failed to adjust video.");
        addDiagnosticLog(`Could not connect. Trying offline backup...`);
      }
    } catch (err: any) {
      console.error("Video optimization call failed:", err);
      setVideoOptimizeError("Network error. Could not connect to server.");
      addDiagnosticLog(`Connection error.`);
    } finally {
      clearInterval(progressInterval);
      setScanProgress(100);
      setTimeout(() => {
        setIsOptimizing(false);
        setIsScanning(false);
      }, 300);
    }
  };

  // Instant pre-calibrated preset configurations
  const PRESETS = [
    {
      id: "midnight",
      name: "🎬 Night Mode",
      description: "Best for dark rooms. Boosts dark parts and contrast.",
      badge: "Night Movie",
      gradient: "from-indigo-950 via-[#12081f] to-stone-950",
      activeModel: "deep-cinema" as const,
      upscaleTarget: "4K" as const,
      colorEnhancement: "lowlight" as const,
      smoothMotion: true,
      turboMode: false
    },
    {
      id: "action",
      name: "🏎️ Action & Sports",
      description: "Best for fast action. Makes movement smoother.",
      badge: "Smooth Action",
      gradient: "from-amber-950/80 via-[#27100b] to-stone-950",
      activeModel: "quantum-scale" as const,
      upscaleTarget: "4K" as const,
      colorEnhancement: "vivid" as const,
      smoothMotion: true,
      turboMode: true
    },
    {
      id: "remaster",
      name: "🌟 Ultra Clear HD",
      description: "Maximum detail and highest quality look.",
      badge: "Super High Quality",
      gradient: "from-[#2b1f0d] via-[#1c1204] to-stone-950",
      activeModel: "chroma-hdr" as const,
      upscaleTarget: "8K" as const,
      colorEnhancement: "hdr" as const,
      smoothMotion: true,
      turboMode: true
    },
    {
      id: "natural",
      name: "🌿 Natural Colors",
      description: "Standard colors that are comfortable for eyes.",
      badge: "Standard Colors",
      gradient: "from-[#081e18] via-[#040e0b] to-stone-950",
      activeModel: "deep-cinema" as const,
      upscaleTarget: "2K" as const,
      colorEnhancement: "none" as const,
      smoothMotion: true,
      turboMode: false
    }
  ];

  const handleApplyPreset = async (preset: typeof PRESETS[0]) => {
    if (!isPremiumActive) {
      onNavigateToUpgrade();
      return;
    }
    setActivePreset(preset.id);
    setActiveModel(preset.activeModel);
    setUpscaleTarget(preset.upscaleTarget);
    setColorEnhancement(preset.colorEnhancement);
    setSmoothMotion(preset.smoothMotion);
    setTurboMode(preset.turboMode);

    // Run actual calibration optimization automatically
    await handleOptimizeVideo({
      activeModel: preset.activeModel,
      upscaleTarget: preset.upscaleTarget,
      colorEnhancement: preset.colorEnhancement,
      smoothMotion: preset.smoothMotion,
      turboMode: preset.turboMode
    });
  };

  // Compute final styles, supporting the instant "Hold to Compare" original bypass
  const enhancedStyles = useMemo(() => {
    // If holding the bypass button, return neutral original video styles
    if (isHoldingCompare) {
      return {
        filter: "none",
        transition: "filter 0.15s ease-out"
      };
    }

    if (aiOptimizedFilters) {
      const { brightness, contrast, saturation, sharpness, hueRotate, sepia } = aiOptimizedFilters;
      let filterStr = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hueRotate}deg) sepia(${sepia})`;
      
      const extraSharpness = smartSharpness ? sharpness * 1.5 : sharpness;
      const sharpnessEffect = extraSharpness > 0 
        ? `drop-shadow(0 0 ${extraSharpness * 0.05}px rgba(255,255,255,${extraSharpness * 0.003}))`
        : "";
        
      return {
        filter: `${filterStr} ${sharpnessEffect}`,
        transform: "translateZ(0)",
        willChange: "transform, filter",
        transition: "filter 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
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
      filterStr += " brightness(1.05) contrast(1.12)";
    }

    if (backlightStabilizer) {
      filterStr += " contrast(0.96) brightness(1.02)";
    }

    const appliedSharpness = smartSharpness ? 45 : 15;
    const sharpnessEffect = upscaleTarget === "4K" || upscaleTarget === "8K"
      ? `drop-shadow(0 0 1px rgba(255,255,255,0.18)) contrast(1.03) saturate(1.02)`
      : "";

    return {
      filter: `${filterStr} ${sharpnessEffect}`,
      transform: "translateZ(0)",
      willChange: "transform, filter",
      transition: "filter 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
    };
  }, [colorEnhancement, upscaleTarget, turboMode, aiOptimizedFilters, isHoldingCompare, smartSharpness, backlightStabilizer]);

  const togglePlayPreview = () => {
    const raw = videoPreviewRef.current;
    if (!raw) return;
    if (isPlayingPreview) {
      raw.pause();
      setIsPlayingPreview(false);
    } else {
      raw.play().catch(err => console.log("Preview play blocked:", err));
      setIsPlayingPreview(true);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-6 text-left select-none text-stone-200 p-1 md:p-3"
      id="ai-video-optimizer-container"
    >
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-extrabold bg-[#1c1412] text-amber-500 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              AI ENGINE
            </span>
            {isPremiumActive && (
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 flex items-center gap-1 shadow-lg">
                <Crown className="w-2.5 h-2.5 fill-current" />
                PREMIUM ACTIVE
              </span>
            )}
          </div>
          
          <h1 className="text-xl md:text-3xl font-sans font-semibold tracking-tight text-white mt-2 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            AI Video Quality Settings
          </h1>
          <p className="text-xs text-stone-400 mt-1 max-w-2xl font-light font-sans leading-relaxed">
            Improve your video quality instantly. Use these options to change how your video looks, making it clearer, brighter, and smoother.
          </p>
        </div>

        {/* Back and Upgrade Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {parentSubscriptionTier !== "paid" && (
            <button
              onClick={onNavigateToUpgrade}
              className="px-3.5 py-2 rounded-xl text-xs font-sans font-bold tracking-wide transition-all border bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500 shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 fill-current animate-pulse" />
              Upgrade to VIP
            </button>
          )}
          
          <button
            onClick={onBackToPlayer}
            className="px-4 py-2 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white transition-all text-xs font-sans font-semibold flex items-center gap-2 shadow"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>

      {/* SECTION 1: All-in-One AI Calibrated Presets (One-Click Orchestration Profiles) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-amber-500 animate-pulse" />
            <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-stone-300">
              Quick Preset Modes
            </h2>
          </div>
          <span className="text-[10px] font-sans text-stone-500 italic">
            Changes multiple settings at once with one click
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRESETS.map((preset) => {
            const isSelectedPreset = activePreset === preset.id;
            return (
              <motion.button
                key={preset.id}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleApplyPreset(preset)}
                className={`text-left p-4.5 rounded-2xl bg-gradient-to-br ${preset.gradient} border transition-all duration-300 flex flex-col justify-between gap-3 relative overflow-hidden group cursor-pointer ${
                  isSelectedPreset 
                    ? "border-amber-500/60 shadow-[0_0_18px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20" 
                    : "border-stone-850 hover:border-stone-700 hover:shadow-lg shadow-md"
                }`}
              >
                {/* Highlight blur glow inside cards */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all pointer-events-none" />

                <div className="flex flex-col gap-1.5 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-black uppercase tracking-widest text-stone-400 group-hover:text-amber-400 transition-colors">
                      {preset.badge}
                    </span>
                    {!isPremiumActive ? (
                      <Lock className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-500 transition-colors" />
                    ) : isSelectedPreset ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    ) : null}
                  </div>
                  <h3 className="text-sm font-sans font-bold text-white group-hover:translate-x-0.5 transition-transform">
                    {preset.name}
                  </h3>
                  <p className="text-[11px] font-sans text-stone-400 leading-snug font-light">
                    {preset.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-sans bg-black/40 px-2 py-0.5 rounded text-stone-300 font-bold tracking-wider uppercase border border-white/5">
                      {preset.activeModel === "deep-cinema" ? "Cinema" : preset.activeModel === "chroma-hdr" ? "Chroma" : "Scale"}
                    </span>
                    <span className="text-[8px] font-sans bg-black/40 px-2 py-0.5 rounded text-stone-300 font-bold tracking-wider uppercase border border-white/5">
                      {preset.upscaleTarget}
                    </span>
                  </div>
                  <span className="text-[10px] font-sans font-extrabold text-amber-500 flex items-center gap-1 group-hover:text-white transition-colors">
                    {!isPremiumActive ? "Unlock →" : isSelectedPreset ? "Active" : "Apply Grade →"}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        
        {/* LEFT COLUMN (COL-SPAN-7): Advanced Processing Dashboard */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-850 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-6 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/2 rounded-full blur-3xl pointer-events-none" />
            
            {!isPremiumActive && (
              <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-amber-500 animate-pulse" />
                </div>
                <h3 className="text-base font-sans font-bold text-white uppercase tracking-wider">
                  AI Video Tuning Locked
                </h3>
                <p className="text-[11px] text-stone-400 mt-2 max-w-xs leading-relaxed font-light">
                  Upgrade to VIP Premium to unlock advanced custom models, upscaling to 8K, color grading, and automated AI tuning.
                </p>
                <button
                  onClick={onNavigateToUpgrade}
                  className="mt-6 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Crown className="w-4 h-4 fill-current animate-pulse" />
                  Upgrade to VIP Premium
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4.5 h-4.5 text-amber-500 stroke-[1.5]" />
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide font-sans">
                    Video Tuning Dashboard
                  </h2>
                  <p className="text-[11px] text-stone-400 font-light mt-0.5">
                    Adjust options below to change your video style.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setActiveModel("quantum-scale");
                  setUpscaleTarget("4K");
                  setColorEnhancement("hdr");
                  setSmoothMotion(true);
                  setTurboMode(false);
                  setAiOptimizedFilters(null);
                  setActivePreset(null);
                  addDiagnosticLog("Reset visual parameters to defaults.");
                }}
                className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors flex items-center gap-1 text-[10px] font-sans uppercase font-bold"
                title="Reset all fields"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            {/* Video Selector Dropdown */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-sans font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-500" />
                Choose Video
              </label>
              <div className="relative">
                <select
                  value={selectedVideo?.id || ""}
                  onChange={(e) => {
                    const found = allVideosCombined.find(v => v.id === e.target.value);
                    if (found) {
                      setSelectedVideo(found);
                      setActivePreset(null);
                      addDiagnosticLog(`Video changed: ${found.name}`);
                    }
                  }}
                  className="w-full px-4 py-3.5 text-sm polished-metal-dropdown rounded-xl focus:outline-none cursor-pointer appearance-none font-sans font-semibold tracking-wide"
                >
                  {allVideosCombined.map((vid) => (
                    <option key={vid.id} value={vid.id}>
                      {vid.name} ({vid.category})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-900 z-10">
                  <SlidersHorizontal className="w-4 h-4 text-stone-900" />
                </div>
              </div>
              {selectedVideo && (
                <div className="flex justify-between items-center text-[10px] text-stone-500 font-sans px-1">
                  <span>By: <strong className="text-stone-350">{selectedVideo.creator}</strong></span>
                  <span>Length: <strong className="text-stone-350">{selectedVideo.duration}</strong></span>
                </div>
              )}
            </div>

            {/* AI Neural Reconstruction Engine Model (Two or Three Options setting) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  1. AI Processing Method
                </span>
                <span className="text-[9px] font-mono text-amber-500 font-bold uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                  {activeModel === "quantum-scale" ? "AI Scale" : activeModel === "deep-cinema" ? "AI Depth" : "AI Bright"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: "quantum-scale" as const, name: "Smooth Scaling", desc: "Makes edges look smooth", spec: "AI SCALE" },
                  { id: "deep-cinema" as const, name: "Theater Depth", desc: "Improves dark details", spec: "AI THEATER" },
                  { id: "chroma-hdr" as const, name: "Bright Highlights", desc: "Makes bright areas look better", spec: "AI BRIGHT" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setActiveModel(mode.id);
                      setActivePreset(null);
                      addDiagnosticLog(`Processing method changed to ${mode.name}`);
                    }}
                    className={`p-3.5 rounded-xl border font-sans text-left transition-all cursor-pointer flex flex-col gap-1 relative overflow-hidden ${
                      activeModel === mode.id
                        ? "bg-stone-950 border-amber-500/50 shadow-md shadow-amber-500/5"
                        : "bg-stone-950/45 border-stone-850 hover:border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] font-bold ${activeModel === mode.id ? "text-amber-500" : "text-stone-200"}`}>
                        {mode.name}
                      </span>
                      {activeModel === mode.id && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <p className="text-[9px] text-stone-500 leading-tight">
                      {mode.desc}
                    </p>
                    <span className="text-[7px] font-mono text-stone-600 mt-1 tracking-widest font-black uppercase">
                      {mode.spec}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Upscaling Level & Base Color Space (Settings with 2 or 3 options each) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Target Upscaling Level (Three or Four Options setting) */}
              <div className="flex flex-col gap-2.5">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-amber-500" />
                  2. Video Size & Detail
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "HD" as const, name: "1080p (Standard)", badge: "Normal" },
                    { id: "2K" as const, name: "2K (Medium)", badge: "Clear" },
                    { id: "4K" as const, name: "4K (High)", badge: "Very Clear" },
                    { id: "8K" as const, name: "8K (Max Detail)", badge: "Premium Only", premium: true }
                  ].map((lvl) => {
                    const isSelected = upscaleTarget === lvl.id;
                    const isPremiumItem = lvl.premium;
                    const isLocked = isPremiumItem && !isPremiumActive;
                    return (
                      <button
                        key={lvl.id}
                        disabled={isLocked}
                        onClick={() => {
                          setUpscaleTarget(lvl.id);
                          setActivePreset(null);
                          addDiagnosticLog(`Resolution changed to ${lvl.id}`);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 font-sans relative overflow-hidden transition-all ${
                          isLocked 
                            ? "opacity-45 bg-stone-950 border-stone-900 cursor-not-allowed"
                            : isSelected
                            ? "bg-stone-950 border-amber-500/50 shadow-md shadow-amber-500/5 text-white"
                            : "bg-stone-950/45 border-stone-850 hover:border-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold">{lvl.name}</span>
                          {isLocked ? (
                            <Lock className="w-2.5 h-2.5 text-stone-600" />
                          ) : (
                            isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <span className="text-[7.5px] font-sans text-stone-500 uppercase font-semibold tracking-wider">
                          {lvl.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base Color Preset Grade (Three or Four Options setting) */}
              <div className="flex flex-col gap-2.5">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-amber-500" />
                  3. Color Profile
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "none" as const, name: "Neutral (No Filter)", desc: "Standard Look" },
                    { id: "hdr" as const, name: "High Dynamic Range", desc: "More Vivid" },
                    { id: "vivid" as const, name: "Vivid Colors", desc: "Bright & Warm" },
                    { id: "lowlight" as const, name: "Night Enhancer", desc: "Brighter in Dark" }
                  ].map((color) => {
                    const isSelected = colorEnhancement === color.id;
                    return (
                      <button
                        key={color.id}
                        onClick={() => {
                          setColorEnhancement(color.id);
                          setActivePreset(null);
                          addDiagnosticLog(`Color profile set to ${color.name}`);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 font-sans transition-all cursor-pointer ${
                          isSelected
                            ? "bg-stone-950 border-amber-500/50 shadow-md shadow-amber-500/5 text-white"
                            : "bg-stone-950/45 border-stone-850 hover:border-stone-800 text-stone-400 hover:text-stone-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold">{color.name}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </div>
                        <span className="text-[7.5px] font-sans text-stone-500 uppercase font-semibold tracking-wider">
                          {color.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Precise Signal Optimization Switches (Toggles) */}
            <div className="flex flex-col gap-2.5">
              <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-stone-400">
                4. Extra Settings
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* 60 FPS Motion Interpolation Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 hover:border-stone-800 transition-all">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`p-2 rounded-xl ${smoothMotion ? "bg-amber-500/10 text-amber-500" : "bg-stone-900 text-stone-500"} transition-all`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[10px] font-bold text-stone-200 uppercase tracking-tight">
                        Extra Smooth Video
                      </span>
                      <span className="font-sans text-[8.5px] text-stone-500 tracking-wide leading-relaxed">
                        Makes video movement extra smooth.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSmoothMotion(!smoothMotion);
                      setActivePreset(null);
                      addDiagnosticLog(`Smooth motion toggled ${!smoothMotion ? "ON" : "OFF"}`);
                    }}
                    className={`w-9 h-5.5 rounded-full transition-all duration-200 relative cursor-pointer outline-none ${
                      smoothMotion ? "bg-amber-500" : "bg-stone-800"
                    }`}
                  >
                    <div 
                      className={`w-3.5 h-3.5 rounded-full absolute top-1 transition-all duration-200 ${
                        smoothMotion ? "left-4.5 bg-stone-950" : "left-1 bg-stone-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Turbo HDR Contrast Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 hover:border-stone-800 transition-all">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`p-2 rounded-xl ${turboMode ? "bg-red-500/10 text-red-400" : "bg-stone-900 text-stone-500"} transition-all`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[10px] font-bold text-stone-200 uppercase tracking-tight">
                        💥 Extra Contrast
                      </span>
                      <span className="font-sans text-[8.5px] text-stone-500 tracking-wide leading-relaxed">
                        Makes bright areas pop and contrast higher.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setTurboMode(!turboMode);
                      setActivePreset(null);
                      addDiagnosticLog(`Extra Contrast toggled ${!turboMode ? "ON" : "OFF"}`);
                    }}
                    className={`w-9 h-5.5 rounded-full transition-all duration-200 relative cursor-pointer outline-none ${
                      turboMode ? "bg-red-600" : "bg-stone-800"
                    }`}
                  >
                    <div 
                      className={`w-3.5 h-3.5 rounded-full absolute top-1 transition-all duration-200 ${
                        turboMode ? "left-4.5 bg-red-100" : "left-1 bg-stone-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Smart Edge Sharpness Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 hover:border-stone-800 transition-all">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`p-2 rounded-xl ${smartSharpness ? "bg-emerald-500/10 text-emerald-400" : "bg-stone-900 text-stone-500"} transition-all`}>
                      <Flame className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[10px] font-bold text-stone-200 uppercase tracking-tight">
                        Sharp Video
                      </span>
                      <span className="font-sans text-[8.5px] text-stone-500 tracking-wide leading-relaxed">
                        Makes details look sharper.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSmartSharpness(!smartSharpness);
                      addDiagnosticLog(`Sharper details toggled ${!smartSharpness ? "ON" : "OFF"}`);
                    }}
                    className={`w-9 h-5.5 rounded-full transition-all duration-200 relative cursor-pointer outline-none ${
                      smartSharpness ? "bg-emerald-500" : "bg-stone-800"
                    }`}
                  >
                    <div 
                      className={`w-3.5 h-3.5 rounded-full absolute top-1 transition-all duration-200 ${
                        smartSharpness ? "left-4.5 bg-stone-950" : "left-1 bg-stone-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Backlight Glare Stabilization Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950/60 border border-stone-850 hover:border-stone-800 transition-all">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`p-2 rounded-xl ${backlightStabilizer ? "bg-blue-500/10 text-blue-400" : "bg-stone-900 text-stone-500"} transition-all`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[10px] font-bold text-stone-200 uppercase tracking-tight">
                        Eye Saver Mode
                      </span>
                      <span className="font-sans text-[8.5px] text-stone-500 tracking-wide leading-relaxed">
                        Lowers brightness slightly to prevent eye strain.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setBacklightStabilizer(!backlightStabilizer);
                      addDiagnosticLog(`Eye Saver Mode toggled ${!backlightStabilizer ? "ON" : "OFF"}`);
                    }}
                    className={`w-9 h-5.5 rounded-full transition-all duration-200 relative cursor-pointer outline-none ${
                      backlightStabilizer ? "bg-blue-500" : "bg-stone-800"
                    }`}
                  >
                    <div 
                      className={`w-3.5 h-3.5 rounded-full absolute top-1 transition-all duration-200 ${
                        backlightStabilizer ? "left-4.5 bg-stone-950" : "left-1 bg-stone-400"
                      }`}
                    />
                  </button>
                </div>

              </div>
            </div>

            {/* Custom Gemini AI Calibration Trigger Button */}
            {!isPremiumActive ? (
              <div className="flex flex-col gap-3.5 mt-2 bg-gradient-to-r from-amber-500/5 to-amber-500/0 p-4.5 rounded-2xl border border-amber-500/10">
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Get Premium Features</h4>
                    <p className="text-[10.5px] text-stone-400 font-light leading-relaxed">
                      Upgrade to unlock high detail (8K), premium movie color filters, and automatic custom AI tuning.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToUpgrade}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/10 cursor-pointer active:scale-98 transition-all"
                >
                  <Crown className="w-4 h-4 fill-current animate-pulse" />
                  Upgrade to VIP Premium
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isOptimizing || !selectedVideo}
                onClick={() => handleOptimizeVideo()}
                className={`w-full py-4 px-4 rounded-xl font-sans text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] cursor-pointer ${
                  isOptimizing
                    ? "bg-stone-850 border border-stone-800 text-stone-500 cursor-not-allowed"
                    : !selectedVideo
                    ? "bg-stone-950 border border-stone-900 text-stone-600 cursor-not-allowed"
                    : "bg-white hover:bg-stone-100 text-stone-950 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                }`}
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    AI is Scanning Video... ({scanProgress}%)
                  </>
                ) : aiOptimizedFilters ? (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    Run AI Adjustments Again
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Let AI Tune the Video Now
                  </>
                )}
              </button>
            )}

            {videoOptimizeError && (
              <div className="text-[10px] text-red-400 font-sans p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                ⚠️ {videoOptimizeError}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN (COL-SPAN-5): Live Screen, Comparison and Diagnostic Analysis */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Live Preview Display Card */}
          <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-850 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-4 backdrop-blur-xl relative">
            
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Video Screen
                </h4>
              </div>
              <span className={`text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded ${
                isHoldingCompare
                  ? "bg-stone-950 text-stone-500"
                  : aiOptimizedFilters 
                  ? "bg-amber-500/10 text-amber-500 animate-pulse border border-amber-500/20" 
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}>
                {isHoldingCompare ? "ORIGINAL" : aiOptimizedFilters ? "AI TUNING" : "TUNED"}
              </span>
            </div>

            {/* Video Preview Bezel - Double-Din Automotive Styled */}
            <div className="relative aspect-video w-full rounded-2xl bg-black border border-stone-950 overflow-hidden shadow-2xl group ring-1 ring-white/5">
              {selectedVideo && resolvedVideoUrl ? (
                <>
                  <video
                    ref={videoPreviewRef}
                    title={selectedVideo.name || "Preview Stream"}
                    src={resolvedVideoUrl}
                    preload="auto"
                    loop={true}
                    muted={true}
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    style={enhancedStyles}
                    className="w-full h-full object-cover transition-all"
                  />
                  {/* Subtle glare reflection overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent select-none z-[2]" />
                  
                  {/* Status Overlay Badges */}
                  <div className="absolute top-3 left-3 z-10 pointer-events-none select-none flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-stone-950/90 border border-stone-800 text-stone-400 font-bold tracking-widest uppercase">
                      PLAYING
                    </span>
                    {!isHoldingCompare && aiOptimizedFilters && (
                      <span className="px-2 py-0.5 rounded text-[8px] font-sans bg-amber-500/20 border border-amber-500/30 text-amber-400 font-extrabold tracking-widest uppercase flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-2.5 h-2.5 animate-bounce" />
                        AI TUNED
                      </span>
                    )}
                    {isHoldingCompare && (
                      <span className="px-2 py-0.5 rounded text-[8px] font-sans bg-stone-950/95 border border-stone-800 text-stone-400 font-bold tracking-wider uppercase">
                        ORIGINAL VIDEO
                      </span>
                    )}
                  </div>

                  {/* Dynamic Calibration Laser Scan Line */}
                  <AnimatePresence>
                    {isScanning && (
                      <motion.div 
                        initial={{ top: "0%" }}
                        animate={{ top: "100%" }}
                        exit={{ opacity: 0 }}
                        transition={{ 
                          repeat: Infinity, 
                          repeatType: "reverse", 
                          duration: 1.5,
                          ease: "easeInOut"
                        }}
                        className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_12px_rgba(245,158,11,1)] z-10 pointer-events-none"
                      />
                    )}
                  </AnimatePresence>

                  {/* Interactive Play/Pause Hover Overlay */}
                  <div 
                    onClick={togglePlayPreview}
                    className="absolute inset-0 z-10 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-stone-950/90 border border-stone-800 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl">
                      {isPlayingPreview ? (
                        <Pause className="w-5 h-5 fill-white text-white" />
                      ) : (
                        <Play className="w-5 h-5 fill-white text-white pl-0.5" />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <Monitor className="w-9 h-9 text-stone-800 mb-2 animate-pulse" />
                  <span className="text-[10px] uppercase font-sans font-bold text-stone-600 tracking-widest">
                    No Video Stream Selected
                  </span>
                </div>
              )}
            </div>

            {/* Tactical Hold to Compare Bypass Control (Noticeable Proof of Upgrade) */}
            {selectedVideo && (
              <div className="flex flex-col gap-1.5">
                <button
                  onMouseDown={() => setIsHoldingCompare(true)}
                  onMouseUp={() => setIsHoldingCompare(false)}
                  onMouseLeave={() => setIsHoldingCompare(false)}
                  onTouchStart={() => setIsHoldingCompare(true)}
                  onTouchEnd={() => setIsHoldingCompare(false)}
                  className="w-full py-3 rounded-xl bg-stone-950 hover:bg-black border border-stone-800 text-stone-400 active:text-amber-500 hover:text-white active:border-amber-500/30 font-sans text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 select-none cursor-pointer transition-all active:scale-[0.99] shadow-inner"
                  title="Press and hold to compare original bypass vs AI video enhancement"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Hold to See Original Video
                </button>
                <p className="text-[9px] text-stone-500 text-center font-sans">
                  Hold this button to compare original video vs AI video.
                </p>
              </div>
            )}

            {/* Diagnostic Logs / Active Neural Stream Terminal */}
            <div className="bg-stone-950 p-4 rounded-2xl border border-stone-850/80 flex flex-col gap-2">
              <span className="text-[8px] font-mono font-bold tracking-widest text-stone-500 uppercase">
                ⚙️ Process Monitor
              </span>
              <div className="h-24 overflow-y-auto font-mono text-[9px] text-stone-400 flex flex-col gap-1.5 scrollbar-thin select-text">
                {diagnosticLogs.length > 0 ? (
                  diagnosticLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-stone-600">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}]</span>
                      <span className={log.includes("Done") ? "text-amber-500 font-bold" : log.includes("error") || log.includes("Could not") ? "text-red-400" : "text-stone-300"}>
                        {log}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-stone-600 italic text-center pt-6">
                    Waiting... Select a preset or click Tune to see activity.
                  </div>
                )}
              </div>
            </div>

            {/* AI Insights Narrative & Metrics Reveal */}
            <AnimatePresence mode="wait">
              {aiOptimizedFilters ? (
                <motion.div
                  key="ai-narrative-results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col gap-3.5 text-left pt-2 border-t border-stone-850"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-sans font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                      AI Video Report
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiOptimizedFilters(null);
                        addDiagnosticLog("Reset video filters.");
                      }}
                      className="p-1 rounded hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
                      title="Clear AI Filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>

                  {/* The actual typewriter-style or descriptive justification */}
                  <div className="p-4 rounded-2xl bg-[#120805]/95 border border-amber-500/10 leading-relaxed text-[11px] text-stone-300 font-light font-sans shadow-inner relative">
                    <div className="absolute top-0 right-0 p-1.5 text-[8px] font-mono text-amber-500/35 font-bold">
                      AI REPORT
                    </div>
                    {aiOptimizedFilters.justification}
                  </div>

                  {/* Six Beautiful Interactive Digital Gauges */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Brightness", val: `${Math.round(aiOptimizedFilters.brightness * 100)}%` },
                      { label: "Contrast", val: `${Math.round(aiOptimizedFilters.contrast * 100)}%` },
                      { label: "Color Saturation", val: `${Math.round(aiOptimizedFilters.saturation * 100)}%` },
                      { label: "Sharpness", val: `+${smartSharpness ? Math.round(aiOptimizedFilters.sharpness * 1.5) : aiOptimizedFilters.sharpness}%` },
                      { label: "Color Tone", val: `${aiOptimizedFilters.hueRotate > 0 ? "+" : ""}${aiOptimizedFilters.hueRotate}°` },
                      { label: "Warmth", val: `${Math.round(aiOptimizedFilters.sepia * 100)}%` }
                    ].map((m, idx) => (
                      <div key={idx} className="flex flex-col gap-0.5 bg-stone-950 p-2 rounded-xl border border-stone-850 text-left">
                        <span className="text-[7.5px] font-sans font-bold text-stone-500 uppercase tracking-wider">
                          {m.label}
                        </span>
                        <span className="text-xs font-mono font-bold text-white tracking-wide">
                          {m.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="bypass-narrative-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-5 rounded-2xl bg-stone-950/40 border border-stone-850/60 text-center text-xs text-stone-500 py-7 font-sans flex flex-col items-center justify-center gap-2"
                >
                  <Sparkles className="w-5.5 h-5.5 text-stone-700 animate-pulse" />
                  <p className="max-w-xs leading-normal">
                    Choose a Preset above or click <strong>"Let AI Tune the Video Now"</strong> to optimize your video!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>

    </motion.div>
  );
};
