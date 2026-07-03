import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { VideoTrack } from "../types";
import { getVideoBlob } from "../utils/videoStorage";

interface VideoThumbnailProps {
  video: VideoTrack;
  className?: string;
}

// Global cache for video thumbnails to avoid re-generating on every mount/render
const thumbnailCache: Record<string, string> = {};

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ video, className }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    return thumbnailCache[video.id] || null;
  });
  const [loading, setLoading] = useState<boolean>(!thumbnailUrl);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    // If we already have a generated/cached thumbnail, do nothing
    if (thumbnailUrl) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    let objectUrl: string | null = null;
    let tempVideo: HTMLVideoElement | null = null;

    const generateThumbnail = async () => {
      try {
        let srcUrl = video.url;

        // Resolve IndexedDB local video url if needed
        if (srcUrl && srcUrl.startsWith("local-db://")) {
          const id = srcUrl.replace("local-db://", "");
          const blob = await getVideoBlob(id);
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
            srcUrl = objectUrl;
          } else {
            throw new Error("Blob not found in IndexedDB");
          }
        }

        if (!srcUrl) {
          throw new Error("No video URL available");
        }

        // Create a hidden video element
        tempVideo = document.createElement("video");
        tempVideo.src = srcUrl;
        tempVideo.crossOrigin = "anonymous";
        tempVideo.preload = "metadata";
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        
        // Move playback forward to capture a non-black frame (at 1 second)
        tempVideo.currentTime = 1.0;

        const onSeeked = () => {
          if (!isCurrent) return;
          try {
            const canvas = document.createElement("canvas");
            canvas.width = tempVideo?.videoWidth || 320;
            canvas.height = tempVideo?.videoHeight || 180;
            const ctx = canvas.getContext("2d");
            if (ctx && tempVideo) {
              ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
              thumbnailCache[video.id] = dataUrl;
              if (isCurrent) {
                setThumbnailUrl(dataUrl);
                setLoading(false);
              }
            } else {
              throw new Error("Could not get canvas context");
            }
          } catch (err) {
            console.error("Canvas draw error:", err);
            if (isCurrent) setError(true);
          } finally {
            cleanup();
          }
        };

        const onError = (e: any) => {
          console.warn("Video metadata loading failed, falling back to static thumbnail:", e);
          if (isCurrent) {
            setError(true);
            setLoading(false);
          }
          cleanup();
        };

        const cleanup = () => {
          if (tempVideo) {
            tempVideo.removeEventListener("seeked", onSeeked);
            tempVideo.removeEventListener("error", onError);
            tempVideo.pause();
            tempVideo.removeAttribute("src");
            tempVideo.load();
          }
        };

        tempVideo.addEventListener("seeked", onSeeked);
        tempVideo.addEventListener("error", onError);

        // Fallback timeout in case the seeked event never fires (e.g., slow stream / codec issue)
        setTimeout(() => {
          if (isCurrent && !thumbnailUrl && tempVideo) {
            if (tempVideo.readyState >= 2) {
              onSeeked();
            } else {
              setError(true);
              setLoading(false);
              cleanup();
            }
          }
        }, 3500);

      } catch (err) {
        console.error("Failed to generate video thumbnail:", err);
        if (isCurrent) {
          setError(true);
          setLoading(false);
        }
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    };

    generateThumbnail();

    return () => {
      isCurrent = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (tempVideo) {
        tempVideo.pause();
        tempVideo.removeAttribute("src");
        tempVideo.load();
      }
    };
  }, [video, thumbnailUrl]);

  // If we have a generated thumbnail and no error, render it
  if (thumbnailUrl && !error) {
    return (
      <img
        src={thumbnailUrl}
        alt={video.name}
        className={className}
        referrerPolicy="no-referrer"
      />
    );
  }

  // If loading, show dynamic progress/generation loader
  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 to-black text-slate-500 gap-1.5">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400 stroke-[1.5]" />
        <span className="text-[9px] font-mono tracking-widest uppercase text-slate-400">Generating Frame...</span>
      </div>
    );
  }

  // Fallback to static thumbnail if error or unsupported CORS/format
  const fallbackUrl = video.thumbnail || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80";
  return (
    <img
      src={fallbackUrl}
      alt={video.name}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
};
