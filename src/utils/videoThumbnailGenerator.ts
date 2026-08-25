import { getVideoBlob } from "./videoStorage";
import { getLocalVideos, storeLocalVideo } from "./localMediaStorage";

// Global in-memory cache for fast lookup
export const videoThumbnailCache: Record<string, string> = {};

// Helper to generate a stylish SVG placeholder if extraction fails (e.g. unsupported codec)
export function generateSvgVideoPlaceholder(title: string, durationStr = "Video"): string {
  const cleanTitle = (title || "Video Track").substring(0, 24).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1c1917" />
        <stop offset="50%" stop-color="#0c0a09" />
        <stop offset="100%" stop-color="#18181b" />
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.3" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#bg)" />
    <circle cx="320" cy="160" r="48" fill="#292524" stroke="#44403c" stroke-width="2" />
    <polygon points="312,142 336,160 312,178" fill="#f59e0b" />
    <rect x="40" y="320" width="560" height="2" fill="url(#glow)" />
    <text x="320" y="240" fill="#e7e5e4" font-family="system-ui, sans-serif" font-size="16" font-weight="600" text-anchor="middle">${cleanTitle}</text>
    <text x="320" y="265" fill="#a8a29e" font-family="monospace" font-size="12" text-anchor="middle">${durationStr}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Extracts a representative frame (thumbnail picture) directly from a video file, blob, or stream URL.
 */
export async function extractVideoFrame(
  source: File | Blob | string,
  targetTimeOffset = 1.0
): Promise<{
  dataUrl: string;
  duration: number;
  durationStr: string;
  width: number;
  height: number;
}> {
  let objectUrlToCleanup: string | null = null;
  let sourceUrl = "";

  try {
    // 1. Resolve source to an accessible URL
    if (source instanceof File || source instanceof Blob) {
      objectUrlToCleanup = URL.createObjectURL(source);
      sourceUrl = objectUrlToCleanup;
    } else if (typeof source === "string") {
      if (source.startsWith("local-db://")) {
        const id = source.replace("local-db://", "");
        let blob = await getVideoBlob(id);
        if (!blob) {
          // Check local media storage as well
          const localVideos = await getLocalVideos();
          const found = localVideos.find((v) => v.id === id);
          if (found && found.blob) {
            blob = found.blob;
          }
        }
        if (blob) {
          objectUrlToCleanup = URL.createObjectURL(blob);
          sourceUrl = objectUrlToCleanup;
        } else {
          throw new Error(`Video blob not found in local database for id: ${id}`);
        }
      } else if (source.startsWith("blob:") || source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
        sourceUrl = source;
      } else {
        throw new Error(`Unrecognized video source string: ${source}`);
      }
    }

    if (!sourceUrl) {
      throw new Error("No video source URL could be resolved.");
    }

    // 2. Perform frame capture on an offscreen video element
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      let resolved = false;
      let hasSeeked = false;

      const finishSuccess = (dataUrl: string, durationSec: number, w: number, h: number) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        
        const mins = Math.floor(durationSec / 60);
        const secs = Math.floor(durationSec % 60);
        const durationStr = !isNaN(durationSec) && durationSec > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : "0:15";

        resolve({
          dataUrl,
          duration: durationSec,
          durationStr,
          width: w,
          height: h
        });
      };

      const finishError = (errorMsg: string) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new Error(errorMsg));
      };

      const captureFrame = () => {
        try {
          const w = video.videoWidth || 480;
          const h = video.videoHeight || 270;
          const canvas = document.createElement("canvas");
          
          // Max dimension of 640px to keep thumbnail crisp yet lightweight for localStorage/Firestore
          const maxDim = 640;
          let targetW = w;
          let targetH = h;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              targetW = maxDim;
              targetH = Math.round((h / w) * maxDim);
            } else {
              targetH = maxDim;
              targetW = Math.round((w / h) * maxDim);
            }
          }
          
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Could not create 2D canvas context");
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(video, 0, 0, targetW, targetH);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          if (dataUrl && dataUrl.length > 100) {
            finishSuccess(dataUrl, video.duration || 0, w, h);
            return true;
          }
          return false;
        } catch (err: any) {
          console.warn("Canvas video frame capture warning:", err?.message || err);
          return false;
        }
      };

      const onSeeked = () => {
        if (resolved) return;
        hasSeeked = true;
        if (!captureFrame()) {
          // If capture fails on seeked, try again on next animation frame
          requestAnimationFrame(() => {
            if (!captureFrame()) {
              finishError("Failed to draw video frame to canvas");
            }
          });
        }
      };

      const onLoadedMetadata = () => {
        if (resolved) return;
        const dur = video.duration;
        let seekTime = 0.5;
        if (!isNaN(dur) && dur > 0) {
          // Pick a good frame timestamp: 15% into video or min(1.0, dur * 0.15)
          seekTime = dur > 1.5 ? Math.min(targetTimeOffset, dur * 0.15) : Math.max(0.1, dur * 0.1);
        }

        try {
          video.currentTime = seekTime;
        } catch {
          // In case setting currentTime fails immediately, capture whatever is available
          setTimeout(() => {
            captureFrame();
          }, 300);
        }
      };

      const onLoadedData = () => {
        if (resolved || hasSeeked) return;
        // If readyState is sufficient and seek hasn't happened yet, try a snapshot
        if (video.readyState >= 2) {
          setTimeout(() => {
            if (!resolved && !hasSeeked) {
              captureFrame();
            }
          }, 200);
        }
      };

      const onError = (e: any) => {
        finishError(`Video loading error: ${e?.message || e?.type || "unknown"}`);
      };

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };

      // Set video attributes
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      // Only set crossOrigin for remote http(s) URLs; do NOT set for blob: URLs
      if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
        video.crossOrigin = "anonymous";
      }

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("loadeddata", onLoadedData);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);

      // Safety timeout: abort after 4.5 seconds
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          if (video.readyState >= 2) {
            if (captureFrame()) return;
          }
          finishError("Video frame extraction timed out");
        }
      }, 4500);

      video.src = sourceUrl;
    });
  } catch (err: any) {
    throw err;
  } finally {
    if (objectUrlToCleanup) {
      URL.revokeObjectURL(objectUrlToCleanup);
    }
  }
}

