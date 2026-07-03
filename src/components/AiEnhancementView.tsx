import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Settings, 
  Cpu, 
  CheckCircle2, 
  Activity, 
  ArrowLeft,
  Lock,
  Flame,
  Speaker,
  Sliders,
  Car,
  Home,
  Headphones,
  Tv,
  Check,
  Shield,
  Zap,
  Compass,
  Volume2,
  Wand2,
  Clock,
  Waves,
  SlidersHorizontal,
  Info,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AiEnhancementViewProps {
  vehicleInfo: {
    vehicleType: string;
    subwooferConfig: string;
    soundPreference: string;
  };
  setVehicleInfo: React.Dispatch<React.SetStateAction<{
    vehicleType: string;
    subwooferConfig: string;
    soundPreference: string;
  }>>;
  dspSettings: {
    eqBands: number[];
    bassBoost: number;
    reverbWet: number;
    delayOffsetMs: number;
    highPassFilterHz: number;
    subCrossoverHz: number;
    justification: string;
  };
  handleAiOptimize: (easyModeSetting?: boolean, customCarModel?: string) => Promise<void>;
  isOptimizing: boolean;
  subscriptionTier: "free" | "paid";
  onBackToPlayer: () => void;
}

export const AiEnhancementView: React.FC<AiEnhancementViewProps> = ({
  vehicleInfo,
  setVehicleInfo,
  dspSettings,
  handleAiOptimize,
  isOptimizing,
  subscriptionTier,
  onBackToPlayer
}) => {
  const [activeTab, setActiveTab] = useState<"easy" | "custom">("easy");
  
  // Headphone style
  const [headphoneStyle, setHeadphoneStyle] = useState<"overear" | "earbud">("overear");

  // Custom setup text
  const [customSetupText, setCustomSetupText] = useState("");

  // Step 3 Auxiliary Booster Switches
  const [activeHarmonic, setActiveHarmonic] = useState(true);
  const [activeDLC, setActiveDLC] = useState(false);
  const [activeExpander, setActiveExpander] = useState(true);
  const [activeVocalFocus, setActiveVocalFocus] = useState(false);
  const [activeRoomShield, setActiveRoomShield] = useState(false);
  const [activeSubHarmonic, setActiveSubHarmonic] = useState(false);
  const [active3DStage, setActive3DStage] = useState(false);
  const [activeAirRestorer, setActiveAirRestorer] = useState(false);

  // Set initial dynamic setup text if empty
  useEffect(() => {
    if (!customSetupText) {
      if (vehicleInfo.vehicleType === "Headphones") {
        setCustomSetupText("Sony WH-1000XM4 Headphones");
      } else if (vehicleInfo.vehicleType === "Home") {
        setCustomSetupText("Bookshelf Stereo System");
      } else if (vehicleInfo.vehicleType === "Car") {
        setCustomSetupText("2018 Honda Civic Cabin");
      } else if (vehicleInfo.vehicleType === "Surround Sound") {
        setCustomSetupText("5.1 Home Theater Setup");
      } else {
        setCustomSetupText("Custom Studio Setup");
      }
    }
  }, [vehicleInfo.vehicleType]);

  // Audio environments (Simplified descriptions)
  const environments = [
    { 
      value: "Headphones", 
      label: "Headphones", 
      icon: Headphones,
      desc: "Balances the sound to make listening on headphones comfortable, clear, and perfectly spaced." 
    },
    { 
      value: "Car", 
      label: "Car Audio", 
      icon: Car,
      desc: "Reduces road noise and tunes the sound to fit your car cabin's seating." 
    },
    { 
      value: "Home", 
      label: "Home Stereo", 
      icon: Home,
      desc: "Smooths out echoes and adjusts the sound for balanced home speakers." 
    },
    { 
      value: "Surround Sound", 
      label: "Surround Sound", 
      icon: Tv,
      desc: "Creates a wide, theater-style sound that feels like it's all around you." 
    }
  ];

  // Equipment configurations per environment mode (Simplified labels & descriptions)
  const getEquipmentOptions = (env: string) => {
    switch (env) {
      case "Headphones":
        return [
          { value: "Wireless Earbuds", label: "Standard Wireless Earbuds", desc: "Smooths out harsh sounds and boosts deep bass for small earbud speakers." },
          { value: "ANC Over-Ear", label: "Noise-Cancelling Headphones", desc: "Balances out pressure and makes music sound natural even with noise cancellation on." },
          { value: "Open-Back Audiophile", label: "Premium Open-Back Headphones", desc: "Tuned for a very wide, realistic, and detailed sound." },
          { value: "Studio Monitor Headphones", label: "Studio Monitor Headphones", desc: "Keeps the sound flat and honest, just like the artist recorded it." }
        ];
      case "Home":
        return [
          { value: "Compact Bookshelf", label: "Compact Bookshelf Speakers", desc: "Boosts low-end warmth while keeping small bookshelf speakers safe." },
          { value: "Audiophile Towers", label: "Premium Floor Towers", desc: "Unlocks rich, full-range sound using large floor speakers." },
          { value: "Active Studio Monitors", label: "Studio Monitor Speakers", desc: "Provides extremely accurate and clean near-field sound." },
          { value: "Vintage Tube System", label: "Classic Tube Amp System", desc: "Adds a soft, warm, vintage-style analog feel to the sound." }
        ];
      case "Car":
        return [
          { value: "Standard OEM", label: "Factory Car Speakers", desc: "Focuses on dialogue and voices so you can hear clearly in the car." },
          { value: "Upgraded Coaxials", label: "Upgraded Premium Car Speakers", desc: "Crisp, snappy sound while controlling harsh treble." },
          { value: "Subwoofer Enhanced", label: "Car System with Subwoofer", desc: "Sends deep bass to the subwoofer so main speakers can play cleanly." },
          { value: "Competition Wall", label: "Heavy Bass Competition Wall", desc: "Handles maximum bass pressure without muddying other instruments." }
        ];
      case "Surround Sound":
        return [
          { value: "Dolby Soundbar", label: "Spatial Dolby Soundbar", desc: "Uses special angles to make a single soundbar feel like a wide room setup." },
          { value: "Discrete 5.1 System", label: "Home Theater 5.1 System", desc: "Tunes the front, rear, and center speakers for a movie theater feel." },
          { value: "Discrete 7.1 System", label: "Premium 7.1 Cinema Speakers", desc: "Creates a full 360-degree theater audio experience." },
          { value: "3D Binaural Headset", label: "3D Surround Headphones", desc: "Uses realistic 3D formulas to simulate a theater in your ears." }
        ];
      default:
        return [
          { value: "Standard", label: "Standard Stereo Speakers", desc: "A robust, multi-purpose listening curve suited for standard stereo configurations." }
        ];
    }
  };

  // Sound styles (Simplified names & descriptions)
  const soundVibes = [
    { 
      value: "Balanced", 
      label: "Balanced & Natural", 
      desc: "Perfect for classical, acoustic, or hearing music exactly as recorded." 
    },
    { 
      value: "SQL (Sound Quality Loud)", 
      label: "Warm & Lively", 
      desc: "Boosts voices and adds a fun, punchy energy to daily listening." 
    },
    { 
      value: "SPL (Maximum Bass Head)", 
      label: "Deep Bass Power", 
      desc: "Brings out deep, rumbling low-end bass while keeping speakers safe." 
    },
    { 
      value: "Vocal-centric", 
      label: "Clear Voices", 
      desc: "Boosts vocals and guitars, making lyrics and podcasts super easy to hear." 
    }
  ];

  const handleSelectEnvironment = (envValue: string) => {
    const defaultEquipment = getEquipmentOptions(envValue)[0].value;
    setVehicleInfo({
      vehicleType: envValue,
      subwooferConfig: defaultEquipment,
      soundPreference: "SQL (Sound Quality Loud)"
    });
    
    // Automatically preset placeholder setup text
    if (envValue === "Headphones") {
      setCustomSetupText("Sony WH-1000XM4 Headphones");
    } else if (envValue === "Home") {
      setCustomSetupText("Bookshelf Stereo System");
    } else if (envValue === "Car") {
      setCustomSetupText("2018 Honda Civic Cabin");
    } else if (envValue === "Surround Sound") {
      setCustomSetupText("5.1 Home Theater Setup");
    }
  };

  const handleEasyEnhanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSetupText.trim()) return;

    let fullSetupDescription = customSetupText;
    if (vehicleInfo.vehicleType === "Headphones") {
      const styleLabel = headphoneStyle === "earbud" ? "In-Ear Buds" : "Over-Ear Headphones";
      fullSetupDescription = `${customSetupText} (${styleLabel})`;
    }

    await handleAiOptimize(true, fullSetupDescription);
  };

  const handleCustomEnhanceSubmit = async () => {
    let finalEquipmentLabel = vehicleInfo.subwooferConfig;
    if (vehicleInfo.vehicleType === "Headphones") {
      const styleLabel = headphoneStyle === "earbud" ? "In-Ear Buds" : "Over-Ear Cups";
      finalEquipmentLabel = `${vehicleInfo.subwooferConfig} (${styleLabel})`;
    }

    setVehicleInfo(prev => ({ ...prev, subwooferConfig: finalEquipmentLabel }));
    await handleAiOptimize(false);
  };

  const currentEquipmentOptions = getEquipmentOptions(vehicleInfo.vehicleType);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 text-left select-none text-slate-200"
      id="ai-audio-optimizer-panel"
    >
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
        <div>
          <h1 className="text-xl md:text-2xl font-sans font-medium tracking-wide text-white flex items-center gap-2.5">
            <Cpu className="w-5.5 h-5.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] stroke-[1.75]" />
            Smart Sound Optimizer
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-light max-w-2xl leading-relaxed font-sans">
            Make your music sound amazing on any device! Powered by <strong>Google Gemini AI</strong>, we analyze your speakers or headphones to find the perfect sound settings for you.
          </p>
        </div>

        {/* Back button */}
        <button
          onClick={onBackToPlayer}
          className="self-start md:self-center px-4.5 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-slate-300 hover:text-white hover:border-white/20 transition-all duration-200 cursor-pointer shadow-sm text-xs font-sans font-medium uppercase tracking-wider flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Player
        </button>
      </div>

      {/* STEP 1: Main Listening Formats Grid */}
      <div className="flex flex-col gap-3">
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-2 font-sans">
          <Compass className="w-4 h-4 text-slate-400" />
          1. Where are you listening?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {environments.map((env) => {
            const IconComponent = env.icon;
            const isSelected = vehicleInfo.vehicleType === env.value;
            const isLocked = subscriptionTier !== "paid";
            return (
              <button
                key={env.value}
                onClick={() => {
                  if (isLocked) return;
                  handleSelectEnvironment(env.value);
                }}
                className={`p-4.5 rounded-2xl border text-left flex flex-col gap-2 transition-all duration-200 relative overflow-hidden group ${
                  isLocked 
                    ? "bg-white/[0.01]/30 border-white/[0.03] text-slate-500 cursor-not-allowed"
                    : isSelected
                      ? "bg-white/[0.04] border-white/30 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/10 cursor-pointer"
                      : "bg-white/[0.01] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.02] hover:border-white/15 cursor-pointer"
                }`}
              >
                {isLocked && (
                  <span className="absolute top-2 right-2 p-1 rounded-md bg-stone-900/80 border border-white/10 text-slate-400 z-10">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
                {isSelected && !isLocked && (
                  <span className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full pointer-events-none" />
                )}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl transition-colors ${
                    isSelected && !isLocked ? "bg-white/10 text-white" : "bg-white/[0.02] text-slate-400 group-hover:text-white"
                  }`}>
                    <IconComponent className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-semibold text-xs uppercase tracking-wider font-sans">{env.label}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-450 font-light mt-1 transition-colors group-hover:text-slate-300 font-sans">
                  {env.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Headphone Type Configuration */}
      {vehicleInfo.vehicleType === "Headphones" && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="font-sans">
            <span className="text-xs font-semibold text-white block">Headphone Type</span>
            <span className="text-[11px] text-slate-455 font-light leading-relaxed block mt-0.5">
              Helps us tune the sound specifically for in-ear buds or over-ear headphones.
            </span>
          </div>
          <div className="flex p-0.5 bg-slate-950/60 rounded-xl border border-white/5 w-full sm:w-auto relative">
            <button
              onClick={() => {
                if (subscriptionTier !== "paid") return;
                setHeadphoneStyle("earbud");
              }}
              className={`flex-1 sm:flex-none py-1.5 px-3.5 rounded-lg font-sans text-[11px] font-medium tracking-wide transition-all ${
                subscriptionTier !== "paid" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                headphoneStyle === "earbud"
                  ? "bg-white/10 text-white font-semibold"
                  : "text-slate-455"
              }`}
            >
              In-Ear Buds
            </button>
            <button
              onClick={() => {
                if (subscriptionTier !== "paid") return;
                setHeadphoneStyle("overear");
              }}
              className={`flex-1 sm:flex-none py-1.5 px-3.5 rounded-lg font-sans text-[11px] font-medium tracking-wide transition-all ${
                subscriptionTier !== "paid" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                headphoneStyle === "overear"
                  ? "bg-white/10 text-white font-semibold"
                  : "text-slate-455"
              }`}
            >
              Over-Ear Headphones
            </button>
          </div>
        </motion.div>
      )}

      {/* Auto vs Manual selection */}
      <div className="flex p-0.5 bg-slate-950/40 rounded-xl border border-white/5 max-w-xs w-full self-start">
        <button
          onClick={() => {
            if (subscriptionTier !== "paid") return;
            setActiveTab("easy");
          }}
          className={`flex-1 py-2 rounded-lg font-sans text-[11px] font-medium tracking-wide transition-all flex items-center justify-center gap-1.5 ${
            subscriptionTier !== "paid" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          } ${
            activeTab === "easy"
              ? "bg-white/10 text-white font-semibold"
              : "text-slate-455 hover:text-slate-200"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          AI Auto Setup
        </button>
        <button
          onClick={() => {
            if (subscriptionTier !== "paid") return;
            setActiveTab("custom");
          }}
          className={`flex-1 py-2 rounded-lg font-sans text-[11px] font-medium tracking-wide transition-all flex items-center justify-center gap-1.5 ${
            subscriptionTier !== "paid" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          } ${
            activeTab === "custom"
              ? "bg-white/10 text-white font-semibold"
              : "text-slate-455 hover:text-slate-200"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Custom Choices
        </button>
      </div>

      {/* Main Form and Readout Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Input Form */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/[0.05] shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col gap-5 backdrop-blur-xl">
            
            <AnimatePresence mode="wait">
              {activeTab === "easy" ? (
                <motion.div
                  key="easy-plate"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5"
                >
                  <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                    <Sparkles className="w-4.5 h-4.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] stroke-[1.5]" />
                    <div>
                      <h2 className="text-sm font-semibold text-white tracking-wide font-sans">
                        AI Sound Setup
                      </h2>
                      <p className="text-[11px] text-slate-455 font-light mt-0.5 leading-relaxed font-sans">
                        Tell us what brand and model of headphones or speakers you are using, and our AI will find the best sound profile for them.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleEasyEnhanceSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-sans text-slate-300 font-medium flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        {vehicleInfo.vehicleType === "Headphones" && "Brand & Model of your Headphones"}
                        {vehicleInfo.vehicleType === "Car" && "Year, Make, & Model of your Car"}
                        {vehicleInfo.vehicleType === "Home" && "Type of Home Speakers"}
                        {vehicleInfo.vehicleType === "Surround Sound" && "Home Theater System Model"}
                      </label>
                      <input
                        type="text"
                        disabled={subscriptionTier !== "paid"}
                        value={customSetupText}
                        onChange={(e) => setCustomSetupText(e.target.value)}
                        placeholder={
                          vehicleInfo.vehicleType === "Headphones" ? "e.g., Sony WH-1000XM4, Apple AirPods" :
                          vehicleInfo.vehicleType === "Car" ? "e.g., 2020 Toyota Camry, Honda Civic" :
                          vehicleInfo.vehicleType === "Home" ? "e.g., Living room speakers, computer speakers" :
                          "e.g., Samsung Soundbar, Bose Surround System"
                        }
                        className="w-full px-4 py-3 text-xs font-mono bg-slate-900/40 hover:bg-slate-900/60 border border-white/10 text-white rounded-xl focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-650 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-[11px] leading-relaxed text-slate-400 font-light font-sans flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-white block mb-0.5">Smart Speaker Protection</span>
                        Our system automatically protects your speakers from playing too loud or distorting, keeping them safe and clean.
                      </div>
                    </div>

                    {subscriptionTier !== "paid" ? (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-slate-400 leading-normal font-light font-sans">
                          AI Sound Tuning is a Premium feature. Upgrade your account to get the best custom sound profiles.
                        </div>
                        <button
                          type="button"
                          disabled
                          className="w-full py-3.5 rounded-xl border border-white/5 bg-slate-900/40 text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 font-sans cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Upgrade to Premium to Unlock
                        </button>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isOptimizing || !customSetupText.trim()}
                        className="w-full py-3.5 rounded-xl text-xs uppercase tracking-widest font-semibold text-stone-950 bg-white hover:bg-slate-200 transition-all cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2 font-sans"
                      >
                        {isOptimizing ? (
                          <>
                            <Activity className="w-4 h-4 animate-spin text-stone-950" />
                            Tuning Your Sound...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-stone-950" />
                            Let's Optimize with AI!
                          </>
                        )}
                      </button>
                    )}
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="custom-plate"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5"
                >
                  <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                    <Settings className="w-4.5 h-4.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] stroke-[1.5]" />
                    <div>
                      <h2 className="text-sm font-semibold text-white tracking-wide font-sans">
                        Custom Settings
                      </h2>
                      <p className="text-[11px] text-slate-455 font-light mt-0.5 leading-relaxed font-sans">
                        Pick your speaker setup and sound style to customize your listening experience.
                      </p>
                    </div>
                  </div>

                  {/* Transducer selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-sans text-slate-300 font-medium flex items-center gap-1.5">
                      <Speaker className="w-3.5 h-3.5 text-slate-400" />
                      What kind of speaker system is this?
                    </label>
                    <div className="relative">
                      <select
                        disabled={subscriptionTier !== "paid"}
                        value={vehicleInfo.subwooferConfig}
                        onChange={(e) => setVehicleInfo(prev => ({ ...prev, subwooferConfig: e.target.value }))}
                        className="w-full px-3.5 py-3 text-sm polished-metal-dropdown rounded-xl focus:outline-none cursor-pointer appearance-none font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {currentEquipmentOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-900 z-10">
                        <Sliders className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-450 font-light px-1 leading-relaxed font-sans">
                      {currentEquipmentOptions.find(o => o.value === vehicleInfo.subwooferConfig)?.desc}
                    </p>
                  </div>

                  {/* Sound profile selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-sans text-slate-300 font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-slate-400" />
                      Select Your Sound Style
                    </label>
                    <div className="relative">
                      <select
                        disabled={subscriptionTier !== "paid"}
                        value={vehicleInfo.soundPreference}
                        onChange={(e) => setVehicleInfo(prev => ({ ...prev, soundPreference: e.target.value }))}
                        className="w-full px-3.5 py-3 text-sm polished-metal-dropdown rounded-xl focus:outline-none cursor-pointer appearance-none font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {soundVibes.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-900 z-10">
                        <Sliders className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-450 font-light px-1 leading-relaxed font-sans">
                      {soundVibes.find(v => v.value === vehicleInfo.soundPreference)?.desc}
                    </p>
                  </div>

                  {subscriptionTier !== "paid" ? (
                    <div className="flex flex-col gap-3 mt-1">
                      <button
                        disabled
                        className="w-full py-3.5 rounded-xl border border-white/5 bg-slate-900/40 text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 font-sans cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        AI Calibration Locked
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleCustomEnhanceSubmit}
                      disabled={isOptimizing}
                      className="w-full py-3.5 rounded-xl text-xs uppercase tracking-widest font-semibold text-stone-950 bg-white hover:bg-slate-200 transition-all cursor-pointer shadow-md disabled:opacity-40 flex items-center justify-center gap-2 font-sans"
                    >
                      {isOptimizing ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin text-stone-950" />
                          Saving Settings...
                        </>
                      ) : (
                        <>
                          <Sliders className="w-3.5 h-3.5 text-stone-950" />
                          Apply Settings
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

        {/* RIGHT COLUMN: DSP Settings Display */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/[0.05] shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col gap-5 backdrop-blur-xl">
            
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-slate-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <h4 className="text-xs font-medium text-white uppercase tracking-wider font-sans">Live Audio Engine Status</h4>
              </div>
              <span className="text-[9px] font-mono text-slate-500 tracking-widest">ACTIVE</span>
            </div>

            {/* AI Listening Insights Narrative */}
            <div className="p-4 rounded-2xl bg-[#030712]/80 border border-white/5 flex flex-col gap-1.5 font-sans">
              <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                AI Listening Insights
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed font-light font-sans">
                {dspSettings.justification || 
                 "Tell us about your listening setup on the left! Once you run the AI optimizer, we'll customize the sound settings here."}
              </p>
            </div>

            {/* EQ Curve Balance Visualizer */}
            <div className="p-4 rounded-2xl bg-[#030712]/30 border border-white/5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-3 font-sans">Sound Equalizer Bars</span>
              <div className="flex items-end justify-between h-20 px-1 bg-slate-950/60 rounded-xl border border-white/[0.03] pt-4 pb-1">
                {dspSettings.eqBands.map((val, i) => {
                  const hz = ["60Hz", "250Hz", "1kHz", "4kHz", "16kHz"][i];
                  const dspTag = ["Deep Bass", "Bass", "Voices", "Clarity", "Sparkle"][i];
                  const heightPct = Math.min(100, Math.max(10, ((val + 12) / 24) * 100));
                  return (
                    <div key={hz} className="flex flex-col items-center flex-1 gap-0.5">
                      <div className="w-2.5 bg-gradient-to-t from-slate-800 to-white rounded-t-sm relative transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ height: `${heightPct}%` }}>
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white font-medium">
                          {val > 0 ? `+${val}` : val}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-slate-350 mt-1">{hz}</span>
                      <span className="text-[6.5px] uppercase font-sans text-slate-500 font-light tracking-tight">{dspTag}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Core DSP values with friendly explanations */}
            <div className="flex flex-col gap-2.5 pt-1 border-t border-white/5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold font-sans">Sound Tuning Details</span>
              
              <div className="grid grid-cols-2 gap-2 text-left">
                {/* Bass Boost */}
                <div className="p-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] flex flex-col gap-0.5 transition-all">
                  <span className="text-[8.5px] font-semibold text-white tracking-wide uppercase flex items-center gap-1 font-sans">
                    <Volume2 className="w-3 h-3 text-slate-300" />
                    Bass Boost Level
                  </span>
                  <span className="text-sm font-mono font-medium text-white tracking-tight mt-0.5">
                    +{Math.round(dspSettings.bassBoost)}%
                  </span>
                  <span className="text-[9.5px] text-slate-450 font-light leading-normal font-sans mt-0.5">
                    Boosts warm, deep bass notes while keeping your speaker clear and safe from distortion.
                  </span>
                </div>

                {/* Space Depth */}
                <div className="p-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] flex flex-col gap-0.5 transition-all">
                  <span className="text-[8.5px] font-semibold text-white tracking-wide uppercase flex items-center gap-1 font-sans">
                    <Waves className="w-3 h-3 text-slate-300" />
                    Room Space Depth
                  </span>
                  <span className="text-sm font-mono font-medium text-white tracking-tight mt-0.5">
                    {Math.round(dspSettings.reverbWet * 100)}%
                  </span>
                  <span className="text-[9.5px] text-slate-455 font-light leading-normal font-sans mt-0.5">
                    Makes the music feel like it is playing in a wider room rather than tight headphones.
                  </span>
                </div>

                {/* Voice Center Balance */}
                <div className="p-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] flex flex-col gap-0.5 transition-all">
                  <span className="text-[8.5px] font-semibold text-white tracking-wide uppercase flex items-center gap-1 font-sans">
                    <Clock className="w-3 h-3 text-slate-300" />
                    Voice Center Balance
                  </span>
                  <span className="text-sm font-mono font-medium text-white tracking-tight mt-0.5">
                    {dspSettings.delayOffsetMs === 0 ? "Balanced Center" : `${dspSettings.delayOffsetMs} ms`}
                  </span>
                  <span className="text-[9.5px] text-slate-455 font-light leading-normal font-sans mt-0.5">
                    Delays speaker timing by split-milliseconds so voices sound perfectly centered to you.
                  </span>
                </div>

                {/* Low Filter Cutoff */}
                <div className="p-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] flex flex-col gap-0.5 transition-all">
                  <span className="text-[8.5px] font-semibold text-white tracking-wide uppercase flex items-center gap-1 font-sans">
                    <SlidersHorizontal className="w-3 h-3 text-slate-300" />
                    Low Filter Cutoff
                  </span>
                  <span className="text-sm font-mono font-medium text-white tracking-tight mt-0.5">
                    {dspSettings.subCrossoverHz} Hz
                  </span>
                  <span className="text-[9.5px] text-slate-455 font-light leading-normal font-sans mt-0.5">
                    Removes super low muddy rumbles so your mid-range notes can play cleanly.
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* STEP 3: Advanced Sound Boosters */}
      <div className="p-6 rounded-3xl bg-white/[0.015] border border-white/[0.05] shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
          <Speaker className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] stroke-[1.5]" />
          <h2 className="text-sm font-semibold text-white tracking-wide font-sans uppercase">
            Advanced Sound Boosters
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Rich Low-Bass Booster */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeHarmonic && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Rich Low-Bass Booster</span>
                {activeHarmonic && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Makes bass feel deeper and fuller even on smaller speakers without causing distortion.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeHarmonic && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeHarmonic && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveHarmonic(!activeHarmonic);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeHarmonic && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeHarmonic && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Background Noise Shield */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeDLC && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans relative">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Background Noise Shield</span>
                {activeDLC && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                {vehicleInfo.vehicleType === "Car" 
                  ? "Quietly adjusts the sound to block out road noise, tires, and highway hums." 
                  : "Quietly adjusts the sound to help block out fans, AC hums, and household noise."}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeDLC && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeDLC && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveDLC(!activeDLC);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeDLC && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeDLC && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Wide Stereo Space */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeExpander && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Wide Stereo Space</span>
                {activeExpander && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                {vehicleInfo.vehicleType === "Headphones" 
                  ? "Projects the sound wider so it feels like you're sitting in front of real room speakers." 
                  : "Expands the sound stage wider to simulate a larger listening space."}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeExpander && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeExpander && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveExpander(!activeExpander);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeExpander && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeExpander && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Vocal Focus */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeVocalFocus && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Vocal Focus</span>
                {activeVocalFocus && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Highlights the singer's voice and brings it front and center for ultimate clarity.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeVocalFocus && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeVocalFocus && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveVocalFocus(!activeVocalFocus);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeVocalFocus && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeVocalFocus && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Echo Reducer */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeRoomShield && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Echo Reducer</span>
                {activeRoomShield && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Cleans up muddy room echoes to make your music sound crisp and natural.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeRoomShield && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeRoomShield && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveRoomShield(!activeRoomShield);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeRoomShield && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeRoomShield && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Super Deep Bass */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeSubHarmonic && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Super Deep Bass</span>
                {activeSubHarmonic && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Creates super deep low-end rumbles, restoring the rich depth often lost in compressed tracks.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeSubHarmonic && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeSubHarmonic && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveSubHarmonic(!activeSubHarmonic);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeSubHarmonic && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeSubHarmonic && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* 3D Theater Sound */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            active3DStage && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>3D Theater Sound</span>
                {active3DStage && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Expands the music all around you to feel like a movie theater or concert hall.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${active3DStage && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {active3DStage && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActive3DStage(!active3DStage);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  active3DStage && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  active3DStage && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* Silky Detail Sparkle */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-300 ${
            activeAirRestorer && subscriptionTier === "paid"
              ? "bg-white/[0.04] border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.08)] ring-1 ring-white/10" 
              : "bg-[#030712]/50 hover:bg-[#030712]/80 border-white/5"
          }`}>
            <div className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-white tracking-wide flex items-center justify-between gap-1.5">
                <span>Silky Detail Sparkle</span>
                {activeAirRestorer && subscriptionTier === "paid" && <Check className="w-3.5 h-3.5 text-emerald-450" />}
              </span>
              <p className="text-[10.5px] text-slate-455 leading-relaxed font-light font-sans mt-1">
                Adds a clean, bright touch to high sounds like cymbals for wonderful detail.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${activeAirRestorer && subscriptionTier === "paid" ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                {activeAirRestorer && subscriptionTier === "paid" ? "● ACTIVE" : "BYPASS"}
              </span>
              <button
                onClick={() => {
                  if (subscriptionTier !== "paid") return;
                  setActiveAirRestorer(!activeAirRestorer);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer flex-shrink-0 ${
                  activeAirRestorer && subscriptionTier === "paid" ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-slate-900 transition-transform duration-200 ${
                  activeAirRestorer && subscriptionTier === "paid" ? "translate-x-5" : "translate-x-0"
                }`} />
                {subscriptionTier !== "paid" && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1.5 right-2.5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default AiEnhancementView;
