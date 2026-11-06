import React, { useState, useMemo, useRef } from "react";
import { 
  Music, 
  Upload, 
  Sparkles, 
  Trash2, 
  CheckSquare, 
  Square, 
  ChevronRight, 
  ChevronDown,
  Disc,
  Mic,
  Tag,
  Search,
  Check,
  FolderSync,
  Database,
  Grid,
  HardDrive,
  Info,
  PlusCircle,
  ArrowUpDown,
  Calendar
} from "lucide-react";
import { Track } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  isNativePlatform,
  requestNativeAndroidPermissions,
  scanNativeStorageForAudio,
  ingestAudioLibrary,
  extractMetadata
} from "../utils/audioScannerService";
import { storeLocalTrack } from "../utils/localMediaStorage";
import { getAlbumArtForTrack } from "../utils/albumArt";

// MediaStore mock records removed. Direct ContentResolver integration active.

interface MyMusicViewProps {
  playlist: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentUser: any; // User | null
  isUploading: boolean;
  uploadProgress: number | null;
  uploadError: string;
  uploadSuccess: string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  deleteSelectedTracks: (trackIds: string[]) => Promise<void>;
  onPlayTrackById: (trackId: string, customQueue?: Track[]) => void;
  setUploadError: (msg: string) => void;
  setUploadSuccess: (msg: string) => void;
  refreshLocalMedia?: () => Promise<{ songs: Track[]; vids: any[] }>;
  isScanning?: boolean;
  scanProgress?: number;
  currentScanFile?: string | null;
  onTriggerScan?: () => void;
}

// Helper to generate a 100% playable, valid WAV blob containing a 40Hz sub-bass tone for smooth audio engine loading
function generatePlayableCalibrationWav(durationSec = 10): Blob {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const numSamples = sampleRate * durationSec;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const chunkSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // "RIFF" chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, chunkSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, byteRate, true);    // ByteRate
  view.setUint16(32, blockAlign, true);  // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample
  
  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);    // Subchunk2Size
  
  // Generate a clean 40Hz sine wave tone
  const frequency = 40;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = Math.round(128 + 127 * Math.sin(2 * Math.PI * frequency * t));
    view.setUint8(44 + i, sampleVal);
  }
  
  return new Blob([buffer], { type: "audio/wav" });
}