/**
 * Ensures that a video record has a valid video thumbnail picture extracted from the video itself.
 * If extracted, automatically caches and optionally updates IndexedDB.
 */
export async function getOrGenerateVideoThumbnail(
  videoId: string,
  videoUrl: string,
  existingThumbnail?: string,
  videoTitle?: string,
  updateStorage = true
): Promise<string> {
  // 1. Check in-memory cache first
  if (videoThumbnailCache[videoId]) {
    return videoThumbnailCache[videoId];
  }

  // 2. If existingThumbnail is already a real data URL, cache and return
  if (existingThumbnail && existingThumbnail.startsWith("data:image/")) {
    videoThumbnailCache[videoId] = existingThumbnail;
    return existingThumbnail;
  }

  // 3. Attempt dynamic video frame extraction
  try {
    const result = await extractVideoFrame(videoUrl);
    if (result && result.dataUrl) {
      videoThumbnailCache[videoId] = result.dataUrl;

      // Update local storage if requested and it's a local video
      if (updateStorage && videoUrl.startsWith("local-db://")) {
        try {
          const id = videoUrl.replace("local-db://", "");
          const localVideos = await getLocalVideos();
          const existing = localVideos.find((v) => v.id === id);
          if (existing && (!existing.thumbnail || !existing.thumbnail.startsWith("data:image/"))) {
            existing.thumbnail = result.dataUrl;
            if (!existing.duration || existing.duration === "Local File" || existing.duration === "0:30") {
              existing.duration = result.durationStr;
            }
            await storeLocalVideo(existing);
          }
        } catch (dbErr) {
          console.warn("Could not update video thumbnail in local storage:", dbErr);
        }
      }

      return result.dataUrl;
    }
  } catch (err) {
    // If extraction failed and existingThumbnail is a valid remote image url, use it
    if (existingThumbnail && (existingThumbnail.startsWith("http://") || existingThumbnail.startsWith("https://"))) {
      videoThumbnailCache[videoId] = existingThumbnail;
      return existingThumbnail;
    }
  }

  // 4. If all else fails, return SVG placeholder
  const placeholder = generateSvgVideoPlaceholder(videoTitle || "Video Track");
  videoThumbnailCache[videoId] = placeholder;
  return placeholder;
}
