"use client";

import { useRef, useEffect, useState } from "react";
import MediaGallery from "./MediaGallery";
import ProjectGrid from "./ProjectGrid";
import { useProject } from "@/context/ProjectContext";

export default function PortfolioShell({ projects, initialProject }) {
  const shellRef = useRef(null);
  const galleryRef = useRef(null);
  const gridRef = useRef(null);

  const {
    activeSlug,
    activeProject,
    showGallery,
    isSwitching,
    animationPhase,
    galleryScrollOpacity,
    setGalleryScrollOpacity,
    selectProject,
    prefetchProject,
    seedProject,
  } = useProject();

  // Track the last displayed project for fade-out
  const [displayedProject, setDisplayedProject] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Fixed top padding for landing view (shows 2 rows + peek from bottom)
  const [gridTopPadding, setGridTopPadding] = useState(0);
  const [isPaddingReady, setIsPaddingReady] = useState(false);

  // Grid peek position when project is selected (padding-top to push grid down)
  const [gridPeekTop, setGridPeekTop] = useState(null);

  // Peek amount (15% of first row height) - needed for fixed gallery height
  const [peekAmount, setPeekAmount] = useState(0);

  // Ref to persist landing padding value even when showGallery is true
  // This allows grid-returning animation to have a valid target
  const landingPaddingRef = useRef(0);

  // Track if grid transition should be enabled (persists through animation sequence)
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  // Starting position for grid return animation (captured when fading out)
  const [gridReturnStart, setGridReturnStart] = useState(null);

  // Seed the cache with SSR-fetched project on mount
  useEffect(() => {
    if (initialProject) {
      seedProject(initialProject);
    }
  }, [initialProject, seedProject]);

  // Calculate top padding for landing view
  // Shows first 2 rows with 3rd row peeking at the bottom of viewport
  // IMPORTANT: Always calculate and store in ref, but only set state when at landing
  useEffect(() => {
    const calculatePadding = () => {
      if (!gridRef.current) return;

      const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
      if (!rowContainer) return;

      const rowElements = Array.from(rowContainer.children);
      if (rowElements.length < 3) {
        setIsPaddingReady(true);
        return;
      }

      const vh = window.innerHeight;
      const gap = 24; // gap-6

      // Get first 2 rows and 3rd row for peek (from TOP of grid)
      const firstRow = rowElements[0];
      const secondRow = rowElements[1];
      const thirdRow = rowElements[2];

      // Height of content we want visible on load: 2 full rows + peek of 3rd
      const top2Height = firstRow.offsetHeight + gap + secondRow.offsetHeight;
      const peekAmount = thirdRow.offsetHeight * 0.08; // 8% peek to match project view
      const visibleOnLoad = top2Height + gap + peekAmount;

      // Padding needed to push grid down so only this content fills the viewport
      // (viewport height - visible content - base padding)
      const padding = Math.max(0, vh - visibleOnLoad - 16);

      // Always store in ref so grid-returning animation has valid target
      landingPaddingRef.current = padding;

      // Only set state when not showing gallery (otherwise it stays at 0 while gallery is open)
      if (!initialProject && !showGallery) {
        setGridTopPadding(padding);
      }
      setIsPaddingReady(true);
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(calculatePadding);
    window.addEventListener('resize', calculatePadding);
    return () => window.removeEventListener('resize', calculatePadding);
  }, [initialProject, showGallery]);

  // Calculate grid peek padding (used when project is selected)
  // This positions the grid so 15% of first row peeks at bottom of viewport
  // Key insight: Don't depend on gallery height - calculate based on viewport and row height only
  useEffect(() => {
    if (!gridRef.current) return;

    const calculate = () => {
      const rowContainer = gridRef.current?.querySelector('.w-full.flex.flex-col');
      const firstRow = rowContainer?.children[0];
      if (!firstRow) return;

      const peek = firstRow.offsetHeight * 0.15; // 15% of first row visible
      setPeekAmount(peek);
      // Grid paddingTop = viewport height - peekAmount positions first row at bottom with 15% showing
      setGridPeekTop(window.innerHeight - peek);
    };

    // Calculate after grid renders
    requestAnimationFrame(calculate);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [isPaddingReady]); // Only depends on grid being ready

  // Capture grid's visual position when starting to close (fade out)
  // This enables smooth animation: snap scroll to 0 immediately (no visual change),
  // then animate padding from captured position to landing
  useEffect(() => {
    if (animationPhase === 'gallery-fading-out' && gridPeekTop) {
      // Capture where grid currently appears: peek padding minus scroll offset
      const currentVisualPadding = gridPeekTop - window.scrollY;
      setGridReturnStart(currentVisualPadding);

      // Snap scroll to 0 immediately - visual position unchanged because padding matches
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    } else if (animationPhase === 'idle') {
      setGridReturnStart(null);
    }
  }, [animationPhase, gridPeekTop]);

  // Manage transition state to prevent mid-animation stutter
  // Enable transition BEFORE grid animation starts (during scroll/fade-out phases)
  // Keep it enabled through the full sequence, disable with delay after completion
  useEffect(() => {
    if (
      animationPhase === 'scrolling-to-peek' ||    // Enable before grid-animating
      animationPhase === 'grid-animating' ||
      animationPhase === 'gallery-fading-in' ||    // Keep enabled through fade-in
      animationPhase === 'gallery-fading-out' ||   // Enable before grid-returning
      animationPhase === 'grid-returning'
    ) {
      setTransitionEnabled(true);
    } else if (animationPhase === 'ready' || animationPhase === 'idle') {
      // Delay disabling transition to prevent snap when phase changes
      const timer = setTimeout(() => setTransitionEnabled(false), 100);
      return () => clearTimeout(timer);
    }
  }, [animationPhase]);

  const handleProjectClick = (project) => {
    selectProject(project.slug.current);
  };

  const handleProjectHover = (project) => {
    prefetchProject(project.slug.current);
  };

  // Determine if new project is ready
  const projectReady = activeProject?.slug?.current === activeSlug;
  const newProjectReady = showGallery && projectReady && !isSwitching;

  // Handle transitions between projects
  useEffect(() => {
    if (newProjectReady && activeProject) {
      // New project is ready - show it immediately (fade-in handled by CSS)
      setIsFadingOut(false);
      setDisplayedProject(activeProject);
    } else if (isSwitching && displayedProject) {
      // Switching started - begin fade out
      setIsFadingOut(true);
    } else if (!showGallery) {
      // Gallery closed - fade out then clear
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setDisplayedProject(null);
        setIsFadingOut(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [newProjectReady, activeProject, isSwitching, showGallery, displayedProject]);

  // Gallery opacity fades based on grid overlap
  // Gallery is fixed, grid scrolls over it - fade as they overlap
  useEffect(() => {
    if (!displayedProject || !gridRef.current) {
      return;
    }

    const handleScroll = () => {
      if (!gridRef.current) return;

      // Don't update opacity during animation phases - keep it at 1
      if (animationPhase !== 'ready') {
        return;
      }

      // Get the first row of tiles, not the grid container (which has padding)
      const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
      const firstRow = rowContainer?.children[0];
      if (!firstRow) return;

      const firstRowTop = firstRow.getBoundingClientRect().top;
      // Use peekAmount if available, otherwise estimate 15% of viewport
      const effectivePeek = peekAmount || window.innerHeight * 0.15;
      const galleryBottom = window.innerHeight - effectivePeek;
      const fadeEndY = window.innerHeight * 0.5; // Fully faded at 50% viewport

      if (firstRowTop >= galleryBottom) {
        // Grid hasn't reached gallery yet
        setGalleryScrollOpacity(1);
      } else if (firstRowTop <= fadeEndY) {
        // Grid past fade end point
        setGalleryScrollOpacity(0);
      } else {
        // Linear fade as grid overlaps gallery
        const progress = (galleryBottom - firstRowTop) / (galleryBottom - fadeEndY);
        setGalleryScrollOpacity(1 - progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayedProject, peekAmount, animationPhase, setGalleryScrollOpacity]);

  // Keep gallery container visible during transitions to prevent layout shift
  // Don't show during scrolling-to-peek from landing (prevents flash) - only show if switching projects
  const shouldShowGalleryContainer =
    displayedProject ||
    (showGallery && (animationPhase !== 'scrolling-to-peek' || isSwitching));

  // Calculate gallery opacity
  const computedGalleryOpacity = (() => {
    if (isFadingOut) return 0;
    if (animationPhase === 'gallery-fading-out') return 0;
    if (animationPhase === 'grid-animating' || animationPhase === 'scrolling-to-peek' || animationPhase === 'idle' || animationPhase === 'grid-returning') return 0;
    // In 'gallery-fading-in' or 'ready' phase, show based on scroll opacity
    return galleryScrollOpacity;
  })();

  return (
    <div ref={shellRef}>
      {/* Fixed gallery - stays in place while grid scrolls over it */}
      {shouldShowGalleryContainer && (
        <div
          ref={galleryRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 'calc(100% / 6)', // Sidebar width
            right: 0,
            height: peekAmount ? `calc(100vh - ${peekAmount}px)` : '85vh',
            zIndex: 10, // Above grid so it can receive pointer events
            opacity: computedGalleryOpacity,
            transition: (animationPhase === 'gallery-fading-in' || animationPhase === 'gallery-fading-out') ? "opacity 300ms ease-out" : "none",
            pointerEvents: computedGalleryOpacity < 0.1 ? 'none' : 'auto',
            overflow: 'hidden',
          }}
        >
          {displayedProject && (
            <MediaGallery
              key={displayedProject.slug?.current}
              project={displayedProject}
              allowAutoPlay={animationPhase === 'ready'}
            />
          )}
        </div>
      )}

      {/* Grid scrolls over the fixed gallery */}
      <div
        ref={gridRef}
        className="p-4"
        style={{
          position: 'relative',
          zIndex: 2,
          // When showing gallery, use gridPeekTop to position peek at bottom of viewport
          // When returning to home, animate back to landing padding (use ref for correct value)
          // Otherwise use landing padding from state
          paddingTop: (() => {
            // Returning home: use captured start position during fade-out, animate to landing during grid-returning
            if (animationPhase === 'gallery-fading-out' && gridReturnStart !== null) {
              return gridReturnStart;
            }
            if (animationPhase === 'grid-returning') {
              // Animate to landing position
              const landing = landingPaddingRef.current;
              return landing > 0 ? landing + 16 : 16;
            }

            // Going to project from landing: keep at landing during scroll, then animate to peek
            // But NOT when switching projects (already at peek)
            if (animationPhase === 'scrolling-to-peek' && !activeSlug) {
              // This case is for home page scroll-to-top, not for going to project
              return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
            }
            if (animationPhase === 'scrolling-to-peek' && activeSlug && !displayedProject) {
              // Coming from landing to project - keep at landing during scroll
              return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
            }

            // Normal peek position when gallery is open
            if (showGallery && gridPeekTop) {
              return gridPeekTop;
            }
            // Landing position
            return gridTopPadding > 0 ? gridTopPadding + 16 : 16;
          })(),
          // Use transitionEnabled to persist transition through animation sequence
          // This prevents stutter when phase changes mid-animation
          transition: transitionEnabled
            ? 'padding-top 800ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
          opacity: isPaddingReady ? 1 : 0,
        }}
      >
        <ProjectGrid
          projects={projects}
          onProjectClick={handleProjectClick}
          onProjectHover={handleProjectHover}
        />
      </div>
    </div>
  );
}
