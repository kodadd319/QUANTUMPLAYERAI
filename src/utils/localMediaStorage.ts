const DB_NAME = "quantum-media-locker-v2";
const TRACK_STORE = "tracks";
const VIDEO_STORE = "videos";
const DB_VERSION = 1;

export interface LocalTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  genre: string;
  imageUrl: string;
  albumArtUrl: string | null;
  createdAt: string;
  blob: Blob;
  uid?: string;
}

export interface LocalVideo {
  id: string;
  name: string;
  duration: string;
  creator: string;
  category: string;
  thumbnail: string;
  createdAt: string;
  blob: Blob;
  uid?: string;
}

export function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        db.createObjectStore(TRACK_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
      }
    };
  });
}

// Track operations
export async function storeLocalTrack(track: LocalTrack): Promise<void> {
  const db = await openMediaDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TRACK_STORE, "readwrite");
    const store = transaction.objectStore(TRACK_STORE);
    const request = store.put(track);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getLocalTracks(): Promise<LocalTrack[]> {
  try {
    const db = await openMediaDB();
    return new Promise<LocalTrack[]>((resolve, reject) => {
      const transaction = db.transaction(TRACK_STORE, "readonly");
      const store = transaction.objectStore(TRACK_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (err) {
    console.error("IndexedDB getLocalTracks error:", err);
    return [];
  }
}

export async function deleteLocalTrack(id: string): Promise<void> {
  try {
    const db = await openMediaDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TRACK_STORE, "readwrite");
      const store = transaction.objectStore(TRACK_STORE);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB deleteLocalTrack error:", err);
  }
}

// Video operations
export async function storeLocalVideo(video: LocalVideo): Promise<void> {
  const db = await openMediaDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, "readwrite");
    const store = transaction.objectStore(VIDEO_STORE);
    const request = store.put(video);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getLocalVideos(): Promise<LocalVideo[]> {
  try {
    const db = await openMediaDB();
    return new Promise<LocalVideo[]>((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE, "readonly");
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (err) {
    console.error("IndexedDB getLocalVideos error:", err);
    return [];
  }
}

export async function deleteLocalVideo(id: string): Promise<void> {
  try {
    const db = await openMediaDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE, "readwrite");
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB deleteLocalVideo error:", err);
  }
}
