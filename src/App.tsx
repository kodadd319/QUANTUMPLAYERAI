import React, { useState, useRef, useEffect, useMemo } from "react"; 
import {   
  Music,   
  Upload,   
  Play,   
  Pause,   
  SkipForward,   
  SkipBack,   
  Sparkles,   
  Cpu,   
  Car,   
  Sliders,   
  Volume2,   
  Trash2,   
  Activity,   
  Info,   
  Shuffle,   
  Repeat,   
  AlertTriangle,   
  VolumeX,   
  PlusCircle,   
  Clock,   
  Dribbble,   
  HelpCircle,   
  Square,   
  FastForward,   
  Rewind,   
  Flame,   
  Bomb,   
  PhoneCall,
  Menu,
  X,
  LogOut
} from "lucide-react"; 
import { Track, VehicleInfo, DspSettings, Preset, VideoTrack } from "./types"; 
import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";
import { CarAudioEngine } from "./utils/audioEngine"; 
import { BassKnob } from "./components/BassKnob"; 
import { EqSliders } from "./components/EqSliders"; 
import { DoubleDinPlayer } from "./utils/DoubleDinPlayer"; // Wait, is it "DoubleDinPlayer" or "定位 DoubleDinPlayer"? Oh, let's check the import in user query.
// In the user's query it says: import { DoubleDinPlayer } from "./utils/DoubleDinPlayer";
import { AuthView } from "./components/AuthView"; 
import { MyMusicView } from "./components/MyMusicView"; 
import { UpgradeView } from "./components/UpgradeView";
import { AiEnhancementView } from "./components/AiEnhancementView";
import { AiVideoEnhancementView } from "./components/AiVideoEnhancementView";
import { VideoView } from "./components/VideoView";
import { MyVideosView } from "./components/MyVideosView";
import { motion, AnimatePresence } from "motion/react"; 

// Firebase Integrations Block 
import { auth, db, storage, googleProvider } from "./firebase"; 
import { onAuthStateChanged, signOut, User } from "firebase/auth"; 
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, deleteDoc } from "firebase/firestore"; 
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"; 
import { getLocalTracks, storeLocalTrack, deleteLocalTrack, getLocalVideos, storeLocalVideo, deleteLocalVideo } from "./utils/localMediaStorage"; 

// Standard Operation Types for Firestore Hardened Audits 
enum OperationType {   
  CREATE = "create",   
  UPDATE = "update",   
  DELETE = "delete",   
  LIST = "list",   
  GET = "get",   
  WRITE = "write" 
}

// Global Secure Firestore Error Handling Wrapper 
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {   
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaError = errMsg.toLowerCase().includes("quota exceeded") || 
                       errMsg.toLowerCase().includes("resource-exhausted") ||
                       errMsg.toLowerCase().includes("quota") ||
                       errMsg.toLowerCase().includes("exceeded");

  const errPayload = {     
    error: errMsg,     
    authInfo: {       
      userId: auth.currentUser?.uid || null,       
      email: auth.currentUser?.email || null,       
      emailVerified: auth.currentUser?.emailVerified || false,       
      isAnonymous: auth.currentUser?.isAnonymous || false,       
      tenantId: auth.currentUser?.tenantId || null,       
      providerInfo: auth.currentUser?.providerData?.map(provider => ({         
        providerId: provider.providerId,         
        email: provider.email,       
      })) || []     
    },     
    operationType,     
    path   };   

  if (isQuotaError) {
    console.warn("Firestore Quota Exceeded. Safely failing back to offline / local IndexedDB state:", errMsg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("firestore-error", { detail: errPayload }));
    }
    return;
  }

  console.error("Firestore Security/Execution Violation Caught:", JSON.stringify(errPayload, null, 2));   
  
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("firestore-error", { detail: errPayload }));
  }

  throw new Error(JSON.stringify(errPayload)); 
}

// Pure JS ID3 parser helper using jsmediatags to extract tags safely client-side
function scanMetadata(file: File): Promise<{ title: string; artist: string; album: string; imageUrl?: string; albumArtUrl?: string | null }> {   
  return new Promise((resolve) => {     
    let defaultArtist = "Unknown Artist";     
    let defaultAlbum = "Unknown Album";     
    // Fall back to actual file name as the title
    let defaultTitle = file ? file.name : "Unknown Track";

    try {
      const jst = (jsmediatags as any)?.read ? jsmediatags : (jsmediatags as any)?.default;
      if (!jst || typeof jst.read !== "function") {
        console.warn("jsmediatags library or read function not loaded, utilizing defaults.");
        resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
        return;
      }

      jst.read(file, {
        onSuccess: (tag: any) => {
          try {
            const tags = tag?.tags || {};
            // If tag title/artist/album is empty, fall back to exact filename as requested
            const title = tags.title && String(tags.title).trim() ? String(tags.title).trim() : defaultTitle;
            const artist = tags.artist && String(tags.artist).trim() ? String(tags.artist).trim() : defaultArtist;
            const album = tags.album && String(tags.album).trim() ? String(tags.album).trim() : defaultAlbum;
            let imageUrl: string | undefined = undefined;

            if (tags.picture) {
              try {
                const { data, format } = tags.picture;
                let base64String = "";
                const len = data.length;
                for (let i = 0; i < len; i++) {
                  base64String += String.fromCharCode(data[i]);
                }
                imageUrl = `data:${format};base64,${window.btoa(base64String)}`;
              } catch (imgErr) {
                console.error("Failed to parse embedded picture from jsmediatags:", imgErr);
              }
            }
            resolve({ title, artist, album, imageUrl, albumArtUrl: imageUrl || null });
          } catch (successInnerErr) {
            console.error("Error processing successful jsmediatags read:", successInnerErr);
            resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
          }
        },
        onError: (err: any) => {
          console.warn("jsmediatags extraction failed, applying fallbacks:", err);
          resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
        }
      });
    } catch (err) {
      console.error("jsmediatags execution threw error:", err);
      resolve({ title: defaultTitle, artist: defaultArtist, album: defaultAlbum, albumArtUrl: null });
    }
  }); 
}

// Extract thumbnail frame and metadata from local video file
function scanVideoMetadata(file: File): Promise<{ title: string; creator: string; thumbnail: string; duration: string }> {
  return new Promise((resolve) => {
    // Fall back to actual file name as the title
    const defaultTitle = file ? file.name : "Unknown Video";
    const defaultCreator = "Local Creator";
    let durationStr = "Local Video";

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    // Timeout fallback after 2.5 seconds to prevent stalling the upload flow
    const timeout = setTimeout(() => {
      video.src = "";
      URL.revokeObjectURL(url);
      resolve({
        title: defaultTitle,
        creator: defaultCreator,
        thumbnail: "", // Fallback to placeholder UI render
        duration: durationStr
      });
    }, 2500);

    video.onloadedmetadata = () => {
      const d = video.duration;
      if (!isNaN(d) && d > 0) {
        const mins = Math.floor(d / 60);
        const secs = Math.floor(d % 60);
        durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;
      }
      // Seek to 10% of the video to capture an interesting frame instead of a black intro frame
      const seekTime = Math.min(1.0, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          video.src = "";
          URL.revokeObjectURL(url);
          resolve({
            title: defaultTitle,
            creator: defaultCreator,
            thumbnail: dataUrl,
            duration: durationStr
          });
          return;
        }
      } catch (err) {
        console.error("Failed to capture video frame:", err);
      }
      video.src = "";
      URL.revokeObjectURL(url);
      resolve({
        title: defaultTitle,
        creator: defaultCreator,
        thumbnail: "",
        duration: durationStr
      });
    };

    video.onerror = () => {
      clearTimeout(timeout);
      video.src = "";
      URL.revokeObjectURL(url);
      resolve({
        title: defaultTitle,
        creator: defaultCreator,
        thumbnail: "",
        duration: durationStr
      });
    };
  });
}

// Sound presets designed for car audio rigs 
const BUILTIN_PRESETS: Preset[] = [     
  {
    name: "Hip hop",     
    eqBands: [8, 5, -2, 1, 3],     
    bassBoost: 75,     
    reverbWet: 0.08,     
    delayOffsetMs: 8   
  },     
  {
    name: "Rock",     
    eqBands: [3, 4, 1, 4, 3],     
    bassBoost: 45,     
    reverbWet: 0.10,     
    delayOffsetMs: 6   
  },     
  {
    name: "Classical",     
    eqBands: [0, 1, 2, 3, 4],     
    bassBoost: 10,     
    reverbWet: 0.22,     
    delayOffsetMs: 16   
  },
  {
    name: "Pop",
    eqBands: [4, 2, 1, 3, 5],
    bassBoost: 35,
    reverbWet: 0.06,
    delayOffsetMs: 4,
    isPremium: true
  },
  {
    name: "Jazz",
    eqBands: [1, 3, 3, 2, 2],
    bassBoost: 20,
    reverbWet: 0.15,
    delayOffsetMs: 12,
    isPremium: true
  },
  {
    name: "Techo",
    eqBands: [9, 7, -3, 2, 6],
    bassBoost: 80,
    reverbWet: 0.14,
    delayOffsetMs: 8,
    isPremium: true
  },
  {
    name: "Movie",
    eqBands: [7, 3, 4, 2, 5],
    bassBoost: 55,
    reverbWet: 0.25,
    delayOffsetMs: 22,
    isPremium: true
  }
]; 

