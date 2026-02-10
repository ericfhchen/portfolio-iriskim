"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// Check if device is mobile (used for quality cap)
function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function VideoPlayer({ playbackId, autoPlay = false }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hlsLoaded, setHlsLoaded] = useState(false);
  const hlsRef = useRef(null);

  const src = `https://stream.mux.com/${playbackId}.m3u8`;
  const poster = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    const mobile = isMobile();
    const maxHeight = mobile ? 1440 : Infinity;

    // Safari supports HLS natively - use URL params to hint quality
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Mux supports max_resolution param for quality hints
      const qualityParam = mobile ? "?max_resolution=1440p" : "";
      video.src = src + qualityParam;
      setHlsLoaded(true);
      return;
    }

    // Dynamic import hls.js for non-Safari browsers
    let hls;
    import("hls.js").then((HlsModule) => {
      const Hls = HlsModule.default;
      if (!Hls.isSupported()) return;

      hls = new Hls({
        // Disable ABR completely
        abrController: undefined,
        // Don't auto-start loading - we'll trigger manually after setting level
        autoStartLoad: false,
        // Don't cap based on player size
        capLevelToPlayerSize: false,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels;
        let targetLevel = levels.length - 1; // Highest quality

        if (mobile) {
          // Find highest level at or below 1440p
          for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height <= maxHeight) {
              targetLevel = i;
              break;
            }
          }
        }

        // Lock to target level BEFORE starting to load
        hls.currentLevel = targetLevel;
        hls.nextLevel = targetLevel;
        hls.loadLevel = targetLevel;

        // Now start loading at the correct level
        hls.startLoad();
        setHlsLoaded(true);
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    });

    return () => {
      if (hls) hls.destroy();
    };
  }, [playbackId, src]);

  // Autoplay with sound when autoPlay prop is true
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsLoaded || !autoPlay || hasAutoPlayed) return;

    video.play().catch(() => {});
    setHasAutoPlayed(true);
  }, [hlsLoaded, autoPlay, hasAutoPlayed]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    video.currentTime = fraction * duration;
  };

  const formatTime = (t) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-full">
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="h-full object-contain cursor-pointer"
      />

      <div className="flex items-center gap-2 mt-1">
        <button onClick={togglePlay} className="cursor-pointer">
          {isPlaying ? "pause" : "play"}
        </button>

        <div
          className="flex-1 h-[1px] bg-muted relative cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="absolute top-0 left-0 h-full bg-black"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
