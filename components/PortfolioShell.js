"use client";

import { useRef, useEffect, useState } from "react";
import MediaGallery from "./MediaGallery";
import ProjectGrid from "./ProjectGrid";
import { useProject } from "@/context/ProjectContext";
import { materialEase } from "@/lib/easing";

export default function PortfolioShell({ projects, initialProject }) {
  const shellRef = useRef(null);
  const galleryRef = useRef(null);
  const gridRef = useRef(null);
  const mediaGalleryRef = useRef(null);

  const {
    activeSlug,
    activeProject,
    showGallery,
    isSwitching,
    animationPhase,
    galleryScrollOpacity,
    setGalleryScrollOpacity,
    jsAnimationTarget,
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

  // Track if grid is overlapping the gallery (for pointer events and video pause)
  const [isGridOverlapping, setIsGridOverlapping] = useState(false);



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



  // JS animation for synchronized scroll+padding (used by grid-returning-js phase)
  // IMPORTANT: Directly manipulate DOM to avoid React re-renders during animation
  useEffect(() => {
    if (animationPhase !== 'grid-returning-js' || !jsAnimationTarget || !gridRef.current) {
      return;
    }

    const gridElement = gridRef.current;
    const startScrollY = window.scrollY;
    const startPadding = gridPeekTop || 0;
    // Calculate target padding - this MUST match what React will compute in 'idle' phase
    const landingPadding = landingPaddingRef.current;
    const targetPadding = landingPadding > 0 ? landingPadding + 16 : 16;
    const duration = 800;
    const startTime = performance.now();

    // Disable CSS transition during JS animation
    gridElement.style.transition = 'none';
    // Set initial padding directly on DOM
    gridElement.style.paddingTop = `${startPadding}px`;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = materialEase(progress);

      // Update both scroll and padding in the same frame - direct DOM manipulation
      const newScrollY = startScrollY * (1 - eased); // Simpler: goes from startScrollY to 0
      const newPadding = startPadding + (targetPadding - startPadding) * eased;

      window.scrollTo(0, newScrollY);
      gridElement.style.paddingTop = `${newPadding}px`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we land exactly on target values
        window.scrollTo(0, 0);
        gridElement.style.paddingTop = `${targetPadding}px`;

        // Use requestAnimationFrame to let the browser paint the final frame
        // before we notify React - prevents jitter from React re-render
        requestAnimationFrame(() => {
          jsAnimationTarget.onComplete?.();
        });
      }
    }

    requestAnimationFrame(animate);
  }, [animationPhase, jsAnimationTarget, gridPeekTop]);

  // Manage transition state to prevent mid-animation stutter
  // Enable transition BEFORE grid animation starts (during scroll/fade-out phases)
  // Keep it enabled through the full sequence, disable with delay after completion
  // NOTE: grid-returning-js uses JS animation, not CSS transition
  useEffect(() => {
    if (
      animationPhase === 'scrolling-to-peek' ||    // Enable before grid-animating
      animationPhase === 'grid-animating' ||
      animationPhase === 'gallery-fading-in' ||    // Keep enabled through fade-in
      animationPhase === 'gallery-fading-out'      // Enable before grid-returning
      // NOTE: grid-returning and grid-returning-js don't need CSS transition
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

      // Get the first row of tiles, not the grid container (which has padding)
      const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
      const firstRow = rowContainer?.children[0];
      if (!firstRow) return;

      const firstRowTop = firstRow.getBoundingClientRect().top;
      // Use peekAmount if available, otherwise estimate 15% of viewport
      const effectivePeek = peekAmount || window.innerHeight * 0.15;
      const galleryBottom = window.innerHeight - effectivePeek;

      // ALWAYS update overlap state (used for pointer events and video pause)
      // This must run regardless of animation phase
      // Add threshold so peek position doesn't count as overlapping
      // This prevents immediate pause after autoplay (peek puts grid ~0.01px inside gallery bottom)
      const overlapThreshold = effectivePeek; // ~15% of first row height (~35-40px)
      const overlapping = firstRowTop < (galleryBottom - overlapThreshold);
      setIsGridOverlapping(overlapping);

      // Don't update opacity during animation phases - keep it at 1
      // This also prevents re-renders during JS animation
      if (animationPhase !== 'ready') {
        return;
      }

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

  // Pause video when grid overlaps gallery, resume when overlap ends
  useEffect(() => {
    if (animationPhase !== 'ready') return;

    if (isGridOverlapping) {
      mediaGalleryRef.current?.pauseVideo();
    } else {
      mediaGalleryRef.current?.resumeVideo();
    }
  }, [isGridOverlapping, animationPhase]);

  // Keep gallery container visible during transitions to prevent layout shift
  // Don't show during scrolling-to-peek from landing (prevents flash) - only show if switching projects
  const shouldShowGalleryContainer =
    displayedProject ||
    (showGallery && (animationPhase !== 'scrolling-to-peek' || isSwitching));

  // Calculate gallery opacity
  const computedGalleryOpacity = (() => {
    if (isFadingOut) return 0;
    if (animationPhase === 'gallery-fading-out') return 0;
    if (animationPhase === 'grid-animating' || animationPhase === 'scrolling-to-peek' || animationPhase === 'idle' || animationPhase === 'grid-returning' || animationPhase === 'grid-returning-js') return 0;
    // In 'gallery-fading-in', 'gallery-preparing-fade-out', or 'ready' phase, show based on scroll opacity
    return galleryScrollOpacity;
  })();

  // Determine if gallery transition should be enabled
  // Enable transition slightly before opacity changes to prevent flicker
  const galleryTransitionEnabled =
    animationPhase === 'gallery-fading-in' ||
    animationPhase === 'gallery-fading-out' ||
    animationPhase === 'gallery-preparing-fade-out';

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
            // When gallery is fading, drop z-index below grid so tiles receive clicks
            zIndex: computedGalleryOpacity < 0.1 ? 1 : 10,
            opacity: computedGalleryOpacity,
            transition: galleryTransitionEnabled ? "opacity 300ms ease-out" : "none",
            // Disable pointer events when gallery is faded out, re-enable when visible
            pointerEvents: isGridOverlapping ? 'none' : 'auto',
            overflow: 'hidden',
          }}
        >
          {displayedProject && (
            <MediaGallery
              ref={mediaGalleryRef}
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
            // During JS animation, padding is set directly on DOM - return undefined to not interfere
            // Actually we need a value here, but JS animation overrides it via direct DOM manipulation
            if (animationPhase === 'grid-returning-js') {
              // This value is immediately overwritten by the JS animation
              return gridPeekTop;
            }

            // Returning home: fade out gallery first, then JS animates grid to landing
            if (animationPhase === 'gallery-fading-out') {
              return gridPeekTop;
            }

            // Opening project: CSS transition animates padding from landing to peek
            // while JS animates scroll from current to 0 - both happen simultaneously
            if (animationPhase === 'grid-animating') {
              // If we already have a displayed project, we're switching projects
              // Stay at peek padding (no padding animation, only scroll animation)
              if (displayedProject) {
                return gridPeekTop;
              }
              // Coming from landing - wait for transition to be enabled before changing padding
              if (!transitionEnabled) {
                const landing = landingPaddingRef.current;
                return landing > 0 ? landing + 16 : 16;
              }
              return gridPeekTop;
            }

            // Normal peek position when gallery is open
            // BUT NOT during idle phase - we need to stay at landing until grid-animating starts
            if (showGallery && gridPeekTop && animationPhase !== 'idle') {
              return gridPeekTop;
            }
            // Landing position - use ref for most accurate value (state may be stale after gallery close)
            const landingPadding = landingPaddingRef.current || gridTopPadding;
            return landingPadding > 0 ? landingPadding + 16 : 16;
          })(),
          // Use transitionEnabled to persist transition through animation sequence
          // This prevents stutter when phase changes mid-animation
          // IMPORTANT: Disable CSS transition during JS animation
          // IMPORTANT: The cubic-bezier must match materialEase in lib/easing.js exactly
          transition: (transitionEnabled && animationPhase !== 'grid-returning-js') ? 'padding-top 800ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
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
