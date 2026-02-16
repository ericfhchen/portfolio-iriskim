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
  const [videoKey, setVideoKey] = useState(0);
  // Note: Parent uses key={slug} so component remounts on project change - no manual reset needed

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

  const goToPrev = useCallback(() => {
    if (media.length <= 1) return;
    setActiveIndex((i) => (i === 0 ? media.length - 1 : i - 1));
    setVideoKey((k) => k + 1);
  }, [media.length]);

  const goToNext = useCallback(() => {
    if (media.length <= 1) return;
    setActiveIndex((i) => (i === media.length - 1 ? 0 : i + 1));
    setVideoKey((k) => k + 1);
  }, [media.length]);

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

  const activeItem = media[activeIndex];

  const handleThumbnailClick = (index) => {
    setActiveIndex(index);
    // Increment key to force VideoPlayer remount for autoplay
    setVideoKey((k) => k + 1);
  };

  const thumbnailHeights = [60, 75, 90];

  return (
    <div className="w-full p-4">
      <div className="mb-2">
        <span>
          {project.title}. {project.year}.
          {renderCaptionInline(project.caption) && ` ${renderCaptionInline(project.caption)}`}
        </span>
      </div>

      {/* Main display area */}
      <div className="w-full" style={{ height: "73vh" }}>
        {activeItem?._type === "mux.video" && activeItem.playbackId ? (
          <VideoPlayer
            ref={videoPlayerRef}
            key={videoKey}
            playbackId={activeItem.playbackId}
            aspectRatio={activeItem.aspectRatio}
            autoPlay={true}
            allowAutoPlay={allowAutoPlay}
            onPrevItem={media.length > 1 ? goToPrev : undefined}
            onNextItem={media.length > 1 ? goToNext : undefined}
          />
        ) : activeItem?._type === "image" ? (
          <div className="relative w-full h-full">
            <Image
              src={urlFor(activeItem).width(1400).quality(90).url()}
              alt={project.title}
              fill
              className="object-contain object-left"
            />
          </div>
        ) : null}
      </div>

      {/* Thumbnail row */}
      {media.length > 1 && (
        <div className="flex items-start gap-1 mt-1">
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
