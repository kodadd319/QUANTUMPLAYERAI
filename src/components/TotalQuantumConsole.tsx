import React, { useState } from "react";
import { 
  Zap, 
  Sliders, 
  Volume2, 
  Tv, 
  Sparkles, 
  X, 
  Flame, 
  ShieldCheck, 
  Radio, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  Activity,
  Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DspSettings } from "../types";
import { EqSliders } from "./EqSliders";
import { BassKnob } from "./BassKnob";

export interface TotalQuantumConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  isTotalQuantumActive: boolean;
  setIsTotalQuantumActive: (active: boolean) => void;
  
  // Video AI Props
  activeModel: "quantum-scale" | "deep-cinema" | "chroma-hdr";
  setActiveModel: (model: "quantum-scale" | "deep-cinema" | "chroma-hdr") => void;
  upscaleTarget: "native" | "1080p" | "4K" | "8K";
  setUpscaleTarget: (target: "native" | "1080p" | "4K" | "8K") => void;
  colorEnhancement: "off" | "vibrant" | "cinematic" | "hdr_pop";
  setColorEnhancement: (val: "off" | "vibrant" | "cinematic" | "hdr_pop") => void;
  smoothMotion: boolean;
  setSmoothMotion: (val: boolean) => void;
  turboMode: boolean;
  setTurboMode: (val: boolean) => void;

  // Audio DSP Props
  dspSettings: DspSettings;
  setDspSettings?: React.Dispatch<React.SetStateAction<DspSettings>>;
  onUpdateBassBoost?: (val: number) => void;
  onUpdateEqBand?: (index: number, val: number) => void;
}

const PRESET_OPTIONS = [
  { name: "Movie 3D", eqBands: [7, 3, 4, 2, 5], bassBoost: 60, reverbWet: 0.22, delayOffsetMs: 18 },
  { name: "Bass Boom", eqBands: [10, 7, 0, 2, 4], bassBoost: 85, reverbWet: 0.10, delayOffsetMs: 10 },
  { name: "Hip Hop", eqBands: [8, 5, -2, 1, 3], bassBoost: 75, reverbWet: 0.08, delayOffsetMs: 8 },
  { name: "Rock", eqBands: [3, 4, 1, 4, 3], bassBoost: 45, reverbWet: 0.10, delayOffsetMs: 6 },
  { name: "Cinema Vocal", eqBands: [2, 4, 6, 4, 2], bassBoost: 30, reverbWet: 0.12, delayOffsetMs: 14 },
  { name: "Flat Studio", eqBands: [0, 0, 0, 0, 0], bassBoost: 0, reverbWet: 0.0, delayOffsetMs: 0 }
];

