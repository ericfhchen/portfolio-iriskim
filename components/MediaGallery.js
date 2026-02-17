"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";
import VideoPlayer from "./VideoPlayer";

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

const MediaGallery = forwardRef(function MediaGallery({ project, allowAutoPlay = true }, ref) {
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

      {/* Thumbnail row */}
      {media.length > 1 && (
        <div
          className="flex items-start gap-1 mt-1"
          style={{
            opacity: thumbnailOpacity,
            transition: "opacity 200ms ease-out",
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
              <div key={item._key || index} className="flex flex-col items-start">
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
                      <svg width="6" height="8" viewBox="0 0 6 8" fill="currentColor">
                        <path d="M0 0L6 4L0 8V0Z" />
                      </svg>
                    )}
                    {mediaLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default MediaGallery;
