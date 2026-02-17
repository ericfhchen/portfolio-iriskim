"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";
import VideoPlayer from "./VideoPlayer";

const SCROLL_SPEED = 250; // pixels per second
const HOVER_ZONE_WIDTH = 70; // px - matches gradient width

// Render Portable Text blocks as inline text
function renderCaptionInline(caption) {
  if (!caption || !Array.isArray(caption)) return null;

  const text = caption
    .filter((block) => block._type === "block")
    .map((block) =>
      block.children
        ?.map((child) => child.text)
        .filter(Boolean)
        .join("")
    )
    .filter(Boolean)
    .join(" ");

  return text || null;
}

const MediaGallery = forwardRef(function MediaGallery({ project, allowAutoPlay = true, controlsDisabled = false }, ref) {
  const media = project?.media || [];
  const [activeIndex, setActiveIndex] = useState(0);
  // Note: Parent uses key={slug} so component remounts on project change - no manual reset needed

  // Dual-layer crossfade system
  // Each layer: { index, opacity, zIndex, id }
  const [layers, setLayers] = useState([{ index: 0, opacity: 0, zIndex: 0, id: 0 }]);
  const transitioningRef = useRef(false);
  const layerIdRef = useRef(1);

  // Thumbnail loading coordination - fade all in together with main media
  const [thumbnailsReady, setThumbnailsReady] = useState(false);
  const [initialMediaReady, setInitialMediaReady] = useState(false);
  const loadedCountRef = useRef(0);
  const totalThumbnails = media.length > 1 ? media.length : 0;

  const handleThumbnailLoad = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= totalThumbnails) {
      setThumbnailsReady(true);
    }
  }, [totalThumbnails]);

  // Called when the initial (index 0) image/video loads
  const handleInitialMediaReady = useCallback(() => {
    setInitialMediaReady(true);
  }, []);

  // Ref to VideoPlayer for pause/resume control
  const videoPlayerRef = useRef(null);

  // Expose pause/resume to parent
  useImperativeHandle(ref, () => ({
    pauseVideo: () => {
      videoPlayerRef.current?.pause();
    },
    resumeVideo: () => {
      videoPlayerRef.current?.resume();
    },
  }), []);

  // Fade in initial layer on mount - wait for thumbnails and initial media
  useEffect(() => {
    const fadeInInitial = () => {
      setLayers(prev => prev.map(layer =>
        layer.index === 0 ? { ...layer, opacity: 1 } : layer
      ));
    };

    // Need initial media to be ready
    if (!initialMediaReady) return;

    // If no thumbnails, fade in after small delay
    if (totalThumbnails === 0) {
      const timer = setTimeout(fadeInInitial, 50);
      return () => clearTimeout(timer);
    }
    // If thumbnails exist, wait for them to be ready
    if (thumbnailsReady) {
      const timer = setTimeout(fadeInInitial, 50);
      return () => clearTimeout(timer);
    }
  }, [thumbnailsReady, totalThumbnails, initialMediaReady]);

  // Handle layer ready (image loaded or video ready)
  // Old layer already faded out in startTransition, just fade in new layer
  const handleLayerReady = useCallback((layerId) => {
    console.log(`[MediaGallery] Layer ready:`, layerId);

    // Fade in the new layer
    setLayers(prev => {
      const newLayer = prev.find(l => l.id === layerId);
      if (!newLayer || newLayer.zIndex !== 1) {
        console.log(`[MediaGallery] Layer ${layerId} not found or not z-index 1, skipping`);
        return prev;
      }

      console.log(`[MediaGallery] Fading in new layer ${layerId}`);
      return prev.map(l =>
        l.id === layerId ? { ...l, opacity: 1 } : l
      );
    });

    // After fade in completes, clean up old layer
    setTimeout(() => {
      console.log(`[MediaGallery] Cleanup, removing old layer`);
      setLayers(prev => {
        const topLayer = prev.find(l => l.zIndex === 1);
        if (!topLayer) return prev;
        transitioningRef.current = false;
        return [{ ...topLayer, zIndex: 0 }];
      });
    }, 200);
  }, []);

  // Start a transition to a new index
  const startTransition = useCallback((targetIndex) => {
    if (transitioningRef.current) return;
    if (targetIndex === activeIndex) return;

    transitioningRef.current = true;
    const newLayerId = layerIdRef.current++;

    const fromItem = media[activeIndex];
    const toItem = media[targetIndex];
    console.log(`[MediaGallery] Starting transition: ${fromItem?._type} (index ${activeIndex}) → ${toItem?._type} (index ${targetIndex}), new layer ${newLayerId}`);

    // Add new layer on top with opacity 0, and immediately fade out old layer
    setLayers(prev => [
      ...prev.map(l => ({ ...l, zIndex: 0, opacity: 0 })), // Fade out existing layers
      { index: targetIndex, opacity: 0, zIndex: 1, id: newLayerId }
    ]);

    setActiveIndex(targetIndex);
  }, [activeIndex, media]);

  const goToPrev = useCallback(() => {
    if (media.length <= 1 || transitioningRef.current) return;
    const newIndex = activeIndex === 0 ? media.length - 1 : activeIndex - 1;
    startTransition(newIndex);
  }, [media.length, activeIndex, startTransition]);

  const goToNext = useCallback(() => {
    if (media.length <= 1 || transitioningRef.current) return;
    const newIndex = activeIndex === media.length - 1 ? 0 : activeIndex + 1;
    startTransition(newIndex);
  }, [media.length, activeIndex, startTransition]);

  // Keyboard navigation for images (video handles its own)
  useEffect(() => {
    const activeItem = media[activeIndex];
    const isImage = activeItem?._type === "image";

    if (!isImage) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, media, goToPrev, goToNext]);

  if (!project || media.length === 0) return null;

  const handleThumbnailClick = (index) => {
    console.log(`[MediaGallery] Thumbnail clicked`, { index, activeIndex, transitioning: transitioningRef.current });
    // Prevent clicks during transition or if already on this index
    if (index === activeIndex || transitioningRef.current) return;
    startTransition(index);
  };

  // Thumbnails use separate opacity - only for initial mount fade-in
  // Once initialMediaReady is true, thumbnails stay visible
  const thumbnailOpacity = (initialMediaReady && (totalThumbnails === 0 || thumbnailsReady)) ? 1 : 0;

  const thumbnailHeights = [60, 75, 90];

  // Horizontal scroll system for thumbnail overflow
  const scrollContainerRef = useRef(null);
  const scrollAnimationRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const newCanScrollLeft = el.scrollLeft > 1;
    const newCanScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    console.log('[Scroll] updateScrollState:', {
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      maxScroll: el.scrollWidth - el.clientWidth,
      canScrollLeft: newCanScrollLeft,
      canScrollRight: newCanScrollRight,
    });
    setCanScrollLeft(newCanScrollLeft);
    setCanScrollRight(newCanScrollRight);
  }, []);

  // Check overflow on mount, resize, and when thumbnails change
  useEffect(() => {
    updateScrollState();

    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollState, media.length]);

  // Update scroll state when thumbnails finish loading
  useEffect(() => {
    if (thumbnailsReady) {
      // Small delay to ensure layout is complete
      const timer = setTimeout(updateScrollState, 50);
      return () => clearTimeout(timer);
    }
  }, [thumbnailsReady, updateScrollState]);

  // Scroll event listener
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollState);
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  const startAutoScroll = useCallback((direction) => {
    console.log('[Scroll] startAutoScroll:', direction);
    let lastTime = performance.now();
    let frameCount = 0;

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const el = scrollContainerRef.current;
      if (!el) {
        console.log('[Scroll] animate: no element, stopping');
        return;
      }

      // Check if we can still scroll in this direction
      const maxScroll = el.scrollWidth - el.clientWidth;
      const canScrollInDirection = direction === 'left'
        ? el.scrollLeft > 1
        : el.scrollLeft < maxScroll - 1;

      if (!canScrollInDirection) {
        console.log('[Scroll] animate: reached boundary, stopping', {
          direction,
          scrollLeft: el.scrollLeft,
          maxScroll,
        });
        scrollAnimationRef.current = null;
        updateScrollState();
        return;
      }

      const beforeScroll = el.scrollLeft;
      const delta = SCROLL_SPEED * deltaTime * (direction === 'left' ? -1 : 1);
      el.scrollLeft += delta;
      const afterScroll = el.scrollLeft;

      frameCount++;
      if (frameCount % 30 === 0) { // Log every 30 frames (~0.5s)
        console.log('[Scroll] animate frame:', {
          direction,
          delta,
          beforeScroll,
          afterScroll,
          actualDelta: afterScroll - beforeScroll,
        });
      }

      updateScrollState();
      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    scrollAnimationRef.current = requestAnimationFrame(animate);
  }, [updateScrollState]);

  const stopAutoScroll = useCallback(() => {
    console.log('[Scroll] stopAutoScroll called, had animation:', !!scrollAnimationRef.current);
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full p-4">
      <div className="mb-2">
        <span>
          {project.title}. {project.year}.
          {renderCaptionInline(project.caption) && ` ${renderCaptionInline(project.caption)}`}
        </span>
      </div>

      {/* Main display area with dual-layer crossfade */}
      <div
        className="relative w-full"
        style={{ height: "73vh" }}
      >
        {layers.map((layer) => {
          const item = media[layer.index];
          if (!item) return null;

          return (
            <div
              key={layer.id}
              className="absolute inset-0"
              style={{
                opacity: layer.opacity,
                zIndex: layer.zIndex,
                transition: "opacity 200ms ease-out",
              }}
            >
              {item._type === "mux.video" && item.playbackId ? (
                <VideoPlayer
                  ref={layer.zIndex === 0 ? videoPlayerRef : undefined}
                  key={layer.id}
                  playbackId={item.playbackId}
                  aspectRatio={item.aspectRatio}
                  autoPlay={true}
                  allowAutoPlay={allowAutoPlay && layer.zIndex === 0}
                  controlsDisabled={controlsDisabled}
                  onPrevItem={media.length > 1 ? goToPrev : undefined}
                  onNextItem={media.length > 1 ? goToNext : undefined}
                  onReady={
                    layer.zIndex === 1
                      ? () => handleLayerReady(layer.id)
                      : layer.id === 0 ? handleInitialMediaReady : undefined
                  }
                />
              ) : item._type === "image" ? (
                <div className="relative w-full h-full">
                  <Image
                    src={urlFor(item).width(1400).quality(90).url()}
                    alt={project.title}
                    fill
                    className="object-contain object-left"
                    onLoad={
                      layer.zIndex === 1
                        ? () => handleLayerReady(layer.id)
                        : layer.id === 0 ? handleInitialMediaReady : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Thumbnail row with horizontal scroll */}
      {media.length > 1 && (
        <div
          className="relative mt-1"
          style={{
            opacity: thumbnailOpacity,
            transition: "opacity 200ms ease-out",
          }}
        >
          {/* Scrollable thumbnail container */}
          <div
            ref={scrollContainerRef}
            className="flex items-start gap-1 thumbnail-scroll-container"
            style={{
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {media.map((item, index) => {
              const height = thumbnailHeights[index % thumbnailHeights.length];
              const isActive = index === activeIndex;

              let thumbSrc;
              if (item._type === "image") {
                thumbSrc = urlFor(item).height(height * 2).quality(60).url();
              } else if (item._type === "mux.video" && item.playbackId) {
                thumbSrc = `https://image.mux.com/${item.playbackId}/thumbnail.jpg?height=${height * 2}&time=0`;
              }

              if (!thumbSrc) return null;

              const mediaLabel = project.projectCode
                ? `${project.projectCode}_${String(index + 1).padStart(2, "0")}`
                : null;

              return (
                <div key={item._key || index} className="flex flex-col items-start flex-shrink-0">
                  <button
                    onClick={() => handleThumbnailClick(index)}
                    className={`relative flex-shrink-0 cursor-pointer border-0 p-0 ${
                      isActive ? "opacity-100" : "opacity-100 hover:opacity-50"
                    }`}
                    style={{ height: `${height}px` }}
                  >
                    <img
                      src={thumbSrc}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-full w-auto object-cover"
                      onLoad={handleThumbnailLoad}
                      onError={handleThumbnailLoad}
                    />
                  </button>
                  {mediaLabel && (
                    <span className={`text-xs mt-1 flex items-center gap-1 ${isActive ? 'text-black' : 'text-muted'}`}>
                      {isActive && (
                        item._type === "mux.video" ? (
                          <svg width="6" height="8" viewBox="0 0 6 8" fill="currentColor">
                            <path d="M0 0L6 4L0 8V0Z" />
                          </svg>
                        ) : (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                            <rect width="8" height="8" />
                            <path d="M1 7L2.5 4L4 5.5L5.5 2L7 4V7H1Z" fill="white" />
                          </svg>
                        )
                      )}
                      {mediaLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Left gradient overlay */}
          {canScrollLeft && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_WIDTH,
                background: 'linear-gradient(to right, white, transparent)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {/* Right gradient overlay */}
          {canScrollRight && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_WIDTH,
                background: 'linear-gradient(to left, white, transparent)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {/* Left hover zone for auto-scroll */}
          {canScrollLeft && (
            <div
              onMouseEnter={() => {
                console.log('[Scroll] LEFT zone mouseEnter');
                startAutoScroll('left');
              }}
              onMouseLeave={() => {
                console.log('[Scroll] LEFT zone mouseLeave');
                stopAutoScroll();
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_WIDTH,
                zIndex: 3,
                cursor: 'w-resize',
              }}
            />
          )}

          {/* Right hover zone for auto-scroll */}
          {canScrollRight && (
            <div
              onMouseEnter={() => {
                console.log('[Scroll] RIGHT zone mouseEnter');
                startAutoScroll('right');
              }}
              onMouseLeave={() => {
                console.log('[Scroll] RIGHT zone mouseLeave');
                stopAutoScroll();
              }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: HOVER_ZONE_WIDTH,
                zIndex: 3,
                cursor: 'e-resize',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
});

export default MediaGallery;
