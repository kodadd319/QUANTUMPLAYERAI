import React, { useState, useEffect, useRef } from "react";
import { 
  Cast, 
  Tv, 
  Wifi, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Sparkles,
  Radio,
  CheckCircle2
} from "lucide-react";
import { castSyncManager, CastMediaPayload, CastMessage } from "../utils/castSync";
import { getVideoBlob } from "../utils/videoStorage";

export const CastReceiver: React.FC = () => {
  const [mediaState, setMediaState] = useState<CastMediaPayload | null>(null);
  const [resolvedBlobUrl, setResolvedBlobUrl] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const receiverNameRef = useRef<string>("Smart TV Receiver (" + (window.navigator.platform || "Display") + ")");

  // Initialize stored state if available
  useEffect(() => {
    const initial = castSyncManager.getStoredMediaState();
    if (initial) {
      setMediaState(initial);
      setIsConnected(true);
      setCurrentTime(initial.currentTime || 0);
      setDuration(initial.duration || 0);
      setIsPlaying(initial.isPlaying || false);
      setVolume(initial.volume !== undefined ? initial.volume : 1);
      setIsMuted(initial.isMuted || false);
    }
  }, []);

  // Respond to discovery pings & handle sync commands
  useEffect(() => {
    // Send immediate announce pong
    castSyncManager.sendMessage("CAST_DISCOVERY_PONG", {
      name: receiverNameRef.current,
      type: "smarttv",
      resolution: `${window.screen.width || 1920}x${window.screen.height || 1080} (60Hz)`,
      location: "Connected Display / Browser Receiver"
    });

    const unsubscribe = castSyncManager.addListener((msg: CastMessage) => {
      if (msg.type === "CAST_DISCOVERY_PING") {
        castSyncManager.sendMessage("CAST_DISCOVERY_PONG", {
          name: receiverNameRef.current,
          type: "smarttv",
          resolution: `${window.screen.width || 1920}x${window.screen.height || 1080} (60Hz)`,
          location: "Connected Display / Browser Receiver"
        });
      } else if (msg.type === "CAST_INIT_SESSION" || msg.type === "CAST_STATE_SYNC") {
        if (msg.payload) {
          const payload = msg.payload as CastMediaPayload;
          setMediaState(payload);
          setIsConnected(true);
          setIsPlaying(payload.isPlaying);
          if (payload.volume !== undefined) setVolume(payload.volume);
          if (payload.isMuted !== undefined) setIsMuted(payload.isMuted);
          
          const vid = videoRef.current;
          if (vid) {
            if (Math.abs(vid.currentTime - payload.currentTime) > 1.5) {
              vid.currentTime = payload.currentTime;
            }
            if (payload.isPlaying && vid.paused) {
              vid.play().catch(() => {});
            } else if (!payload.isPlaying && !vid.paused) {
              vid.pause();
            }
          }
        }
      } else if (msg.type === "CAST_PLAY") {
        setIsPlaying(true);
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      } else if (msg.type === "CAST_PAUSE") {
        setIsPlaying(false);
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      } else if (msg.type === "CAST_SEEK") {
        const targetSec = Number(msg.payload);
        if (!isNaN(targetSec)) {
          setCurrentTime(targetSec);
          if (videoRef.current) {
            videoRef.current.currentTime = targetSec;
          }
        }
      } else if (msg.type === "CAST_VOLUME") {
        const vol = Number(msg.payload);
        if (!isNaN(vol)) {
          setVolume(vol);
          if (videoRef.current) {
            videoRef.current.volume = vol;
          }
        }
      } else if (msg.type === "CAST_MUTE") {
        const muted = Boolean(msg.payload);
        setIsMuted(muted);
        if (videoRef.current) {
          videoRef.current.muted = muted;
        }
      } else if (msg.type === "CAST_STOP") {
        setIsConnected(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Resolve video URL if stored in IndexedDB (local-db://)
  useEffect(() => {
    let active = true;
    if (!mediaState?.url) {
      setResolvedBlobUrl("");
      return;
    }

    const url = mediaState.url;
    if (url.startsWith("local-db://")) {
      const id = url.replace("local-db://", "");
      getVideoBlob(id).then((blob) => {
        if (blob && active) {
          const objUrl = URL.createObjectURL(blob);
          setResolvedBlobUrl(objUrl);
        }
      }).catch((e) => {
        console.warn("Failed to load local blob in receiver:", e);
      });
    } else {
      setResolvedBlobUrl(url);
    }

    return () => {
      active = false;
    };
  }, [mediaState?.url]);

  // Sync audio/volume to video tag
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Autoplay when resolved URL is ready
  useEffect(() => {
    if (videoRef.current && resolvedBlobUrl && isPlaying) {
      videoRef.current.play().catch((err) => {
        console.log("Receiver autoplay waiting for user interaction:", err);
      });
    }
  }, [resolvedBlobUrl]);

  // Controls auto-hide timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="relative w-screen h-screen bg-black text-white overflow-hidden select-none font-sans flex flex-col items-center justify-center"
    >
      {/* Active Video Player Screen */}
      {resolvedBlobUrl ? (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={resolvedBlobUrl}
            playsInline
            autoPlay
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
              const dur = e.currentTarget.duration;
              if (dur && !isNaN(dur)) setDuration(dur);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 shadow-2xl animate-pulse">
            <Tv className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Quantum Cast Receiver</h1>
          <p className="text-sm text-stone-400 mt-2 leading-relaxed">
            Ready to receive wireless streams. Open the video player on your phone, tablet, or computer, click <strong className="text-amber-400">Cast</strong>, and select this device.
          </p>
          <div className="mt-6 px-4 py-2 rounded-full bg-stone-900 border border-stone-800 flex items-center gap-2.5 text-xs text-stone-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Listening on Wi-Fi Network • Ready</span>
          </div>
        </div>
      )}

      {/* Top Overlay Banner */}
      <div 
        className={`absolute top-0 inset-x-0 p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between pointer-events-auto ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg">
            <Cast className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Quantum Cast Receiver</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live Wi-Fi Stream
              </span>
            </div>
            <h2 className="text-base font-semibold text-white mt-0.5">
              {mediaState?.name || "Connected Display"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 transition-all cursor-pointer shadow-lg"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Bottom Transport Bar */}
      {resolvedBlobUrl && (
        <div 
          className={`absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 pointer-events-auto ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Progress Timeline */}
          <div className="w-full mb-4">
            <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-400 font-mono mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const vid = videoRef.current;
                  if (!vid) return;
                  if (vid.paused) {
                    vid.play();
                    setIsPlaying(true);
                    castSyncManager.sendMessage("CAST_PLAY");
                  } else {
                    vid.pause();
                    setIsPlaying(false);
                    castSyncManager.sendMessage("CAST_PAUSE");
                  }
                }}
                className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <button
                onClick={() => {
                  const nextMute = !isMuted;
                  setIsMuted(nextMute);
                  castSyncManager.sendMessage("CAST_MUTE", nextMute);
                }}
                className="p-2.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-stone-700/80 transition-all cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="w-28 hidden sm:flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setVolume(vol);
                    if (isMuted) setIsMuted(false);
                    castSyncManager.sendMessage("CAST_VOLUME", vol);
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>Synced 4K Ultra HD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
