import React from "react";
import { Sliders, RotateCcw, Lock } from "lucide-react";
import { Preset } from "../types";

interface EqSlidersProps {
  gains: number[]; // 5 values: 60Hz, 250Hz, 1kHz, 4kHz, 16kHz
  onChange: (index: number, val: number) => void;
  onReset: () => void;
  presets: Preset[];
  selectedPresetName: string;
  onPresetSelect: (preset: Preset) => void;
  isPremiumActive?: boolean;
}

export const EqSliders: React.FC<EqSlidersProps> = ({
  gains,
  onChange,
  onReset,
  presets,
  selectedPresetName,
  onPresetSelect,
  isPremiumActive = false
}) => {
  const bands = [
    { label: "60 Hz", subtext: "Deep Bass", color: "from-[#991b1b] to-[#1c0303]" }, 
    { label: "250 Hz", subtext: "Bass", color: "from-[#b45309] to-[#1c0303]" }, 
    { label: "1 kHz", subtext: "Voices", color: "from-white to-[#1c0303]" }, 
    { label: "4 kHz", subtext: "Clarity", color: "from-[#cbd5e1] to-[#1c0303]" }, 
    { label: "16 kHz", subtext: "Sparkle", color: "from-[#e2e8f0] to-[#1c0303]" } 
  ];

  return (
    <div className="bg-[#0f0a09]/80 p-4 rounded-xl flex flex-col h-full relative border border-white/15 shadow-2xl">
      {/* EQ Header */}
      <div className="flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
          <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] chrome-text">
            Presets
          </h3>
        </div>
        <button
          id="reset-eq-btn"
          onClick={onReset}
          className="text-[10px] font-sans font-semibold text-slate-200 hover:text-white transition-colors bg-gradient-to-b from-stone-850 to-stone-950 px-2.5 py-1.5 rounded border border-slate-750 flex items-center gap-1 active:bg-black shadow cursor-pointer"
          title="Reset EQ to flat 0dB"
        >
          <RotateCcw className="w-3 h-3 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
          FLAT
        </button>
      </div>

      {/* Preset Select Buttons */}
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
                {isLocked && <Lock className="w-2.5 h-2.5 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.7)] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Equalizer faders */}
      <div className="flex-1 grid grid-cols-5 gap-4 items-stretch relative min-h-[260px] md:min-h-[360px] z-10">
        
        {/* Horizontal dB alignment indicator lines in background */}
        <div className="absolute inset-x-0 top-[8%] bottom-[8%] flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-t border-dashed border-stone-750 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">+12dB</div>
          <div className="border-t border-dashed border-stone-750 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">+6dB</div>
          <div className="border-t border-solid border-stone-700 text-[8px] font-sans text-slate-300 pl-1 pt-0.5">0dB (FLAT)</div>
          <div className="border-t border-dashed border-stone-750 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">-6dB</div>
          <div className="border-t border-dashed border-stone-750 text-[8px] font-sans text-slate-400 pl-1 pt-0.5">-12dB</div>
        </div>

        {bands.map((band, idx) => {
          const currentGain = gains[idx] ?? 0;
          // Calculate slider percentage (from -12 to 12)
          const percent = ((currentGain + 12) / 24) * 100;

          return (
            <div key={idx} className="flex flex-col items-center justify-between z-10 relative group">
              {/* dB indicator label directly above fader */}
              <span className={`text-[12px] font-sans font-semibold ${
                currentGain > 6 ? "text-red-500" : currentGain < -6 ? "text-slate-400" : "text-white font-medium drop-shadow-[0_0_4.5px_rgba(255,255,255,0.45)]"
              }`}>
                {currentGain > 0 ? `+${currentGain.toFixed(0)}` : currentGain.toFixed(0)}
              </span>

              {/* Slider Track Body Column */}
              <div className="relative w-9 flex-1 my-4 flex items-center justify-center">
                {/* Visual track background groove */}
                <div className="absolute inset-y-0 w-3 rounded-full bg-stone-950 border border-stone-800 shadow-inner" />
                
                {/* Active range fill indicator */}
                <div 
                  className={`absolute bottom-0 w-2 rounded-full bg-gradient-to-t ${band.color} opacity-60 shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                  style={{ height: `${percent}%` }}
                />

                {/* Range Input element */}
                <input
                  id={`eq-fader-${idx}`}
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={currentGain}
                  onChange={(e) => onChange(idx, parseInt(e.target.value))}
                  className="absolute cursor-ns-resize w-full h-full opacity-0 pointer-events-auto"
                  style={{
                    writingMode: "vertical-lr", // vertical fader support
                    WebkitAppearance: "slider-vertical",
                  }}
                  aria-label={`${band.label} gain fader`}
                />
                
                {/* Custom Neon Knurled Slider Fader Knob */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-8 h-4.5 rounded bg-gradient-to-b from-[#ffffff] via-[#f1f5f9] via-[#94a3b8] via-[#09101d] via-[#cbd5e1] to-[#ffffff] border-2 border-slate-300 shadow-xl pointer-events-none cursor-ns-resize flex flex-col justify-between p-0.5 transition-all"
                  style={{
                    bottom: `calc(${percent}% - 9px)`,
                    boxShadow: "0 3px 6px rgba(0,0,0,0.9), inset 0 1px 1.5px rgba(255,255,255,0.95)"
                  }}
                >
                  {/* Grip teeth center lines */}
                  <div className="w-full h-[1px] bg-white/20" />
                  <div className="w-full h-1 bg-white rounded-sm shadow-[0_0_6px_rgba(255,255,255,0.9),0_0_2px_#fff]" />
                  <div className="w-full h-[1px] bg-black/40" />
                </div>
              </div>

              {/* Fader Labels */}
              <div className="text-center">
                <span className="text-[11px] font-semibold font-sans text-slate-100 block tracking-tight truncate max-w-[50px] md:max-w-none">
                  {band.label}
                </span>
                <span className="text-[9px] font-sans text-slate-500 block leading-none font-light">
                  {band.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
