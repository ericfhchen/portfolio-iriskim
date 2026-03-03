"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { urlFor } from "@/sanity/lib/image";
import { useHover } from "@/context/HoverContext";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function GridTile({ project, widthPercent, aspectRatio, onClick, onHover, isFirst, isLast }) {
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const { hoveredProject, hoverSource, isHoverLocked, setTileHover, clearHover } = useHover();
  const isMobile = useIsMobile();

  const projectSlug = project.slug.current;
  const isThisHovered = hoveredProject === projectSlug;
  const someOtherHovered = hoveredProject && hoveredProject !== projectSlug;
  // Should autoplay when sidebar hovers this project
  const shouldAutoplay = hoverSource === "sidebar" && isThisHovered && isNearViewport;

  const muxPlaybackId = project.muxPlaybackId;
  // Use static rendition URL format (1080p.mp4 matches static_renditions config)
  const videoSrc = muxPlaybackId
    ? `https://stream.mux.com/${muxPlaybackId}/1080p.mp4`
    : null;

  useEffect(() => {
    const el = tileRef.current;
    if (!el || !videoSrc) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting);
        if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setVideoReady(false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [videoSrc]);

  const handleMouseEnter = () => {
    // Skip hover on mobile - first tap navigates directly
    if (isMobile) return;
    // Skip hover during "keep browsing" scroll animation
    if (isHoverLocked) return;

    setIsHovering(true);
    setTileHover(projectSlug);
    onHover?.(project);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      if (videoRef.current.readyState >= 2) {
        setVideoReady(true);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setVideoReady(false);
    clearHover();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Autoplay when sidebar hovers this project
  useEffect(() => {
    if (shouldAutoplay && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      if (videoRef.current.readyState >= 2) {
        setVideoReady(true);
      }
    } else if (!shouldAutoplay && !isHovering && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setVideoReady(false);
    }
  }, [shouldAutoplay, isHovering]);

  // Track video readiness via event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onReady = () => setVideoReady(true);

    // If already buffered (preload finished before hover)
    if (video.readyState >= 2) {
      setVideoReady(true);
    }

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);

    return () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
    };
  }, [videoSrc]);

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(project);
    }
  };

  const imageUrl = project.coverImage
    ? urlFor(project.coverImage).width(800).quality(80).url()
    : null;

  // Show video when this tile is hovered OR when sidebar hovers this project
  // Gate on videoReady so cover image stays visible until first frame is decoded
  const wantVideo = isHovering || shouldAutoplay;
  const showVideo = wantVideo && videoReady;
  // Show title when this tile is hovered OR when sidebar highlights this project
  const showTitle = isHovering || isThisHovered;

  return (
    <div
      ref={tileRef}
      style={{
        width: `${widthPercent}%`,
        opacity: someOtherHovered ? 0.3 : 1,
        transition: "opacity 300ms"
      }}
      className={`flex-shrink-0 ${isFirst ? 'pr-[2px]' : isLast ? 'pl-[2px]' : 'px-[2px]'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Title above tile - visible on hover */}
      <div
        className={`mb-[2px] h-5 transition-opacity duration-300 ${
          showTitle ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{project.title}</span>
      </div>

      <Link
        href={`/?project=${project.slug.current}`}
        onClick={handleClick}
        className="block relative overflow-hidden"
        style={{ aspectRatio: aspectRatio }}
        data-slug={project.slug.current}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={project.title}
            fill
            className={`object-cover transition-opacity duration-150 ${
              showVideo && videoSrc ? "opacity-0" : "opacity-100"
            }`}
            sizes={`${widthPercent}vw`}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: "none", userSelect: "none" }}
          />
        )}

        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload={isNearViewport ? "auto" : "none"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
              showVideo ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </Link>

      {/* Role and year below tile - visible on hover */}
      <div
        className={`mt-[2px] h-5 transition-opacity duration-300 ${
          showTitle ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{project.role}{project.role && project.year ? ", " : ""}{project.year}</span>
      </div>
    </div>
  );
}