export const TotalQuantumConsole: React.FC<TotalQuantumConsoleProps> = ({
  isOpen,
  onClose,
  isTotalQuantumActive,
  setIsTotalQuantumActive,
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
  dspSettings,
  setDspSettings,
  onUpdateBassBoost,
  onUpdateEqBand
}) => {
  const [activeTab, setActiveTab] = useState<"combined" | "audio" | "video">("combined");

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_OPTIONS[0]) => {
    if (setDspSettings) {
      setDspSettings(prev => ({
        ...prev,
        eqBands: [...preset.eqBands],
        bassBoost: preset.bassBoost,
        reverbWet: preset.reverbWet,
        delayOffsetMs: preset.delayOffsetMs,
        justification: `Total Quantum Audio Preset Applied: ${preset.name}`
      }));
    }
    if (onUpdateBassBoost) {
      onUpdateBassBoost(preset.bassBoost);
    }
    if (onUpdateEqBand) {
      preset.eqBands.forEach((val, idx) => onUpdateEqBand(idx, val));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          className="w-full max-w-3xl max-h-[90vh] bg-stone-920 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-stone-100 flex flex-col overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Zap className="w-6 h-6 fill-current animate-pulse text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-sans font-bold text-white tracking-tight">TOTAL QUANTUM</h2>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-stone-950 uppercase tracking-widest">
                    A/V UNIFIED ENGINE
                  </span>
                </div>
                <p className="text-xs text-stone-400 font-sans">
                  Combine AI Video Upscaling with Studio 5-Band Audio DSP for Video Playback
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Master Toggle Banner */}
          <div className="mt-4 p-3.5 rounded-2xl bg-stone-900 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${isTotalQuantumActive ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-stone-600"}`} />
              <div>
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Total Quantum Status: {isTotalQuantumActive ? "ACTIVE (Audio + Video Linked)" : "STANDBY"}
                </div>
                <div className="text-[11px] text-stone-400">
                  {isTotalQuantumActive 
                    ? "Video playback audio is routed live through the Web Audio 5-Band Equalizer & Bass Boost Engine."
                    : "Video audio plays raw without DSP processing. Enable Total Quantum to apply audio options to video."}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsTotalQuantumActive(!isTotalQuantumActive)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 shrink-0 ${
                isTotalQuantumActive
                  ? "bg-amber-500 text-stone-950 border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  : "bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700"
              }`}
            >
              {isTotalQuantumActive ? "Disable Total Quantum" : "Engage Total Quantum"}
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 mt-4 border-b border-stone-800 pb-2 shrink-0">
            <button
              onClick={() => setActiveTab("combined")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "combined"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Unified Dashboard
            </button>
            <button
              onClick={() => setActiveTab("audio")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "audio"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              AI Audio DSP
            </button>
            <button
              onClick={() => setActiveTab("video")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "video"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              AI Video Enhancements
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-5">
            {/* 1. UNIFIED / COMBINED TAB */}
            {(activeTab === "combined" || activeTab === "audio") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    AI Sound Presets for Video Audio
                  </div>
                  <span className="text-[10px] text-stone-500 font-mono">5-Band Web Audio DSP</span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2.5 rounded-xl bg-stone-900 hover:bg-amber-500/10 border border-stone-800 hover:border-amber-500/40 text-left transition-all cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center justify-between">
                        <span>{preset.name}</span>
                        <Zap className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100" />
                      </div>
                      <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-2">
                        <span>Bass: +{preset.bassBoost}%</span>
                        <span>•</span>
                        <span>Reverb: {Math.round(preset.reverbWet * 100)}%</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Bass Boost & EQ Controls */}
                <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col md:flex-row items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-amber-400 mb-2">Subwoofer Bass Boost</span>
                    <BassKnob 
                      value={dspSettings.bassBoost} 
                      onChange={(val) => {
                        if (onUpdateBassBoost) onUpdateBassBoost(val);
                      }} 
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <span className="text-xs font-bold text-amber-400 mb-2 block">5-Band Master Equalizer</span>
                    <EqSliders 
                      gains={dspSettings.eqBands} 
                      onChange={(idx, val) => {
                        if (onUpdateEqBand) onUpdateEqBand(idx, val);
                      }} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. VIDEO ENHANCEMENTS TAB */}
            {(activeTab === "combined" || activeTab === "video") && (
              <div className="space-y-4 pt-2">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-amber-400" />
                  AI Video Enhancements
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* AI Model */}
                  <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col gap-2">
                    <span className="text-xs font-bold text-stone-300">AI Upscaling Model</span>
                    <select
                      value={activeModel}
                      onChange={(e) => setActiveModel(e.target.value as any)}
                      className="bg-stone-800 text-white text-xs font-semibold rounded-xl p-2 border border-stone-700 cursor-pointer"
                    >
                      <option value="quantum-scale">Quantum Scale (Smooth)</option>
                      <option value="deep-cinema">Deep Cinema (Sharp)</option>
                      <option value="chroma-hdr">Chroma HDR (Pop)</option>
                    </select>
                  </div>

                  {/* Resolution Target */}
                  <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col gap-2">
                    <span className="text-xs font-bold text-stone-300">Upscale Target</span>
                    <select
                      value={upscaleTarget}
                      onChange={(e) => setUpscaleTarget(e.target.value as any)}
                      className="bg-stone-800 text-white text-xs font-semibold rounded-xl p-2 border border-stone-700 cursor-pointer"
                    >
                      <option value="native">Native Resolution</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="4K">4K Ultra HD</option>
                      <option value="8K">8K Master</option>
                    </select>
                  </div>

                  {/* Color Profile */}
                  <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col gap-2">
                    <span className="text-xs font-bold text-stone-300">Color Enhancement</span>
                    <select
                      value={colorEnhancement}
                      onChange={(e) => setColorEnhancement(e.target.value as any)}
                      className="bg-stone-800 text-white text-xs font-semibold rounded-xl p-2 border border-stone-700 cursor-pointer"
                    >
                      <option value="off">Off (Standard)</option>
                      <option value="vibrant">Vibrant Colors</option>
                      <option value="cinematic">Cinematic Tone</option>
                      <option value="hdr_pop">HDR Color Pop</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSmoothMotion(!smoothMotion)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      smoothMotion
                        ? "bg-amber-500/15 border-amber-500/50 text-white"
                        : "bg-stone-900 border-stone-800 text-stone-400"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">60FPS Motion Smoothing</div>
                      <div className="text-[10px] opacity-70">AI Interpolation</div>
                    </div>
                    <CheckCircle2 className={`w-4 h-4 ${smoothMotion ? "text-amber-400" : "text-stone-600"}`} />
                  </button>

                  <button
                    onClick={() => setTurboMode(!turboMode)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      turboMode
                        ? "bg-amber-500/15 border-amber-500/50 text-white"
                        : "bg-stone-900 border-stone-800 text-stone-400"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">Turbo GPU Acceleration</div>
                      <div className="text-[10px] opacity-70">Zero Latency Playback</div>
                    </div>
                    <Flame className={`w-4 h-4 ${turboMode ? "text-amber-400" : "text-stone-600"}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between shrink-0">
            <div className="text-[10px] text-stone-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real-time Audio & Video DSP Processing active in browser</span>
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              Done & Apply
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
