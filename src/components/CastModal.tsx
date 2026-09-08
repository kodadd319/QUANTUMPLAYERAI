import React, { useState, useEffect } from "react";
import { 
  Cast, 
  Tv, 
  Check, 
  Copy, 
  ExternalLink, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  X, 
  PictureInPicture2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { castSyncManager, CastMediaPayload } from "../utils/castSync";

export interface CastDevice {
  id: string;
  name: string;
  type: "chromecast" | "airplay" | "smarttv" | "dlna" | "presentation" | "remote_playback";
  location?: string;
  resolution?: string;
  status: "available" | "connecting" | "connected";
}

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement?: HTMLVideoElement | null;
  videoName?: string;
  videoUrl?: string;
  connectedDevice: CastDevice | null;
  onSelectDevice: (device: CastDevice | null) => void;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  volume?: number;
  isMuted?: boolean;
  onPlayPause?: () => void;
  onSeek?: (seconds: number) => void;
  onVolumeChange?: (vol: number) => void;
  onToggleMute?: () => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  videoElement,
  videoName,
  videoUrl,
  connectedDevice,
  onSelectDevice,
  currentTime = 0,
  duration = 0,
  isPlaying = true,
  volume = 0.85,
  isMuted = false,
  onPlayPause,
  onToggleMute
}) => {
  const [copied, setCopied] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Detect Apple AirPlay availability
  const isApple = typeof navigator !== "undefined" && (
    /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) || 
    Boolean((videoElement as any)?.webkitShowPlaybackTargetPicker)
  );

  // Monitor Native Remote Playback state if supported
  useEffect(() => {
    if (!videoElement || !("remote" in videoElement) || !(videoElement as any).remote) return;
    const remote = (videoElement as any).remote;

    const handleConnecting = () => {
      onSelectDevice({
        id: "native-cast-connecting",
        name: "Wireless Display",
        type: "chromecast",
        status: "connecting"
      });
    };

    const handleConnect = () => {
      onSelectDevice({
        id: "native-cast-active",
        name: isApple ? "Apple TV / AirPlay" : "Chromecast / Smart TV",
        type: isApple ? "airplay" : "chromecast",
        status: "connected"
      });
      setInfoMsg(null);
    };

    const handleDisconnect = () => {
      onSelectDevice(null);
    };

    try {
      remote.addEventListener("connecting", handleConnecting);
      remote.addEventListener("connect", handleConnect);
      remote.addEventListener("disconnect", handleDisconnect);
    } catch (e) {}

    return () => {
      try {
        remote.removeEventListener("connecting", handleConnecting);
        remote.removeEventListener("connect", handleConnect);
        remote.removeEventListener("disconnect", handleDisconnect);
      } catch (e) {}
    };
  }, [videoElement, isApple, onSelectDevice]);

  // Keep receiver updated with current playback state
  const syncPlaybackState = () => {
    const curTime = videoElement ? videoElement.currentTime : currentTime;
    const dur = videoElement ? videoElement.duration : duration;
    const isVidPlaying = videoElement ? !videoElement.paused : isPlaying;

    const payload: CastMediaPayload = {
      name: videoName || "Quantum Video Stream",
      url: videoUrl || "",
      currentTime: curTime || 0,
      duration: dur || 0,
      isPlaying: isVidPlaying,
      volume: isMuted ? 0 : volume,
      isMuted: isMuted,
      updatedAt: Date.now()
    };

    castSyncManager.broadcastMediaState(payload);
  };

  // Get the TV receiver URL to open on a Smart TV or second screen
  const getReceiverUrl = () => {
    const baseUrl = `${window.location.origin}${window.location.pathname}?mode=cast-receiver`;
    if (videoUrl && !videoUrl.startsWith("blob:")) {
      return `${baseUrl}&videoUrl=${encodeURIComponent(videoUrl)}&name=${encodeURIComponent(videoName || "Video")}`;
    }
    return baseUrl;
  };

  // 1. One-tap Cast to TV / Chromecast / AirPlay
  const handleWirelessCast = async () => {
    setInfoMsg(null);

    // Apple AirPlay (Safari / iOS / Mac)
    if (videoElement && (videoElement as any).webkitShowPlaybackTargetPicker) {
      try {
        (videoElement as any).webkitShowPlaybackTargetPicker();
        onSelectDevice({
          id: "airplay-target",
          name: "AirPlay Display",
          type: "airplay",
          status: "connected"
        });
        return;
      } catch (err) {
        console.warn("AirPlay target picker:", err);
      }
    }

    // Google Cast / W3C Remote Playback API (Chrome / Edge / Android)
    if (videoElement && "remote" in videoElement && (videoElement as any).remote) {
      try {
        await (videoElement as any).remote.prompt();
        onSelectDevice({
          id: "remote-cast-target",
          name: "Chromecast / Smart TV",
          type: "chromecast",
          status: "connected"
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // User closed the cast menu without picking
          return;
        }
        console.warn("Remote playback prompt:", err);
      }
    }

    // Google Cast Web SDK
    if (typeof window !== "undefined" && (window as any).cast?.framework) {
      try {
        const context = (window as any).cast.framework.CastContext.getInstance();
        await context.requestSession();
        onSelectDevice({
          id: "google-cast-session",
          name: "Chromecast",
          type: "chromecast",
          status: "connected"
        });
        return;
      } catch (err) {
        console.warn("Cast context requestSession:", err);
      }
    }

    // Fallback: Open TV Screen receiver
    handleOpenTvScreen();
  };

  // 2. Open TV Screen Receiver (for Smart TV browsers or second displays)
  const handleOpenTvScreen = () => {
    syncPlaybackState();
    const url = getReceiverUrl();
    window.open(url, "QuantumCastReceiver", "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no");
    onSelectDevice({
      id: "smart-tv-receiver",
      name: "TV Screen Display",
      type: "smarttv",
      status: "connected"
    });
    setInfoMsg("Playing on TV Screen. Any playback changes sync automatically.");
  };

  // 3. Copy TV Receiver Link (to paste or open on a Smart TV web browser)
  const handleCopyLink = () => {
    const url = getReceiverUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setInfoMsg("Link copied! Open this URL on your Smart TV browser to stream.");
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {});
  };

  // 4. Pop-out Picture-in-Picture
  const handlePopOut = async () => {
    if (!videoElement) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoElement.requestPictureInPicture) {
        await videoElement.requestPictureInPicture();
        onClose();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  // Disconnect active cast
  const handleDisconnect = () => {
    castSyncManager.sendMessage("CAST_STOP");
    onSelectDevice(null);
    setInfoMsg(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-sm bg-stone-950 border border-stone-800 rounded-2xl p-5 shadow-2xl text-stone-100 relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-stone-850">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Cast className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Cast Video</h3>
                <p className="text-[10px] text-stone-400">Play video on your TV or other device</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Casting Status */}
          {connectedDevice ? (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Connected & Casting
                    </div>
                    <div className="text-xs font-semibold text-white">
                      {connectedDevice.name}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-red-950/70 text-stone-300 hover:text-red-400 text-[10px] font-semibold border border-stone-800 hover:border-red-900 transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {/* Simple Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onPlayPause) onPlayPause();
                      syncPlaybackState();
                    }}
                    className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-transform active:scale-95 cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleMute) onToggleMute();
                      syncPlaybackState();
                    }}
                    className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <span className="text-[10px] text-stone-400 font-mono truncate max-w-[150px]">
                  {videoName || "Video Stream"}
                </span>
              </div>
            </div>
          ) : (
            /* Simple, Downsized Casting Options */
            <div className="mt-4 space-y-2.5">
              
              {/* Option 1: TV / Chromecast / AirPlay */}
              <button
                onClick={handleWirelessCast}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent hover:from-amber-500/30 border border-amber-500/40 text-left transition-all cursor-pointer flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500 text-stone-950 font-bold">
                    <Cast className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {isApple ? "AirPlay to Apple TV / Smart TV" : "Cast to TV / Chromecast"}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Streams directly to your TV wirelessly
                    </div>
                  </div>
                </div>
              </button>

              {/* Option 2: Open TV Screen / Web Receiver */}
              <div className="p-3 rounded-xl bg-stone-900/90 border border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-stone-800 text-stone-300">
                      <Tv className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Smart TV Browser / Second Display</div>
                      <div className="text-[10px] text-stone-400">Play in a dedicated display window</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleOpenTvScreen}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-white text-[11px] font-semibold border border-stone-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3 text-amber-400" />
                    <span>Open TV Screen</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-white text-[11px] font-medium border border-stone-750 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Copy TV browser URL"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Link"}</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Pop-out Window (PiP) */}
              <button
                onClick={handlePopOut}
                className="w-full p-2.5 rounded-xl bg-stone-900/60 hover:bg-stone-850 border border-stone-800/80 text-left transition-colors cursor-pointer flex items-center justify-between text-stone-300 hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  <PictureInPicture2 className="w-4 h-4 text-stone-400" />
                  <div>
                    <div className="text-xs font-medium">Pop-out Player (PiP)</div>
                    <div className="text-[10px] text-stone-500">Floating window you can drag to any monitor</div>
                  </div>
                </div>
              </button>

            </div>
          )}

          {/* Feedback message */}
          {infoMsg && (
            <div className="mt-3 p-2 rounded-lg bg-stone-900 border border-stone-800 text-[10px] text-amber-300/90 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
              <span>{infoMsg}</span>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CastModal;
