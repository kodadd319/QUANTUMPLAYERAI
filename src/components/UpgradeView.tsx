import React from "react";
import { 
  Crown, 
  Check, 
  Sparkles, 
  Sliders, 
  ArrowLeft,
  Volume2,
  Lock,
  Music,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { motion } from "motion/react";
import { auth } from "../firebase";
import { isAdminUserEmail } from "../utils/admin";

interface UpgradeViewProps {
  onBackToPlayer: () => void;
  subscriptionTier: "free" | "paid";
  onChangeSubscriptionTier: (tier: "free" | "paid") => void;
  globalPremiumPrompt?: string;
}

export const UpgradeView: React.FC<UpgradeViewProps> = ({ 
  onBackToPlayer, 
  subscriptionTier, 
  onChangeSubscriptionTier,
  globalPremiumPrompt
}) => {

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  // Build Stripe Links dynamically with client_reference_id containing the UID
  const monthlyLink = uid 
    ? `https://buy.stripe.com/8x200b5cT2Ye7jR6dU73G08?client_reference_id=${uid}` 
    : "https://buy.stripe.com/8x200b5cT2Ye7jR6dU73G08";

  const annualLink = uid 
    ? `https://buy.stripe.com/8x2dR17l1aqGfQn9q673G09?client_reference_id=${uid}` 
    : "https://buy.stripe.com/8x2dR17l1aqGfQn9q673G09";

  const lifetimeLink = uid 
    ? `https://buy.stripe.com/7sY4grbBhfL01Zx6dU73G0a?client_reference_id=${uid}` 
    : "https://buy.stripe.com/7sY4grbBhfL01Zx6dU73G0a";

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!uid) {
      e.preventDefault();
      setErrorMessage("Please sign in or create an account first. An account is required so we can credit your premium membership to your profile.");
      // Scroll to error message for visibility
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleUpgrade = () => {
    // Simulate upgrading the tier to paid so the user gets real-time access
    onChangeSubscriptionTier("paid");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      {/* Return Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToPlayer}
          className="px-4 py-2 rounded-xl border border-white/20 bg-[#0b0504]/95 text-stone-300 hover:text-white hover:border-white font-sans text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all duration-150 cursor-pointer font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Music Player
        </button>

        {/* Subscription Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950/45 border border-stone-850">
          <span className="text-[9px] font-sans text-stone-450 uppercase tracking-wider font-semibold">Status:</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-sans font-semibold uppercase transition-all tracking-wider ${
            subscriptionTier === "paid" 
              ? "bg-white/10 text-white border border-white/20 shadow-[0_0_8px_rgba(255,255,255,0.25)]" 
              : "bg-stone-900 text-stone-300 border border-stone-800"
          }`}>
            {subscriptionTier === "paid" ? "Premium Active" : "Free Tier"}
          </span>
        </div>
      </div>

      {/* Premium Notification Warning Banner */}
      {globalPremiumPrompt && subscriptionTier !== "paid" && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-2xl bg-[#4a1515]/20 border-2 border-red-800/40 text-red-200 flex items-start gap-4 shadow-[0_4px_20px_rgba(153,27,27,0.08)]"
        >
          <div className="w-8 h-8 rounded-lg bg-red-950/35 border border-red-800/40 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-sans text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Premium Action Required
            </h4>
            <p className="font-sans text-[11px] text-stone-300 leading-relaxed font-semibold">
              {globalPremiumPrompt}
            </p>
          </div>
        </motion.div>
      )}

      {/* Auth Requirement Error Warning Banner */}
      {errorMessage && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/30 text-red-200 flex items-start gap-4 shadow-[0_4px_20px_rgba(239,68,68,0.15)]"
        >
          <div className="w-8 h-8 rounded-lg bg-red-950/35 border border-red-500/45 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <h4 className="font-sans text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Sign In Required
            </h4>
            <p className="font-sans text-[11px] text-stone-300 leading-relaxed font-semibold">
              {errorMessage}
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Upgrade Card */}
      <div className="relative rounded-3xl bg-[#0a0504]/90 border-2 border-slate-350 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Decorative ambient backdrop glow */}
        <div className="absolute -top-32 -left-30 w-72 h-72 bg-white/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-30 w-72 h-72 bg-[#4a1515]/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Crown Badge */}
        <div className="absolute top-6 right-6 bg-white text-[9px] font-sans text-black font-semibold uppercase px-3 py-1 rounded-full tracking-widest shadow-[0_0_15px_rgba(255,255,255,0.45)] flex items-center gap-1.5 z-10 select-none">
          <Crown className="w-3 h-3" />
          PREMIUM
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2 border-b border-stone-850 pb-6 max-w-xl">
          <h2 className="font-sans text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Upgrade to Premium
          </h2>
          <p className="text-[11px] font-sans text-stone-400 uppercase tracking-widest leading-relaxed font-light">
            Unlock professional AI sound engineering of your custom tracks.
          </p>
        </div>

        {/* Feature List */}
        <div className="my-8">
          <h3 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] mb-4">
            Exclusive Premium Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 1 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-stone-900/40 transition-colors">
              <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-[11px] font-sans font-semibold uppercase tracking-wide text-white">
                  Ai enhancement settings for audio files
                </h4>
                <p className="text-[10px] font-sans text-stone-400 mt-1 leading-relaxed">
                  Remaster vocal registers, enhance bass levels, and control high frequency ranges for perfect acoustic fidelity.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-stone-900/40 transition-colors">
              <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                <Sliders className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-[11px] font-sans font-semibold uppercase tracking-wide text-white">
                  Ai optimazation settings for Audio Player
                </h4>
                <p className="text-[10px] font-sans text-stone-400 mt-1 leading-relaxed">
                  Real-time spatial calibration, soundstage modeling, and dynamic response optimizations for the player engine.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-stone-900/40 transition-colors">
              <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-[11px] font-sans font-semibold uppercase tracking-wide text-white">
                  Ai enhancement settings for video Files
                </h4>
                <p className="text-[10px] font-sans text-stone-400 mt-1 leading-relaxed">
                  Upscale detail, balance contrast, and optimize visual dynamics of your uploaded video formats in real-time.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-3.5 items-start p-3 rounded-xl hover:bg-stone-900/40 transition-colors">
              <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-[11px] font-sans font-semibold uppercase tracking-wide text-white">
                  Ai optimazation settings for Video Player
                </h4>
                <p className="text-[10px] font-sans text-stone-400 mt-1 leading-relaxed">
                  Align acoustic synchronization, optimize bitrates, and apply high-contrast cinema filters for your display setup.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8 pt-4 border-t border-stone-850">
          
          {/* Monthly Subscription */}
          <div className="p-5 rounded-2xl bg-stone-950/45 border border-stone-850 flex flex-col justify-between relative group hover:border-white transition-all">
            <div>
              <span className="text-[8px] font-sans font-semibold text-slate-200 uppercase tracking-widest block mb-1">
                Flexible Plan
              </span>
              <h4 className="text-xs font-sans font-semibold text-white uppercase tracking-wider mb-1">
                Monthly Subscription
              </h4>
              <div className="flex flex-col gap-1 my-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-sans font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">$9.99</span>
                  <span className="text-[10px] font-sans text-stone-400 uppercase tracking-wider font-semibold">/ month</span>
                </div>
              </div>
              <p className="text-[9px] font-sans text-stone-500 uppercase tracking-wider mb-5 font-light leading-relaxed">
                Full unlimited premium tools. Cancel anytime in your user profile.
              </p>
            </div>
            <a
              href={monthlyLink}
              onClick={handleLinkClick}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-stone-850 to-stone-950 border border-stone-750 hover:border-white text-white hover:bg-white/5 font-sans text-[10px] font-semibold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg flex items-center justify-center gap-1.5 text-center no-underline hover:text-white"
            >
              <span>Subscribe Monthly</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Annual Subscription */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1a110f] to-[#0a0504] border border-stone-850 flex flex-col justify-between relative group hover:border-white transition-all">
            <div className="absolute top-3 right-3 bg-stone-900 text-[6.5px] font-sans text-emerald-400 font-bold uppercase px-2 py-0.5 rounded tracking-wider border border-emerald-500/20 shadow">
              SAVE OVER 37%
            </div>
            <div>
              <span className="text-[8px] font-sans font-semibold text-slate-200 uppercase tracking-widest block mb-1">
                Value Saver Plan
              </span>
              <h4 className="text-xs font-sans font-semibold text-white uppercase tracking-wider mb-1">
                Annual Subscription
              </h4>
              <div className="flex flex-col gap-1 my-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-sans font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">$74.99</span>
                  <span className="text-[10px] font-sans text-stone-350 uppercase tracking-wider font-semibold">/ year</span>
                </div>
                <span className="text-[9.5px] font-sans text-emerald-400 uppercase font-bold tracking-wider">
                  Equivalent to just $6.25 / month!
                </span>
              </div>
              <p className="text-[9px] font-sans text-stone-550 uppercase tracking-wider mb-5 font-light leading-relaxed">
                Complete unrestricted elite package. Best rate guaranteed.
              </p>
            </div>
            <a
              href={annualLink}
              onClick={handleLinkClick}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-stone-850 to-stone-950 border border-stone-750 hover:border-white text-white hover:bg-white/5 font-sans text-[10px] font-semibold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg flex items-center justify-center gap-1.5 text-center no-underline hover:text-white"
            >
              <span>Subscribe Annually</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Lifetime Membership */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1c1204] to-[#0a0504] border-2 border-amber-500/35 flex flex-col justify-between relative group hover:border-amber-400 transition-all shadow-[0_5px_15px_rgba(245,158,11,0.06)]">
            <div className="absolute top-3 right-3 bg-amber-500 text-[6.5px] font-sans text-stone-950 font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
              BEST VALUE
            </div>
            <div>
              <span className="text-[8px] font-sans font-semibold text-amber-400 uppercase tracking-widest block mb-1">
                Ultimate Lifetime
              </span>
              <h4 className="text-xs font-sans font-semibold text-white uppercase tracking-wider mb-1">
                Lifetime Membership
              </h4>
              <div className="flex flex-col gap-1 my-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-sans font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]">$99.99</span>
                  <span className="text-[10px] font-sans text-stone-300 uppercase tracking-wider font-semibold">/ one-time</span>
                </div>
                <span className="text-[9.5px] font-sans text-amber-500 uppercase font-bold tracking-wider">
                  Pay once, own forever!
                </span>
              </div>
              <p className="text-[9px] font-sans text-slate-300 uppercase tracking-wider mb-5 font-semibold">
                No monthly or annual rebills. Lifetime access to all premium features.
              </p>
            </div>
            <a
              href={lifetimeLink}
              onClick={handleLinkClick}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-stone-950 hover:from-amber-400 hover:to-yellow-400 font-sans text-[10px] font-black tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg flex items-center justify-center gap-1.5 text-center no-underline hover:text-stone-950"
            >
              <span>Unlock Lifetime</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

      </div>



      {/* Billing Info Footer Area */}
    </motion.div>
  );
};
