"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/useIsMobile";

function CornerLinesSVG({ hoverTextRef, containerRef }) {
  const [lines, setLines] = useState(null);

  const recalculate = useCallback(() => {
    const el = hoverTextRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setLines({ rect, vw, vh });
  }, [hoverTextRef]);

  useEffect(() => {
    // Initial calc after CSS hover state applies
    const raf = requestAnimationFrame(recalculate);

    const onResize = () => recalculate();
    const onScroll = () => recalculate();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Find scrollable ancestor for inner-container scroll tracking
    let scrollAncestor = null;
    if (containerRef?.current) {
      let node = containerRef.current.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll"
        ) {
          scrollAncestor = node;
          break;
        }
        node = node.parentElement;
      }
    }
    if (scrollAncestor) {
      scrollAncestor.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      if (scrollAncestor) {
        scrollAncestor.removeEventListener("scroll", onScroll);
      }
    };
  }, [recalculate, containerRef]);

  if (!lines) return null;

  const { rect, vw, vh } = lines;
  const color = "#000000";

  const screenCorners = [
    { x: 0, y: 0 },
    { x: vw, y: 0 },
    { x: 0, y: vh },
    { x: vw, y: vh },
  ];

  const blockCorners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.left, y: rect.bottom },
    { x: rect.right, y: rect.bottom },
  ];

  return createPortal(
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2147483647,
        overflow: "visible",
      }}
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {screenCorners.map((sc, i) => (
        <line
          key={`line-${i}`}
          x1={sc.x}
          y1={sc.y}
          x2={blockCorners[i].x}
          y2={blockCorners[i].y}
          stroke={color}
          strokeWidth="1"
        />
      ))}
      {/* Viewport border */}
      <rect x="0" y="0" width={vw} height="1.5" fill={color} />
      <rect x="0" y={vh - 1.5} width={vw} height="1.5" fill={color} />
      <rect x="0" y="0" width="1.5" height={vh} fill={color} />
      <rect x={vw - 1.5} y="0" width="1.5" height={vh} fill={color} />
    </svg>,
    document.body
  );
}

export default function FinalResearchCredit() {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  const [isMobileTapped, setIsMobileTapped] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hoverTextRef = useRef(null);
  const containerRef = useRef(null);
  const mobileTimeoutRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (mobileTimeoutRef.current) clearTimeout(mobileTimeoutRef.current);
    };
  }, []);

  const showSVG = mounted && (isHovering || isMobileTapped);

  const handleClick = (e) => {
    if (!isMobile) return; // Desktop: let <a> navigate normally
    e.preventDefault();
    if (isMobileTapped) return; // Already animating
    setIsMobileTapped(true);
    mobileTimeoutRef.current = setTimeout(() => {
      setIsMobileTapped(false);
      window.location.href = "https://finalresearch.org";
    }, 1500);
  };

  const active = isHovering || isMobileTapped;

  return (
    <div
      ref={containerRef}
      style={isMobile ? { marginTop: "1rem" } : undefined}
    >
      <a
        href="https://finalresearch.org"
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        onMouseEnter={() => { if (!isMobile) setIsHovering(true); }}
        onMouseLeave={() => { if (!isMobile) setIsHovering(false); }}
        style={{
          position: "relative",
          display: "inline-block",
          fontSize: isMobile ? "0.7rem" : "0.75rem",
          textDecoration: "none",
          color: "#000000",
          cursor: "pointer",
        }}
      >
        {/* Default text */}
        <span
          style={{
            display: "inline-block",
            visibility: active ? "hidden" : "visible",
          }}
        >
          website by{" "}
          <span style={{ textTransform: "uppercase" }}>Final Research</span>
        </span>

        {/* Hover text */}
        <span
          ref={hoverTextRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            opacity: active ? 1 : 0,
            visibility: active ? "visible" : "hidden",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          finalresearch.org
        </span>
      </a>

      {showSVG && (
        <CornerLinesSVG
          hoverTextRef={hoverTextRef}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}
