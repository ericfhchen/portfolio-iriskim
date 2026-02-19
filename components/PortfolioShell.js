"use client";

import { useRef, useEffect, useState } from "react";
import MediaGallery from "./MediaGallery";
import InformationPage from "./InformationPage";
import ProjectGrid from "./ProjectGrid";
import { useProject } from "@/context/ProjectContext";
import { useHover } from "@/context/HoverContext";
import { materialEase, cancellableScrollTo } from "@/lib/easing";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function PortfolioShell({ projects, initialProject, initialInformation, settings }) {
  const shellRef = useRef(null);
  const galleryRef = useRef(null);
  const gridRef = useRef(null);
  const mediaGalleryRef = useRef(null);

  const {
    activeSlug,
    activeProject,
    isInformationActive,
    showGallery,
    isSwitching,
    animationPhase,
    galleryScrollOpacity,
    setGalleryScrollOpacity,
    jsAnimationTarget,
    isSameProjectScrollingRef,
    selectProject,
    prefetchProject,
    seedProject,
    seedProjects,
    seedInformation,
  } = useProject();

  // Track the last displayed project for fade-out
  const [displayedProject, setDisplayedProject] = useState(null);

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

  // Track previous viewport width to avoid recalculating padding on height-only changes
  // (prevents layout shift from Safari/Chrome dynamic browser UI)
  const prevViewportWidthRef = useRef(0);

  // Track if grid transition should be enabled (persists through animation sequence)
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  // Track if grid is overlapping the gallery (for pointer events and video pause)
  const [isGridOverlapping, setIsGridOverlapping] = useState(false);

  // Button animation state for sequenced fade transitions
  const [buttonPhase, setButtonPhase] = useState('idle'); // 'idle' | 'fading-out' | 'fading-in'
  const wasOverlappingRef = useRef(false);

  const isMobile = useIsMobile();

  // Get hover context for scroll handler registration and hover lock
  const { registerScrollHandler, unregisterScrollHandler, setIsHoverLocked } = useHover();

  // Ref to track current scroll animation for cancellation
  const scrollAnimationRef = useRef(null);

  // Ref to skip scroll handler work during "keep browsing" animation
  const isAnimatingKeepBrowsingRef = useRef(false);

  // Refs to track previous scroll state (avoids re-renders during scroll animation)
  const prevOverlappingRef = useRef(false);
  const prevOpacityRef = useRef(1);

  // Refs for debouncing rapid sidebar hovers
  const hoverScrollTimeoutRef = useRef(null);
  const lastHoverTimeRef = useRef(0);
  const currentScrollTargetRowRef = useRef(null); // Track which row we're scrolling to

  // Seed the cache with SSR-fetched project on mount, or seed information page
  useEffect(() => {
    seedProjects(projects);        // warm cache with all SSR project data
    if (initialProject) {
      seedProject(initialProject);
    } else if (initialInformation) {
      // Direct URL load of /?information - skip animation, go straight to ready
      seedInformation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate top padding for landing view
  // Desktop: shows first 2 rows with 3rd row peeking at the bottom of viewport
  // Mobile: shows first 4 rows with 5th row peeking at the bottom of viewport
  // IMPORTANT: Always calculate and store in ref, but only set state when at landing
  useEffect(() => {
    const calculatePadding = (forceRecalc = false) => {
      if (!gridRef.current) return;

      const currentWidth = window.innerWidth;

      // Skip recalculation if only height changed (prevents Safari/Chrome browser UI shift)
      // Always calculate on first run (prevViewportWidthRef.current === 0) or when forced
      if (!forceRecalc && prevViewportWidthRef.current !== 0 && currentWidth === prevViewportWidthRef.current) {
        return;
      }
      prevViewportWidthRef.current = currentWidth;

      const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
      if (!rowContainer) return;

      const rowElements = Array.from(rowContainer.children);
      const mobile = currentWidth <= 640;
      const visibleRows = mobile ? 3 : 2;
      const peekRowIndex = visibleRows; // 0-indexed: row after the visible ones

      if (rowElements.length < peekRowIndex + 1) {
        setIsPaddingReady(true);
        return;
      }

      const vh = window.innerHeight;
      const gap = 24; // gap-6

      // Sum height of all fully-visible rows + gaps between them
      let topRowsHeight = 0;
      for (let i = 0; i < visibleRows; i++) {
        topRowsHeight += rowElements[i].offsetHeight;
        if (i < visibleRows - 1) topRowsHeight += gap;
      }
      const peekRow = rowElements[peekRowIndex];
      const peekAmount = peekRow.offsetHeight * 0.08; // 8% peek to match project view
      const visibleOnLoad = topRowsHeight + gap + peekAmount;

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

    const handleResize = () => calculatePadding(false);

    // Use requestAnimationFrame to ensure DOM is ready
    // Retry if rows aren't ready yet (ProjectGrid may still be rendering with fallback width)
    let retryCount = 0;
    const maxRetries = 5;
    const attemptCalculation = () => {
      const rowContainer = gridRef.current?.querySelector('.w-full.flex.flex-col');
      const rowElements = rowContainer ? Array.from(rowContainer.children) : [];
      const mobile = window.innerWidth <= 640;
      const neededRows = mobile ? 4 : 3;

      if (rowElements.length < neededRows && retryCount < maxRetries) {
        retryCount++;
        requestAnimationFrame(attemptCalculation);
        return;
      }
      calculatePadding(true);
    };
    // Wait for React hydration cycle to complete before calculating
    // ProjectGrid starts with windowWidth=0, then updates - we need to wait for that
    setTimeout(() => {
      requestAnimationFrame(attemptCalculation);
    }, 0);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialProject, showGallery]);

  // Calculate grid peek padding (used when project is selected)
  // Positions grid so first row peeks at bottom of viewport (~35-40px visible)
  // Mobile uses 25% of row height, desktop uses 15% (mobile rows are smaller)
  useEffect(() => {
    if (!gridRef.current) return;

    const calculate = () => {
      const rowContainer = gridRef.current?.querySelector('.w-full.flex.flex-col');
      const firstRow = rowContainer?.children[0];
      if (!firstRow) return;

      const isMobile = window.innerWidth <= 640;
      const peekPercent = isMobile ? 0.25 : 0.15; // Mobile needs higher % for same visual peek (~35-40px)
      const peek = firstRow.offsetHeight * peekPercent;
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

  // Handle "keep browsing" click - scroll grid so first row aligns with top
  const handleKeepBrowsingClick = () => {
    // Guard: Ignore if already animating
    if (isAnimatingKeepBrowsingRef.current) return;

    const rowContainer = gridRef.current?.querySelector('.w-full.flex.flex-col');
    const firstRow = rowContainer?.children[0];
    if (!firstRow) return;

    // Start fade out of button text immediately (CSS transition handles the fade)
    setButtonPhase('fading-out');

    const firstRowTop = firstRow.getBoundingClientRect().top;
    const targetY = window.scrollY + firstRowTop - 8; // 8px offset from top
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 800;
    const startTime = performance.now();

    // Get gallery element for direct opacity manipulation
    const galleryElement = galleryRef.current;
    const effectivePeek = peekAmount || window.innerHeight * 0.15;
    const galleryBottom = window.innerHeight - effectivePeek;
    const fadeEndY = window.innerHeight * 0.5;
    const fadeStartY = galleryBottom * 0.9; // Start fading at 15% overlap

    // Skip React scroll handler during animation
    isAnimatingKeepBrowsingRef.current = true;

    // Lock hover state to prevent rapid hover triggers as grid scrolls over tiles
    setIsHoverLocked(true);

    // Hint to browser to optimize for scroll - promote grid to compositor layer
    if (gridRef.current) {
      gridRef.current.style.willChange = 'transform';
    }

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = materialEase(progress);

      const currentScrollY = startY + distance * eased;
      window.scrollTo(0, currentScrollY);

      // Calculate and apply gallery opacity directly (no React state)
      if (galleryElement) {
        // Estimate where first row will be after this scroll
        const estimatedFirstRowTop = firstRowTop - (currentScrollY - startY);
        const fadeStartY = galleryBottom * 0.9; // Start fading at 15% overlap

        let opacity;
        if (estimatedFirstRowTop >= fadeStartY) {
          opacity = 1;
        } else if (estimatedFirstRowTop <= fadeEndY) {
          opacity = 0;
        } else {
          // Fade from 0.75 to 0 - immediate visual feedback that gallery is inactive
          const fadeProgress = (fadeStartY - estimatedFirstRowTop) / (fadeStartY - fadeEndY);
          opacity = 0.65 * (1 - fadeProgress);
        }

        galleryElement.style.opacity = opacity;

        // Also update overlap state for pointer events - sync with fade start
        const overlapping = estimatedFirstRowTop < fadeStartY;
        galleryElement.style.pointerEvents = overlapping ? 'none' : 'auto';
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - clean up
        isAnimatingKeepBrowsingRef.current = false;
        setIsHoverLocked(false);
        if (gridRef.current) {
          gridRef.current.style.willChange = 'auto';
        }

        // Trigger one scroll handler call to sync React state with final position
        // This ensures isGridOverlapping and galleryScrollOpacity match final values
        window.dispatchEvent(new Event('scroll'));

        // Start fade in of new button text
        setButtonPhase('fading-in');
        setTimeout(() => setButtonPhase('idle'), 300);
      }
    }

    requestAnimationFrame(animate);
  };

  // Handle "back to project" click - scroll back up to show gallery
  const handleBackToProjectClick = () => {
    // Guard: Ignore if already animating
    if (isAnimatingKeepBrowsingRef.current) return;

    // Start fade out of button text immediately (CSS transition handles the fade)
    setButtonPhase('fading-out');

    const duration = 800;
    const startTime = performance.now();
    const startY = window.scrollY;
    const targetY = 0;
    const distance = targetY - startY;

    const galleryElement = galleryRef.current;
    const effectivePeek = peekAmount || window.innerHeight * 0.15;
    const galleryBottom = window.innerHeight - effectivePeek;
    const fadeEndY = window.innerHeight * 0.5;

    isAnimatingKeepBrowsingRef.current = true;
    setIsHoverLocked(true);

    if (gridRef.current) {
      gridRef.current.style.willChange = 'transform';
    }

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = materialEase(progress);

      const currentScrollY = startY + distance * eased;
      window.scrollTo(0, currentScrollY);

      // Fade gallery back in as we scroll up
      if (galleryElement) {
        const rowContainer = gridRef.current?.querySelector('.w-full.flex.flex-col');
        const firstRow = rowContainer?.children[0];
        if (firstRow) {
          const estimatedFirstRowTop = firstRow.getBoundingClientRect().top;
          const fadeStartY = galleryBottom * 0.9; // Start fading at 15% overlap

          let opacity;
          if (estimatedFirstRowTop >= fadeStartY) {
            opacity = 1;
          } else if (estimatedFirstRowTop <= fadeEndY) {
            opacity = 0;
          } else {
            // Fade from 0.75 to 0 - immediate visual feedback that gallery is inactive
            const fadeProgress = (fadeStartY - estimatedFirstRowTop) / (fadeStartY - fadeEndY);
            opacity = 0.65 * (1 - fadeProgress);
          }

          galleryElement.style.opacity = opacity;
          // Sync clickability with fade start
          const overlapping = estimatedFirstRowTop < fadeStartY;
          galleryElement.style.pointerEvents = overlapping ? 'none' : 'auto';
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isAnimatingKeepBrowsingRef.current = false;
        setIsHoverLocked(false);
        if (gridRef.current) {
          gridRef.current.style.willChange = 'auto';
        }
        window.dispatchEvent(new Event('scroll'));

        // Start fade in of new button text
        setButtonPhase('fading-in');
        setTimeout(() => setButtonPhase('idle'), 300);
      }
    }

    requestAnimationFrame(animate);
  };

  // Determine if new project is ready
  const projectReady = activeProject?.slug?.current === activeSlug;
  const newProjectReady = showGallery && projectReady && !isSwitching;

  // Handle transitions between projects
  // Use animationPhase to control when displayedProject swaps, not isSwitching
  // (isSwitching gets batched by React and is never seen as true during project switches)
  useEffect(() => {
    // Gallery closing: clear displayed project after fade
    if (!showGallery && displayedProject) {
      const timer = setTimeout(() => {
        setDisplayedProject(null);
      }, 300);
      return () => clearTimeout(timer);
    }

    // Switching to information page: clear displayed project
    if (isInformationActive && displayedProject) {
      setDisplayedProject(null);
      return;
    }

    // Gallery fading in: update displayed project to new project
    // This happens AFTER gallery-fading-out completes in ProjectContext
    if (animationPhase === 'gallery-fading-in' && activeProject) {
      setDisplayedProject(activeProject);
    }

    // First project load (from landing or direct URL)
    // No fade-out needed, just show the project
    if (showGallery && activeProject && !displayedProject && animationPhase !== 'gallery-fading-out') {
      setDisplayedProject(activeProject);
    }
  }, [animationPhase, activeProject, isInformationActive, showGallery, displayedProject]);

  // Gallery opacity fades based on grid overlap
  // Gallery is fixed, grid scrolls over it - fade as they overlap
  useEffect(() => {
    if ((!displayedProject && !isInformationActive) || !gridRef.current) {
      return;
    }

    const handleScroll = () => {
      if (!gridRef.current) return;

      // Skip all scroll handler work during "keep browsing" animation
      // This prevents React state updates from causing jank
      if (isAnimatingKeepBrowsingRef.current) return;

      // Skip scroll handler during same-project scroll animation
      // This prevents ~48 setState calls during the 800ms animation
      if (isSameProjectScrollingRef?.current) return;

      // Get the first row of tiles, not the grid container (which has padding)
      const rowContainer = gridRef.current.querySelector('.w-full.flex.flex-col');
      const firstRow = rowContainer?.children[0];
      if (!firstRow) return;

      const firstRowTop = firstRow.getBoundingClientRect().top;
      // Use peekAmount if available, otherwise estimate 15% of viewport
      const effectivePeek = peekAmount || window.innerHeight * 0.15;
      const galleryBottom = window.innerHeight - effectivePeek;

      const fadeEndY = window.innerHeight * 0.5; // Fully faded at 50% viewport

      // Surgical threshold: fade starts exactly when grid reaches bottom of thumbnail row
      const thumbnailBottom = mediaGalleryRef.current?.getThumbnailBottom?.() ?? null;
      const fadeStartY = thumbnailBottom !== null ? thumbnailBottom : galleryBottom;

      // DEBUG
      console.log('[scroll]', {
        firstRowTop: Math.round(firstRowTop),
        galleryBottom: Math.round(galleryBottom),
        thumbnailBottom: thumbnailBottom !== null ? Math.round(thumbnailBottom) : 'n/a',
        fadeStartY: Math.round(fadeStartY),
        isGridOverlapping,
      });

      // ALWAYS update overlap state (used for pointer events and video pause)
      // This must run regardless of animation phase
      // Use fadeStartY so clickability syncs with when fade begins
      const overlapping = firstRowTop < fadeStartY;
      // Only update state if value changed (prevents re-renders during scroll animation)
      if (overlapping !== prevOverlappingRef.current) {
        prevOverlappingRef.current = overlapping;
        setIsGridOverlapping(overlapping);
      }

      // Don't update opacity during animation phases - keep it at 1
      // This also prevents re-renders during JS animation
      if (animationPhase !== 'ready') {
        return;
      }

      let newOpacity;
      if (firstRowTop >= fadeStartY) {
        // Grid hasn't reached fade start yet
        newOpacity = 1;
      } else if (firstRowTop <= fadeEndY) {
        // Grid past fade end point
        newOpacity = 0;
      } else {
        // Fade from 0.75 to 0 - immediate visual feedback that gallery is inactive
        const progress = (fadeStartY - firstRowTop) / (fadeStartY - fadeEndY);
        newOpacity = 0.65 * (1 - progress);
      }

      // Only update if opacity changed significantly (prevents re-renders during scroll)
      if (Math.abs(newOpacity - prevOpacityRef.current) > 0.01) {
        prevOpacityRef.current = newOpacity;
        setGalleryScrollOpacity(newOpacity);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayedProject, isInformationActive, peekAmount, animationPhase, setGalleryScrollOpacity]);

  // Pause video when grid overlaps gallery, resume when overlap ends (projects only)
  useEffect(() => {
    if (animationPhase !== 'ready' || isInformationActive) return;

    if (isGridOverlapping) {
      mediaGalleryRef.current?.pauseVideo();
    } else {
      mediaGalleryRef.current?.resumeVideo();
    }
  }, [isGridOverlapping, animationPhase, isInformationActive]);

  // Handle manual scroll changing overlap state - animate button text
  useEffect(() => {
    // Skip during animation phases or when button is already animating
    if (animationPhase !== 'ready' || isAnimatingKeepBrowsingRef.current) return;

    // Detect change in overlap state from manual scrolling
    if (wasOverlappingRef.current !== isGridOverlapping && buttonPhase === 'idle') {
      // Manual scroll changed overlap state - animate text
      setButtonPhase('fading-out');
      setTimeout(() => {
        setButtonPhase('fading-in');
        setTimeout(() => setButtonPhase('idle'), 300);
      }, 300);
    }
    wasOverlappingRef.current = isGridOverlapping;
  }, [isGridOverlapping, animationPhase, buttonPhase]);

  // Sidebar hover scroll handler
  // Scrolls to make the hovered project's row visible
  // Note: Sidebar already filters out boundary oscillation, so we only need
  // to debounce rapid intentional sweeping (user moving through many items)
  useEffect(() => {
    const RAPID_SWEEP_THRESHOLD = 80; // ms - if hovers come faster than this, user is sweeping
    const SWEEP_DEBOUNCE = 100; // ms - wait this long for user to settle during sweep

    const handleSidebarHoverScroll = (slug) => {
      // Check phase constraints first:
      // - Home page (idle): always active
      // - Project page (ready): only when grid is overlapping gallery
      if (animationPhase === 'idle') {
        // OK - home page, proceed
      } else if (animationPhase === 'ready' && isGridOverlapping) {
        // OK - project page with grid overlapping, proceed
      } else {
        // Not in a valid phase for scrolling
        return;
      }

      if (!gridRef.current) return;

      // Find the tile and its row early so we can check if it's the same row
      const tile = gridRef.current.querySelector(`[data-slug="${slug}"]`);
      if (!tile) return;

      const tileWrapper = tile.parentElement;
      const row = tileWrapper?.parentElement;
      if (!row) return;

      // If we're already scrolling to this row (or it's the current target), skip
      if (currentScrollTargetRowRef.current === row) {
        return;
      }

      // Track timing for sweep detection
      const now = Date.now();
      const timeSinceLastHover = now - lastHoverTimeRef.current;
      lastHoverTimeRef.current = now;

      // Clear any pending debounced scroll
      if (hoverScrollTimeoutRef.current) {
        clearTimeout(hoverScrollTimeoutRef.current);
        hoverScrollTimeoutRef.current = null;
      }

      // Cancel any ongoing scroll animation (we're switching to a different row)
      if (scrollAnimationRef.current) {
        scrollAnimationRef.current.cancel();
        scrollAnimationRef.current = null;
      }

      const executeScroll = () => {
        // Check if row is already fully visible
        const rowRect = row.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const topOffset = 16;
        const bottomOffset = 16;

        // Row is fully visible if its top and bottom are within the viewport (with offsets)
        const isFullyVisible = rowRect.top >= topOffset && rowRect.bottom <= (viewportHeight - bottomOffset);

        if (isFullyVisible) {
          // No scroll needed, but mark this row as current target
          currentScrollTargetRowRef.current = row;
          return;
        }

        // Closest-edge anchoring: anchor to whichever edge requires less movement
        const rowCenter = rowRect.top + rowRect.height / 2;
        const viewportMidpoint = viewportHeight / 2;

        let targetY;
        if (rowCenter < viewportMidpoint) {
          // Row is above center → anchor row top to viewport top
          targetY = window.scrollY + rowRect.top - topOffset;
        } else {
          // Row is below center → anchor row bottom to viewport bottom
          targetY = window.scrollY + rowRect.bottom - (viewportHeight - bottomOffset);
        }

        // Mark this row as the current scroll target
        currentScrollTargetRowRef.current = row;

        // Start cancellable scroll animation
        scrollAnimationRef.current = cancellableScrollTo(targetY, 400);
      };

      if (timeSinceLastHover > RAPID_SWEEP_THRESHOLD) {
        // Normal hover (not sweeping) → scroll immediately
        executeScroll();
      } else {
        // Rapid sweeping → short debounce to let user settle
        hoverScrollTimeoutRef.current = setTimeout(executeScroll, SWEEP_DEBOUNCE);
      }
    };

    const handleHoverClear = () => {
      // Reset row target when hover clears (mouse left sidebar)
      currentScrollTargetRowRef.current = null;
    };

    // Skip hover scroll handlers on mobile - no hover states
    if (isMobile) return;

    registerScrollHandler(handleSidebarHoverScroll, handleHoverClear);

    return () => {
      unregisterScrollHandler();
      // Cancel any ongoing animation on cleanup
      if (scrollAnimationRef.current) {
        scrollAnimationRef.current.cancel();
        scrollAnimationRef.current = null;
      }
      // Clear any pending debounced scroll on cleanup
      if (hoverScrollTimeoutRef.current) {
        clearTimeout(hoverScrollTimeoutRef.current);
        hoverScrollTimeoutRef.current = null;
      }
      // Reset row target
      currentScrollTargetRowRef.current = null;
    };
  }, [animationPhase, isGridOverlapping, isMobile, registerScrollHandler, unregisterScrollHandler]);

  // Keep gallery container visible during transitions to prevent layout shift
  // Don't show during scrolling-to-peek from landing (prevents flash) - only show if switching projects
  const shouldShowGalleryContainer =
    displayedProject ||
    isInformationActive ||
    (showGallery && (animationPhase !== 'scrolling-to-peek' || isSwitching));

  // Calculate gallery opacity based on animation phase
  const computedGalleryOpacity = (() => {
    // Fading out (project switch or closing)
    if (animationPhase === 'gallery-fading-out') {
      return 0;
    }
    // Fading in: keep at 0 until displayedProject matches activeProject
    // This prevents showing old project at full opacity before swap
    // For information page, no displayedProject needed - just show at scroll opacity
    if (animationPhase === 'gallery-fading-in') {
      if (isInformationActive) return galleryScrollOpacity;
      const projectsMatch = displayedProject?.slug?.current === activeProject?.slug?.current;
      return projectsMatch ? galleryScrollOpacity : 0;
    }
    // Grid animating, scrolling, or returning - gallery hidden
    if (animationPhase === 'grid-animating' || animationPhase === 'scrolling-to-peek' || animationPhase === 'idle' || animationPhase === 'grid-returning' || animationPhase === 'grid-returning-js') {
      return 0;
    }
    // In 'gallery-preparing-fade-out' or 'ready' phase, show based on scroll opacity
    return galleryScrollOpacity;
  })();

  // Determine if gallery transition should be enabled
  const galleryTransitionEnabled =
    animationPhase === 'gallery-fading-in' ||
    animationPhase === 'gallery-fading-out' ||
    animationPhase === 'gallery-preparing-fade-out' ||
    isSameProjectScrollingRef?.current;  // Enable transition during same-project scroll

  return (
    <div ref={shellRef}>
      {/* Fixed "back to project" button - visible when grid overlaps gallery (not for information page) */}
      {displayedProject && !isInformationActive && animationPhase === 'ready' && isGridOverlapping && (
        <button
          onClick={handleBackToProjectClick}
          style={{
            position: 'fixed',
            top: isMobile ? '0.5rem' : '1rem',
            right: 11,
            zIndex: 100,
            opacity: buttonPhase === 'idle' ? 1 : 0,
            transition: 'opacity 300ms, color 300ms',
            pointerEvents: buttonPhase === 'idle' ? 'auto' : 'none',
          }}
          className="text-muted hover:text-black cursor-pointer"
        >
          back to project
        </button>
      )}

      {/* Fixed gallery - stays in place while grid scrolls over it */}
      {shouldShowGalleryContainer && (
        <div
          ref={galleryRef}
          style={{
            position: 'fixed',
            top: 0,
            left: isMobile ? 0 : 'calc(100% / 6)',
            right: 0,
            height: peekAmount ? `calc(100dvh - ${peekAmount}px)` : '85dvh',
            // When gallery is fading, drop z-index below grid so tiles receive clicks
            zIndex: computedGalleryOpacity < 0.1 ? 1 : 10,
            opacity: computedGalleryOpacity,
            transition: galleryTransitionEnabled ? "opacity 300ms ease-out" : "none",
            // Container never blocks clicks on grid tiles beneath it
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div style={{
            pointerEvents: isGridOverlapping ? 'none' : 'auto',
            height: peekAmount ? `calc(100% - ${peekAmount}px)` : 'calc(100% - 15dvh)',
            overflow: 'hidden',
          }}>
            {isInformationActive ? (
              <InformationPage settings={settings} />
            ) : displayedProject ? (
              <MediaGallery
                ref={mediaGalleryRef}
                key={displayedProject.slug?.current}
                project={displayedProject}
                allowAutoPlay={animationPhase === 'ready'}
                controlsDisabled={isGridOverlapping}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Grid scrolls over the fixed gallery */}
      <div
        ref={gridRef}
        className="p-2 sm:p-4"
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
        <div style={{ position: 'relative' }}>
          {/* Keep browsing button - visible at peek position (not overlapping) */}
          {(displayedProject || isInformationActive) && animationPhase === 'ready' && !isGridOverlapping && (
            <button
              onClick={handleKeepBrowsingClick}
              style={{
                position: 'absolute',
                top: -2,
                right: 0,
                zIndex: 100,
                opacity: buttonPhase === 'idle' ? 1 : 0,
                transition: 'opacity 300ms, color 300ms',
                pointerEvents: buttonPhase === 'idle' ? 'auto' : 'none',
              }}
              className="text-muted hover:text-black cursor-pointer"
            >
              keep browsing
            </button>
          )}
          <ProjectGrid
            projects={projects}
            onProjectClick={handleProjectClick}
            onProjectHover={handleProjectHover}
          />
        </div>
      </div>
    </div>
  );
}
