"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { urlFor } from "@/sanity/lib/image";
import { useHover } from "@/context/HoverContext";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function GridTile({ project, widthPercent, aspectRatio, onClick, onHover }) {
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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
      ([entry]) => setIsNearViewport(entry.isIntersecting),
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
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
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
    } else if (!shouldAutoplay && !isHovering && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [shouldAutoplay, isHovering]);

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
  const showVideo = isHovering || shouldAutoplay;
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
      className="flex-shrink-0 px-[2px]"
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
            className={`object-cover transition-opacity duration-300 ${
              showVideo && videoSrc ? "opacity-0" : "opacity-100"
            }`}
            sizes={`${widthPercent}vw`}
          />
        )}

        {videoSrc && isNearViewport && (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
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
