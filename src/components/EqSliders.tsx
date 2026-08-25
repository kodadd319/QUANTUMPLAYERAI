import React, { useRef, useState, useCallback } from "react";
import { Sliders, RotateCcw, Lock } from "lucide-react";
import { Preset } from "../types";

interface EqSlidersProps {
  gains: number[]; // 5 values: 60Hz, 250Hz, 1kHz, 4kHz, 16kHz
  onChange: (index: number, val: number) => void;
  onReset?: () => void;
  presets?: Preset[];
  selectedPresetName?: string;
  onPresetSelect?: (preset: Preset) => void;
  isPremiumActive?: boolean;
}

interface BandInfo {
  label: string;
  subtext: string;
  color: string;
}

const BANDS: BandInfo[] = [
  { label: "60 Hz", subtext: "Deep Bass", color: "from-[#991b1b] to-[#1c0303]" },
  { label: "250 Hz", subtext: "Bass", color: "from-[#b45309] to-[#1c0303]" },
  { label: "1 kHz", subtext: "Voices", color: "from-white to-[#1c0303]" },
  { label: "4 kHz", subtext: "Clarity", color: "from-[#cbd5e1] to-[#1c0303]" },
  { label: "16 kHz", subtext: "Sparkle", color: "from-[#e2e8f0] to-[#1c0303]" }
];

interface FaderBandProps {
  idx: number;
  band: BandInfo;
  currentGain: number;
  onChange: (idx: number, val: number) => void;
}

