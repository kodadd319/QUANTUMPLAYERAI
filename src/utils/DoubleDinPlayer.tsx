import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Square,
  Shuffle,
  Volume2,
  VolumeX,
  Disc,
  Info,
  Radio,
  Sliders,
  Sparkles,
  Music
} from "lucide-react";
import { Track } from "../types";
import { getAlbumArtForTrack } from "./albumArt";

interface DoubleDinPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  songProgress: number;
  songDuration: number;
  volume: number; // 0.0 to 1.0
  shuffleMode: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  headunitTime: string;
  isMaxBass: boolean;
  onToggleMaxBass: () => void;
}

export function DoubleDinPlayer({
  currentTrack,
  isPlaying,
  songProgress,
  songDuration,
  volume,
  shuffleMode,
  onPlayPause,
  onStop,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  headunitTime,
  isMaxBass,
  onToggleMaxBass
}: DoubleDinPlayerProps) {
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(volume || 0.5);

  // Formatting helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Toggle mute behavior
  const handleToggleMute = () => {
    if (isMuted) {
      onVolumeChange(prevVolumeRef.current);
      setIsMuted(false);
    } else {
      prevVolumeRef.current = volume > 0 ? volume : 0.5;
      onVolumeChange(0);
      setIsMuted(true);
    }
  };

  useEffect(() => {
    if (volume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [volume]);

  // Audio spectrum visualizer mock state
  const [frequencies, setFrequencies] = useState<number[]>(Array(24).fill(0));

  useEffect(() => {
    let animationId: number;
    let lastTime = 0;

    const tick = (time: number) => {
      if (time - lastTime > 60) { // Throttle updates for performance
        if (isPlaying) {
          setFrequencies(
            Array(24)
              .fill(0)
              .map(() => Math.floor(Math.random() * 8) + 1)
          );
        } else {
          setFrequencies((prev) => prev.map((v) => Math.max(0, v - 1)));
        }
        lastTime = time;
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div
      id="open-spotify-player-container"
      className="w-full max-w-xl mx-auto rounded-3xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/20 p-5 md:p-6 relative overflow-hidden mb-6 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(255,255,255,0.05)] high-gloss-reflection"
    >
      {/* Decorative subtle ambient backdrop glow mapping */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[#991b1b]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* TOP DECK HEADER: Subtle metadata line inside the player */}
      <div className="w-full flex items-center justify-between text-[9px] font-sans tracking-widest text-stone-400 uppercase border-b border-stone-900/60 pb-3 mb-5 relative z-10">
        <span className="flex items-center gap-1.5 text-stone-300 font-semibold">
          <span className="relative flex h-1.5 w-1.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 ${isPlaying ? "block" : "hidden"}`}></span>
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPlaying ? "bg-white" : "bg-stone-600"}`}></span>
          </span>
          ELITE STREAMING ACTIVE
        </span>
        <div className="flex items-center gap-3">
          {isMaxBass && (
            <span className="text-red-500 font-semibold animate-pulse bg-red-950/45 px-1.5 py-0.5 rounded border border-red-800/35">
              MAX BASS ACTIVE
            </span>
          )}
          <span className="font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]">{headunitTime}</span>
        </div>
      </div>

      {/* INTERPRETATION LAYOUT: Spotify/Streaming Open Hub */}
      <div className="flex flex-col items-center gap-6 relative z-10 w-full mb-6">
        
        {/* ALBUM ART COMPASS: Large Premium Album Art image or Generic Placeholder */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto my-6 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center group transition-all duration-300 hover:border-neutral-700/50">
          
          <AnimatePresence mode="wait">
            {currentTrack ? (
              <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full relative"
              >
                <img
                  src={getAlbumArtForTrack(currentTrack)}
                  alt={currentTrack.name || "Album Art"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback if URL is broken
                    (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";
                  }}
                />
                
                {/* Overlay rotating vinyl badge in corner to match double-din vibe */}
                <div className="absolute bottom-3 right-3 bg-black/80 hover:bg-black p-1.5 rounded-full border border-slate-400/30 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] shadow-lg flex items-center justify-center">
                  <Disc className={`w-4 h-4 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
                </div>
              </motion.div>
            ) : (
              /* Beautiful generic placeholder icon for local stream files */
              <motion.div
                key="fallback-art"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full bg-stone-950 flex flex-col items-center justify-center gap-4 text-center p-6"
              >
                <div className="w-20 h-20 rounded-full bg-[#1c1412]/80 border border-stone-800 flex items-center justify-center text-stone-400 shadow-xl relative overflow-hidden group-hover:border-stone-700 transition-colors">
                  <Music className={`w-9 h-9 text-slate-400 ${isPlaying ? "animate-pulse" : ""}`} />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-white/5 flex items-center justify-center pointer-events-none">
                      <Disc className="w-16 h-16 text-white/5 animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-sans font-bold tracking-[0.2em] text-stone-300 uppercase">
                    LOCAL STREAM ACTIVE
                  </p>
                  <p className="text-[8px] font-sans text-stone-500 uppercase tracking-widest leading-relaxed">
                    Direct Lossless Playback
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Golden outline overlay inner border */}
          <div className="absolute inset-0.5 rounded-[14px] border border-white/[0.03] pointer-events-none" />
          <div className="absolute inset-1.5 rounded-[12px] border border-black/10 pointer-events-none" />
        </div>

        {/* TRACK METADATA INFO: Substantially increased font sizing for perfect legibility */}
        <div className="w-full flex flex-col justify-center items-center text-center px-2 min-w-0">
          <AnimatePresence mode="wait">
            {currentTrack ? (
              <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col items-center"
              >
                {/* Album / Playlist Context Indicator */}
                <span className="text-[10px] font-sans font-semibold tracking-[0.25em] text-slate-300 uppercase mb-1.5">
                  NOW REPRODUCING
                </span>

                {/* Song Title (Bigger size: text-2xl base, text-3xl sm) */}
                <h2 className="text-2xl sm:text-3xl font-sans font-semibold text-white tracking-normal leading-tight truncate max-w-full uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">
                  {currentTrack.name}
                </h2>

                {/* Artist Name (Bigger size: text-sm base, text-lg sm) */}
                <p className="text-sm sm:text-base text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] font-sans font-semibold tracking-widest uppercase mt-2">
                  {currentTrack.artist || "Unknown Artist"}
                </p>

                {/* Album Name (Bigger size: text-xs base, text-sm sm) */}
                <p className="text-xs sm:text-sm text-stone-400 font-sans font-semibold tracking-wide mt-1 italic">
                  {currentTrack.album || "Single Release"}
                </p>

                {/* Dynamic Genre Tag overlay */}
                <div className="flex items-center justify-center gap-2.5 mt-4">
                  <span className="text-[9px] font-sans font-semibold tracking-[0.12em] text-stone-300 bg-stone-900 px-3 py-1 rounded-full border border-stone-800 uppercase font-light">
                    {currentTrack.genre || "Lossless Direct"}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="w-full flex flex-col items-center opacity-60">
                <span className="text-[9px] font-sans tracking-[0.25em] text-stone-500 uppercase mb-2 font-semibold">
                  STREAMING SYSTEM READY
                </span>
                <h2 className="text-xl sm:text-2xl font-sans font-semibold text-stone-300 tracking-wide">
                  Waiting For Track Selection
                </h2>
                <p className="text-xs font-sans text-stone-500 uppercase mt-2 tracking-widest font-light">
                  Pick a song from your collection below
                </p>
                <div className="mt-4 p-2.5 rounded-full bg-stone-900 border border-stone-850 animate-pulse text-stone-400">
                  <Radio className="w-5 h-5 stroke-[1.5]" />
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TRACK TIMELINE PROGRESS: Modern Seeking Slider directly visible */}
      <div className="w-full mt-4 mb-2 flex flex-col gap-1.5 relative z-10 bg-black/35 p-3 rounded-2xl border border-stone-900/85">
        <div className="flex items-center justify-between text-[10px] font-sans text-stone-400 font-semibold tracking-wider px-1">
          <span className="text-stone-100">{formatTime(songProgress)}</span>
          <div className="h-[1px] flex-1 mx-3 bg-stone-905" />
          <span className="text-slate-200">{currentTrack ? formatTime(songDuration || currentTrack.duration) : "00:00"}</span>
        </div>

        {/* Custom Seek track */}
        <div 
          onClick={(e) => {
            if (!currentTrack) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            onSeek(ratio * (songDuration || currentTrack.duration || 120));
          }}
          className={`h-2 rounded-full relative cursor-pointer outline-none transition-all duration-150 ${
            currentTrack ? "bg-stone-900/90 group" : "bg-stone-950/40 cursor-not-allowed"
          }`}
        >
          {/* Background Highlight fill */}
          <div 
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-slate-400 via-white to-slate-350 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-all"
            style={{ width: `${Math.min(100, ((songProgress / (songDuration || (currentTrack?.duration) || 120)) * 100))}%` }}
          />
          {/* Seeking handle */}
          {currentTrack && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.6)] scale-100 opacity-90 hover:scale-125 transition-transform"
              style={{ left: `calc(${Math.min(99, ((songProgress / (songDuration || currentTrack.duration || 120)) * 100))}% - 6px)` }}
            />
          )}
        </div>
      </div>

      {/* DIGITAL CONTROL DECK: Centered circular buttons in Spotify layout */}
      <div className="flex items-center justify-between gap-4 mt-4 relative z-10 w-full px-1">
        
        {/* SHUFFLE BUTTON */}
        <button
          onClick={onToggleShuffle}
          className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
            shuffleMode
              ? "bg-white/10 border-slate-350 text-white shadow-[0_0_12px_rgba(255,255,255,0.45)]"
              : "bg-transparent border-stone-850 hover:border-stone-500 text-stone-400 hover:text-white"
          }`}
          title="Toggle Shuffle"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        {/* PREVIOUS TRACK */}
        <button
          onClick={onPrev}
          className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 transition-all cursor-pointer"
          title="Previous Track"
        >
          <SkipBack className="w-4.5 h-4.5" />
        </button>

        {/* CENTRAL PRIMARY PLAY / PAUSE SPIN BUTTON */}
        <button
          onClick={onPlayPause}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-400 p-0.5 border-2 border-slate-300 shadow-[0_0_24px_rgba(255,255,255,0.45)] cursor-pointer hover:scale-105 active:scale-95 transition-all text-stone-950 flex items-center justify-center"
          title={isPlaying ? "Pause Track" : "Play Track"}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-stone-900 fill-stone-900" />
          ) : (
            <Play className="w-6 h-6 text-stone-900 fill-stone-900 ml-0.5" />
          )}
        </button>

        {/* NEXT TRACK */}
        <button
          onClick={onNext}
          className="w-10 h-10 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-stone-300 hover:text-white hover:border-stone-450 active:scale-90 transition-all cursor-pointer"
          title="Next Track"
        >
          <SkipForward className="w-4.5 h-4.5" />
        </button>

        {/* STOP BUTTON */}
        <button
          onClick={onStop}
          className="w-9 h-9 rounded-full border border-stone-850 bg-transparent flex items-center justify-center text-red-500 hover:text-red-400 hover:border-red-950/65 active:scale-90 transition-all cursor-pointer"
          title="Force Stop & Reset"
        >
          <Square className="w-3.5 h-3.5 fill-red-800/10" />
        </button>
      </div>

      {/* HORIZONTAL VOLUME SLIDER: Complete and responsive directly on the page */}
      <div className="w-full mt-5 pt-4 border-t border-stone-900/60 flex items-center gap-3.5 relative z-10 select-none">
        {/* Speaker Mute/Vibrate Icon button clickable */}
        <button
          onClick={handleToggleMute}
          className="text-stone-400 hover:text-white transition-all cursor-pointer hover:scale-105"
          title={isMuted ? "Unmute Volume" : "Mute Volume"}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4.5 h-4.5 text-red-500 animate-pulse" />
          ) : (
            <Volume2 className="w-4.5 h-4.5" />
          )}
        </button>

        {/* Modern Volume Slider */}
        <div className="flex-1 flex items-center relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onVolumeChange(val);
              if (isMuted && val > 0) setIsMuted(false);
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer outline-none bg-stone-900 [&::-webkit-slider-runnable-track]:bg-stone-900 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white"
            style={{
              background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${isMuted ? 0 : volume * 100}%, #1c1917 ${isMuted ? 0 : volume * 100}%, #1c1917 100%)`
            }}
            title="Sleek direct volume feedback stream"
          />
        </div>

        {/* Precise volume badge info */}
        <span className="text-[10px] font-sans font-semibold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] min-w-[36px] text-right">
          {isMuted ? "MUTED" : `${Math.round(volume * 100)}%`}
        </span>
      </div>

      {/* BOTTOM SPECTRUM WAVEFORM (Embedded directly inside player) */}
      <div className="w-full mt-5 pt-4 border-t border-stone-900/40 flex items-end justify-center gap-[4.4px] h-14 px-1 relative z-10 overflow-hidden">
        {frequencies.map((lev, idx) => (
          <div key={idx} className="flex flex-col-reverse justify-end gap-[3px] w-[10px] h-full">
            {Array.from({ length: 8 }).map((_, segmentIdx) => {
              const isActive = segmentIdx < lev;
              let segmentBg = "bg-stone-950/80";
              if (isActive) {
                if (segmentIdx >= 6) {
                  segmentBg = "bg-red-700 shadow-[0_0_4px_#b91c1c]"; // High-frequency mahogany red
                } else if (segmentIdx >= 4) {
                  segmentBg = "bg-slate-350 shadow-[0_0_4px_rgba(255,255,255,0.7)]"; // Chrome silver
                } else {
                  segmentBg = "bg-stone-300 shadow-[0_0_4px_#e3e3e3]"; // Metallic beige silver
                }
              }
              return (
                <div
                  key={segmentIdx}
                  className={`w-full h-[4.4px] rounded-xs transition-colors duration-100 ${segmentBg}`}
                />
              );
            })}
          </div>
        ))}
      </div>

    </div>
  );
}
