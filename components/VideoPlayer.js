"use client";

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

// Check if device is mobile (used for quality cap)
function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

const VideoPlayer = forwardRef(function VideoPlayer({
  playbackId,
  aspectRatio,
  autoPlay = false,
  allowAutoPlay = true,
  controlsDisabled = false,
  onPrevItem,
  onNextItem,
  onReady: onReadyCallback,
}, ref) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store callback in ref to avoid re-running effect when callback changes
  const onReadyCallbackRef = useRef(onReadyCallback);
  onReadyCallbackRef.current = onReadyCallback;

  // Track if video was playing before an external pause (for resume logic)
  const wasPlayingBeforePauseRef = useRef(false);

  // Expose pause/resume methods to parent via ref
  useImperativeHandle(ref, () => ({
    pause: () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        wasPlayingBeforePauseRef.current = true;
        video.pause();
      }
    },
    resume: () => {
      const video = videoRef.current;
      if (video && video.paused && wasPlayingBeforePauseRef.current) {
        video.play().catch(() => {});
        wasPlayingBeforePauseRef.current = false;
      }
    },
    isPaused: () => videoRef.current?.paused ?? true,
  }), []);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const hideControlsTimeout = useRef(null);
  const hlsRef = useRef(null);

  // Track mobile status for layout
  useEffect(() => {
    setIsMobileView(isMobile());
  }, []);

  // Parse Mux aspect ratio string (e.g., "16:9") to number
  const parsedAspectRatio = aspectRatio
    ? typeof aspectRatio === "string"
      ? aspectRatio.split(":").reduce((a, b) => a / b)
      : aspectRatio
    : null;

  const src = `https://stream.mux.com/${playbackId}.m3u8`;
  const poster = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`;

  // Preload poster image and fire onReady callback when it loads
  // This ensures smooth transitions - poster is visible before video stream loads
  useEffect(() => {
    if (!onReadyCallbackRef.current) return;

    const img = new window.Image();
    img.onload = () => {
      onReadyCallbackRef.current?.();
    };
    img.onerror = () => {
      // Still fire ready on error so transition doesn't hang
      onReadyCallbackRef.current?.();
    };
    img.src = poster;
  }, [poster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    const mobile = isMobile();
    const maxHeight = mobile ? 1440 : Infinity;

    // Handler for when video has enough data to play
    // Listen for both 'canplay' and 'canplaythrough' - Safari sometimes fires
    // 'canplay' but delays 'canplaythrough', causing the video to stay invisible
    const handleReady = () => {
      setIsReady(true);
    };
    video.addEventListener("canplaythrough", handleReady);
    video.addEventListener("canplay", handleReady);

    // Use hls.js for ALL browsers to force highest quality
    // Safari's native HLS uses ABR and doesn't allow forcing quality
    // hls.js works in Safari and gives us control over quality selection
    let hls;
    let targetLevel = -1;

    import("hls.js").then((HlsModule) => {
      const Hls = HlsModule.default;

      // Fallback to native HLS for browsers that don't support hls.js (e.g., Safari on iOS)
      if (!Hls.isSupported()) {
        // Safari natively supports HLS - use video.src directly
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.load();
        }
        return;
      }

      hls = new Hls({
        // Don't auto-start loading - we control when to start
        autoStartLoad: false,
        // Don't cap based on player size - we want full quality
        capLevelToPlayerSize: false,
        // High bandwidth estimate to prevent ABR from choosing low quality
        abrEwmaDefaultEstimate: 100000000, // 100 Mbps
        abrEwmaDefaultEstimateMax: 100000000,
        // Disable bandwidth-based switching
        abrBandWidthFactor: 0,
        abrBandWidthUpFactor: 0,
        // Max buffer length to encourage loading more high quality
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels;
        targetLevel = levels.length - 1; // Highest quality

        if (mobile) {
          // Find highest level at or below 1440p
          for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height <= maxHeight) {
              targetLevel = i;
              break;
            }
          }
        }

        // Lock to highest quality BEFORE attaching media
        hls.currentLevel = targetLevel;
        hls.nextLevel = targetLevel;
        hls.loadLevel = targetLevel;

        // NOW attach media and start loading
        hls.attachMedia(video);
        hls.startLoad();
      });

      // Enforce quality level on every level change attempt
      hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
        if (targetLevel !== -1 && data.level !== targetLevel) {
          hls.currentLevel = targetLevel;
          hls.nextLevel = targetLevel;
          hls.loadLevel = targetLevel;
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (targetLevel !== -1 && data.level !== targetLevel) {
          hls.currentLevel = targetLevel;
          hls.nextLevel = targetLevel;
          hls.loadLevel = targetLevel;
        }
      });

      // Handle HLS errors - fall back to native if needed
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("[VideoPlayer] Fatal HLS error:", data.type, data.details);
          hls.destroy();
          // Fall back to native HLS for Safari
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
            video.load();
          }
        }
      });

      // Load source FIRST (this fetches the manifest)
      hls.loadSource(src);
      // attachMedia is called in MANIFEST_PARSED after setting level
    });

    return () => {
      video.removeEventListener("canplaythrough", handleReady);
      video.removeEventListener("canplay", handleReady);
      if (hls) hls.destroy();
    };
  }, [playbackId, src]);

  // Autoplay with sound when autoPlay prop is true, video is ready, and allowed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady || !autoPlay || !allowAutoPlay || hasAutoPlayed) return;

    video.play().catch(() => {});
    setHasAutoPlayed(true);
  }, [isReady, autoPlay, allowAutoPlay, hasAutoPlayed]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.() ||
        container.webkitRequestFullscreen?.() ||
        container.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.msExitFullscreen?.();
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (controlsDisabled) return;

    const handleKeyDown = (e) => {
      // Don't capture if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "arrowleft":
          e.preventDefault();
          onPrevItem?.();
          break;
        case "arrowright":
          e.preventDefault();
          onNextItem?.();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlsDisabled, togglePlay, toggleMute, toggleFullscreen, onPrevItem, onNextItem]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
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

  // Calculate wrapper dimensions using aspect ratio
  // Keep consistent sizing before AND after video loads to prevent resize jump
  // When fullscreen, fill the container and let video use object-fit: contain
  // Use 100% height to respect flex container, not fixed vh units
  const wrapperStyle = {
    position: "relative",
    display: isFullscreen ? "flex" : "inline-block",
    justifyContent: "center",
    alignItems: "center",
    ...(isFullscreen
      ? { width: "100%", height: "100%" }
      : { maxHeight: "100%", maxWidth: "100%" }
    ),
  };

  // Always apply aspect ratio sizing if available (not just before ready)
  // But NOT in fullscreen mode - let video fill the screen
  if (!isFullscreen && parsedAspectRatio) {
    wrapperStyle.aspectRatio = parsedAspectRatio;
    // Use maxHeight instead of height so wrapper sizes to video's intrinsic size
    // but never exceeds container. This fixes: top-alignment, controls positioning,
    // and prevents whitespace clicks from triggering play/pause
    wrapperStyle.maxHeight = "100%";
    wrapperStyle.width = "auto";
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: isFullscreen || isMobileView ? "center" : "flex-start",
        justifyContent: isFullscreen ? "center" : "flex-start",
        height: "100%",
        ...(isFullscreen && { width: "100%", height: "100%", background: "#000" }),
      }}
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
    >
      {/* Wrapper that sizes to video and positions controls */}
      <div style={wrapperStyle}>
        <video
          ref={videoRef}
          poster={poster}
          playsInline
          loop
          onClick={controlsDisabled ? undefined : togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => {
            setIsPlaying(true);
            resetHideTimer();
          }}
          onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          className={controlsDisabled ? "" : "cursor-pointer"}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: isFullscreen ? "contain" : undefined,
            pointerEvents: controlsDisabled ? "none" : "auto",
          }}
        />

        {/* Controls overlay - positioned at bottom of the inline-block wrapper */}
        {isReady && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "8px 10px 8px 10px",
              opacity: showControls && !controlsDisabled ? 1 : 0,
              transition: "opacity 300ms",
              pointerEvents: showControls && !controlsDisabled ? "auto" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "white", fontSize: "9px" }}>
              {/* Play/Pause - fixed width */}
              <button
                onClick={togglePlay}
                className="cursor-pointer hover:opacity-70 transition-opacity"
                style={{ width: "28px", textAlign: "left" }}
              >
                {isPlaying ? "pause" : "play"}
              </button>

              {/* Mute - fixed width, next to play */}
              <button
                onClick={toggleMute}
                className="cursor-pointer hover:opacity-70 transition-opacity"
                style={{ width: "34px", textAlign: "left" }}
              >
                {isMuted ? "unmute" : "mute"}
              </button>

              {/* Progress bar */}
              <div
                style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.4)", position: "relative", cursor: "pointer" }}
                onClick={handleSeek}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    background: "white",
                    width: `${progress}%`,
                    transition: "width 250ms linear",
                  }}
                />
              </div>

              {/* Time - fixed width */}
              <span style={{ width: "60px", textAlign: "right", opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Fullscreen - fixed width */}
              <button
                onClick={toggleFullscreen}
                className="cursor-pointer hover:opacity-70 transition-opacity"
                style={{ width: "52px", textAlign: "right" }}
              >
                {isFullscreen ? "exit" : "fullscreen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default VideoPlayer;
