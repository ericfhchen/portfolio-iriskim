"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { urlFor } from "@/sanity/lib/image";
import { useHover } from "@/context/HoverContext";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function GridTile({ project, widthPercent, aspectRatio, onClick, onHover, isFirst, isLast }) {
  const tileRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const { hoveredProject, hoverSource, isHoverLocked, setTileHover, clearHover } = useHover();
  const isMobile = useIsMobile();

  const projectSlug = project.slug.current;
  const isThisHovered = hoveredProject === projectSlug;
  const someOtherHovered = hoveredProject && hoveredProject !== projectSlug;
  // Should show preview when sidebar hovers this project
  const shouldAutoplay = hoverSource === "sidebar" && isThisHovered && isNearViewport;

  const muxPlaybackId = project.muxPlaybackId;
  // Animated WebP: 5-second loop at 480px wide (~200-500KB vs 3-8MB for 1080p MP4)
  const previewSrc = muxPlaybackId
    ? `https://image.mux.com/${muxPlaybackId}/animated.webp?start=0&end=5&width=480`
    : null;

  useEffect(() => {
    const el = tileRef.current;
    if (!el || !previewSrc) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [previewSrc]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (isHoverLocked) return;
    setIsHovering(true);
    setTileHover(projectSlug);
    onHover?.(project);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    clearHover();
  };

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(project);
    }
  };

  const imageUrl = project.coverImage
    ? urlFor(project.coverImage).width(800).quality(80).url()
    : null;

  // Show preview when this tile is hovered OR when sidebar hovers this project
  // Gate on previewLoaded so cover image stays visible until animated WebP is decoded
  const wantPreview = isHovering || shouldAutoplay;
  const showPreview = wantPreview && previewLoaded;
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
              showPreview ? "opacity-0" : "opacity-100"
            }`}
            sizes={`${widthPercent}vw`}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: "none", userSelect: "none" }}
          />
        )}

        {previewSrc && isNearViewport && (
          <img
            src={previewSrc}
            alt=""
            onLoad={() => setPreviewLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
              showPreview ? "opacity-100" : "opacity-0"
            }`}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
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
