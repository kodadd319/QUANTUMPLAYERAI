import { Track } from "../types";

const ALBUM_ART_FALLBACKS = [
  "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=500&auto=format&fit=crop&q=80", // colorful soundwave
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80", // concert lights
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80", // DJ neon
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80", // retro mic
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop&q=80", // vinyl record
  "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&auto=format&fit=crop&q=80", // fluid art abstract
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80", // headphones yellow
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=80", // stage crowd
  "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=500&auto=format&fit=crop&q=80", // retro cassette
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&auto=format&fit=crop&q=80", // psychedelic lights
];

export function getAlbumArtForTrack(track: Track | null): string {
  if (!track) return ALBUM_ART_FALLBACKS[0];
  
  // 1. Prefer extracted album art or uploaded custom cover art
  if (track.albumArtUrl && track.albumArtUrl.trim() !== "") {
    return track.albumArtUrl;
  }
  if (track.imageUrl && track.imageUrl.trim() !== "" && !track.imageUrl.startsWith("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4")) {
    return track.imageUrl;
  }
  
  // 2. Deterministically select a gorgeous fallback image using a hash of the track's name and artist
  const seedString = (track.name || "") + (track.artist || "") + (track.id || "");
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ALBUM_ART_FALLBACKS.length;
  return ALBUM_ART_FALLBACKS[index];
}
