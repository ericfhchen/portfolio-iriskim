"use client";

import { useRef, useState, useEffect, useLayoutEffect, useCallback, forwardRef, useImperativeHandle } from "react";

// Detect Safari (desktop + iOS) for native HLS playback.
// Native HLS is faster than hls.js + MSE on Safari because Safari's MSE
// implementation is slower than its hardware-accelerated native HLS pipeline.
// Chrome on macOS also returns "maybe" for canPlayType HLS, but we want
// hls.js there for quality pinning — so we check navigator.vendor too.
export const useNativeHLS = (() => {
  if (typeof navigator === "undefined" || typeof document === "undefined") return false;
  const isSafari = navigator.vendor === "Apple Computer, Inc.";
  const canPlayHLS = !!document.createElement("video").canPlayType("application/vnd.apple.mpegurl");
  return isSafari && canPlayHLS;
})();

// Preload hls.js on module load so it's parsed before any project click.
// This avoids ~1.1MB of JS parsing during the gallery-fading-in animation.
// Skip entirely on Safari — native HLS is faster than hls.js + MSE there.
const hlsModulePromise = useNativeHLS ? null : import("hls.js");

// Check if device is mobile (used for quality cap)
export function isMobile() {
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
  onCanPlay,
}, ref) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store callbacks in ref to avoid re-running effect when callback changes
  const onReadyCallbackRef = useRef(onReadyCallback);
  onReadyCallbackRef.current = onReadyCallback;
  const onCanPlayRef = useRef(onCanPlay);
  onCanPlayRef.current = onCanPlay;

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
  const [detectedAspectRatio, setDetectedAspectRatio] = useState(null);
  const hideControlsTimeout = useRef(null);
  const hlsRef = useRef(null);
  const aspectRatioDetectedRef = useRef(false);
  const isReadyRef = useRef(false);

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

  // finalAspectRatio: prefer Sanity data, fall back to poster-detected ratio
  const finalAspectRatio = parsedAspectRatio || detectedAspectRatio;

  // JS-computed wrapper dimensions: replaces inline-block + width:auto + aspectRatio
  // which Safari sizes from <video> intrinsic dims (300x150 → poster → HLS metadata → jumps).
  // Instead, we measure the container and compute deterministic width/height from the AR.
  const [wrapperSize, setWrapperSize] = useState(null);

  useLayoutEffect(() => {
    if (!finalAspectRatio || isFullscreen) {
      setWrapperSize(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const compute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!cw || !ch) return;
      let w, h;
      if (cw / ch > finalAspectRatio) {
        // Height-constrained (container wider than video AR)
        h = ch;
        w = Math.round(ch * finalAspectRatio);
      } else {
        // Width-constrained (container taller than video AR)
        w = cw;
        h = Math.round(cw / finalAspectRatio);
      }
      setWrapperSize({ width: w, height: h });
    };

    compute(); // Synchronous initial measurement (useLayoutEffect = before paint)

    const obs = new ResizeObserver(compute);
    obs.observe(container);
    return () => obs.disconnect();
  }, [finalAspectRatio, isFullscreen]);

  const src = `https://stream.mux.com/${playbackId}.m3u8`;
  const poster = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`;

  // Preload poster image. If Sanity aspect ratio is missing, detect it from the poster's
  // natural dimensions — the poster frame has the same aspect ratio as the video.
  // This ensures the wrapper is correctly sized BEFORE onReady fires the fade-in,
  // and works for all layers including the crossfade layer (allowAutoPlay=false).
  const mountTimeRef = useRef(performance.now());
  useEffect(() => {
    if (!onReadyCallbackRef.current) return;

    const t0 = performance.now();
    console.log(`[Debug][VP:${playbackId?.slice(-6)}] poster load start, allowAutoPlay=${allowAutoPlay}`);
    const img = new window.Image();
    img.onload = () => {
      console.log(`[Debug][VP:${playbackId?.slice(-6)}] poster loaded in ${(performance.now() - t0).toFixed(0)}ms`);
      // Detect aspect ratio from poster if Sanity data is missing
      if (!parsedAspectRatio && !aspectRatioDetectedRef.current && img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        setDetectedAspectRatio(ratio);
        aspectRatioDetectedRef.current = true;
      }
      onReadyCallbackRef.current?.();
    };
    img.onerror = () => {
      console.log(`[Debug][VP:${playbackId?.slice(-6)}] poster FAILED in ${(performance.now() - t0).toFixed(0)}ms`);
      // Still fire ready on error so transition doesn't hang
      onReadyCallbackRef.current?.();
    };
    img.src = poster;
  }, [poster, parsedAspectRatio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    const mobile = isMobile();
    const maxHeight = mobile ? 1440 : Infinity;

    // Handler for when video has enough data to play
    // Listen for both 'canplay' and 'canplaythrough' - Safari sometimes fires
    // 'canplay' but delays 'canplaythrough', causing the video to stay invisible
    const hlsStartTime = performance.now();
    const handleReady = () => {
      setIsReady(true);
      isReadyRef.current = true;
      onCanPlayRef.current?.();
    };
    video.addEventListener("canplaythrough", handleReady);
    video.addEventListener("canplay", handleReady);

    // Safari: native HLS pipeline (faster than hls.js + MSE)
    // min_resolution excludes low renditions so ABR starts at acceptable quality
    if (useNativeHLS) {
      const params = mobile
        ? '?min_resolution=480p&max_resolution=1080p'
        : '?min_resolution=720p&max_resolution=1440p';
      console.log(`[Debug][VP:${playbackId?.slice(-6)}] native HLS starting @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms after mount, params=${params}`);
      video.src = src + params;
      video.load();

      return () => {
        video.removeEventListener("canplaythrough", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.src = "";
        video.load();
      };
    }

    // Chrome/Firefox: use hls.js for quality control
    let targetLevel = -1;
    let cancelled = false;

    // Start HLS immediately on mount — don't wait for allowAutoPlay.
    // The poster loads independently for the visual fade-in, while HLS
    // loads manifest + buffers in the background. The autoplay effect
    // (below) still gates video.play() on allowAutoPlay.
    console.log(`[Debug][VP:${playbackId?.slice(-6)}] HLS init starting @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms after mount`);
    hlsModulePromise.then((HlsModule) => {
      if (cancelled) return; // Don't create HLS if unmounted

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

      const hls = new Hls({
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

      console.log(`[Debug][VP:${playbackId?.slice(-6)}] hls.js module resolved @ +${(performance.now() - hlsStartTime).toFixed(0)}ms`);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels;
        targetLevel = levels.length - 1; // Highest quality
        console.log(`[Debug][VP:${playbackId?.slice(-6)}] MANIFEST_PARSED: ${levels.length} levels, target=${targetLevel} (${levels[targetLevel]?.height}p) @ +${(performance.now() - hlsStartTime).toFixed(0)}ms`);

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
          hlsRef.current = null;
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
      cancelled = true;
      video.removeEventListener("canplaythrough", handleReady);
      video.removeEventListener("canplay", handleReady);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playbackId, src]);

  // Autoplay with sound when autoPlay prop is true, video is ready, and allowed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady || !autoPlay || !allowAutoPlay || hasAutoPlayed) {
      if (video) {
        console.log(`[Debug][VP:${playbackId?.slice(-6)}] autoplay check: isReady=${isReady}, autoPlay=${autoPlay}, allowAutoPlay=${allowAutoPlay}, hasAutoPlayed=${hasAutoPlayed} → SKIP @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms`);
      }
      return;
    }

    console.log(`[Debug][VP:${playbackId?.slice(-6)}] autoplay FIRING @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms after mount`);
    // Set isPlaying true synchronously to prevent brief "play" button flash on mobile.
    // The onPlay event would set this too, but there's a gap between calling play()
    // and the browser firing onPlay that's visible on slower mobile devices.
    setIsPlaying(true);
    video.play().then(() => {
      console.log(`[Debug][VP:${playbackId?.slice(-6)}] play() succeeded @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms`);
    }).catch((err) => {
      console.log(`[Debug][VP:${playbackId?.slice(-6)}] play() FAILED: ${err.message} @ +${(performance.now() - mountTimeRef.current).toFixed(0)}ms`);
      // If play fails (e.g., blocked by browser), revert state
      setIsPlaying(false);
    });
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
    // Don't auto-hide controls while video is still loading
    if (!isReadyRef.current) return;
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

  const wrapperRef = useRef(null);

  // Wrapper sizing: JS-computed from container dims + aspect ratio.
  // Fullscreen: flex fill. Computed: deterministic width/height (no Safari intrinsic jumps).
  // Fallback (before first measurement): old CSS aspectRatio approach.
  const wrapperStyle = {
    position: "relative",
    ...(isFullscreen
      ? { display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }
      : wrapperSize
        ? { width: wrapperSize.width, height: wrapperSize.height }
        : finalAspectRatio
          ? { aspectRatio: finalAspectRatio, maxHeight: "100%", maxWidth: "100%", width: "auto" }
          : { maxHeight: "100%", maxWidth: "100%" }
    ),
  };

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
      <div ref={wrapperRef} style={wrapperStyle}>
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
        {/* Gate on hasAutoPlayed when autoplay is expected to prevent "play" button flash */}
        {(!isReady || !autoPlay || !allowAutoPlay || hasAutoPlayed) && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "0",
              opacity: showControls && !controlsDisabled ? 1 : 0,
              transition: "opacity 300ms",
              pointerEvents: showControls && !controlsDisabled ? "auto" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "white", fontSize: "9px" }}>
              {!isReady ? (
                <span style={{ padding: "8px 2px 8px 10px", opacity: 0.7 }}>loading...</span>
              ) : (
                <>
                  {/* Play/Pause - fixed width */}
                  <button
                    onClick={togglePlay}
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ width: "40px", textAlign: "left", padding: "8px 2px 8px 10px" }}
                  >
                    {isPlaying ? "pause" : "play"}
                  </button>

                  {/* Mute - fixed width, next to play */}
                  <button
                    onClick={toggleMute}
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ width: "38px", textAlign: "left", padding: "8px 2px" }}
                  >
                    {isMuted ? "unmute" : "mute"}
                  </button>
                </>
              )}

              {/* Progress bar */}
              <div
                style={{ flex: 1, padding: "8px 2px", display: "flex", alignItems: "center", cursor: isReady ? "pointer" : "default" }}
                onClick={isReady ? handleSeek : undefined}
              >
                <div
                  style={{ height: "1px", width: "100%", background: "rgba(255,255,255,0.4)", position: "relative" }}
                >
                  {isReady && (
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
                    >
                      <div
                        style={{
                          position: "absolute",
                          right: -2,
                          top: "50%",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "white",
                          transform: "translateY(-50%)",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Time - fixed width */}
              <span style={{ width: "64px", textAlign: "right", opacity: 0.7, fontVariantNumeric: "tabular-nums", padding: "8px 2px" }}>
                {isReady ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "--:-- / --:--"}
              </span>

              {/* Fullscreen - fixed width */}
              <button
                onClick={isReady ? toggleFullscreen : undefined}
                className={isReady ? "cursor-pointer hover:opacity-70 transition-opacity" : ""}
                style={{
                  width: "64px",
                  textAlign: "right",
                  padding: "8px 10px 8px 2px",
                  ...(isReady ? {} : { opacity: 0.3, pointerEvents: "none" }),
                }}
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
