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
  Tv,
  Crown,
  Eye,
  Sliders,
  Sparkle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize2,
  Split,
  EyeOff,
  Radio,
  SlidersVertical
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { getVideoBlob } from "../utils/videoStorage";
import { VideoTrack } from "../types";

interface AiVideoMirrorViewProps {
  subscriptionTier: "free" | "paid";
  onBackToEnhancement: () => void;
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

export const AiVideoMirrorView: React.FC<AiVideoMirrorViewProps> = ({
  subscriptionTier: parentSubscriptionTier,
  onBackToEnhancement,
  onBackToPlayer,
  onNavigateToUpgrade,
  firestoreVideos,
  
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

  // Video playback & HTML5 element refs
  const enhancedVideoRef = useRef<HTMLVideoElement>(null);
  const rawVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player controls state
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  // Video mirror settings & modes
  const [isHoldingCompare, setIsHoldingCompare] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50); // percentage 0 - 100
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Local enhancement switches
  const [smartSharpness, setSmartSharpness] = useState(true);
  const [backlightStabilizer, setBacklightStabilizer] = useState(false);

  // Active preset tag
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Diagnostic activity log
  const [lastAction, setLastAction] = useState<string>("Live Mirror View Connected");

  // Resolved video URL state
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
          console.error("Error fetching video blob in mirror:", err);
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

  // Sync dual videos when playing/seeking
  const syncVideos = (time: number) => {
    if (enhancedVideoRef.current && Math.abs(enhancedVideoRef.current.currentTime - time) > 0.15) {
      enhancedVideoRef.current.currentTime = time;
    }
    if (rawVideoRef.current && Math.abs(rawVideoRef.current.currentTime - time) > 0.15) {
      rawVideoRef.current.currentTime = time;
    }
  };

  const handleTimeUpdate = () => {
    const main = enhancedVideoRef.current;
    if (!main) return;
    const cur = main.currentTime || 0;
    const dur = main.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress(dur ? (cur / dur) * 100 : 0);

    // Keep raw background video synchronized for instant split screen comparison
    if (splitMode && rawVideoRef.current) {
      if (Math.abs(rawVideoRef.current.currentTime - cur) > 0.15) {
        rawVideoRef.current.currentTime = cur;
      }
    }
  };

  const togglePlay = () => {
    const enh = enhancedVideoRef.current;
    const raw = rawVideoRef.current;

    if (isPlaying) {
      if (enh) enh.pause();
      if (raw) raw.pause();
      setIsPlaying(false);
    } else {
      if (enh) enh.play().catch(e => console.log("Play error:", e));
      if (raw) raw.play().catch(e => console.log("Raw play error:", e));
      setIsPlaying(true);
    }
  };

  const handleSeek = (percentage: number) => {
    const dur = duration || (enhancedVideoRef.current?.duration || 0);
    if (!dur) return;
    const targetTime = (percentage / 100) * dur;
    if (enhancedVideoRef.current) enhancedVideoRef.current.currentTime = targetTime;
    if (rawVideoRef.current) rawVideoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setProgress(percentage);
  };

  // Compute live CSS filters
  const enhancedStyles = useMemo(() => {
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
        transition: "filter 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
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

    const sharpnessEffect = (upscaleTarget === "4K" || upscaleTarget === "8K") && filterStr !== "none"
      ? `contrast(1.04) saturate(1.02)`
      : "";

    return {
      filter: `${filterStr} ${sharpnessEffect}`,
      transform: "translateZ(0)",
      willChange: "transform, filter",
      transition: "filter 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
    };
  }, [colorEnhancement, upscaleTarget, turboMode, aiOptimizedFilters, isHoldingCompare, smartSharpness, backlightStabilizer]);

  // Handle split screen dragging
  const handleSplitDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const offset = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (offset / rect.width) * 100));
    setSplitPosition(pct);
  };

  const PRESETS = [
    {
      id: "midnight",
      name: "🎬 Night Mode",
      badge: "Night Movie",
      activeModel: "deep-cinema" as const,
      upscaleTarget: "4K" as const,
      colorEnhancement: "lowlight" as const,
      smoothMotion: true,
      turboMode: false
    },
    {
      id: "action",
      name: "🏎️ Action & Sports",
      badge: "Smooth Action",
      activeModel: "quantum-scale" as const,
      upscaleTarget: "4K" as const,
      colorEnhancement: "vivid" as const,
      smoothMotion: true,
      turboMode: true
    },
    {
      id: "remaster",
      name: "🌟 Ultra Clear HD",
      badge: "Super Quality",
      activeModel: "chroma-hdr" as const,
      upscaleTarget: "8K" as const,
      colorEnhancement: "hdr" as const,
      smoothMotion: true,
      turboMode: true
    },
    {
      id: "natural",
      name: "🌿 Natural Colors",
      badge: "Standard",
      activeModel: "deep-cinema" as const,
      upscaleTarget: "2K" as const,
      colorEnhancement: "none" as const,
      smoothMotion: true,
      turboMode: false
    }
  ];

  const applyPreset = (p: typeof PRESETS[0]) => {
    setActivePreset(p.id);
    setActiveModel(p.activeModel);
    setUpscaleTarget(p.upscaleTarget);
    setColorEnhancement(p.colorEnhancement);
    setSmoothMotion(p.smoothMotion);
    setTurboMode(p.turboMode);
    setLastAction(`Preset Applied: ${p.name}`);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5 p-1 md:p-3 text-stone-200 select-none text-left"
      id="ai-video-mirror-container"
    >
      {/* Top Mirror Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
              LIVE MIRROR SCREEN
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-extrabold bg-stone-900 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              AI REAL-TIME SYNC
            </span>
            {isPremiumActive && (
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5 fill-current" />
                VIP UNLOCKED
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-3xl font-sans font-semibold tracking-tight text-white mt-2 flex items-center gap-2.5">
            <Tv className="w-6 h-6 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            AI Video Settings Mirror Screen
          </h1>
          <p className="text-xs text-stone-400 mt-1 max-w-2xl font-light font-sans leading-relaxed">
            Watch live changes in real-time as you switch different video options, color profiles, upscaling targets, and AI filters on and off.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onBackToEnhancement}
            className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all text-xs font-sans font-bold flex items-center gap-2 shadow"
          >
            <SlidersHorizontal className="w-4 h-4" />
            AI Video Settings
          </button>
          
          <button
            onClick={onBackToPlayer}
            className="px-4 py-2 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white transition-all text-xs font-sans font-semibold flex items-center gap-2 shadow"
          >
            <ArrowLeft className="w-4 h-4" />
            4K Video Player
          </button>
        </div>
      </div>

      {/* Main Mirror Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / TOP STAGE (COL-SPAN-8): High Resolution Mirror Theater Player */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          <div className="p-5 md:p-6 rounded-3xl bg-stone-900/80 border border-stone-800 shadow-[0_25px_60px_rgba(0,0,0,0.7)] flex flex-col gap-4 backdrop-blur-2xl relative overflow-hidden">
            
            {/* Mirror Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-500" />
                  {selectedVideo ? selectedVideo.name : "Select Video Stream"}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Split Screen Before/After Toggle */}
                <button
                  onClick={() => {
                    setSplitMode(!splitMode);
                    setLastAction(`Split Screen Mode ${!splitMode ? "ENABLED" : "DISABLED"}`);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-sans font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitMode
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      : "bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200"
                  }`}
                  title="Toggle Split-Screen Before & After Slider"
                >
                  <Split className="w-3.5 h-3.5" />
                  {splitMode ? "Split Screen Active" : "Enable Split Screen"}
                </button>

                {/* Active Filter Badge */}
                <span className={`text-[9px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-lg border ${
                  isHoldingCompare
                    ? "bg-stone-950 text-stone-500 border-stone-850"
                    : aiOptimizedFilters 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse" 
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                }`}>
                  {isHoldingCompare ? "RAW ORIGINAL" : aiOptimizedFilters ? "AI OPTIMIZED" : "LIVE TUNED"}
                </span>
              </div>
            </div>

            {/* Video Player Display Screen Container */}
            <div 
              ref={containerRef}
              onMouseMove={splitMode && isDraggingSplit ? handleSplitDrag : undefined}
              onTouchMove={splitMode && isDraggingSplit ? handleSplitDrag : undefined}
              onMouseUp={() => setIsDraggingSplit(false)}
              onTouchEnd={() => setIsDraggingSplit(false)}
              className="relative aspect-video w-full rounded-2xl bg-black border border-stone-950 overflow-hidden shadow-2xl ring-1 ring-white/10 select-none group"
            >
              {selectedVideo && resolvedVideoUrl ? (
                <>
                  {/* Main Enhanced Video Element */}
                  <video
                    ref={enhancedVideoRef}
                    src={resolvedVideoUrl}
                    preload="auto"
                    loop={true}
                    muted={isMuted}
                    autoPlay={isPlaying}
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    style={enhancedStyles}
                    className="w-full h-full object-cover transition-all"
                  />

                  {/* Split Screen Overlay Video (Raw Unfiltered) */}
                  {splitMode && (
                    <div 
                      className="absolute top-0 left-0 bottom-0 overflow-hidden border-r-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)] z-10"
                      style={{ width: `${splitPosition}%` }}
                    >
                      <video
                        ref={rawVideoRef}
                        src={resolvedVideoUrl}
                        preload="auto"
                        loop={true}
                        muted={true}
                        autoPlay={isPlaying}
                        playsInline
                        style={{ filter: "none" }}
                        className="absolute top-0 left-0 w-full h-full object-cover max-w-none"
                      />
                      <span className="absolute top-3 left-3 bg-black/80 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-stone-300 border border-stone-800 tracking-wider uppercase">
                        RAW BEFORE ({Math.round(splitPosition)}%)
                      </span>
                    </div>
                  )}

                  {/* Split Screen Drag Handle */}
                  {splitMode && (
                    <div 
                      onMouseDown={() => setIsDraggingSplit(true)}
                      onTouchStart={() => setIsDraggingSplit(true)}
                      style={{ left: `${splitPosition}%` }}
                      className="absolute top-0 bottom-0 w-6 -ml-3 z-20 flex items-center justify-center cursor-ew-resize group/slider"
                    >
                      <div className="w-6 h-10 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-black text-[10px] shadow-2xl group-hover/slider:scale-110 transition-transform">
                        ↔
                      </div>
                    </div>
                  )}

                  {/* Top Overlay Live Badges */}
                  <div className="absolute top-3 right-3 z-20 pointer-events-none flex flex-wrap gap-1.5 items-center">
                    <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-stone-950/90 text-stone-300 border border-stone-800 font-bold uppercase tracking-wider">
                      {upscaleTarget}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[8px] font-sans bg-stone-950/90 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                      {colorEnhancement === "none" ? "NEUTRAL" : colorEnhancement.toUpperCase()}
                    </span>
                    {smoothMotion && (
                      <span className="px-2 py-0.5 rounded text-[8px] font-sans bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wider">
                        60 FPS SMOOTH
                      </span>
                    )}
                    {turboMode && (
                      <span className="px-2 py-0.5 rounded text-[8px] font-sans bg-red-500/20 text-red-300 border border-red-500/30 font-bold uppercase tracking-wider">
                        CONTRAST TURBO
                      </span>
                    )}
                  </div>

                  {/* Interactive Play/Pause Overlay on Click */}
                  <div 
                    onClick={togglePlay}
                    className="absolute inset-0 z-10 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full bg-stone-950/90 border border-stone-800 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl">
                      {isPlaying ? (
                        <Pause className="w-6 h-6 fill-white text-white" />
                      ) : (
                        <Play className="w-6 h-6 fill-white text-white pl-1" />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <Tv className="w-10 h-10 text-stone-800 mb-2 animate-pulse" />
                  <span className="text-xs uppercase font-sans font-bold text-stone-600 tracking-widest">
                    No Video Selected
                  </span>
                </div>
              )}
            </div>

            {/* Custom Video Playbar Controls */}
            {selectedVideo && (
              <div className="flex flex-col gap-2 bg-stone-950/80 p-3.5 rounded-2xl border border-stone-850">
                {/* Seek Bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-stone-400 w-9 text-right font-bold">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={progress || 0}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 w-9 text-left font-bold">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-all cursor-pointer border border-stone-800"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 pl-0.5" />}
                    </button>

                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition-all cursor-pointer border border-stone-800"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        if (v > 0) setIsMuted(false);
                      }}
                      className="w-20 h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Hold to Compare Raw Button */}
                  <button
                    onMouseDown={() => setIsHoldingCompare(true)}
                    onMouseUp={() => setIsHoldingCompare(false)}
                    onMouseLeave={() => setIsHoldingCompare(false)}
                    onTouchStart={() => setIsHoldingCompare(true)}
                    onTouchEnd={() => setIsHoldingCompare(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black border border-stone-800 text-stone-400 active:text-amber-400 hover:text-white font-sans text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none cursor-pointer transition-all active:scale-95 shadow"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-500" />
                    Hold For Original Raw
                  </button>
                </div>
              </div>
            )}

            {/* Diagnostic Monitor Readout */}
            <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-850/80 flex items-center justify-between text-[10px] font-mono">
              <span className="text-stone-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                Live Feed Activity:
              </span>
              <span className="text-amber-400 font-semibold truncate max-w-md">
                {lastAction}
              </span>
            </div>

          </div>
        </div>

        {/* RIGHT STAGE (COL-SPAN-4): Live Setting Switches & Toggles */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          <div className="p-5 rounded-3xl bg-stone-900/80 border border-stone-850 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-5 backdrop-blur-xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <SlidersVertical className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Live Video Controls
                </h3>
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
                  setLastAction("Reset settings to defaults");
                }}
                className="text-[9px] font-sans font-bold uppercase text-stone-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                <Sparkle className="w-3 h-3 text-amber-500" />
                Quick Preset Profiles
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const isActive = activePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className={`p-2.5 rounded-xl border text-left font-sans transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isActive
                          ? "bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-md"
                          : "bg-stone-950/50 border-stone-850 text-stone-400 hover:text-white hover:border-stone-750"
                      }`}
                    >
                      <span className="text-[10px] font-bold truncate">{p.name}</span>
                      <span className="text-[8px] font-mono text-stone-500 uppercase">{p.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Model Switcher */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400">
                1. AI Processing Model
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "quantum-scale" as const, label: "Scale" },
                  { id: "deep-cinema" as const, label: "Cinema" },
                  { id: "chroma-hdr" as const, label: "Bright" }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveModel(m.id);
                      setActivePreset(null);
                      setLastAction(`AI Model: ${m.label}`);
                    }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-sans font-extrabold uppercase tracking-wider transition-all cursor-pointer border ${
                      activeModel === m.id
                        ? "bg-stone-950 border-amber-500 text-amber-400 shadow"
                        : "bg-stone-950/40 border-stone-850 text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Target Switcher */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400">
                2. Resolution Detail
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["HD", "2K", "4K", "8K"] as const).map((r) => {
                  const isLocked = r === "8K" && !isPremiumActive;
                  return (
                    <button
                      key={r}
                      disabled={isLocked}
                      onClick={() => {
                        setUpscaleTarget(r);
                        setActivePreset(null);
                        setLastAction(`Resolution: ${r}`);
                      }}
                      className={`py-2 rounded-xl text-[10px] font-mono font-bold transition-all border ${
                        isLocked
                          ? "opacity-40 bg-stone-950 border-stone-900 cursor-not-allowed"
                          : upscaleTarget === r
                          ? "bg-stone-950 border-amber-500 text-amber-400 shadow"
                          : "bg-stone-950/40 border-stone-850 text-stone-500 hover:text-stone-300 cursor-pointer"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Profile Switcher */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400">
                3. Color Profile
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "none" as const, label: "Neutral" },
                  { id: "hdr" as const, label: "HDR" },
                  { id: "vivid" as const, label: "Vivid" },
                  { id: "lowlight" as const, label: "Night" }
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setColorEnhancement(c.id);
                      setActivePreset(null);
                      setLastAction(`Color Profile: ${c.label}`);
                    }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-sans font-bold transition-all border ${
                      colorEnhancement === c.id
                        ? "bg-stone-950 border-amber-500 text-amber-400 shadow"
                        : "bg-stone-950/40 border-stone-850 text-stone-500 hover:text-stone-300 cursor-pointer"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Toggles */}
            <div className="flex flex-col gap-2.5 pt-1 border-t border-stone-800">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400">
                4. Feature Toggles
              </span>
              
              <div className="flex flex-col gap-2">
                {/* 60 FPS Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-850">
                  <span className="text-[10px] font-sans font-bold text-stone-300">
                    Extra Smooth Motion (60 FPS)
                  </span>
                  <button
                    onClick={() => {
                      setSmoothMotion(!smoothMotion);
                      setActivePreset(null);
                      setLastAction(`Smooth Motion: ${!smoothMotion ? "ON" : "OFF"}`);
                    }}
                    className={`w-8 h-4.5 rounded-full transition-all relative cursor-pointer ${
                      smoothMotion ? "bg-amber-500" : "bg-stone-800"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full absolute top-0.75 transition-all ${
                      smoothMotion ? "left-4 bg-stone-950" : "left-0.75 bg-stone-400"
                    }`} />
                  </button>
                </div>

                {/* Extra Contrast Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-850">
                  <span className="text-[10px] font-sans font-bold text-stone-300">
                    Extra Contrast Mode
                  </span>
                  <button
                    onClick={() => {
                      setTurboMode(!turboMode);
                      setActivePreset(null);
                      setLastAction(`Extra Contrast: ${!turboMode ? "ON" : "OFF"}`);
                    }}
                    className={`w-8 h-4.5 rounded-full transition-all relative cursor-pointer ${
                      turboMode ? "bg-red-600" : "bg-stone-800"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full absolute top-0.75 transition-all ${
                      turboMode ? "left-4 bg-white" : "left-0.75 bg-stone-400"
                    }`} />
                  </button>
                </div>

                {/* Sharp Details Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-850">
                  <span className="text-[10px] font-sans font-bold text-stone-300">
                    Smart Edge Sharpness
                  </span>
                  <button
                    onClick={() => {
                      setSmartSharpness(!smartSharpness);
                      setLastAction(`Sharpness: ${!smartSharpness ? "ON" : "OFF"}`);
                    }}
                    className={`w-8 h-4.5 rounded-full transition-all relative cursor-pointer ${
                      smartSharpness ? "bg-emerald-500" : "bg-stone-800"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full absolute top-0.75 transition-all ${
                      smartSharpness ? "left-4 bg-stone-950" : "left-0.75 bg-stone-400"
                    }`} />
                  </button>
                </div>

                {/* Eye Saver Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-850">
                  <span className="text-[10px] font-sans font-bold text-stone-300">
                    Eye Saver Backlight Mode
                  </span>
                  <button
                    onClick={() => {
                      setBacklightStabilizer(!backlightStabilizer);
                      setLastAction(`Eye Saver: ${!backlightStabilizer ? "ON" : "OFF"}`);
                    }}
                    className={`w-8 h-4.5 rounded-full transition-all relative cursor-pointer ${
                      backlightStabilizer ? "bg-blue-500" : "bg-stone-800"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full absolute top-0.75 transition-all ${
                      backlightStabilizer ? "left-4 bg-stone-950" : "left-0.75 bg-stone-400"
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Filter Metrics Gauge Card */}
            {aiOptimizedFilters && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2">
                <span className="text-[9px] font-sans font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Filter Values
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-stone-300">
                  <div>Bright: <strong className="text-white">{Math.round(aiOptimizedFilters.brightness * 100)}%</strong></div>
                  <div>Contrast: <strong className="text-white">{Math.round(aiOptimizedFilters.contrast * 100)}%</strong></div>
                  <div>Sat: <strong className="text-white">{Math.round(aiOptimizedFilters.saturation * 100)}%</strong></div>
                  <div>Sharp: <strong className="text-white">+{aiOptimizedFilters.sharpness}%</strong></div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </motion.div>
  );
};
