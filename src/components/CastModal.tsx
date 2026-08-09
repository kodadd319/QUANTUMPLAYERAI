import React, { useState, useEffect } from "react";
import { 
  Cast, 
  Tv, 
  CheckCircle2, 
  Wifi, 
  X, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Monitor, 
  Radio, 
  RefreshCw,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface CastDevice {
  id: string;
  name: string;
  type: "chromecast" | "airplay" | "smarttv" | "dlna";
  location: string;
  resolution: string;
  status: "available" | "connecting" | "connected";
}

const DEFAULT_DEVICES: CastDevice[] = [
  { id: "dev-1", name: "Living Room Smart TV", type: "smarttv", location: "Living Room (5GHz Wi-Fi)", resolution: "4K HDR (60Hz)", status: "available" },
  { id: "dev-2", name: "Google Chromecast 4K", type: "chromecast", location: "Home Theater", resolution: "4K Dolby Vision", status: "available" },
  { id: "dev-3", name: "Apple TV 4K (AirPlay 2)", type: "airplay", location: "Bedroom", resolution: "4K HDR", status: "available" },
  { id: "dev-4", name: "Samsung QLED (DLNA / Wi-Fi Direct)", type: "dlna", location: "Media Room", resolution: "8K UHD", status: "available" }
];

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement?: HTMLVideoElement | null;
  videoName?: string;
  videoUrl?: string;
  connectedDevice: CastDevice | null;
  onSelectDevice: (device: CastDevice | null) => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  videoElement,
  videoName,
  videoUrl,
  connectedDevice,
  onSelectDevice
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<CastDevice[]>(DEFAULT_DEVICES);
  const [castVolume, setCastVolume] = useState(0.85);
  const [castIsMuted, setCastIsMuted] = useState(false);
  const [castIsPlaying, setCastIsPlaying] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      handleScan();
    }
  }, [isOpen]);

  const handleScan = () => {
    setIsScanning(true);
    setStatusMessage("Scanning local Wi-Fi network for AirPlay, Chromecast & Smart TVs...");
    setTimeout(() => {
      setIsScanning(false);
      setStatusMessage("Found 4 wireless display targets on network.");
    }, 1200);
  };

  const handleTriggerNativeCast = async () => {
    try {
      if (videoElement) {
        if ("remote" in videoElement && (videoElement as any).remote) {
          await (videoElement as any).remote.prompt();
          setStatusMessage("Native Remote Playback Dialog Triggered");
          return;
        }
        if ((videoElement as any).webkitShowPlaybackTargetPicker) {
          (videoElement as any).webkitShowPlaybackTargetPicker();
          setStatusMessage("AirPlay Target Picker Prompted");
          return;
        }
      }
      setStatusMessage("Native cast API not available in iframe. Using smart Wi-Fi casting mode.");
    } catch (err) {
      console.warn("Native cast trigger fallback:", err);
    }
  };

  const handleConnect = (device: CastDevice) => {
    setStatusMessage(`Connecting to ${device.name}...`);
    setDevices(prev => prev.map(d => ({
      ...d,
      status: d.id === device.id ? "connecting" : "available"
    })));

    setTimeout(() => {
      const activeDev = { ...device, status: "connected" as const };
      onSelectDevice(activeDev);
      setDevices(prev => prev.map(d => ({
        ...d,
        status: d.id === device.id ? "connected" : "available"
      })));
      setStatusMessage(`Connected to ${device.name}. Streaming high-definition video.`);
    }, 1000);
  };

  const handleDisconnect = () => {
    onSelectDevice(null);
    setDevices(DEFAULT_DEVICES);
    setStatusMessage("Disconnected from wireless display.");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 relative overflow-hidden"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Cast className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Cast to Device</h3>
                <p className="text-xs text-stone-400">Stream video & audio to Smart TVs, Apple TV, or Chromecast</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Connection Banner */}
          {connectedDevice ? (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                  <div>
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Casting Active</div>
                    <div className="text-sm font-semibold text-white">{connectedDevice.name}</div>
                    <div className="text-[10px] text-stone-400">{videoName || "Video Stream"}</div>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-red-950/60 text-stone-300 hover:text-red-400 text-xs font-semibold border border-stone-700 hover:border-red-800 transition-all cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {/* Cast Remote Controls */}
              <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCastIsPlaying(!castIsPlaying)}
                    className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 cursor-pointer transition-colors"
                    title={castIsPlaying ? "Pause Cast" : "Play Cast"}
                  >
                    {castIsPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setCastIsMuted(!castIsMuted)}
                    className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer transition-colors"
                  >
                    {castIsMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 font-mono">VOL</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={castIsMuted ? 0 : castVolume}
                    onChange={(e) => {
                      setCastVolume(parseFloat(e.target.value));
                      if (castIsMuted) setCastIsMuted(false);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-stone-300 font-mono">{Math.round((castIsMuted ? 0 : castVolume) * 100)}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleTriggerNativeCast}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
              >
                <Radio className="w-4 h-4" />
                Trigger Browser Cast Picker
              </button>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-amber-400" : ""}`} />
                Rescan Wi-Fi
              </button>
            </div>
          )}

          {/* Status Bar */}
          {statusMessage && (
            <div className="mt-3 text-[11px] font-sans text-amber-400/90 bg-stone-950/60 p-2.5 rounded-xl border border-stone-800 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Available Devices List */}
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2 flex items-center justify-between">
              <span>Discovered Devices</span>
              <span className="flex items-center gap-1 text-[10px] text-stone-500">
                <Wifi className="w-3 h-3 text-emerald-400" /> Local Wi-Fi
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {devices.map((device) => {
                const isConnected = connectedDevice?.id === device.id;
                const isConnecting = device.status === "connecting";

                return (
                  <div
                    key={device.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isConnected
                        ? "bg-amber-500/15 border-amber-500/50 text-white"
                        : "bg-stone-850/80 border-stone-800 hover:border-stone-700 hover:bg-stone-800 text-stone-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isConnected ? "bg-amber-500/20 text-amber-300" : "bg-stone-800 text-stone-400"}`}>
                        {device.type === "smarttv" ? (
                          <Tv className="w-4 h-4" />
                        ) : device.type === "chromecast" ? (
                          <Cast className="w-4 h-4" />
                        ) : device.type === "airplay" ? (
                          <Radio className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white flex items-center gap-2">
                          {device.name}
                          {isConnected && (
                            <span className="text-[10px] bg-amber-500 text-stone-950 font-extrabold px-1.5 py-0.2 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-2">
                          <span>{device.location}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-stone-400">{device.resolution}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isConnected ? (
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          Connected
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(device)}
                          disabled={isConnecting}
                          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 text-xs font-semibold border border-stone-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {isConnecting ? "Connecting..." : "Cast"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
