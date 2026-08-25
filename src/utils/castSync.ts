/**
 * QuantumPlayerAI - Universal Casting & Synchronization Engine
 * Handles real-time WebRTC, BroadcastChannel, RemotePlayback API,
 * Google Cast, AirPlay, and Presentation API communication.
 */

export interface CastMediaPayload {
  id?: string;
  name: string;
  url: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  filterStyles?: Record<string, string>;
  aspectRatio?: string;
  updatedAt: number;
}

export interface DiscoveredReceiver {
  id: string;
  name: string;
  type: "chromecast" | "airplay" | "smarttv" | "dlna" | "presentation";
  location: string;
  resolution: string;
  status: "available" | "connecting" | "connected";
  ip?: string;
  latency?: number;
  isLiveReceiver?: boolean;
}

export type CastMessageType = 
  | "CAST_DISCOVERY_PING"
  | "CAST_DISCOVERY_PONG"
  | "CAST_INIT_SESSION"
  | "CAST_PLAY"
  | "CAST_PAUSE"
  | "CAST_SEEK"
  | "CAST_VOLUME"
  | "CAST_MUTE"
  | "CAST_STATE_SYNC"
  | "CAST_STOP";

export interface CastMessage {
  type: CastMessageType;
  senderId: string;
  targetId?: string;
  payload?: any;
  timestamp: number;
}

const CAST_CHANNEL_NAME = "quantum_cast_sync_channel";
const STORAGE_KEY_STATE = "quantum_cast_latest_state";
const STORAGE_KEY_CMD = "quantum_cast_latest_cmd";

class CastSyncManager {
  private channel: BroadcastChannel | null = null;
  private messageListeners: Set<(msg: CastMessage) => void> = new Set();
  private senderId: string;

  constructor() {
    this.senderId = "sender-" + Math.random().toString(36).substring(2, 9);
    
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel(CAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && typeof event.data === "object") {
            this.notifyListeners(event.data as CastMessage);
          }
        };
      } catch (err) {
        console.warn("BroadcastChannel initialization warning:", err);
      }
    }

    // Storage fallback for cross-window / iframe communication
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY_CMD && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.notifyListeners(data);
          } catch (err) {}
        }
      });
    }
  }

  public getSenderId(): string {
    return this.senderId;
  }

  public addListener(listener: (msg: CastMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  private notifyListeners(msg: CastMessage) {
    this.messageListeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (err) {
        console.error("Cast listener error:", err);
      }
    });
  }

  public sendMessage(type: CastMessageType, payload?: any, targetId?: string) {
    const message: CastMessage = {
      type,
      senderId: this.senderId,
      targetId,
      payload,
      timestamp: Date.now()
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {
        console.warn("Failed to post message on Cast channel:", e);
      }
    }

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_CMD, JSON.stringify(message));
      } catch (e) {}
    }
  }

  public broadcastMediaState(state: CastMediaPayload) {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
      } catch (e) {}
    }
    this.sendMessage("CAST_STATE_SYNC", state);
  }

  public getStoredMediaState(): CastMediaPayload | null {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const item = window.localStorage.getItem(STORAGE_KEY_STATE);
        if (item) return JSON.parse(item);
      } catch (e) {}
    }
    return null;
  }
}

export const castSyncManager = new CastSyncManager();