export default function App() {   
  const [currentView, setCurrentView] = useState<"landing" | "auth" | "player" | "mymusic" | "myvideos" | "privacy" | "agreement" | "upgrade" | "ai_enhancement" | "ai_enhancement_audio" | "ai_enhancement_video" | "video">("landing");   
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "paid">(
    () => (localStorage.getItem("thumplayer_sub_tier") as "free" | "paid") || "free"
  );
  // Shared AI Video states
  const [selectedVideo, setSelectedVideo] = useState<VideoTrack | null>(null);
  const [activeModel, setActiveModel] = useState<"quantum-scale" | "deep-cinema" | "chroma-hdr">("quantum-scale");
  const [upscaleTarget, setUpscaleTarget] = useState<"HD" | "2K" | "4K" | "8K">("4K");
  const [colorEnhancement, setColorEnhancement] = useState<"hdr" | "vivid" | "lowlight" | "crisp" | "none">("hdr");
  const [smoothMotion, setSmoothMotion] = useState<boolean>(true);
  const [turboMode, setTurboMode] = useState<boolean>(false);
  const [aiOptimizedFilters, setAiOptimizedFilters] = useState<{
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    hueRotate: number;
    sepia: number;
    justification: string;
  } | null>(null);
  const [globalPremiumPrompt, setGlobalPremiumPrompt] = useState<string>("");
  const [playlist, setPlaylist] = useState<Track[]>([]);   
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);   
  const [isPlaying, setIsPlaying] = useState<boolean>(false);   
  const [songProgress, setSongProgress] = useState<number>(0);   
  const [songDuration, setSongDuration] = useState<number>(0);   
  const [volume, setVolume] = useState<number>(0.85);   
  const [isMuted, setIsMuted] = useState<boolean>(false);   
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("all");   
  const [shuffleMode, setShuffleMode] = useState<boolean>(false);   
  const [playlistViewMode, setPlaylistViewMode] = useState<"all" | "artist" | "album">("all");   
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});   
  const [playerTab, setPlayerTab] = useState<"workbench" | "mymusic">("workbench");   
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimizedClosed, setIsMinimizedClosed] = useState<boolean>(false);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState<boolean>(
    typeof document !== "undefined" ? (document.visibilityState === "hidden" || !document.hasFocus()) : false
  );
  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const tracksByArtist = useMemo(() => {     
    const groups: Record<string, Track[]> = {};     
    playlist.forEach((track) => {       
      const artist = track.artist || "Unknown Artist";       
      if (!groups[artist]) groups[artist] = [];       
      groups[artist].push(track);     
    });     
    return groups;   
  }, [playlist]);   

  const tracksByAlbum = useMemo(() => {     
    const groups: Record<string, Track[]> = {};     
    playlist.forEach((track) => {       
      const album = track.album || "Unknown Album";       
      if (!groups[album]) groups[album] = [];       
      groups[album].push(track);     
    });     
    return groups;   
  }, [playlist]);   

  const audioRef = useRef<HTMLAudioElement | null>(null);   
  const engineRef = useRef<CarAudioEngine | null>(null);   
  const syntheticIntervalRef = useRef<any>(null);
  const [engineReady, setEngineReady] = useState(false);   
  const [currentUser, setCurrentUser] = useState<User | null>(null);   
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);   
  const [firestoreTracks, setFirestoreTracks] = useState<Track[]>([]);   
  const [firestoreVideos, setFirestoreVideos] = useState<any[]>([]);   
  const [isUploading, setIsUploading] = useState<boolean>(false);   
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);   
  const [uploadError, setUploadError] = useState<string>("");   
  const [uploadSuccess, setUploadSuccess] = useState<string>("");   
  const [accentTheme, setAccentTheme] = useState<"cyan" | "cherry" | "chrome">("cyan");   
  const [headunitTime, setHeadunitTime] = useState("13:30");   
  const [isPhoneScreenActive, setIsPhoneScreenActive] = useState(false);   
  const [dialedNumber, setDialedNumber] = useState("");   
  const [callStatus, setCallStatus] = useState("");   
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<{
    message: string;
    path?: string | null;
    operationType?: string | null;
  } | null>(null);
  const lastSavedSettingsRef = useRef<any>(null);

  const refreshLocalMedia = async () => {
    try {
      const dbTracks = await getLocalTracks();
      const songs: Track[] = dbTracks.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        genre: t.genre,
        url: (t as any).path || (t as any).url || `local-db://${t.id}`,
        imageUrl: t.imageUrl,
        albumArtUrl: t.albumArtUrl || t.imageUrl || null,
        file: t.blob ? new File([t.blob], t.name, { type: t.blob.type || "audio/mpeg" }) : undefined
      }));
      setFirestoreTracks(songs);

      const dbVideos = await getLocalVideos();
      const vids = dbVideos.map((v) => ({
        id: v.id,
        name: v.name,
        url: `local-db://${v.id}`,
        duration: v.duration,
        creator: v.creator,
        category: v.category,
        thumbnail: v.thumbnail,
        createdAt: v.createdAt
      }));
      setFirestoreVideos(vids);
      return { songs, vids };
    } catch (err) {
      console.error("Failed refreshing local media database:", err);
      return { songs: [], vids: [] };
    }
  };

  useEffect(() => {
    refreshLocalMedia();
  }, []);

  useEffect(() => {     
    const updateTime = () => {       
      const now = new Date();       
      let hours = now.getHours();       
      const minutes = String(now.getMinutes()).padStart(2, "0");       
      const ampm = hours >= 12 ? "PM" : "AM";       
      hours = hours % 12;       
      hours = hours ? hours : 12;       
      setHeadunitTime(`${hours}:${minutes} ${ampm}`);     
    };     
    updateTime();     
    const timer = setInterval(updateTime, 1000);     
    return () => clearInterval(timer);   
  }, []);

  useEffect(() => {
    const handleFirestoreErrorEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.error && (detail.error.includes("Quota exceeded") || detail.error.toLowerCase().includes("resource-exhausted"))) {
        setQuotaError({
          message: detail.error,
          path: detail.path,
          operationType: detail.operationType
        });
      }
    };
    
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (msg.includes("Quota exceeded") || msg.toLowerCase().includes("resource-exhausted")) {
        setQuotaError({
          message: msg,
          path: "unknown",
          operationType: "unknown"
        });
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      if (msg.includes("Quota exceeded") || msg.toLowerCase().includes("resource-exhausted")) {
        setQuotaError({
          message: msg,
          path: "unknown",
          operationType: "unknown"
        });
      }
    };

    window.addEventListener("firestore-error", handleFirestoreErrorEvent);
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("firestore-error", handleFirestoreErrorEvent);
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {     
    setAuthLoading(true);     
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {       
      if (user) {         
        console.log("Firebase Authenticated Session Established:", user.uid);         
        setCurrentUser(user);         
        setIsLoggedIn(true);
        setAuthLoading(false);         
        const userDocRef = doc(db, "users", user.uid);         
        const unsubscribeSettings = onSnapshot(userDocRef, (docSnap) => {           
          if (docSnap.exists()) {             
            const data = docSnap.data();             
            lastSavedSettingsRef.current = data;
            if (data.accentTheme) {               
               setAccentTheme(data.accentTheme);             
            }           
            if (typeof data.volume === "number") {
              setVolume(data.volume);
              if (audioRef.current) audioRef.current.volume = data.volume;
            }
            if (typeof data.isMuted === "boolean") {
              setIsMuted(data.isMuted);
              if (audioRef.current) audioRef.current.muted = data.isMuted;
            }
            if (data.repeatMode) {
              setRepeatMode(data.repeatMode as "none" | "one" | "all");
            }
            if (typeof data.shuffleMode === "boolean") {
              setShuffleMode(data.shuffleMode);
            }
            if (data.subscriptionTier) {
              setSubscriptionTier((user.email === "jkoehler319@gmail.com" ? "paid" : data.subscriptionTier) as "free" | "paid");
            } else if (user.email === "jkoehler319@gmail.com") {
              setSubscriptionTier("paid");
            }
            if (data.currentTrackId !== undefined) {
              setLoadedTrackId(data.currentTrackId);
            }
            if (data.selectedPresetName) {
              setSelectedPresetName(data.selectedPresetName);
            }
            if (data.customEqBands !== undefined) {
              setCustomEqBands(data.customEqBands);
            }
            if (typeof data.isMaxBass === "boolean") {
              setIsMaxBass(data.isMaxBass);
            }
            if (data.vehicleInfo) {
              setVehicleInfo(prev => {
                const merged = { ...prev, ...data.vehicleInfo };
                if (JSON.stringify(prev) === JSON.stringify(merged)) {
                  return prev;
                }
                return merged;
              });
            }
            if (data.dspSettings) {
              setDspSettings(prev => {
                const merged = { ...prev, ...data.dspSettings };
                if (JSON.stringify(prev) === JSON.stringify(merged)) {
                  return prev;
                }
                return merged;
              });
            }
          } else {             
            const initialData = {               
              uid: user.uid,               
              accentTheme: "cyan" as const,               
              lastLogin: new Date().toISOString(),
              volume: 0.85,
              isMuted: false,
              repeatMode: "all" as const,
              shuffleMode: false,
              subscriptionTier: (user.email === "jkoehler319@gmail.com" ? "paid" : "free") as "free" | "paid",
              currentTrackId: null,
              selectedPresetName: "Hip hop",
              customEqBands: null,
              isMaxBass: false,
              vehicleInfo: {
                vehicleType: "Sedan",
                subwooferConfig: "Single 12\" Sub",
                soundPreference: "SQL (Sound Quality Loud)"
              },
              dspSettings: {
                eqBands: [4, 1, 0, 2, 3],
                bassBoost: 50.0,
                reverbWet: 0.08,
                delayOffsetMs: 12,
                highPassFilterHz: 30,
                subCrossoverHz: 80,
                justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."
              }
            };
            lastSavedSettingsRef.current = initialData;
            setSubscriptionTier(user.email === "jkoehler319@gmail.com" ? "paid" : "free");
            setDoc(userDocRef, initialData, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));           
          }         
        }, (err) => {           
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);         
          // Fallback to localStorage cached user settings when Firestore is offline or quota exceeded
          try {
            const cached = localStorage.getItem("quantumplayer_user_settings");
            if (cached) {
              const data = JSON.parse(cached);
              console.log("Firestore settings subscription failed. Restored configurations from local cache:", data);
              lastSavedSettingsRef.current = data;
              if (data.accentTheme) setAccentTheme(data.accentTheme);
              if (typeof data.volume === "number") {
                setVolume(data.volume);
                if (audioRef.current) audioRef.current.volume = data.volume;
              }
              if (typeof data.isMuted === "boolean") {
                setIsMuted(data.isMuted);
                if (audioRef.current) audioRef.current.muted = data.isMuted;
              }
              if (data.repeatMode) setRepeatMode(data.repeatMode);
              if (typeof data.shuffleMode === "boolean") setShuffleMode(data.shuffleMode);
              if (data.subscriptionTier) setSubscriptionTier(data.subscriptionTier);
              if (data.currentTrackId !== undefined) setLoadedTrackId(data.currentTrackId);
              if (data.selectedPresetName) setSelectedPresetName(data.selectedPresetName);
              if (data.customEqBands !== undefined) setCustomEqBands(data.customEqBands);
              if (typeof data.isMaxBass === "boolean") setIsMaxBass(data.isMaxBass);
              if (data.vehicleInfo) setVehicleInfo(prev => ({ ...prev, ...data.vehicleInfo }));
              if (data.dspSettings) setDspSettings(prev => ({ ...prev, ...data.dspSettings }));
            } else {
              const initialData = {               
                uid: user.uid,               
                accentTheme: "cyan" as const,               
                lastLogin: new Date().toISOString(),
                volume: 0.85,
                isMuted: false,
                repeatMode: "all" as const,
                shuffleMode: false,
                subscriptionTier: (user.email === "jkoehler319@gmail.com" ? "paid" : "free") as "free" | "paid",
                currentTrackId: null,
                selectedPresetName: "Hip hop",
                customEqBands: null,
                isMaxBass: false,
                vehicleInfo: {
                  vehicleType: "Sedan",
                  subwooferConfig: "Single 12\" Sub",
                  soundPreference: "SQL (Sound Quality Loud)"
                },
                dspSettings: {
                  eqBands: [4, 1, 0, 2, 3],
                  bassBoost: 50.0,
                  reverbWet: 0.08,
                  delayOffsetMs: 12,
                  highPassFilterHz: 30,
                  subCrossoverHz: 80,
                  justification: "ElitePlayer offline settings loaded. Enjoy offline music playing!"
                }
              };
              lastSavedSettingsRef.current = initialData;
            }
          } catch (cacheErr) {
            console.error("Failed to parse cached settings during fallback:", cacheErr);
          }
        });         
        // Unconditionally refresh local media from IndexedDB
        refreshLocalMedia();

        return () => {           
          unsubscribeSettings();           
        };       
      } else {         
        setCurrentUser(null);         
        setIsLoggedIn(false);
        setFirestoreTracks([]);         
        setFirestoreVideos([]);         
        setAuthLoading(false);       
        lastSavedSettingsRef.current = null;
        setLoadedTrackId(null);
        // Reset local configurations on log out
        setAccentTheme("cyan");
        setVolume(0.85);
        if (audioRef.current) audioRef.current.volume = 0.85;
        setIsMuted(false);
        if (audioRef.current) audioRef.current.muted = false;
        setRepeatMode("all");
        setShuffleMode(false);
        setSubscriptionTier("free");
        setCurrentTrackIndex(-1);
        setSelectedPresetName("Hip hop");
        setIsMaxBass(false);
        setVehicleInfo({
          vehicleType: "Sedan",
          subwooferConfig: "Single 12\" Sub",
          soundPreference: "SQL (Sound Quality Loud)"
        });
        setDspSettings({
          eqBands: [4, 1, 0, 2, 3],
          bassBoost: 50.0,
          reverbWet: 0.08,
          delayOffsetMs: 12,
          highPassFilterHz: 30,
          subCrossoverHz: 80,
          justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."
        });
      }     
    });     
    return () => unsubscribeAuth();   
  }, []);

  useEffect(() => {     
    if (!authLoading) {
      if (!isLoggedIn) {       
        const protectedViews = ["player", "mymusic", "upgrade", "ai_enhancement", "ai_enhancement_audio", "ai_enhancement_video", "video"];
        if (protectedViews.includes(currentView)) {
          setCurrentView("auth");
        }
      } else {
        if (currentView === "auth") {
          setCurrentView("player");
        }
      }
    }   
  }, [isLoggedIn, currentView, authLoading]);   

  const handleAccentThemeChange = async (theme: "cyan" | "cherry" | "chrome") => {     
    setAccentTheme(theme);     
    if (currentUser) {       
      if (quotaError) {
        console.warn("Firestore Quota Exceeded. Skipping remote theme save, preserved locally.");
        return;
      }
      try {         
        const userDocRef = doc(db, "users", currentUser.uid);         
        await setDoc(userDocRef, {           
          accentTheme: theme,           
          updatedAt: new Date().toISOString()         
        }, { merge: true });         
        console.log("Persistent styling preference written to Firestore:", theme);       
      } catch (err) {         
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);       
      }     
    }   
  };   

  useEffect(() => {     
    setPlaylist(firestoreTracks);
  }, [firestoreTracks]);   

  useEffect(() => {
    if (currentTrackIndex === -1 && playlist.length > 0) {
      setCurrentTrackIndex(0);
    }
  }, [playlist, currentTrackIndex]);   

  const appendDialDigit = (digit: string) => {     
    if (dialedNumber.length < 15) {       
      setDialedNumber((prev) => prev + digit);     
    }   
  };   

  const clearDialedDigits = () => {     
    setDialedNumber("");     
    setCallStatus("");   
  };   

  const triggerPhoneCall = () => {     
    if (!dialedNumber) {       
      setCallStatus("ENTER DIGITS FIRST_");       
      return;     
    }     
    if (callStatus) {       
      setCallStatus("");       
      return;     
    }          
    setCallStatus("DIALING SPECIALIST STATION...");     
    setTimeout(() => {       
      setCallStatus("LINE CONNECTED: 'Yo! This is Alpine Support. You want more trunk boom and hairtrick thump? Turn on that ATOMIC BLAST! Keep the street slam loud!'");     
    }, 2000);   
  };   

  const [syntheticOsc, setSyntheticOsc] = useState<OscillatorNode | null>(null);   
  const [syntheticGain, setSyntheticGain] = useState<GainNode | null>(null);   
  const [currentSyntheticLabel, setCurrentSyntheticLabel] = useState<string>("");   

  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({     
    vehicleType: "Headphones",     
    subwooferConfig: "Standard",     
    soundPreference: "SQL (Sound Quality Loud)"   
  });   

  const [dspSettings, setDspSettings] = useState<DspSettings>({     
    eqBands: [4, 1, 0, 2, 3],     
    bassBoost: 50.0,     
    reverbWet: 0.08,     
    delayOffsetMs: 12,     
    highPassFilterHz: 30,     
    subCrossoverHz: 80,     
    justification: "ElitePlayer setup loaded. Select your vehicle cabin size, your trunk speaker box gear, and slam that AI Sound Optimization button! We'll formulate a premium street-competition DSP profile tailored specifically for your ride."   
  });   

  const [selectedPresetName, setSelectedPresetName] = useState<string>("Hip hop");   
  const [customEqBands, setCustomEqBands] = useState<number[] | null>(() => {
    try {
      const saved = localStorage.getItem("thumplayer_custom_eq_bands");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isMaxBass, setIsMaxBass] = useState<boolean>(false);   
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);   
  const [showAtomicExplosion, setShowAtomicExplosion] = useState<boolean>(false);   

  const handleSubscriptionTierChange = (tier: "free" | "paid") => {
    const forcedTier = currentUser?.email === "jkoehler319@gmail.com" ? "paid" : tier;
    setSubscriptionTier(forcedTier);
    localStorage.setItem("thumplayer_sub_tier", forcedTier);
    if (forcedTier === "paid") {
      setGlobalPremiumPrompt(""); 
      console.log("Premium plan activated - Unlocked custom presets, unlimited track uploads, and AI high-fidelity filter algorithms!");
    } else {
      console.log("Restoring Free tier limitations - checking and relocking specific features.");
      setGlobalPremiumPrompt("");
      // Reset selected preset if it was a premium one to avoid unauthorized premium state leakage
      if (BUILTIN_PRESETS.some(p => p.name === selectedPresetName && p.isPremium)) {
        const firstFreePreset = BUILTIN_PRESETS.find(p => !p.isPremium);
        if (firstFreePreset) {
          applyAudioPreset(firstFreePreset);
        }
      }
    }
  };

  const ensureEngine = () => {     
    if (!audioRef.current) return;     
    if (!engineRef.current) {       
      const e = new CarAudioEngine(audioRef.current);       
      e.init();       
      engineRef.current = e;       
      setEngineReady(true);              
      e.applyDspSettings(dspSettings);       
      e.audioElement.volume = isMuted ? 0 : volume;     
    } else {       
      engineRef.current.resume();     
    }   
  };   

  const currentTrack = useMemo(() => {     
    if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {       
      return playlist[currentTrackIndex];     
    }     
    return null;   
  }, [playlist, currentTrackIndex]);   

  useEffect(() => {     
    const audio = audioRef.current;     
    if (!audio) return;     
    const onTimeUpdate = () => {       
      setSongProgress(audio.currentTime);     
    };     
    const onLoadedMetadata = () => {       
      const dur = audio.duration || 120;
      setSongDuration(dur);     
      if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
        if (!playlist[currentTrackIndex].duration) {
          setPlaylist(prev => {
            const nextList = [...prev];
            if (nextList[currentTrackIndex]) {
              nextList[currentTrackIndex] = {
                ...nextList[currentTrackIndex],
                duration: Math.round(dur)
              };
            }
            return nextList;
          });
        }
      }
    };     
    const onEnded = () => {       
      handleNextTrack();     
    };     
    const onPause = () => {
      setIsPlaying(false);
    };
    const onPlay = () => {
      setIsPlaying(true);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);     
    audio.addEventListener("loadedmetadata", onLoadedMetadata);     
    audio.addEventListener("ended", onEnded);     
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {       
      audio.removeEventListener("timeupdate", onTimeUpdate);       
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);       
      audio.removeEventListener("ended", onEnded);     
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };   
  }, [playlist, currentTrackIndex, repeatMode, shuffleMode]);   

  // Synchronize MediaSession metadata & action handlers for background play & lockscreen support
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artist || "Unknown Artist",
        album: currentTrack.album || "Elite Player AI",
        artwork: [
          { src: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=512", sizes: "512x512", type: "image/jpeg" }
        ]
      });

      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        handlePrevTrack();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        handleNextTrack();
      });
    }
  }, [currentTrack]);

  // Automatic routing when returning to app from background
  useEffect(() => {
    const handleReturnToApp = () => {
      // If there's an active track, we are not viewing the player page, and it's not dismissed
      // Do not automatically redirect if the user is on the mymusic or video view (such as after file uploads)
      if (currentTrack && currentView !== "player" && currentView !== "mymusic" && currentView !== "video" && !isMinimizedClosed) {
        setCurrentView("player");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleReturnToApp();
      }
    };

    const handleWindowFocus = () => {
      handleReturnToApp();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [currentTrack, currentView, isMinimizedClosed]);

  // Synchronize app background status (navigating out of the app / blur / focus / call overlays)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppBackgrounded(document.visibilityState === "hidden" || !document.hasFocus());
    };
    const handleBlur = () => {
      setIsAppBackgrounded(true);
    };
    const handleFocus = () => {
      setIsAppBackgrounded(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Auto-reset dismissed state when entering full player view or starting playback
  useEffect(() => {
    if (currentView === "player") {
      setIsMinimizedClosed(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (isPlaying) {
      setIsMinimizedClosed(false);
    }
  }, [isPlaying]);   

  useEffect(() => {     
    if (audioRef.current) {       
      audioRef.current.volume = isMuted ? 0 : volume;     
    }   
  }, [volume, isMuted]);

  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];     
    if (!file) {       
      setUploadError("Please select a valid audio file.");       
      return;     
    }     

    // 1. Initial State Fire-up
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      setUploadProgress(20);
      // 2. Scan Audio Metadata on the Client Layer
      const metadata = await scanMetadata(file);
      setUploadProgress(40);

      // Determine genre based on filename
      let genre = "Bass Accent";
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

      setUploadProgress(60);
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 3. Save directly to local IndexedDB
      const localTrackRecord = {
        id: trackId,
        name: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist || "Anonymous Streamer",
        album: metadata.album || "Local Catalog Single",
        genre: genre,
        duration: 180, // Default duration
        imageUrl: metadata.imageUrl || "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80",
        albumArtUrl: metadata.albumArtUrl || null,
        createdAt: new Date().toISOString(),
        blob: file
      };

      await storeLocalTrack(localTrackRecord);
      setUploadProgress(100);

      // 4. Success Finalization Flags reset
      setUploadSuccess(`"${localTrackRecord.name}" saved to local device storage successfully!`);
      setIsUploading(false);
      setUploadProgress(null);
      setLoadedTrackId(trackId);
      setIsPlaying(false);
      stopSyntheticOsc();

      // Refresh the local tracks list in state
      await refreshLocalMedia();

      setCurrentView("mymusic");
      
      // Auto wipe notification notice after 4 seconds
      setTimeout(() => setUploadSuccess(""), 4000);
    } catch (err: any) {
      console.error("Critical tracking crash during file compilation process:", err);
      setUploadError(`Failed to save file to local IndexedDB: ${err.message || err}`);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCloudFileUpload = handleAudioFileUpload;   
  
  const handleFileUpload = async (eOrFiles: React.ChangeEvent<HTMLInputElement> | File[]) => {     
    let files: File[] = [];
    if (Array.isArray(eOrFiles)) {
      files = eOrFiles;
    } else {
      if (!eOrFiles.target.files) {
        setUploadError("Please select valid files.");
        return;
      }
      files = Array.from(eOrFiles.target.files);
    }
    if (files.length === 0) return;          
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadSuccess("");

    try {
      let successAudioCount = 0;
      let successVideoCount = 0;
      let firstUploadedTrackId: string | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith("video/");

        if (isVideo) {
          const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const videoMetadata = await scanVideoMetadata(file);

          const videoData = {
            id: videoId,
            name: videoMetadata.title || file.name,
            duration: videoMetadata.duration || "Local File",
            creator: videoMetadata.creator || "Local Creator",
            category: "Personal Video",
            thumbnail: videoMetadata.thumbnail || "", // Save empty string if no frame so fallback works
            createdAt: new Date().toISOString(),
            blob: file
          };

          await storeLocalVideo(videoData);
          if (!firstUploadedTrackId) {
            firstUploadedTrackId = videoId;
          }
          successVideoCount++;
          
          const progressVal = Math.round(((i + 1) / files.length) * 100);
          setUploadProgress(progressVal);
        } else {
          const metadata = await scanMetadata(file);

          let genre = "Bass Accent";
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

          const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const localTrackRecord = {
            id: trackId,
            name: metadata.title || file.name,
            artist: metadata.artist || "Unknown Artist",
            album: metadata.album || "Unknown Album",
            genre: genre,
            duration: 180,
            imageUrl: metadata.imageUrl || "", // empty if no artwork
            albumArtUrl: metadata.albumArtUrl || null,
            createdAt: new Date().toISOString(),
            blob: file
          };

          await storeLocalTrack(localTrackRecord);
          if (!firstUploadedTrackId) {
            firstUploadedTrackId = trackId;
          }
          successAudioCount++;

          const progressVal = Math.round(((i + 1) / files.length) * 100);
          setUploadProgress(progressVal);
        }
      }

      if (successAudioCount > 0 && successVideoCount > 0) {
        setUploadSuccess(`Saved ${successAudioCount} track(s) and ${successVideoCount} video(s) locally!`);
      } else if (successAudioCount > 0) {
        setUploadSuccess(`Successfully saved ${successAudioCount} track(s) to local device storage!`);
      } else if (successVideoCount > 0) {
        setUploadSuccess(`Successfully saved ${successVideoCount} video(s) to local device video storage!`);
      }

      setIsUploading(false);
      setUploadProgress(null);
      setIsPlaying(false);
      stopSyntheticOsc();

      // Refresh state from local media database
      const { songs, vids } = await refreshLocalMedia();

      if (successVideoCount > 0 && successAudioCount === 0) {
        setCurrentView("video");
        if (firstUploadedTrackId) {
          const targetVideo = vids.find(v => v.id === firstUploadedTrackId);
          if (targetVideo) {
            setSelectedVideo(targetVideo);
          } else if (vids.length > 0) {
            setSelectedVideo(vids[vids.length - 1]);
          }
        } else if (vids.length > 0) {
          setSelectedVideo(vids[vids.length - 1]);
        }
      } else {
        setCurrentView("player");
        if (firstUploadedTrackId) {
          setLoadedTrackId(firstUploadedTrackId);
          setPlaylist(songs);
          onPlayTrackById(firstUploadedTrackId, songs);
        }
      }

      // Auto wipe notification notice after 4 seconds
      setTimeout(() => setUploadSuccess(""), 4000);
      
    } catch (err: any) {
      console.error("Critical tracking crash during file compilation process:", err);
      setUploadError(`Failed to save files locally: ${err.message || err}`);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };   

  const loadTrackSource = async (audio: HTMLAudioElement, track: Track) => {     
    if (audio.src && audio.src.startsWith("blob:")) {       
      try {         
        URL.revokeObjectURL(audio.src);       
      } catch (err) {         
        console.warn("Failed to revoke blob URL:", err);       
      }     
    }     
    if (track.url) {       
      if (track.url.startsWith("local-db://")) {
        try {
          audio.removeAttribute("crossorigin");
          const trackId = track.url.replace("local-db://", "");
          const dbTracks = await getLocalTracks();
          const targetTrack = dbTracks.find(t => t.id === trackId);
          if (targetTrack && targetTrack.blob) {
            const blobUrl = URL.createObjectURL(targetTrack.blob);
            audio.src = blobUrl;
          } else {
            throw new Error("Track blob not found in IndexedDB.");
          }
        } catch (err) {
          console.error("Failed to load local database audio track:", err);
          setUploadError("Failed to load audio file from your local storage.");
        }
      } else if (track.url.startsWith("content://") || track.url.startsWith("file://") || track.url.startsWith("/storage")) {
        audio.removeAttribute("crossorigin");
        const nativeUrl = (window as any).Capacitor?.convertFileSrc ? (window as any).Capacitor.convertFileSrc(track.url) : track.url;
        audio.src = nativeUrl;
      } else {
        audio.crossOrigin = "anonymous";
        audio.src = track.url;     
      }
    } else if (track.file) {       
      audio.removeAttribute("crossorigin");
      audio.src = URL.createObjectURL(track.file);     
    }   
    if (track.duration) {
      setSongDuration(track.duration);
    } else {
      setSongDuration(0);
    }
  };   

  // Synchronize player with the loaded track index when database setting is loaded
  useEffect(() => {
    if (loadedTrackId && playlist.length > 0) {
      const idx = playlist.findIndex(t => t.id === loadedTrackId);
      if (idx !== -1 && idx !== currentTrackIndex) {
        setCurrentTrackIndex(idx);
        const audio = audioRef.current;
        const track = playlist[idx];
        if (audio && track) {
          if (!track.id.startsWith("sample-")) {
            loadTrackSource(audio, track);
          } else {
            setCurrentSyntheticLabel(track.name);
          }
        }
      }
    }
  }, [playlist, loadedTrackId]);

  // Reactive automatic settings syncing to the user's Firestore account
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    
    const activeTrackId = currentTrackIndex >= 0 && playlist[currentTrackIndex] ? playlist[currentTrackIndex].id : null;
    
    const currentSettings = {
      accentTheme,
      volume,
      isMuted,
      repeatMode,
      shuffleMode,
      subscriptionTier: currentUser?.email === "jkoehler319@gmail.com" ? "paid" : subscriptionTier,
      currentTrackId: activeTrackId,
      selectedPresetName,
      isMaxBass,
      vehicleInfo,
      dspSettings,
      customEqBands
    };
    
    const prev = lastSavedSettingsRef.current;
    if (!prev) {
      // Haven't loaded existing remote settings yet - ignore to prevent overwriting
      return;
    }
    
    // Deep equality comparison
    let hasChanged = false;
    const diffs: string[] = [];
    if (prev.accentTheme !== currentSettings.accentTheme) { hasChanged = true; diffs.push(`accentTheme: ${prev.accentTheme} -> ${currentSettings.accentTheme}`); }
    if (prev.volume !== currentSettings.volume) { hasChanged = true; diffs.push(`volume: ${prev.volume} -> ${currentSettings.volume}`); }
    if (prev.isMuted !== currentSettings.isMuted) { hasChanged = true; diffs.push(`isMuted: ${prev.isMuted} -> ${currentSettings.isMuted}`); }
    if (prev.repeatMode !== currentSettings.repeatMode) { hasChanged = true; diffs.push(`repeatMode: ${prev.repeatMode} -> ${currentSettings.repeatMode}`); }
    if (prev.shuffleMode !== currentSettings.shuffleMode) { hasChanged = true; diffs.push(`shuffleMode: ${prev.shuffleMode} -> ${currentSettings.shuffleMode}`); }
    if (prev.subscriptionTier !== currentSettings.subscriptionTier) { hasChanged = true; diffs.push(`subscriptionTier: ${prev.subscriptionTier} -> ${currentSettings.subscriptionTier}`); }
    if (prev.currentTrackId !== currentSettings.currentTrackId) { hasChanged = true; diffs.push(`currentTrackId: ${prev.currentTrackId} -> ${currentSettings.currentTrackId}`); }
    if (prev.selectedPresetName !== currentSettings.selectedPresetName) { hasChanged = true; diffs.push(`selectedPresetName: ${prev.selectedPresetName} -> ${currentSettings.selectedPresetName}`); }
    if (JSON.stringify(prev.customEqBands) !== JSON.stringify(currentSettings.customEqBands)) { hasChanged = true; diffs.push(`customEqBands: ${JSON.stringify(prev.customEqBands)} -> ${JSON.stringify(currentSettings.customEqBands)}`); }
    if (prev.isMaxBass !== currentSettings.isMaxBass) { hasChanged = true; diffs.push(`isMaxBass: ${prev.isMaxBass} -> ${currentSettings.isMaxBass}`); }
    if (JSON.stringify(prev.vehicleInfo) !== JSON.stringify(currentSettings.vehicleInfo)) { 
      hasChanged = true; 
      diffs.push(`vehicleInfo: ${JSON.stringify(prev.vehicleInfo)} -> ${JSON.stringify(currentSettings.vehicleInfo)}`); 
    }
    if (JSON.stringify(prev.dspSettings) !== JSON.stringify(currentSettings.dspSettings)) { 
      hasChanged = true; 
      diffs.push(`dspSettings: ${JSON.stringify(prev.dspSettings)} -> ${JSON.stringify(currentSettings.dspSettings)}`); 
    }
    
    if (hasChanged) {
      console.log("Detecting local settings drift. Diffs:", diffs);
      
      // Always save to localStorage as a robust local fallback/cache layer
      try {
        localStorage.setItem("quantumplayer_user_settings", JSON.stringify(currentSettings));
      } catch (cacheErr) {
        console.warn("Failed to write user settings cache to localStorage:", cacheErr);
      }

      // Optimistically update our comparison ref to avoid parallel execution race conditions
      lastSavedSettingsRef.current = {
        ...prev,
        ...currentSettings
      };
      
      // If Firestore database quota is exceeded, bypass the write operation completely to avoid console spam or SDK crash
      if (quotaError) {
        console.warn("Firestore Quota Exceeded. Skipping remote settings synchronization. Preferences safely saved in local storage.");
        return;
      }
      
      const userDocRef = doc(db, "users", currentUser.uid);
      setDoc(userDocRef, {
        ...currentSettings,
        uid: currentUser.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .then(() => {
          console.log("Automatically synchronized updated configurations to database.");
        })
        .catch((err) => {
          console.error("Auto configuration sync error:", err);
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
        });
    }
  }, [
    isLoggedIn,
    currentUser,
    accentTheme,
    volume,
    isMuted,
    repeatMode,
    shuffleMode,
    subscriptionTier,
    currentTrackIndex,
    playlist,
    selectedPresetName,
    customEqBands,
    isMaxBass,
    vehicleInfo,
    dspSettings
  ]);

  const handlePlayPause = () => {     
    ensureEngine();          
    if (currentTrack?.id.startsWith("sample-")) {       
      if (isPlaying) {
        stopSyntheticOsc();
        setIsPlaying(false);
      } else {
        handlePlaySynthetic(currentTrack);       
      }
      return;     
    }     
    if (!audioRef.current) return;     
    if (isPlaying) {       
      audioRef.current.pause();       
      setIsPlaying(false);     
    } else {       
      audioRef.current.play()         
        .then(() => setIsPlaying(true))         
        .catch(err => {           
          console.warn("Audio play blocked by browser sandbox gesture restriction. Retrying manually.", err);         
        });     
    }   
  };   

  const handleStop = () => {     
    stopSyntheticOsc();     
    setIsPlaying(false);     
    setSongProgress(0);     
    if (audioRef.current) {       
      audioRef.current.pause();       
      audioRef.current.currentTime = 0;     
    }   
  };   

  const handleCloseMinimized = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMinimizedClosed(true);
    handleStop();
  };   

  const handleForwardSearch = () => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress((prev) => Math.min(songDuration || 100, prev + 10));       
      return;     
    }     
    if (audioRef.current) {       
      const target = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10);       
      audioRef.current.currentTime = target;       
      setSongProgress(target);     
    }   
  };   

  const handleBackwardSearch = () => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress((prev) => Math.max(0, prev - 10));       
      return;     
    }     
    if (audioRef.current) {       
      const target = Math.max(0, audioRef.current.currentTime - 10);       
      audioRef.current.currentTime = target;       
      setSongProgress(target);     
    }   
  };

  const handleNextTrack = () => {     
    const activeQueue = playbackQueue.length > 0 ? playbackQueue : playlist;
    if (activeQueue.length === 0) return;          
    stopSyntheticOsc();     
    
    const currentTrackId = currentTrack?.id;
    let queueIdx = activeQueue.findIndex(t => t.id === currentTrackId);
    if (queueIdx === -1) {
      queueIdx = Math.max(0, currentTrackIndex);
    }
    
    let nextQueueIdx = queueIdx;     
    if (repeatMode === "one") {
      nextQueueIdx = queueIdx;
    } else if (shuffleMode) {       
      nextQueueIdx = Math.floor(Math.random() * activeQueue.length);     
    } else {       
      nextQueueIdx = queueIdx + 1;
      if (nextQueueIdx >= activeQueue.length) {
        if (repeatMode === "all") {
          nextQueueIdx = 0;
        } else {
          // repeatMode === "none": stop playback
          setIsPlaying(false);
          setSongProgress(0);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          return;
        }
      }
    }     
    
    const selection = activeQueue[nextQueueIdx];
    if (selection) {
      setLoadedTrackId(selection.id);
      const mainIdx = playlist.findIndex(t => t.id === selection.id);
      if (mainIdx !== -1) {
        setCurrentTrackIndex(mainIdx);
      }
    }
    
    setIsPlaying(false);     
    setSongProgress(0);     
    setTimeout(async () => {       
      if (selection && selection.id.startsWith("sample-")) {         
        handlePlaySynthetic(selection);       
      } else {         
        const audio = audioRef.current;         
        if (audio && selection) {           
          await loadTrackSource(audio, selection);           
          ensureEngine();           
          audio.play()             
            .then(() => setIsPlaying(true))             
            .catch(err => console.log("Auto-play next track required visual activation gesture", err));         
        }       
      }     
    }, 120);   
  };   

  const handlePrevTrack = () => {     
    const activeQueue = playbackQueue.length > 0 ? playbackQueue : playlist;
    if (activeQueue.length === 0) return;          
    stopSyntheticOsc();     
    
    const currentTrackId = currentTrack?.id;
    let queueIdx = activeQueue.findIndex(t => t.id === currentTrackId);
    if (queueIdx === -1) {
      queueIdx = Math.max(0, currentTrackIndex);
    }
    
    let prevQueueIdx = queueIdx;     
    if (repeatMode === "one") {
      prevQueueIdx = queueIdx;
    } else if (shuffleMode) {       
      prevQueueIdx = Math.floor(Math.random() * activeQueue.length);     
    } else {       
      prevQueueIdx = queueIdx - 1;
      if (prevQueueIdx < 0) {
        if (repeatMode === "all") {
          prevQueueIdx = activeQueue.length - 1;
        } else {
          prevQueueIdx = 0;
        }
      }
    }     
    
    const selection = activeQueue[prevQueueIdx];
    if (selection) {
      setLoadedTrackId(selection.id);
      const mainIdx = playlist.findIndex(t => t.id === selection.id);
      if (mainIdx !== -1) {
        setCurrentTrackIndex(mainIdx);
      }
    }
    
    setIsPlaying(false);     
    setSongProgress(0);     
    setTimeout(async () => {       
      if (selection && selection.id.startsWith("sample-")) {         
        handlePlaySynthetic(selection);       
      } else {         
        const audio = audioRef.current;         
        if (audio && selection) {           
          await loadTrackSource(audio, selection);           
          ensureEngine();           
          audio.play()             
            .then(() => setIsPlaying(true))             
            .catch(err => console.log(err));         
        }       
      }     
    }, 125);   
  };

  const handlePlaySynthetic = (trackOverride?: Track) => {     
    ensureEngine();          
    stopSyntheticOsc();          
    const engine = engineRef.current;     
    if (!engine || !engine.ctx) return;          
    engine.resume();          
    const ctx = engine.ctx;     
    const osc = ctx.createOscillator();     
    const gainNode = ctx.createGain();          
    osc.connect(gainNode);     
    if (engine.analyser) {       
      gainNode.connect(engine.analyser);     
    } else {       
      gainNode.connect(ctx.destination);     
    }     
    const selTrack = trackOverride || playlist[currentTrackIndex];     
    if (!selTrack) return;     
    setCurrentSyntheticLabel(selTrack.name);          
    if (selTrack.id === "sample-40hz") {       
      osc.type = "sine";       
      osc.frequency.value = 40;       
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);       
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);       
      osc.start();     
    } else if (selTrack.id === "sample-sweep") {       
      osc.type = "sine";       
      osc.frequency.setValueAtTime(25, ctx.currentTime);       
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 10);       
      setupSweepRefresher(osc, ctx);              
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);       
      gainNode.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.08);       
      osc.start();     
    } else if (selTrack.id === "sample-heavy") {       
      osc.type = "triangle";       
      osc.frequency.setValueAtTime(50, ctx.currentTime);       
      generateHipHopBassline(osc, gainNode, ctx);       
      osc.start();     
    }     
    setSyntheticOsc(osc);     
    setSyntheticGain(gainNode);     
    setIsPlaying(true);     
    setSongDuration(selTrack.duration);     
    setSongProgress(0);     
    const startProgressTime = Date.now();     
    const tickInterval = setInterval(() => {       
      if (!osc) {         
        clearInterval(tickInterval);         
        return;       
      }       
      const elapsed = (Date.now() - startProgressTime) / 1000;       
      if (elapsed >= selTrack.duration) {         
        clearInterval(tickInterval);         
        handleNextTrack();       
      } else {         
        setSongProgress(elapsed);       
      }     
    }, 200);   
    syntheticIntervalRef.current = tickInterval;
  };   

  const stopSyntheticOsc = () => {     
    if (syntheticIntervalRef.current) {
      clearInterval(syntheticIntervalRef.current);
      syntheticIntervalRef.current = null;
    }
    if (syntheticOsc) {       
      try {         
        syntheticOsc.stop();         
        syntheticOsc.disconnect();       
      } catch (e) {}       
      setSyntheticOsc(null);     
    }     
    if (syntheticGain) {       
      try {         
        syntheticGain.disconnect();       
      } catch (e) {}       
      setSyntheticGain(null);     
    }     
    setCurrentSyntheticLabel("");   
  };   

  const setupSweepRefresher = (osc: OscillatorNode, ctx: AudioContext) => {     
    let tick = 0;     
    const interval = setInterval(() => {       
      if (!syntheticOsc || syntheticOsc !== osc) {         
        clearInterval(interval);         
        return;       
      }       
      tick++;       
      const currentMultiplier = (tick % 2 === 0) ? 25 : 35;       
      const targetHz = (tick % 2 === 0) ? 130 : 25;              
      try {         
        osc.frequency.setValueAtTime(currentMultiplier, ctx.currentTime);         
        osc.frequency.exponentialRampToValueAtTime(targetHz, ctx.currentTime + 6);       
      } catch (e) {         
        clearInterval(interval);       
      }     
    }, 6000);   
  };   

  const generateHipHopBassline = (osc: OscillatorNode, gain: GainNode, ctx: AudioContext) => {     
    let beats = 0;     
    const beatInterval = setInterval(() => {       
      if (!syntheticOsc || syntheticOsc !== osc) {         
        clearInterval(beatInterval);         
        return;       
      }       
      beats++;       
      const time = ctx.currentTime;              
      try {         
        osc.frequency.setValueAtTime(120, time);         
        osc.frequency.exponentialRampToValueAtTime(38, time + 0.3);         
        gain.gain.setValueAtTime(0.01, time);         
        gain.gain.linearRampToValueAtTime(0.7, time + 0.05);         
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);         
        if (beats % 4 === 0) {           
          setTimeout(() => {             
            if (!syntheticOsc) return;             
            osc.frequency.setValueAtTime(45, ctx.currentTime);             
            osc.frequency.linearRampToValueAtTime(41, ctx.currentTime + 0.8);             
            gain.gain.setValueAtTime(0.01, ctx.currentTime);             
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);             
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.25);           
          }, 600);         
        }       
      } catch (e) {         
        clearInterval(beatInterval);       
      }     
    }, 1400);   
  };   

  const handleSeek = (progressSeconds: number) => {     
    if (currentTrack?.id.startsWith("sample-")) {       
      setSongProgress(progressSeconds);       
      return;     
    }     
    if (audioRef.current) {       
      audioRef.current.currentTime = progressSeconds;       
      setSongProgress(progressSeconds);     
    }   
  };   

  const deleteTrack = async (idx: number, e: React.MouseEvent) => {     
    e.stopPropagation();     
    const track = playlist[idx];     
    if (!track) return;     
    if (track.id.startsWith("sample-")) {       
      const updated = [...playlist];       
      updated.splice(idx, 1);       
      setPlaylist(updated);       
      if (currentTrackIndex === idx) {         
        stopSyntheticOsc();         
        setIsPlaying(false);         
        setCurrentTrackIndex(updated.length > 0 ? 0 : -1);       
      } else if (currentTrackIndex > idx) {         
        setCurrentTrackIndex(currentTrackIndex - 1);       
      }       
      return;     
    }     
    try {       
      await deleteDoc(doc(db, "tracks", track.id));       
      console.log("Track safely wiped from Firestore:", track.id);       
      if (currentTrackIndex === idx) {         
        stopSyntheticOsc();         
        setIsPlaying(false);         
        if (audioRef.current) audioRef.current.pause();         
        setCurrentTrackIndex(-1);       
      } else if (currentTrackIndex > idx) {         
        setCurrentTrackIndex(currentTrackIndex - 1);       
      }     
    } catch (err) {       
      handleFirestoreError(err, OperationType.DELETE, `tracks/${track.id}`);     
    }   
  };   

  const onPlayTrackById = (trackId: string, customQueue?: Track[]) => {
    const queueToUse = customQueue && customQueue.length > 0 ? customQueue : playlist;
    setPlaybackQueue(queueToUse);
    
    const idx = queueToUse.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    
    stopSyntheticOsc();
    setLoadedTrackId(trackId);
    
    const mainIdx = playlist.findIndex((t) => t.id === trackId);
    if (mainIdx !== -1) {
      setCurrentTrackIndex(mainIdx);
    }
    
    setIsPlaying(false);
    setCurrentView("player");
    setTimeout(async () => {
      const track = queueToUse[idx];
      if (track) {
        if (track.id.startsWith("sample-")) {
          handlePlaySynthetic(track);
        } else {
          const audio = audioRef.current;
          if (audio) {
            await loadTrackSource(audio, track);
            ensureEngine();
            audio.play()
              .then(() => setIsPlaying(true))
              .catch((err) => console.log(err));
          }
        }
      }
    }, 50);
  };

  const deleteSelectedTracks = async (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    const localIds = trackIds.filter(id => id.startsWith("local-"));
    const dbTrackIds = trackIds.filter(id => id.startsWith("track_"));

    for (const id of dbTrackIds) {
      try {
        await deleteLocalTrack(id);
        console.log("Deleted local IndexedDB track successfully:", id);
      } catch (err) {
        console.error("Failed deleting local track:", id, err);
      }
    }

    await refreshLocalMedia();

    setPlaylist((prev) => {
      const remaining = prev.filter(t => !localIds.includes(t.id) && !dbTrackIds.includes(t.id));
      const currentPlayingTrack = prev[currentTrackIndex];
      if (currentPlayingTrack && trackIds.includes(currentPlayingTrack.id)) {
        stopSyntheticOsc();
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
        setCurrentTrackIndex(-1);
      } else if (currentPlayingTrack) {
        const newIdx = remaining.findIndex(t => t.id === currentPlayingTrack.id);
        setCurrentTrackIndex(newIdx);
      }
      return remaining;
    });
  };   

  const deleteSelectedVideos = async (videoIds: string[]) => {
    if (videoIds.length === 0) return;
    for (const id of videoIds) {
      try {
        await deleteLocalVideo(id);
        console.log("Deleted local IndexedDB video successfully:", id);
      } catch (err) {
        console.error("Failed deleting local video:", id, err);
      }
    }
    await refreshLocalMedia();
    if (selectedVideo && videoIds.includes(selectedVideo.id)) {
      setSelectedVideo(null);
    }
  };

  const handleEqValueChange = (bandIdx: number, newGainDb: number) => {     
    setSelectedPresetName("Custom Manual Tuning");     
    const updatedBands = [...dspSettings.eqBands];     
    updatedBands[bandIdx] = newGainDb;          
    const updatedSettings = {       
      ...dspSettings,       
      eqBands: updatedBands     
    };          
    setDspSettings(updatedSettings);          
    if (engineRef.current) {       
      engineRef.current.setEqBand(bandIdx, newGainDb);     
    }   
  };   

  const handleBassKnobChange = (newLevel: number) => {     
    setSelectedPresetName("Custom Manual Tuning");     
    setIsMaxBass(newLevel >= 100);          
    const updatedSettings = {       
      ...dspSettings,       
      bassBoost: newLevel     
    };     
    setDspSettings(updatedSettings);     
    if (engineRef.current) {       
      engineRef.current.setBassBoost(newLevel);     
    }   
  };   

  const toggleMaxBass = () => {     
    ensureEngine();          
    if (isMaxBass) {       
      setIsMaxBass(false);       
      handleBassKnobChange(50.0);     
    } else {       
      setIsMaxBass(true);       
      handleBassKnobChange(100.0);       
      setShowAtomicExplosion(true);              
      if (typeof window !== "undefined" && window.navigator && typeof window.navigator.vibrate === "function") {         
        window.navigator.vibrate([150, 50, 300, 50, 400, 50, 500, 50, 450]);       
      }       
      setTimeout(() => {         
        setShowAtomicExplosion(false);       
      }, 2200);              
      const updatedBands = [...dspSettings.eqBands];       
      updatedBands[0] = 12;              
      const updatedSettings = {         
        ...dspSettings,         
        eqBands: updatedBands,         
        bassBoost: 100.0       
      };       
      setDspSettings(updatedSettings);              
      if (engineRef.current) {         
        engineRef.current.setEqBand(0, 12);         
        engineRef.current.setBassBoost(100.0);       
      }     
    }   
  };   

  const applyAudioPreset = (preset: Preset) => {     
    if (preset.isPremium && subscriptionTier !== "paid") {
      setGlobalPremiumPrompt(`The custom EQ Preset '${preset.name}' is a premium feature. Upgrade to unlock high-fidelity sound-engineering presets!`);
      setCurrentView("upgrade");
      return;
    }
    ensureEngine();     
    setSelectedPresetName(preset.name);     
    setIsMaxBass(preset.bassBoost >= 95);     
    const targetBands = preset.name === "Custom" ? (customEqBands || [0, 0, 0, 0, 0]) : preset.eqBands;
    const updatedSettings = {       
      ...dspSettings,       
      eqBands: [...targetBands],       
      bassBoost: preset.bassBoost,       
      reverbWet: preset.reverbWet,       
      delayOffsetMs: preset.delayOffsetMs     
    };     
    setDspSettings(updatedSettings);     
    if (engineRef.current) {       
      engineRef.current.applyDspSettings(updatedSettings);     
    }   
  };   

  const resetAllFlat = () => {     
    applyAudioPreset(BUILTIN_PRESETS[0]);   
  };   

  const handleSaveCustomPreset = async () => {
    const bandsToSave = [...dspSettings.eqBands];
    setCustomEqBands(bandsToSave);
    try {
      localStorage.setItem("thumplayer_custom_eq_bands", JSON.stringify(bandsToSave));
    } catch (e) {
      console.warn("localStorage quota exceeded or blocked:", e);
    }
    
    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
          customEqBands: bandsToSave,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("Custom EQ preset saved to Firestore:", bandsToSave);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleResetCustomPreset = async () => {
    setCustomEqBands(null);
    try {
      localStorage.removeItem("thumplayer_custom_eq_bands");
    } catch (e) {
      console.warn("localStorage block:", e);
    }
    
    // Reset eqBands to default flat levels: [0, 0, 0, 0, 0]
    const updatedSettings = {
      ...dspSettings,
      eqBands: [0, 0, 0, 0, 0]
    };
    setDspSettings(updatedSettings);
    if (engineRef.current) {
      engineRef.current.applyDspSettings(updatedSettings);
    }
    setSelectedPresetName("Custom");

    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
          customEqBands: null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("Custom EQ preset reset in Firestore");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleAiOptimize = async (easyModeSetting?: boolean, customCarModel?: string) => {     
    if (subscriptionTier !== "paid") {
      setGlobalPremiumPrompt("AI Audio Frequency Optimization & Spatial Acoustic Calibration is a premium feature. Upgrade to achieve maximum acoustic clarity and remaster your studio files!");
      setCurrentView("upgrade");
      return;
    }
    ensureEngine();     
    setIsOptimizing(true);          
    try {       
      const activeName = currentTrack ? currentTrack.name : "Cabin Test Beat";       
      const activeGenre = currentTrack ? currentTrack.genre : "Dynamic Acoustic";       
      let friendlySoundPref = vehicleInfo.soundPreference;
      if (vehicleInfo.soundPreference === "Balanced") friendlySoundPref = "High Clarity & Detail";
      else if (vehicleInfo.soundPreference === "SQL (Sound Quality Loud)") friendlySoundPref = "Rich, Warm & Energetic";
      else if (vehicleInfo.soundPreference === "SPL (Maximum Bass Head)") friendlySoundPref = "Deep Bass Thump";
      else if (vehicleInfo.soundPreference === "Vocal-centric") friendlySoundPref = "Crisp Vocals & Clear Melodies";

      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : "";

      const response = await fetch("/api/optimize", {         
        method: "POST",         
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(user?.uid ? { "x-user-uid": user.uid } : {})
        },         
        body: JSON.stringify({           
          songTitle: activeName,           
          genre: activeGenre,           
          vehicleType: vehicleInfo.vehicleType,           
          subwooferConfig: vehicleInfo.subwooferConfig,           
          soundPreference: friendlySoundPref,
          environmentMode: vehicleInfo.vehicleType,
          userEquipment: vehicleInfo.subwooferConfig,
          easyMode: easyModeSetting || false,
          carYearMakeModel: customCarModel || ""
        })       });       
      if (!response.ok) throw new Error("DSP Optimization query failed from server API");       
      const optimalSettings: DspSettings & { success: boolean, isFallback?: boolean } = await response.json();              
      if (optimalSettings.success) {         
        const scaledBassBoost = (optimalSettings.bassBoost || 0) * 10;         
        const finalSettings = {           
          eqBands: optimalSettings.eqBands,           
          bassBoost: scaledBassBoost,           
          reverbWet: optimalSettings.reverbWet,           
          delayOffsetMs: optimalSettings.delayOffsetMs,           
          highPassFilterHz: optimalSettings.highPassFilterHz,           
          subCrossoverHz: optimalSettings.subCrossoverHz,           
          justification: optimalSettings.justification         
        };         
        setDspSettings(finalSettings);         
        setSelectedPresetName(easyModeSetting ? "AI Easy Calibrated Profile" : "AI Optimized DSP Profile");         
        setIsMaxBass(scaledBassBoost >= 95);         
        if (engineRef.current) {           
          engineRef.current.applyDspSettings(finalSettings);         
        }       
      }     
    } catch (err) {       
      console.error("AI DSP Optimization error: ", err);     
    } finally {       
      setIsOptimizing(false);     
    }   
  };   

  const formatTime = (secs: number) => {     
    const m = Math.floor(secs / 60);     
    const s = Math.floor(secs % 60);     
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;   
  };   

  useEffect(() => {     
    return () => {       
      stopSyntheticOsc();     
    };   
  }, []);   

  const glassShards = useMemo(() => {     
    const count = 75;     
    const clipPaths = [       
      "polygon(10% 0%, 100% 20%, 80% 90%, 0% 70%)",       
      "polygon(50% 0%, 100% 100%, 0% 80%)",       
      "polygon(0% 15%, 90% 0%, 100% 85%, 15% 100%)",       
      "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",       
      "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      "polygon(30% 0%, 100% 30%, 70% 100%, 0% 80%)",
      "polygon(0% 0%, 90% 10%, 100% 90%, 10% 100%)"
    ];     
    return Array.from({ length: count }).map((_, i) => {       
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);       
      const distPercent = i % 3 === 0 ? 0.25 : i % 3 === 1 ? 0.55 : 0.85;       
      const distance = (120 + Math.random() * 520) * (distPercent + 0.35);       
      const tx = Math.cos(angle) * distance;       
      const ty = Math.sin(angle) * distance;       
      const rotX = Math.floor(Math.random() * 720 - 360);        
      const rotY = Math.floor(Math.random() * 720 - 360);        
      const rotZ = Math.floor(Math.random() * 720 - 360);        
      const width = Math.floor(Math.random() * 22 + 8);       
      const height = Math.floor(Math.random() * 32 + 10);       
      const delay = (Math.random() * 0.12).toFixed(3);       
      const clipPath = clipPaths[i % clipPaths.length];       
      return {         
        id: i,         
        width: `${width}px`,         
        height: `${height}px`,         
        clipPath,         
        delay: `${delay}s`,         
        tx: `${tx}px`,         
        ty: `${ty}px`,         
        rotX: `${rotX}deg`,
        rotY: `${rotY}deg`,
        rotZ: `${rotZ}deg`
      };     
    });   
  }, [showAtomicExplosion]);   

  return (     
    <div id="app-container" className={`min-h-screen candy-paint-body text-slate-100 flex flex-col font-sans select-none overflow-x-hidden ${showAtomicExplosion ? "glass-shaking" : ""}`}>              
      {/* Global Backdrop Overlay when dropdown is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 z-[1000] backdrop-blur-xs"
          />
        )}
      </AnimatePresence>

      {/* Global Dropdown Menu in the upper left hand corner of all pages */}
      <div id="global-menu-container" className="fixed top-5 left-5 z-[1101] select-none">
        <button
          id="global-menu-btn"
          onClick={toggleMenu}
          className={`p-3.5 px-4.5 rounded-2xl border-2 flex items-center justify-center transition-all duration-150 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.65)] ${
            isOpen
              ? "bg-white/10 border-white text-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              : "bg-[#020512]/95 border-slate-800 text-slate-300 hover:text-white hover:border-slate-500 hover:scale-105"
          }`}
          title="Open Menu"
        >
          {isOpen ? <X className="w-5 h-5 animate-pulse" /> : <Menu className="w-5 h-5" />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                background: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 15%, #e5e7eb 40%, #d1d5db 65%, #f3f4f6 85%, #9ca3af 100%)"
              }}
              className="absolute left-0 mt-4 w-80 rounded-3xl border-2 border-stone-400 shadow-[0_25px_60px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(255,255,255,0.95)] overflow-hidden flex flex-col gap-1.5 p-4 z-[1102]"
            >
              {/* Logo at the top - scaled up */}
              <div className="flex flex-col items-center justify-center py-5 border-b border-black/10 mb-2 px-4 bg-black/5 rounded-t-2xl gap-2.5">
                <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover shadow-[0_4px_12px_rgba(0,0,0,0.15)] mb-1" />
                <span className="text-lg font-sans font-extrabold tracking-[0.2em] text-stone-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)] select-none text-center">QUANTUMPLAYERAI</span>
                {currentUser?.email === "jkoehler319@gmail.com" && (
                  <div className="flex flex-col items-center gap-1 bg-amber-500/15 border border-amber-600/30 p-2.5 rounded-2xl w-full text-center shadow-[0_0_10px_rgba(0,0,0,0.05)]">
                     <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-800">ADMINISTRATOR PROFILE</span>
                     <span className="text-[8.5px] font-sans text-stone-800 font-light lowercase">{currentUser.email}</span>
                     <span className="text-[8px] font-sans font-bold uppercase tracking-wider text-emerald-700 mt-0.5">UNLIMITED ELITE TIER ACTIVE</span>
                  </div>
                )}
              </div>
              {/* Options - larger fonts, increased spacing */}
              {/* Audio Player */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("player");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "player"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                Audio Player
              </button>

              {/* My music */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("mymusic");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "mymusic"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-[#eaeaea] hover:text-black hover:pl-5"
                }`}
              >
                My music
              </button>

              {/* AI Audio Enhancement and Optimization Option */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("ai_enhancement_audio");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "ai_enhancement_audio"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                Ai audio enhancement and optimizer
              </button>

              {/* 4k Video Player */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("video");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "video"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                4k Video Player
              </button>

              {/* My videos */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("myvideos");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "myvideos"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                My videos
              </button>

              {/* AI Video Enhancement and Optimization Option */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("ai_enhancement_video");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "ai_enhancement_video"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                Ai video enhancement and optimizer
              </button>

              {/* Upgrade */}
              <button
                onClick={() => {
                  if (isLoggedIn) {
                    setCurrentView("upgrade");
                  } else {
                    setCurrentView("auth");
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 border border-transparent cursor-pointer ${
                  currentView === "upgrade"
                    ? "bg-black/10 border-2 border-stone-800 text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)] font-bold"
                    : "text-stone-800 hover:bg-black/5 hover:text-black hover:pl-5"
                }`}
              >
                Upgrade
              </button>

              <div className="border-t border-black/10 my-1 mx-1" />
              
              <button
                onClick={async () => {
                  if (isLoggedIn) {
                    try {
                      await signOut(auth);
                    } catch (err) {
                      console.error("Error signing out:", err);
                    }
                  }
                  setIsOpen(false);
                  setCurrentView("landing");
                }}
                className="w-full text-left font-sans font-semibold uppercase tracking-widest text-[11px] sm:text-[12px] px-4 py-2 rounded-xl transition-all duration-100 text-red-700 hover:bg-red-500/10 border border-transparent cursor-pointer hover:pl-5 font-bold"
              >
                Log Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showAtomicExplosion && (         
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">           
          {/* Subtle ice blue glare flash */}
          <div className="absolute inset-0 bg-sky-200/20 mix-blend-overlay animate-pulse" style={{ animationDuration: '0.4s' }} />           
          
          {/* SVG Animated glass crack web pattern */}
          <div className="absolute inset-0 w-full h-full animate-glass-crack flex items-center justify-center">
            <svg 
              className="w-full h-full text-white/95 drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] stroke-white" 
              viewBox="0 0 1000 1000" 
              preserveAspectRatio="none"
              style={{ strokeWidth: '1.2px', strokeLinecap: 'round', fill: 'none' }}
            >
              {/* Main radial fracture rays starting from screen center (500,500) */}
              <path d="M500,500 L120,80 L220,150 L50,450 L100,550 L180,820 L400,950 L520,980 L880,900 L950,550 L920,400 L850,150 L750,50 Z" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.5" />
              <path d="M500,500 L150,100" />
              <path d="M500,500 L80,320" />
              <path d="M500,500 L50,580" />
              <path d="M500,500 L250,880" />
              <path d="M500,500 L550,950" />
              <path d="M500,500 L820,820" />
              <path d="M500,500 L950,480" />
              <path d="M500,500 L900,220" />
              <path d="M500,500 L620,80" />
              <path d="M500,500 L380,50" />

              {/* Sub-branch fractures */}
              <path d="M325,300 L200,220 L110,250" />
              <path d="M290,410 L180,420 L70,390" />
              <path d="M275,540 L190,620 L80,680" />
              <path d="M375,690 L300,820 L220,900" />
              <path d="M525,725 L620,880 L680,950" />
              <path d="M660,660 L800,750 L910,810" />
              <path d="M725,490 L850,510 L980,490" />
              <path d="M680,310 L820,280 L950,220" />
              <path d="M560,290 L680,180 L740,90" />
              
              {/* Concentric fracture rings */}
              <path d="M470,500 A30,30 0 0,1 530,500 A30,30 0 0,1 470,500 Z" />
              <path d="M420,500 A80,80 0 0,1 580,500 A80,80 0 0,1 420,500 Z" strokeWidth="0.8" />
              <path d="M350,500 A150,150 0 0,1 650,500 A150,150 0 0,1 350,500 Z" strokeWidth="0.6" strokeDasharray="15,10,30,10" />
              <path d="M250,500 A250,250 0 0,1 750,500 A250,250 0 0,1 250,500 Z" strokeWidth="0.4" strokeDasharray="40,15,10,20" />
              <path d="M120,500 A380,380 0 0,1 880,500 A380,380 0 0,1 120,500 Z" strokeWidth="0.3" strokeDasharray="10,25" />
            </svg>
          </div>

          <div className="absolute top-1/2 left-1/2 w-0 h-0">             
            {glassShards.map((shard) => (               
              <div                 
                key={shard.id}                 
                className="glass-shard-premium"                 
                style={{                   
                  width: shard.width,                   
                  height: shard.height,                   
                  clipPath: shard.clipPath,                   
                  animationDelay: shard.delay,                   
                  "--tx": shard.tx,                   
                  "--ty": shard.ty,                   
                  "--rotX": shard.rotX,                 
                  "--rotY": shard.rotY,                 
                  "--rotZ": shard.rotZ,                 
                } as React.CSSProperties}               
              />             
            ))}           
          </div>                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent">             
            <div className="text-center p-6 bg-stone-950/95 border-2 border-white/40 rounded-2xl shadow-[0_0_60px_rgba(255,255,255,0.25)] transform scale-110 duration-200 backdrop-blur-md">               
              <span className="text-[10px] font-sans font-semibold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.65)] uppercase tracking-[0.25em] block mb-1">                   
                CABIN PRESSURE RESISTANCE BREACHED
              </span>               
              <h2 className="text-2xl font-sans font-medium text-white uppercase tracking-wider animate-pulse">                 
                💥 GLASS SHATTERED!               
              </h2>               
              <span className="text-[10px] font-sans text-stone-300 block mt-2 uppercase font-medium tracking-widest">                 
                100% MAXIMUM BASS IMPACT ENGAGED               
              </span>             
            </div>           
          </div>         
        </div>       
      )}       <audio ref={audioRef} className="hidden" />       

      <div className="flex items-center justify-center gap-2 mt-4 mb-2">
        <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded object-cover shadow-[0_0_6px_rgba(255,255,255,0.2)]" />
        <span className="text-base font-sans font-semibold tracking-[0.25em] text-white select-none block drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">QUANTUMPLAYERAI</span>
      </div>

      {quotaError && (
        <div className="w-full max-w-xl mx-auto px-4 mt-2 mb-4 relative z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 shadow-lg text-left relative overflow-hidden backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-sans font-bold text-red-400 uppercase tracking-wider">
                  Firestore Quota Exceeded (Daily Limit Reached)
                </h4>
                <p className="text-[11px] text-slate-300 font-light mt-1 leading-relaxed">
                  Your Firestore database has exceeded its daily free-tier usage quota. This quota resets daily. In the meantime, the application is automatically falling back to fully functional local storage (IndexedDB) so you can continue playing and customizing your tracks without interruption.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="https://console.firebase.google.com/project/eliteplayerai/firestore/databases/ai-studio-121a998e-f48a-4fe6-99da-b27a251b5324/data?openUpgradeDialog=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Open Firebase Console
                  </a>
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider border border-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Firestore Pricing & Quotas
                  </a>
                  <button
                    onClick={() => setQuotaError(null)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider border border-white/5 transition-all cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {authLoading ? (
        <div id="auth-loading-screen" className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-center items-center min-h-screen relative z-30">
          <div className="text-center p-8 bg-stone-950/95 border-2 border-white/40 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.18)] max-w-sm w-full mx-auto select-none backdrop-blur-md">
            <div className="flex flex-col items-center justify-center gap-3 mb-6 animate-pulse">
              <img src="/logo.png" alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-pulse" />
              <span className="text-base font-sans font-semibold tracking-[0.25em] text-white select-none">QUANTUMPLAYERAI</span>
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-4 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-[10px] font-sans font-semibold text-white uppercase tracking-widest">
                VERIFYING SECURE SESSION
              </span>
            </div>
            
            <p className="text-[10px] font-sans text-slate-400 uppercase mt-1 leading-relaxed tracking-wider font-light">
              Establishing digital handshake...
            </p>
          </div>
        </div>
      ) : (!isLoggedIn && (currentView === "auth" || (currentView !== "landing" && currentView !== "privacy" && currentView !== "agreement"))) ? (
        <AuthView auth={auth} onSuccess={() => { setIsLoggedIn(true); setCurrentView("player"); }} onBack={() => { setCurrentView("landing"); }} />
      ) : (
        <>
          {currentView === "landing" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-between items-center relative min-h-screen">                      
          <div className="my-auto flex flex-col items-center justify-center text-center w-full max-w-md py-6">                          
            <div className="relative w-full max-w-[320px] mx-auto mb-8 overflow-hidden group rounded-3xl">               
              <img 
                src="/logo.png" 
                alt="QUANTUMPLAYERAI Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-auto aspect-square rounded-3xl object-cover transition-transform duration-500 group-hover:scale-105 shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
              />
            </div>             
            <h1 className="text-base md:text-lg font-semibold font-sans tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 uppercase leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] px-2 text-center">               
              Ai Powered Video and Music Player             
            </h1>             
            <p className="mt-6 text-[12px] font-sans font-light text-slate-300 leading-relaxed bg-slate-950/65 p-6 rounded-2xl border border-slate-900 shadow-xl text-center tracking-wide max-w-md">
              Experience your music and videos like never before. Powered by advanced Gemini AI, QuantumPlayerAI instantly remasters your uploads, delivering ultra-crisp video upscaling and studio-grade audio optimization in real time. Take total control of your soundstage with a precision 5-band equalizer and tailored audio profiles optimized specifically for car audio, headphones, home audio, and immersive surround sound environments. Upload your files and let Gemini power your playback today.
            </p>             
            <button               
              onClick={() => {                 
                if (currentUser) setCurrentView("player");                 
                else setCurrentView("auth");               
              }}               
              className="mt-8 px-6 py-3 rounded-xl font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer select-none bg-gradient-to-r from-slate-200/20 via-white/10 to-slate-400/25 border-2 border-slate-450 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:from-white hover:via-slate-100 hover:to-slate-300 hover:text-stone-950 hover:border-white hover:shadow-[0_0_30px_rgba(255,255,255,0.45)] active:scale-95 duration-100 transition-all flex items-center gap-2"             
            >               
              {currentUser ? "Enter App" : "Log In"}             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-center gap-3 text-[10px] font-sans text-slate-400 uppercase tracking-widest pb-2">             
            <span className="opacity-60 text-[9px] tracking-wider">  2026 Studio Player</span>             
            <span className="hidden sm:inline text-slate-800">|</span>             
            <div className="flex gap-4">               
              <button onClick={() => setCurrentView("privacy")} className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4">                 
                Privacy Policy               
              </button>               
              <button onClick={() => setCurrentView("agreement")} className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4">                 
                User Agreements               
              </button>             
            </div>           
          </footer>         
        </div>       
      )}       
      {currentView === "privacy" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col min-h-screen justify-between relative">                      
          <div className="my-auto max-w-md mx-auto w-full flex flex-col gap-5 py-6">             
            <div className="flex items-center gap-3 border-b border-slate-850 pb-3">               
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">                 
                <Info className="w-4.5 h-4.5" />               
              </div>               
              <div>                 
                <h1 className="text-sm font-semibold font-sans tracking-widest text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] uppercase">                   
                  Privacy Policy                 
                </h1>                 
                <p className="text-[8px] font-sans text-slate-500 uppercase tracking-wider mt-0.5">Placeholder Host: https://quantumplayer.ai/privacy-policy</p>               
              </div>             
            </div>             
            <div className="text-xs font-sans text-slate-300/90 leading-relaxed bg-slate-950/75 border border-slate-900 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-y-auto max-h-[350px] font-light">               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">1. SECURE LOCAL AUDIO DATA HANDSHAKES</p>               
              <p>QUANTUMPLAYERAI respects your personal audio content. All loaded MP3, WAV or track collections are handled entirely client-side using the local browser Web Audio API environment or cached securely using high-speed IndexedDB and LocalStorage wrappers.</p>               
              <p>We do not transfer, harvest, or index your original music audio byte data to any unauthorized external databases.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">2. ANONYMOUS HANDSHAKE TRACKING</p>               
              <p>When synced to Cloud Storage catalog, persistent metadata pointers (such as track filename, length, upload timestamps) are saved in a sandboxed, anonymous Firestore directory matching your temporary profile credential key.</p>               
              <p>This ensures that your playlist catalog stays fully synchronized without requiring any confidential tracking telemetry.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">3. THIRD-PARTY DISCLOSURES & INTEGRATION</p>               
              <p>Our services do not deploy any hidden analytical cookies, tracker pixels, or secondary telemetry systems. The workspace runs inside an isolated container with zero secondary data harvesting policies.</p>             
            </div>             
            <button               
              onClick={() => setCurrentView("landing")}               
              className="mt-4 px-6 py-2.5 rounded-xl font-sans text-[10px] font-semibold tracking-widest text-center uppercase cursor-pointer select-none bg-slate-900 border border-slate-800 hover:border-slate-500 text-slate-300 hover:text-white transition-all transform hover:scale-102 active:scale-95 animate-none"             
            >                 
              Return to Home View             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 text-[9px] font-sans text-slate-500 uppercase tracking-widest">             
            Placeholder Host Domain: https://quantumplayer.ai           
          </footer>         
        </div>       
      )}       
      {currentView === "agreement" && (         
        <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col min-h-screen justify-between relative">                      
          <div className="my-auto max-w-md mx-auto w-full flex flex-col gap-5 py-6">             
            <div className="flex items-center gap-3 border-b border-slate-850 pb-3">               
              <div className="p-2 rounded-xl bg-orange-650/15 text-orange-400 border border-orange-500/30">                 
                <AlertTriangle className="w-4.5 h-4.5" />               
              </div>               
              <div>                 
                <h1 className="text-sm font-semibold font-sans tracking-widest text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] uppercase">                   
                  User Agreements                 
                </h1>                 
                <p className="text-[8px] font-sans text-slate-500 uppercase tracking-wider mt-0.5">Placeholder Host: https://quantumplayer.ai/user-agreement</p>               
              </div>             
            </div>             
            <div className="text-xs font-sans text-slate-300/90 leading-relaxed bg-[#020512]/90 border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-y-auto max-h-[350px] font-light">               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">1. INTENT OF APP USE</p>               
              <p>By booting the QUANTUMPLAYERAI digital sound processing (DSP) environment, you acquire a non-transferable runtime access license to optimize local and synchronized audio files inside your container.</p>               
              <p className="font-semibold text-red-400 text-xs border-b border-slate-850 pb-1">2. SUBWOOFER CLIPPING & COMP BASS WARNING</p>               
              <p className="text-red-350">QUANTUMPLAYERAI CONTAINS HIGH-GAIN ANALOG-EMULATED BASS BOOST GAIN CONTROLS & AN ATOMIC MAX BASS SHOCKWAVE SWITCH capable of severe SPL output swings. BY AGREEMENT, USER TAKES FULL RESPONSIBILITY FOR SOUND INTENSITY AND SPEAKER RIG HARDWARE DAMAGE FROM OVER-EXCURSION OR CLIPPING.</p>               
              <p className="font-semibold text-white text-xs border-b border-slate-800 pb-1">3. CLOUD DEPLOYMENTS & DOMAIN HANDSHAKES</p>               
              <p>All domain handshakes, local port mappings, and external proxies configured on custom server points are operated under strict local sandbox policies. QUANTUMPLAYERAI delivers services "as-is" without secondary liabilities.</p>             
            </div>             
            <button               
              onClick={() => setCurrentView("landing")}               
              className="mt-4 px-6 py-2.5 rounded-xl font-sans text-[10px] font-semibold tracking-widest text-center uppercase cursor-pointer select-none bg-slate-900 border border-slate-800 hover:border-slate-500 text-slate-300 hover:text-white transition-all transform hover:scale-102 active:scale-95 animate-none"             
            >                 
              Return to Home View             
            </button>           
          </div>           
          <footer className="w-full text-center mt-auto pt-6 text-[9px] font-sans text-slate-500 uppercase tracking-widest">             
            Placeholder Host Domain: https://quantumplayer.ai           
          </footer>         
        </div>       
      )}       
          {(currentView === "player" || currentView === "mymusic" || currentView === "myvideos" || currentView === "upgrade" || currentView === "ai_enhancement" || currentView === "ai_enhancement_audio" || currentView === "ai_enhancement_video" || currentView === "video") && (         
        <>           
          <main id="main-workbench" className="flex-1 w-full mx-auto px-4 py-6 flex flex-col gap-6 items-stretch max-w-xl">                          
            {currentView === "player" && (
              <>
                <DoubleDinPlayer               
                  currentTrack={currentTrack}               
                  isPlaying={isPlaying}               
                  songProgress={songProgress}               
                  songDuration={songDuration}               
                  volume={volume}               
                  shuffleMode={shuffleMode}               
                  onPlayPause={handlePlayPause}               
                  onStop={handleStop}               
                  onPrev={handlePrevTrack}               
                  onNext={handleNextTrack}               
                  onSeek={handleSeek}               
                  onVolumeChange={setVolume}               
                  onToggleShuffle={() => setShuffleMode(!shuffleMode)}               
                  headunitTime={headunitTime}               
                  isMaxBass={isMaxBass}               
                  onToggleMaxBass={toggleMaxBass}             
                />             

                <section className="flex flex-col gap-6">                              
                  <div className="bg-slate-950/20 p-5 rounded-2xl flex flex-col items-center relative overflow-hidden">                 
                    <div className="absolute top-0 right-0 p-1 bg-red-650 font-sans text-[7px] text-white font-semibold uppercase tracking-widest leading-none rotate-45 translate-x-3.5 translate-y-1 z-10 w-20 text-center select-none shadow animate-pulse">                   
                      WARNING                 
                    </div>                 
                    <h3 className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#cbd5e1] mb-6 flex items-center gap-1.5 z-10 chrome-text">                   
                      <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />                   
                      Slammer Bass Booster                 
                    </h3>                 
                    <BassKnob value={dspSettings.bassBoost} onChange={handleBassKnobChange} />               
                  </div>               
                  <EqSliders                 
                    gains={dspSettings.eqBands}                 
                    onChange={handleEqValueChange}                 
                    onReset={resetAllFlat}                 
                    presets={BUILTIN_PRESETS}                 
                    selectedPresetName={selectedPresetName}                 
                    onPresetSelect={applyAudioPreset}               
                    isPremiumActive={subscriptionTier === "paid"}
                  />             
                </section>             
              </>
            )}

            {currentView === "mymusic" && (
              <MyMusicView
                playlist={playlist}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                currentUser={currentUser}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                handleFileUpload={handleFileUpload}
                deleteSelectedTracks={deleteSelectedTracks}
                onPlayTrackById={onPlayTrackById}
                setUploadError={setUploadError}
                setUploadSuccess={setUploadSuccess}
                refreshLocalMedia={refreshLocalMedia}
              />
            )}

            {currentView === "myvideos" && (
              <MyVideosView
                videos={firestoreVideos}
                selectedVideo={selectedVideo}
                currentUser={currentUser}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                handleFileUpload={handleFileUpload}
                deleteSelectedVideos={deleteSelectedVideos}
                onPlayVideo={(video) => {
                  setSelectedVideo(video);
                  setCurrentView("video");
                }}
                setUploadError={setUploadError}
                setUploadSuccess={setUploadSuccess}
                refreshLocalMedia={refreshLocalMedia}
              />
            )}

            {currentView === "upgrade" && (
              <UpgradeView 
                onBackToPlayer={() => {
                  setCurrentView("player");
                  setGlobalPremiumPrompt("");
                }} 
                subscriptionTier={subscriptionTier}
                onChangeSubscriptionTier={handleSubscriptionTierChange}
                globalPremiumPrompt={globalPremiumPrompt}
              />
            )}

            {currentView === "ai_enhancement_audio" && (
              <AiEnhancementView
                vehicleInfo={vehicleInfo}
                setVehicleInfo={setVehicleInfo}
                dspSettings={dspSettings}
                handleAiOptimize={handleAiOptimize}
                isOptimizing={isOptimizing}
                subscriptionTier={subscriptionTier}
                onBackToPlayer={() => {
                  setCurrentView("player");
                }}
              />
            )}

            {currentView === "ai_enhancement_video" && (
              <AiVideoEnhancementView
                subscriptionTier={subscriptionTier}
                onBackToPlayer={() => {
                  setCurrentView("video");
                }}
                firestoreVideos={firestoreVideos}
                selectedVideo={selectedVideo}
                setSelectedVideo={setSelectedVideo}
                activeModel={activeModel}
                setActiveModel={setActiveModel}
                upscaleTarget={upscaleTarget}
                setUpscaleTarget={setUpscaleTarget}
                colorEnhancement={colorEnhancement}
                setColorEnhancement={setColorEnhancement}
                smoothMotion={smoothMotion}
                setSmoothMotion={setSmoothMotion}
                turboMode={turboMode}
                setTurboMode={setTurboMode}
                aiOptimizedFilters={aiOptimizedFilters}
                setAiOptimizedFilters={setAiOptimizedFilters}
              />
            )}

            {currentView === "video" && (
              <VideoView
                subscriptionTier={subscriptionTier}
                headunitTime={headunitTime}
                onBackToPlayer={() => {
                  setCurrentView("player");
                }}
                currentUser={currentUser}
                firestoreVideos={firestoreVideos}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                onUploadVideos={handleFileUpload}
                onRefreshVideos={refreshLocalMedia}
                selectedVideo={selectedVideo}
                setSelectedVideo={setSelectedVideo}
                activeModel={activeModel}
                setActiveModel={setActiveModel}
                upscaleTarget={upscaleTarget}
                setUpscaleTarget={setUpscaleTarget}
                colorEnhancement={colorEnhancement}
                setColorEnhancement={setColorEnhancement}
                smoothMotion={smoothMotion}
                setSmoothMotion={setSmoothMotion}
                turboMode={turboMode}
                setTurboMode={setTurboMode}
                aiOptimizedFilters={aiOptimizedFilters}
                setAiOptimizedFilters={setAiOptimizedFilters}
              />
            )}
          </main>         
        </>       
      )}     
        </>
      )}

      {/* Persistent Floating Minimized Music Player */}
      {isAppBackgrounded && isPlaying && currentTrack && !isMinimizedClosed && (
        <div 
          id="minimized-persistent-dock"
          className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-xl z-[2000] bg-[#070b19]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Clickable Area to Return to Full Player */}
            <div 
              id="minimized-track-info"
              onClick={() => setCurrentView("player")}
              className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden group-hover:border-white/20 transition-all">
                <Music className={`w-4.5 h-4.5 text-slate-400 group-hover:text-emerald-400 transition-colors ${isPlaying ? "animate-pulse" : ""}`} />
                {isPlaying && (
                  <div className="absolute inset-0 bg-emerald-500/10 flex items-end justify-center gap-0.5 pb-1.5">
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_100ms] rounded-full" style={{ height: '40%' }}></span>
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_300ms] rounded-full" style={{ height: '70%' }}></span>
                    <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite_200ms] rounded-full" style={{ height: '30%' }}></span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-semibold text-white truncate font-sans group-hover:text-emerald-400 transition-all">
                  {currentTrack.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-sans font-light mt-0.5">
                  {currentTrack.artist || "Unknown Artist"}
                </span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-1.5" id="minimized-playback-controls">
              <button
                id="minimized-prev-btn"
                onClick={(e) => { e.stopPropagation(); handlePrevTrack(); }}
                className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/10 text-slate-350 hover:text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              
              <button
                id="minimized-play-pause-btn"
                onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-200 text-stone-950 transition-all active:scale-90 hover:shadow-[0_0_12px_rgba(255,255,255,0.4)] cursor-pointer flex items-center justify-center"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                id="minimized-next-btn"
                onClick={(e) => { e.stopPropagation(); handleNextTrack(); }}
                className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/10 text-slate-350 hover:text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Close/Dismiss Button with separator */}
            <div className="border-l border-white/10 pl-2 ml-0.5" id="minimized-dismiss-wrapper">
              <button
                id="minimized-dismiss-btn"
                onClick={handleCloseMinimized}
                className="p-2 rounded-xl bg-white/[0.01] hover:bg-red-500/10 text-slate-455 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all active:scale-95 cursor-pointer"
                title="Exit Player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Inline Micro Progress Bar */}
          <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1 relative" id="minimized-progress-container">
            <div 
              id="minimized-progress-bar"
              className="h-full bg-gradient-to-r from-emerald-500 to-white shadow-[0_0_6px_rgba(255,255,255,0.5)] transition-all duration-300 rounded-full"
              style={{ width: `${songDuration ? (songProgress / songDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>   
  ); 
}
