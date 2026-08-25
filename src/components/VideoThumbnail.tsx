import React, { useState, useEffect } from "react";
import { Loader2, Film } from "lucide-react";
import { VideoTrack } from "../types";
import {
  getOrGenerateVideoThumbnail,
  videoThumbnailCache,
  generateSvgVideoPlaceholder
} from "../utils/videoThumbnailGenerator";

interface VideoThumbnailProps {
  video: VideoTrack;
  className?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ video, className }) => {
  // Determine initial thumbnail if already in cache or if video.thumbnail is a valid data/image url
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    if (videoThumbnailCache[video.id]) {
      return videoThumbnailCache[video.id];
    }
    if (video.thumbnail && (video.thumbnail.startsWith("data:image/") || video.thumbnail.startsWith("http://") || video.thumbnail.startsWith("https://"))) {
      videoThumbnailCache[video.id] = video.thumbnail;
      return video.thumbnail;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(!thumbnailUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isCurrent = true;

    // If already in cache or existing thumbnail is valid, ensure state is set
    if (videoThumbnailCache[video.id]) {
      setThumbnailUrl(videoThumbnailCache[video.id]);
      setLoading(false);
      return;
    }

    if (video.thumbnail && video.thumbnail.startsWith("data:image/")) {
      videoThumbnailCache[video.id] = video.thumbnail;
      setThumbnailUrl(video.thumbnail);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    // Extract real thumbnail picture directly from the video file
    getOrGenerateVideoThumbnail(
      video.id,
      video.url,
      video.thumbnail,
      video.name,
      true
    )
      .then((url) => {
        if (!isCurrent) return;
        setThumbnailUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Video thumbnail generation notice for", video.name, err?.message || err);
        if (!isCurrent) return;
        const fallback = generateSvgVideoPlaceholder(video.name, video.duration);
        setThumbnailUrl(fallback);
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [video.id, video.url, video.thumbnail, video.name, video.duration]);

  // If loading and no image yet, show a clean sleek loader
  if (loading && !thumbnailUrl) {
    return (
      <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-stone-950/90 text-stone-400 gap-1.5 z-0">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400 stroke-[1.75]" />
        <span className="text-[9px] font-mono tracking-wider uppercase text-stone-400">Loading Frame...</span>
      </div>
    );
  }

  // Display the video thumbnail image
  const displaySrc = thumbnailUrl || generateSvgVideoPlaceholder(video.name, video.duration);

  return (
    <img
      src={displaySrc}
      alt={video.name || "Video Thumbnail"}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={(e) => {
        if (!hasError) {
          setHasError(true);
          const fallback = generateSvgVideoPlaceholder(video.name, video.duration);
          e.currentTarget.src = fallback;
        }
      }}
    />
  );
};
