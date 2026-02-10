"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { urlFor } from "@/sanity/lib/image";

export default function GridTile({ project, widthPercent, aspectRatio, onClick }) {
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const muxPlaybackId = project.muxPlaybackId;
  const videoSrc = muxPlaybackId
    ? `https://stream.mux.com/${muxPlaybackId}/capped-1080p.mp4`
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
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
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

  return (
    <div
      ref={tileRef}
      style={{ width: `${widthPercent}%` }}
      className="flex-shrink-0 px-[2px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Title above tile - visible on hover */}
      <div
        className={`mb-[2px] h-5 transition-opacity duration-300 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{project.title}</span>
      </div>

      <Link
        href={`/${project.slug.current}`}
        onClick={handleClick}
        className="block relative overflow-hidden"
        style={{ aspectRatio: aspectRatio }}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={project.title}
            fill
            className={`object-cover transition-opacity duration-300 ${
              isHovering && videoSrc ? "opacity-0" : "opacity-100"
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
              isHovering ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </Link>

      {/* Title and year below tile - visible on hover */}
      <div
        className={`mt-[2px] h-5 flex justify-between transition-opacity duration-300 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{project.title}</span>
        <span className="text-muted">{project.year}</span>
      </div>
    </div>
  );
}