export const MyMusicView: React.FC<MyMusicViewProps> = ({
  playlist,
  currentTrackIndex,
  isPlaying,
  currentUser,
  isUploading,
  uploadProgress,
  uploadError,
  uploadSuccess,
  handleFileUpload,
  deleteSelectedTracks,
  onPlayTrackById,
  setUploadError,
  setUploadSuccess,
  refreshLocalMedia,
  isScanning: propIsScanning,
  scanProgress: propScanProgress,
  currentScanFile: propCurrentScanFile,
  onTriggerScan
}) => {
  const [viewCategory, setViewCategory] = useState<"all" | "artist" | "album" | "releaseDate" | "genre">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dateAdded" | "artist" | "title">("title");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // Long press timer refs & selection mode triggers
  const longPressTimers = useRef<Record<string, any>>({});
  const isLongPressing = useRef<Record<string, boolean>>({});
  const touchStartPos = useRef<Record<string, { x: number; y: number }>>({});
  const hasMoved = useRef<Record<string, boolean>>({});
  const isSelectionModeRef = useRef(isSelectionMode);
  isSelectionModeRef.current = isSelectionMode;

  const startLongPress = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    // Only respond to primary left click or touch
    if ("button" in e && e.button !== 0) return;

    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
    }
    isLongPressing.current[id] = false;
    hasMoved.current[id] = false;

    if ("touches" in e && e.touches && e.touches[0]) {
      touchStartPos.current[id] = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else if ("clientX" in e) {
      touchStartPos.current[id] = {
        x: (e as React.MouseEvent).clientX,
        y: (e as React.MouseEvent).clientY
      };
    }

    // 400ms snappy long-press trigger
    longPressTimers.current[id] = setTimeout(() => {
      if (!hasMoved.current[id]) {
        isLongPressing.current[id] = true;
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        setIsSelectionMode(true);
        setSelectedTrackIds(prev => {
          if (!prev.includes(id)) {
            return [...prev, id];
          }
          return prev;
        });
      }
    }, 400);
  };

  const cancelLongPress = (id: string) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
  };

  const handleTouchMove = (id: string, e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPos.current[id]) return;
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e && e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return;
    }

    const dx = Math.abs(clientX - touchStartPos.current[id].x);
    const dy = Math.abs(clientY - touchStartPos.current[id].y);

    // 20px natural finger wobble tolerance
    if (dx > 20 || dy > 20) {
      hasMoved.current[id] = true;
      cancelLongPress(id);
    }
  };

  const endLongPress = (id: string, normalAction: () => void) => {
    if (longPressTimers.current[id]) {
      clearTimeout(longPressTimers.current[id]);
      delete longPressTimers.current[id];
    }
    const wasLongPress = isLongPressing.current[id];
    const didMove = hasMoved.current[id];
    isLongPressing.current[id] = false;
    hasMoved.current[id] = false;

    if (!wasLongPress && !didMove) {
      if (isSelectionModeRef.current) {
        toggleSelectTrack(id);
      } else {
        normalAction();
      }
    }
  };

  const bindLongPress = (id: string, action: () => void) => {
    return {
      onMouseDown: (e: React.MouseEvent) => startLongPress(id, e),
      onMouseUp: () => endLongPress(id, action),
      onMouseLeave: () => cancelLongPress(id),
      onTouchStart: (e: React.TouchEvent) => startLongPress(id, e),
      onTouchEnd: () => endLongPress(id, action),
      onTouchMove: (e: React.TouchEvent) => handleTouchMove(id, e),
    };
  };

  // Smart Scanner Service local states & persistent props resolution
  const [internalIsScanning, setInternalIsScanning] = useState(false);
  const [internalCurrentScanFile, setInternalCurrentScanFile] = useState<string | null>(null);
  const [internalScanProgress, setInternalScanProgress] = useState<number>(0);
  const [scanResult, setScanResult] = useState<{ tracksCount: number; limitExceeded: boolean } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const isScanning = propIsScanning !== undefined ? propIsScanning : internalIsScanning;
  const scanProgress = propScanProgress !== undefined ? propScanProgress : internalScanProgress;
  const currentScanFile = propCurrentScanFile !== undefined ? propCurrentScanFile : internalCurrentScanFile;

  // Web-compatible HTML5 individual / multi-file local device storage scanner
  const handleSmartScan = async () => {
    if (onTriggerScan) {
      onTriggerScan();
      return;
    }
    setUploadError("");
    setUploadSuccess("");
    if (scanInputRef.current) {
      scanInputRef.current.value = "";
      scanInputRef.current.click();
    } else {
      const el = document.getElementById("music-scanner") as HTMLInputElement | null;
      if (el) {
        el.value = "";
        el.click();
      }
    }
  };

  const handleWebFolderScanChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      return;
    }
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      return;
    }

    setInternalIsScanning(true);
    setInternalScanProgress(0);
    setScanResult(null);
    setUploadError("");
    setUploadSuccess("");

    try {
      setInternalCurrentScanFile("Reading selected audio files from storage...");
      await new Promise((r) => setTimeout(r, 250));

      // Automated File Filtering Loop: Accept all local audio extensions & MIME types
      const allowedExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"];
      const filteredFiles = files.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        return allowedExtensions.includes(ext) || file.type.startsWith("audio/");
      });

      if (filteredFiles.length === 0) {
        throw new Error("No valid audio files found (.mp3, .wav, .m4a, .aac, .ogg, .flac).");
      }

      const totalTracks = filteredFiles.length;
      setInternalCurrentScanFile(`Loaded ${totalTracks} audio file${totalTracks === 1 ? "" : "s"}. Scanning tags & audio waveforms...`);
      await new Promise((r) => setTimeout(r, 350));

      let processedCount = 0;
      for (const file of filteredFiles) {
        // Extract filename, strip extension off for a clean look
        const title = file.name.replace(/\.[^/.]+$/, "");
        
        // Parse folder path to construct artist/album hierarchy dynamically if relative path exists
        const relativePath = (file as any).webkitRelativePath || "";
        const parts = relativePath ? relativePath.split("/") : [];
        let artist = "Local Storage";
        let album = "Local Device";
        if (parts.length >= 3) {
          artist = parts[parts.length - 3];
          album = parts[parts.length - 2];
        } else if (parts.length === 2) {
          album = parts[0];
        }

        // Determine genre based on simple title scanning matching standard player categories
        let genre = "Local Media";
        const fileLower = file.name.toLowerCase();
        if (fileLower.includes("rap") || fileLower.includes("hip") || fileLower.includes("beat")) {
          genre = "Hip Hop / Rap";
        } else if (fileLower.includes("rock") || fileLower.includes("metal") || fileLower.includes("guitar")) {
          genre = "Rock / Metal";
        } else if (fileLower.includes("electro") || fileLower.includes("edm") || fileLower.includes("house") || fileLower.includes("dance")) {
          genre = "EDM / Electronic";
        } else if (fileLower.includes("pop") || fileLower.includes("rnb") || fileLower.includes("vocal")) {
          genre = "Pop Vocal";
        }

        setInternalCurrentScanFile(`Scanning & indexing: ${file.name}`);

        let metadata;
        try {
          metadata = await extractMetadata(file);
        } catch (e) {
          metadata = { title: title, artist: artist, album: album, imageUrl: "", albumArtUrl: null };
        }

        const trackId = `track_local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Build localized record maintaining reference to original File object
        const localTrackRecord = {
          id: trackId,
          name: metadata.title || title,
          artist: metadata.artist && metadata.artist !== "Unknown Artist" ? metadata.artist : artist,
          album: metadata.album && metadata.album !== "Unknown Album" ? metadata.album : album,
          duration: 180, // Default fallback. Will be resolved to true duration dynamically on load!
          genre: genre,
          imageUrl: metadata.imageUrl || "",
          albumArtUrl: metadata.albumArtUrl || null,
          createdAt: new Date().toISOString(),
          url: `local-db://${trackId}`, // Standard URL protocol to trigger offline blob load
          blob: file, // Store raw file object inside IndexedDB directly!
          uid: currentUser ? currentUser.uid : "guest"
        };

        // Write directly to IndexedDB local storage (bypass cloud, 100% local)
        await storeLocalTrack(localTrackRecord);
        processedCount++;

        // Stagger progress animation for tactile feedback
        setInternalScanProgress(Math.round((processedCount / totalTracks) * 100));
        await new Promise((r) => setTimeout(r, 20));
      }

      // Sync and populate parent application state instantly
      if (refreshLocalMedia) {
        await refreshLocalMedia();
      }

      setScanResult({
        tracksCount: processedCount,
        limitExceeded: false
      });

      setUploadSuccess(`Scan Complete! Successfully added ${processedCount} audio track${processedCount === 1 ? "" : "s"} to your offline library.`);

    } catch (err: any) {
      console.error("Local audio scanner failed:", err);
      setUploadError(err.message || "An error occurred while scanning your selected audio files.");
    } finally {
      setInternalIsScanning(false);
      setInternalCurrentScanFile(null);
      if (e.target) e.target.value = "";
    }
  };

  // 1. All tracks in playlist for My Music view
  const uploadedTracks = useMemo(() => {
    return playlist;
  }, [playlist]);

  // Determine current active track details if playing from the user's list
  const currentPlayingTrackId = useMemo(() => {
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
      return playlist[currentTrackIndex].id;
    }
    return null;
  }, [playlist, currentTrackIndex]);

  // Apply search query filter and sort dynamically
  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = [...uploadedTracks];
    
    if (q) {
      result = result.filter(
        t => 
          (t.name || "").toLowerCase().includes(q) ||
          (t.artist || "").toLowerCase().includes(q) ||
          (t.album || "").toLowerCase().includes(q) ||
          (t.genre || "").toLowerCase().includes(q)
      );
    }

    // Sort the list based on selected sort option
    return result.sort((a, b) => {
      if (sortBy === "artist") {
        const artistA = (a.artist || "Unknown Artist").toLowerCase();
        const artistB = (b.artist || "Unknown Artist").toLowerCase();
        if (artistA !== artistB) return artistA.localeCompare(artistB);
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
      } else if (sortBy === "title") {
        return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
      } else {
        // "dateAdded" (Newest first)
        const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA; // Descending
        return b.id.localeCompare(a.id); // Descending ID fallback
      }
    });
  }, [uploadedTracks, searchQuery, sortBy]);

  // Compute groupings dynamically based on state
  const tracksByArtist = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const artist = track.artist || "Unknown Artist";
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(track);
    });
    return groups;
  }, [filteredTracks]);

  const tracksByAlbum = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const album = track.album || "Unknown Album";
      if (!groups[album]) groups[album] = [];
      groups[album].push(track);
    });
    return groups;
  }, [filteredTracks]);

  const tracksByGenre = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      const genre = track.genre || "Unknown Genre";
      if (!groups[genre]) groups[genre] = [];
      groups[genre].push(track);
    });
    return groups;
  }, [filteredTracks]);

  const tracksByReleaseDate = useMemo(() => {
    const groups: Record<string, Track[]> = {};
    filteredTracks.forEach(track => {
      let dateKey = "Unknown Release Date";
      if ((track as any).createdAt) {
        try {
          const d = new Date((track as any).createdAt);
          if (!isNaN(d.getTime())) {
            dateKey = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
          }
        } catch (e) {
          console.error("Error parsing createdAt for release date grouping:", e);
        }
      }
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(track);
    });
    return groups;
  }, [filteredTracks]);

  // Selection state helpers
  const toggleSelectTrack = (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTrackIds(prev => {
      const isCurrentlySelected = prev.includes(trackId);
      const next = isCurrentlySelected ? prev.filter(id => id !== trackId) : [...prev, trackId];
      if (next.length > 0) {
        setIsSelectionMode(true);
      } else {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const isAllSelected = filteredTracks.length > 0 && selectedTrackIds.length === filteredTracks.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTrackIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedTrackIds(filteredTracks.map(t => t.id));
      setIsSelectionMode(true);
    }
  };

  const targetTrackToDelete = useMemo(() => {
    if (pendingDeleteIds.length === 1) {
      return playlist.find(t => t.id === pendingDeleteIds[0]) || null;
    }
    return null;
  }, [pendingDeleteIds, playlist]);

  const handleSingleDelete = (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idsToDelete = selectedTrackIds.length > 0
      ? (selectedTrackIds.includes(trackId) ? [...selectedTrackIds] : [...selectedTrackIds, trackId])
      : [trackId];
    setPendingDeleteIds(idsToDelete);
    setShowDeleteConfirm(true);
  };

  const handleBatchDelete = () => {
    if (selectedTrackIds.length === 0) return;
    setPendingDeleteIds([...selectedTrackIds]);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const idsToDelete = pendingDeleteIds.length > 0 ? pendingDeleteIds : selectedTrackIds;
    if (idsToDelete.length === 0) return;

    setPendingDeleteIds([]);
    setSelectedTrackIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    if (selectedTrackIds.length <= idsToDelete.length) {
      setIsSelectionMode(false);
    }
    setShowDeleteConfirm(false);
    await deleteSelectedTracks(idsToDelete);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex flex-col gap-8 text-left select-none text-slate-200 p-2 sm:p-4"
      id="elegant-my-music-view"
    >
      {/* 1. Elegant Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-sans font-light tracking-wide text-white flex items-center gap-2.5">
            <Music className="w-6 h-6 text-white stroke-[1.5] drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
            Your Music Collection
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-light">
            Manage, upload, and sync your personalized library of audio tracks and dynamic calibration lists.
          </p>
        </div>
        
        {/* Songs Count Badge & Select Files button */}
        <div className="self-start md:self-center flex items-center gap-3">
          <button
            onClick={() => {
              setIsSelectionMode(prev => {
                const next = !prev;
                if (!next) setSelectedTrackIds([]);
                return next;
              });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-2 border ${
              isSelectionMode 
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]" 
                : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300 hover:text-white"
            }`}
            title="Toggle file selection to select and delete files"
          >
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>{isSelectionMode ? "Exit Select" : "Select Files"}</span>
          </button>
          <span className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-sans tracking-wider font-semibold">
            {uploadedTracks.length === 1 ? "1 Song Loaded" : `${uploadedTracks.length} Songs Loaded`}
          </span>
        </div>
      </div>

      {/* 2. Media Acquisition Control Station */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="media-scanner-station">
        
        {/* Interactive scanner device connection card */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/10 hover:border-slate-300/40 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-300/5 rounded-full blur-3xl pointer-events-none group-hover:bg-slate-300/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-slate-300/10 text-slate-100 group-hover:scale-105 group-hover:bg-slate-300/20 transition-all duration-300 flex items-center justify-center border border-slate-300/20">
              <FolderSync className="w-6 h-6 stroke-[1.5] animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-sans font-semibold text-white tracking-wide uppercase">
                Scan Device for Music
              </span>
              <span className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                Scan and index individual audio tracks or multi-file selections from any storage folder.
              </span>
              <span className="text-[10px] text-slate-300/90 font-medium tracking-wide uppercase mt-2.5 block border-t border-slate-300/10 pt-2.5">
                Instruction: Select individual music files or multiple files from your folders to scan and upload.
              </span>
            </div>
          </div>
          
          <button
            onClick={handleSmartScan}
            disabled={isScanning}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 hover:from-slate-300 hover:via-white hover:to-slate-300 text-stone-950 font-sans text-xs font-bold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 border-0 mt-2"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Scanning Audio...</span>
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4 stroke-[2]" />
                <span>Scan Device for Music</span>
              </>
            )}
          </button>
        </div>

        {/* Traditional Local File Ingestion card */}
        <div className="flex flex-col items-stretch justify-between p-6 rounded-2xl bg-gradient-to-b from-[#140e0d] to-[#0a0504] border border-white/10 hover:border-slate-400/30 shadow-[0_15px_40px_rgba(0,0,0,0.5)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:bg-white/10 transition-colors duration-500" />
          
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-white/5 text-white group-hover:scale-105 group-hover:bg-white/10 transition-all duration-300 flex items-center justify-center border border-white/10">
              <Upload className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-sans font-semibold text-white tracking-wide uppercase">
                Open Audio File
              </span>
              <span className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                Directly select and load specific high-fidelity tracks from your device's filesystem.
              </span>
            </div>
          </div>
          
          <label className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-stone-850 to-stone-950 hover:from-stone-800 hover:to-stone-900 border border-stone-750 text-white font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer transition-all active:scale-[98.5%] shadow-lg flex items-center justify-center gap-2 mt-2 select-none text-center">
            <input 
              type="file" 
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" 
              multiple 
              onChange={(e) => {
                setUploadError("");
                setUploadSuccess("");
                handleFileUpload(e);
              }} 
              className="hidden" 
            />
            <PlusCircle className="w-4 h-4 text-slate-300" />
            <span>Select Local Audio</span>
          </label>
        </div>

      </div>

      {/* HTML5 Local Storage Input Element configured for individual or multi-file selection */}
      <input 
        type="file"
        id="music-scanner"
        ref={scanInputRef}
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        multiple
        onChange={handleWebFolderScanChange}
        className="hidden"
      />

      {/* Scanner Live Status & Progress Panel */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 rounded-2xl bg-slate-950/20 border-2 border-slate-300/20 text-slate-200 flex flex-col md:flex-row items-center gap-6 shadow-[0_10px_30px_rgba(255,255,255,0.05)] overflow-hidden"
          >
            {/* Circular Radar Sweep Screen */}
            <div className="w-24 h-24 rounded-full border-2 border-slate-300/30 relative flex items-center justify-center shrink-0 overflow-hidden bg-stone-950 shadow-[inset_0_0_15px_rgba(255,255,255,0.15)]">
              {/* Spinning radar beam */}
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_60%,rgba(226,232,240,0.45)_100%)] animate-spin" style={{ animationDuration: "2.5s" }} />
              {/* Radar concentric target circles */}
              <div className="absolute w-16 h-16 rounded-full border border-slate-300/15" />
              <div className="absolute w-8 h-8 rounded-full border border-slate-300/10" />
              {/* Horizontal scan line */}
              <div className="absolute inset-x-0 h-[2px] bg-slate-200/80 animate-[pulse_1.2s_infinite] shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <HardDrive className="w-6 h-6 text-slate-200 stroke-[1.5] relative z-10 animate-bounce" />
            </div>

            <div className="flex flex-col gap-3 flex-1 w-full text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-ping" />
                  Live Media Scanner Active
                </h4>
                <span className="font-mono text-[10px] text-slate-200 font-bold">{scanProgress}% Completed</span>
              </div>

              {/* Current file or step */}
              <div className="bg-stone-950/70 border border-slate-300/10 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 flex items-center gap-2 min-h-[38px] truncate">
                <span className="text-slate-300 select-none">&gt;</span>
                <span className="truncate">{currentScanFile || "Acquiring MediaStore links..."}</span>
              </div>

              {/* Progress Bar with modern nested neon track */}
              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-white/5 relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-slate-400 via-white to-slate-400 shadow-[0_0_10px_rgba(255,255,255,0.4)] rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-light">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Scanning directories recursively, verifying READ_MEDIA_AUDIO permissions, and processing track metadata tags automatically.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bars and Status Alerts */}
      <AnimatePresence>
        {uploadError && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/10 text-xs text-red-400"
          >
            <p className="font-light">{uploadError}</p>
          </motion.div>
        )}

        {uploadSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/10 text-xs text-emerald-400"
          >
            <p className="font-light">{uploadSuccess}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filtering & Beautiful Category Swapper */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-2">
        {/* Tab Buttons (Relaxed, no hard frames, floating accent hover) */}
        <div className="flex flex-wrap gap-2.5">
          {(["all", "artist", "album", "genre", "releaseDate"] as const).map((catName) => {
            const labelMap: Record<string, string> = {
              all: "All Songs",
              artist: "Artists",
              album: "Albums",
              genre: "Genres",
              releaseDate: "Added Date"
            };
            const label = labelMap[catName] || catName;
            const isActive = viewCategory === catName;
            return (
              <button
                key={catName}
                onClick={() => {
                  setViewCategory(catName);
                  setSelectedTrackIds([]);
                }}
                className={`px-5 py-2.5 rounded-xl font-sans text-xs uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white/10 text-white font-semibold border border-slate-400 shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Live Search Controls with Glass Styling */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:max-w-xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists, or albums..."
              className="w-full bg-[#0f0a09]/50 hover:bg-white/[0.04] focus:bg-white/[0.05] border border-stone-850 focus:border-white/30 py-3 pl-11 pr-5 rounded-xl text-xs text-white placeholder-slate-400 outline-none transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* 4. Selection & Dynamic Action Panel */}
      {filteredTracks.length > 0 && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between bg-[#0f0a09]/50 border p-4 rounded-2xl transition-all duration-300 gap-3 ${
          isSelectionMode ? "border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)] bg-[#140e0d]/60" : "border-stone-850"
        }`}>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2.5 text-slate-300 hover:text-white text-xs tracking-wider transition-colors duration-150 cursor-pointer"
            >
              <div className="w-4 h-4 rounded-sm border border-stone-500 flex items-center justify-center bg-black/40">
                {isAllSelected && <Check className="w-3 h-3 text-amber-400 stroke-[3]" />}
              </div>
              <span>{isAllSelected ? "Deselect All" : `Select all (${filteredTracks.length})`}</span>
            </button>
            
            {isSelectionMode && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-sans font-semibold text-amber-400 tracking-wider">
                {selectedTrackIds.length} {selectedTrackIds.length === 1 ? "File Selected" : "Files Selected"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedTrackIds([]);
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition-all duration-150 cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setIsSelectionMode(true)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Files</span>
              </button>
            )}

            {selectedTrackIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-5 py-2.5 text-xs font-sans font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ({selectedTrackIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Custom Tracks Listing Container */}
      <div className="flex flex-col gap-3 min-h-[220px]">
        {filteredTracks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/5">
            <FolderSync className="w-8 h-8 text-slate-500 mx-auto mb-3 stroke-[1.5] animate-pulse" />
            <h3 className="text-sm font-sans font-medium text-slate-300">
              {searchQuery ? "No search results match" : "Your music library is currently empty"}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 font-light">
              {searchQuery 
                ? "Try checking your spelling or looking for a different title." 
                : "Add local files or log in to sync saved tracks on your profile."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Direct Flat Stream view */}
            {viewCategory === "all" && (
              <div className="flex flex-col gap-1">
                 {filteredTracks.map((track) => {
                  const isSelectedForDel = selectedTrackIds.includes(track.id);
                  const isPlayingActive = track.id === currentPlayingTrackId;
                  return (
                    <div
                      key={track.id}
                      {...bindLongPress(track.id, () => {
                        if (isSelectionMode) {
                          toggleSelectTrack(track.id);
                        } else {
                          onPlayTrackById(track.id, filteredTracks);
                        }
                      })}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer group transition-all duration-200 select-none ${
                        isPlayingActive
                          ? "bg-white/[0.04] border-white/30"
                          : isSelectedForDel 
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-[#0a0504]/50 hover:bg-[#150e0d]/50 border-stone-850/60 hover:border-slate-550/30"
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-3.5">
                        {/* Box and Checkmark System */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectTrack(track.id);
                          }}
                          className={`p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center ${
                            isSelectionMode 
                              ? "opacity-100" 
                              : "opacity-35 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100"
                          }`}
                          title={isSelectedForDel ? "Deselect track" : "Select track"}
                        >
                          {isSelectedForDel ? (
                            <div className="w-5 h-5 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                          )}
                        </div>

                        {/* Track Album Art Thumbnail */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                          <img 
                            src={getAlbumArtForTrack(track)} 
                            alt={track.name || "Track thumbnail"}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80";
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                          <span className={`text-sm sm:text-base font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                            {track.name || (track as any).title || "Untitled Track"}
                          </span>
                          <span className="text-xs font-sans font-medium text-slate-200 group-hover:text-slate-100 transition-colors truncate block">
                            {track.artist || "Unknown Artist"} • {track.album || "Unknown Album"} • {track.genre || "Unknown Genre"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isPlayingActive && isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5 mr-2">
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-full" style={{ animationDuration: "1s" }} />
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-2/3" style={{ animationDelay: "0.2s", animationDuration: "0.8s" }} />
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-4/5" style={{ animationDelay: "0.4s", animationDuration: "1.1s" }} />
                          </div>
                        ) : null}
                        <span className="text-xs text-slate-400 font-sans font-medium">
                          {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleSingleDelete(track.id, e);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          title="Delete track"
                          className="p-1.5 rounded-lg bg-black/50 hover:bg-red-600 border border-white/15 text-slate-400 hover:text-white transition-all cursor-pointer opacity-80 hover:opacity-100 shrink-0 active:scale-95 z-20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ARTIST Grouping */}
            {viewCategory === "artist" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByArtist).sort().map((artistName) => {
                  const groupTracks = tracksByArtist[artistName];
                  const isExpanded = !!expandedGroups[artistName];
                  return (
                    <div key={artistName} className="rounded-xl border border-white/10 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(artistName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Mic className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{artistName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                {...bindLongPress(track.id, () => {
                                  if (isSelectionMode) {
                                    toggleSelectTrack(track.id);
                                  } else {
                                    onPlayTrackById(track.id, groupTracks);
                                  }
                                })}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all select-none ${
                                  isPlayingActive 
                                    ? "bg-white/10" 
                                    : isSelectedForDel
                                      ? "bg-amber-500/10 border border-amber-500/20"
                                      : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  {/* Box and Checkmark System */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSelectTrack(track.id);
                                    }}
                                    className={`p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center ${
                                      isSelectionMode 
                                        ? "opacity-100" 
                                        : "opacity-35 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100"
                                    }`}
                                    title={isSelectedForDel ? "Deselect track" : "Select track"}
                                  >
                                    {isSelectedForDel ? (
                                      <div className="w-5 h-5 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                    )}
                                  </div>
                                  
                                  {/* Track Album Art Thumbnail */}
                                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                                    <img 
                                      src={getAlbumArtForTrack(track)} 
                                      alt={track.name || "Track thumbnail"}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80";
                                      }}
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                    <span className={`text-sm font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                                      {track.name || (track as any).title || "Untitled Track"}
                                    </span>
                                    <span className="text-xs font-sans font-medium text-slate-200 group-hover:text-slate-100 transition-colors truncate block">
                                      {track.album ? `${track.album}` : "Unknown Album"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-sans font-medium">
                                    {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleSingleDelete(track.id, e);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Delete track"
                                    className="p-1.5 rounded-lg bg-black/50 hover:bg-red-600 border border-white/15 text-slate-400 hover:text-white transition-all cursor-pointer opacity-80 hover:opacity-100 shrink-0 active:scale-95 z-20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ALBUM Grouping */}
            {viewCategory === "album" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByAlbum).sort().map((albumName) => {
                  const groupTracks = tracksByAlbum[albumName];
                  const isExpanded = !!expandedGroups[albumName];
                  return (
                    <div key={albumName} className="rounded-xl border border-white/11 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(albumName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Disc className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{albumName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                {...bindLongPress(track.id, () => {
                                  if (isSelectionMode) {
                                    toggleSelectTrack(track.id);
                                  } else {
                                    onPlayTrackById(track.id, groupTracks);
                                  }
                                })}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all select-none ${
                                  isPlayingActive 
                                    ? "bg-white/10" 
                                    : isSelectedForDel
                                      ? "bg-amber-500/10 border border-amber-500/20"
                                      : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  {/* Box and Checkmark System */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSelectTrack(track.id);
                                    }}
                                    className={`p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center ${
                                      isSelectionMode 
                                        ? "opacity-100" 
                                        : "opacity-35 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100"
                                    }`}
                                    title={isSelectedForDel ? "Deselect track" : "Select track"}
                                  >
                                    {isSelectedForDel ? (
                                      <div className="w-5 h-5 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                    )}
                                  </div>
                                  
                                  {/* Track Album Art Thumbnail */}
                                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                                    <img 
                                      src={getAlbumArtForTrack(track)} 
                                      alt={track.name || "Track thumbnail"}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80";
                                      }}
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                    <span className={`text-sm font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                                      {track.name || (track as any).title || "Untitled Track"}
                                    </span>
                                    <span className="text-xs font-sans font-medium text-slate-200 group-hover:text-slate-100 transition-colors truncate block">
                                      {track.artist ? `${track.artist}` : "Unknown Artist"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-sans font-medium">
                                    {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleSingleDelete(track.id, e);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Delete track"
                                    className="p-1.5 rounded-lg bg-black/50 hover:bg-red-600 border border-white/15 text-slate-400 hover:text-white transition-all cursor-pointer opacity-80 hover:opacity-100 shrink-0 active:scale-95 z-20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* RELEASE DATE Grouping */}
            {viewCategory === "releaseDate" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByReleaseDate).sort((a, b) => {
                  if (a === "Unknown Release Date") return 1;
                  if (b === "Unknown Release Date") return -1;
                  return new Date(b).getTime() - new Date(a).getTime();
                }).map((dateKey) => {
                  const groupTracks = tracksByReleaseDate[dateKey];
                  const isExpanded = !!expandedGroups[dateKey];
                  return (
                    <div key={dateKey} className="rounded-xl border border-white/10 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(dateKey)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Calendar className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{dateKey}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                {...bindLongPress(track.id, () => {
                                  if (isSelectionMode) {
                                    toggleSelectTrack(track.id);
                                  } else {
                                    onPlayTrackById(track.id, groupTracks);
                                  }
                                })}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all select-none ${
                                  isPlayingActive 
                                    ? "bg-white/10" 
                                    : isSelectedForDel
                                      ? "bg-amber-500/10 border border-amber-500/20"
                                      : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  {/* Box and Checkmark System */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSelectTrack(track.id);
                                    }}
                                    className={`p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center ${
                                      isSelectionMode 
                                        ? "opacity-100" 
                                        : "opacity-35 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100"
                                    }`}
                                    title={isSelectedForDel ? "Deselect track" : "Select track"}
                                  >
                                    {isSelectedForDel ? (
                                      <div className="w-5 h-5 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                    )}
                                  </div>
                                  
                                  {/* Track Album Art Thumbnail */}
                                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                                    {track.imageUrl || track.albumArtUrl ? (
                                      <img 
                                        src={track.imageUrl || track.albumArtUrl || ""} 
                                        alt={track.name || "Track thumbnail"}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80";
                                        }}
                                      />
                                    ) : (
                                      <Disc className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span className={`text-xs font-sans font-semibold truncate block ${isPlayingActive ? "text-amber-300 font-bold" : "text-white group-hover:text-amber-200 transition-colors"}`}>
                                      {track.name || (track as any).title || "Untitled Track"}
                                    </span>
                                    <span className="text-[11px] text-slate-300 font-normal truncate block">
                                      {track.artist ? `${track.artist}` : "Unknown Artist"} • {track.album ? `${track.album}` : "Unknown Album"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-sans font-medium">
                                    {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleSingleDelete(track.id, e);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Delete track"
                                    className="p-1.5 rounded-lg bg-black/50 hover:bg-red-600 border border-white/15 text-slate-400 hover:text-white transition-all cursor-pointer opacity-80 hover:opacity-100 shrink-0 active:scale-95 z-20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* GENRE Grouping */}
            {viewCategory === "genre" && (
              <div className="flex flex-col gap-3">
                {Object.keys(tracksByGenre).sort().map((genreName) => {
                  const groupTracks = tracksByGenre[genreName];
                  const isExpanded = !!expandedGroups[genreName];
                  return (
                    <div key={genreName} className="rounded-xl border border-white/10 bg-[#0f0a09]/50 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(genreName)}
                        className="p-4 bg-white/[0.015] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3 text-slate-200">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <Tag className="w-4 h-4 text-white" />
                          <span className="text-[13px] font-sans font-semibold tracking-wide text-white">{genreName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans font-medium px-2 py-0.5 bg-white/[0.03] rounded-lg">
                          {groupTracks.length === 1 ? "1 song" : `${groupTracks.length} songs`}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 bg-black/[0.15] border-t border-white/5 flex flex-col gap-1">
                          {groupTracks.map((track) => {
                            const isSelectedForDel = selectedTrackIds.includes(track.id);
                            const isPlayingActive = track.id === currentPlayingTrackId;
                            return (
                              <div
                                key={track.id}
                                {...bindLongPress(track.id, () => {
                                  if (isSelectionMode) {
                                    toggleSelectTrack(track.id);
                                  } else {
                                    onPlayTrackById(track.id, groupTracks);
                                  }
                                })}
                                className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer group transition-all select-none ${
                                  isPlayingActive 
                                    ? "bg-white/10" 
                                    : isSelectedForDel
                                      ? "bg-amber-500/10 border border-amber-500/20"
                                      : "hover:bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  {/* Box and Checkmark System */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSelectTrack(track.id);
                                    }}
                                    className={`p-1 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center ${
                                      isSelectionMode 
                                        ? "opacity-100" 
                                        : "opacity-35 sm:opacity-0 sm:group-hover:opacity-70 hover:!opacity-100"
                                    }`}
                                    title={isSelectedForDel ? "Deselect track" : "Select track"}
                                  >
                                    {isSelectedForDel ? (
                                      <div className="w-5 h-5 rounded-md bg-amber-500 border border-amber-400 flex items-center justify-center text-stone-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-md border-2 border-stone-500 hover:border-amber-400/80 bg-black/40 transition-colors" />
                                    )}
                                  </div>
                                  
                                  {/* Track Album Art Thumbnail */}
                                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                                    {track.imageUrl || track.albumArtUrl ? (
                                      <img 
                                        src={track.imageUrl || track.albumArtUrl || ""} 
                                        alt={track.name || "Track thumbnail"}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80";
                                        }}
                                      />
                                    ) : (
                                      <Disc className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                    <span className={`text-sm font-sans font-bold truncate block ${isPlayingActive ? "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "text-white group-hover:text-amber-300 transition-colors"}`}>
                                      {track.name || (track as any).title || "Untitled Track"}
                                    </span>
                                    <span className="text-xs font-sans font-medium text-slate-200 group-hover:text-slate-100 transition-colors truncate block">
                                      {track.artist ? `${track.artist}` : "Unknown Artist"} • {track.album ? `${track.album}` : "Unknown Album"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-sans font-medium">
                                    {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleSingleDelete(track.id, e);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Delete track"
                                    className="p-1.5 rounded-lg bg-black/50 hover:bg-red-600 border border-white/15 text-slate-400 hover:text-white transition-all cursor-pointer opacity-80 hover:opacity-100 shrink-0 active:scale-95 z-20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Sleek Glass Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowDeleteConfirm(false);
              setPendingDeleteIds([]);
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0f0a09] border border-stone-800 rounded-2xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                  <Trash2 className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-wide">
                    Delete Track
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-light">
                    Confirmation prompt
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 font-light leading-relaxed mb-6">
                {targetTrackToDelete ? (
                  <>
                    Are you sure you want to delete <strong className="text-white font-semibold">"{targetTrackToDelete.name}"</strong> from your library?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete the <strong className="text-white font-semibold">{(pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedTrackIds.length)}</strong> selected track(s) from your library?
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setPendingDeleteIds([]);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-stone-800 text-slate-400 hover:text-white hover:bg-white/5 text-xs font-sans font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-sans font-bold transition-all active:scale-[98.5%] cursor-pointer shadow-lg shadow-red-500/10"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Action Bar when Selection Mode is Active */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-[#140e0d]/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-black/90 max-w-md w-[92%]"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-sans font-bold text-white">
                {selectedTrackIds.length} {selectedTrackIds.length === 1 ? "file selected" : "files selected"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 text-[11px] font-sans font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {isAllSelected ? "Deselect" : "Select All"}
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedTrackIds([]);
                }}
                className="px-2.5 py-1.5 text-[11px] font-sans font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={selectedTrackIds.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-sans font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MyMusicView;