const FaderBand: React.FC<FaderBandProps> = ({ idx, band, currentGain, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate position percentage: -12dB -> 0%, 0dB -> 50%, +12dB -> 100%
  const clampedGain = Math.max(-12, Math.min(12, currentGain));
  const percent = ((clampedGain + 12) / 24) * 100;

  const updateGainFromPointerY = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;

    // Constrain clientY within the track
    const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));

    // fractionFromBottom: 0 at rect.bottom (-12dB), 1 at rect.top (+12dB)
    const fractionFromBottom = (rect.bottom - clampedY) / rect.height;

    // Convert to dB (-12 to +12)
    let rawGain = -12 + fractionFromBottom * 24;

    // Magnetic detent around FLAT (0 dB) for easy reset
    if (Math.abs(rawGain) < 0.35) {
      rawGain = 0;
    }

    const nextGain = Math.round(Math.max(-12, Math.min(12, rawGain)));
    onChange(idx, nextGain);
  }, [idx, onChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary button / primary touch
    if (e.button !== 0 && e.pointerType === "mouse") return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateGainFromPointerY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateGainFromPointerY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = clampedGain;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      next = Math.min(12, clampedGain + 1);
      e.preventDefault();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      next = Math.max(-12, clampedGain - 1);
      e.preventDefault();
    } else if (e.key === "PageUp") {
      next = Math.min(12, clampedGain + 3);
      e.preventDefault();
    } else if (e.key === "PageDown") {
      next = Math.max(-12, clampedGain - 3);
      e.preventDefault();
    } else if (e.key === "Home") {
      next = 12;
      e.preventDefault();
    } else if (e.key === "End") {
      next = -12;
      e.preventDefault();
    } else if (e.key === "0" || e.key === "f" || e.key === "F") {
      next = 0;
      e.preventDefault();
    }

    if (next !== clampedGain) {
      onChange(idx, next);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between z-10 relative group select-none">
      {/* dB indicator label directly above fader */}
      <span
        className={`text-[12px] font-sans font-semibold transition-colors duration-150 tabular-nums ${
          clampedGain > 6
            ? "text-red-500 font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            : clampedGain < -6
            ? "text-slate-400"
            : "text-white font-medium drop-shadow-[0_0_4.5px_rgba(255,255,255,0.45)]"
        }`}
      >
        {clampedGain > 0 ? `+${clampedGain}dB` : `${clampedGain}dB`}
      </span>

      {/* Interactive Fader Column Hit Area */}
      <div
        ref={trackRef}
        id={`eq-fader-band-${idx}`}
        role="slider"
        aria-label={`${band.label} Equalizer Fader`}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={clampedGain}
        aria-valuetext={`${clampedGain > 0 ? "+" : ""}${clampedGain} dB`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-12 sm:w-14 flex-1 my-3 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/40 rounded-lg"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        {/* Recessed metal track slot channel */}
        <div className="absolute inset-y-2 w-3 rounded-full bg-[#0a0706] border border-stone-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_2px_rgba(255,255,255,0.08)] pointer-events-none" />

        {/* Center zero dB detent marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-[1.5px] bg-white/25 rounded-full pointer-events-none" />

        {/* Active dynamic range fill bar from bottom */}
        <div
          className={`absolute bottom-2 w-2 rounded-full bg-gradient-to-t ${band.color} opacity-70 shadow-[0_0_8px_rgba(255,255,255,0.3)] pointer-events-none`}
          style={{
            height: `calc(${percent}% * 0.94)`,
            transition: isDragging ? "none" : "height 120ms ease-out"
          }}
        />

        {/* Knurled Brushed-Chrome Switch Knob that follows touch/mouse coordinates directly */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-9 h-5 rounded-md flex flex-col justify-between p-0.5 pointer-events-none z-20 ${
            isDragging
              ? "scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.95),0_0_12px_rgba(255,255,255,0.5)] border-amber-400/80"
              : "border-slate-300 hover:border-white shadow-[0_3px_8px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.95)]"
          }`}
          style={{
            bottom: `calc(${percent}% * 0.88 + 4px)`,
            background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 20%, #94a3b8 45%, #0f172a 50%, #cbd5e1 75%, #ffffff 100%)",
            borderWidth: "1.5px",
            transition: isDragging ? "none" : "bottom 100ms ease-out, transform 100ms ease-out"
          }}
        >
          {/* Top grip ridge */}
          <div className="w-full h-[1px] bg-white/60" />
          {/* Illuminated center LED bar notch */}
          <div className="w-full h-1 bg-white rounded-sm shadow-[0_0_6px_rgba(255,255,255,0.95),0_0_2px_#fff] flex items-center justify-center">
            <div className="w-3 h-[0.5px] bg-amber-400/60" />
          </div>
          {/* Bottom recessed edge */}
          <div className="w-full h-[1px] bg-black/60" />
        </div>
      </div>

      {/* Fader Band Frequency & Name Labels */}
      <div className="text-center mt-1 select-none pointer-events-none">
        <span className="text-[11px] font-bold font-sans text-slate-100 block tracking-tight truncate max-w-[50px] md:max-w-none">
          {band.label}
        </span>
        <span className="text-[9px] font-sans text-slate-400 block leading-none font-medium">
          {band.subtext}
        </span>
      </div>
    </div>
  );
};

export const EqSliders: React.FC<EqSlidersProps> = ({
  gains,
  onChange,
  onReset,
  presets = [],
  selectedPresetName = "",
  onPresetSelect,
  isPremiumActive = false
}) => {
  return (
    <div className="bg-[#0f0a09]/80 p-4 rounded-xl flex flex-col h-full relative border border-white/15 shadow-2xl">
      {/* EQ Header */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
          <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] chrome-text">
            Equalizer & Presets
          </h3>
        </div>
        {onReset && (
          <button
            id="reset-eq-btn"
            type="button"
            onClick={onReset}
            className="text-[10px] font-sans font-semibold text-slate-200 hover:text-white transition-colors bg-gradient-to-b from-stone-850 to-stone-950 px-2.5 py-1.5 rounded border border-slate-750 flex items-center gap-1 active:bg-black shadow cursor-pointer"
            title="Reset EQ to flat 0dB"
          >
            <RotateCcw className="w-3 h-3 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
            FLAT
          </button>
        )}
      </div>

      {/* Preset Select Buttons (if presets provided) */}
      {presets.length > 0 && onPresetSelect && (
        <div className="flex flex-col gap-1.5 mb-4 z-10 border-b border-stone-800/80 pb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
            {presets.map((preset) => {
              const isSelected = selectedPresetName === preset.name;
              const isLocked = preset.isPremium && !isPremiumActive;

              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onPresetSelect(preset)}
                  className={`px-2.5 py-1.5 rounded-lg border-2 text-[10px] font-sans font-semibold tracking-wider transition-all cursor-pointer text-left uppercase truncate flex items-center justify-between gap-1 h-[32px] ${
                    isSelected
                      ? "bg-white/10 text-white border-slate-350 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                      : "bg-black border-stone-850 hover:bg-stone-900 text-stone-400 hover:text-white"
                  }`}
                  title={preset.name}
                >
                  <span className="truncate">{preset.name}</span>
                  {isLocked && (
                    <Lock className="w-2.5 h-2.5 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.7)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of 5-Band Equalizer Faders */}
      <div className="flex-1 grid grid-cols-5 gap-2 sm:gap-4 items-stretch relative min-h-[260px] md:min-h-[360px] z-10">
        {/* Horizontal dB alignment indicator guide lines in background */}
        <div className="absolute inset-x-0 top-[10%] bottom-[12%] flex flex-col justify-between pointer-events-none opacity-25">
          <div className="border-t border-dashed border-stone-700 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">+12dB</div>
          <div className="border-t border-dashed border-stone-700 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">+6dB</div>
          <div className="border-t border-solid border-stone-500 text-[8px] font-sans text-slate-300 pl-1 pt-0.5">0dB (FLAT)</div>
          <div className="border-t border-dashed border-stone-700 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">-6dB</div>
          <div className="border-t border-dashed border-stone-700 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">-12dB</div>
        </div>

        {BANDS.map((band, idx) => (
          <FaderBand
            key={idx}
            idx={idx}
            band={band}
            currentGain={gains[idx] ?? 0}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
};
