"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { freshClient } from "@/sanity/lib/client";
import { projectDetailQuery } from "@/sanity/lib/queries";
import { smoothScrollTo, materialEase } from "@/lib/easing";

const ProjectContext = createContext(null);

export function ProjectProvider({ children, projects }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cache of fetched project details: slug -> project data
  const [projectCache, setProjectCache] = useState({});
  const cacheRef = useRef(projectCache);

  // Keep ref in sync with state
  useEffect(() => {
    cacheRef.current = projectCache;
  }, [projectCache]);

  // Currently active project slug
  const [activeSlug, setActiveSlug] = useState(null);

  // Whether gallery should be visible
  const [showGallery, setShowGallery] = useState(false);

  // Whether we're in the middle of switching projects (to prevent flicker)
  const [isSwitching, setIsSwitching] = useState(false);

  // Animation phase for sequenced transitions
  // 'grid-entering' | 'idle' | 'scrolling-to-peek' | 'grid-animating' | 'gallery-fading-in' | 'ready'
  // Return phases: 'gallery-fading-out' | 'grid-returning'
  const [animationPhase, setAnimationPhase] = useState('idle');

  // Gallery opacity based on scroll/overlap (set by PortfolioShell, consumed by SidebarClient)
  const [galleryScrollOpacity, setGalleryScrollOpacity] = useState(1);

  // Track the target slug during programmatic navigation (ref for synchronous access)
  // Uses undefined to mean "no navigation in progress", null means "navigating to home"
  const navigationTargetRef = useRef(undefined);

  // Track when scrolling to same project (used to skip scroll handlers and enable CSS transition)
  const isSameProjectScrollingRef = useRef(false);

  // JS animation target - when set, PortfolioShell will animate padding via JS instead of CSS
  // { targetPadding: number, duration: number, onComplete: () => void } | null
  const [jsAnimationTarget, setJsAnimationTarget] = useState(null);

  // Fetch a project and cache it
  const fetchProject = useCallback(async (slug) => {
    // Check current cache via ref to avoid stale closure
    if (cacheRef.current[slug]) {
      return cacheRef.current[slug];
    }

    try {
      const project = await freshClient.fetch(projectDetailQuery, { slug });
      if (project) {
        setProjectCache((prev) => ({ ...prev, [slug]: project }));
      }
      return project;
    } catch (error) {
      console.error("Failed to fetch project:", error);
      return null;
    }
  }, []);

  // Seed the cache with a project (called from PortfolioShell with SSR data)
  const seedProject = useCallback((project) => {
    if (project && project.slug?.current) {
      const slug = project.slug.current;
      setProjectCache((prev) => {
        if (prev[slug]) return prev;
        return { ...prev, [slug]: project };
      });
      setActiveSlug(slug);
      setShowGallery(true);
      // SSR load - skip animation, go straight to ready
      setAnimationPhase('ready');
    }
  }, []);

  // Seed the cache with multiple projects at once (called from PortfolioShell with SSR data)
  // Only warms the cache - does NOT set activeSlug or showGallery
  const seedProjects = useCallback((projectsList) => {
    if (!projectsList || projectsList.length === 0) return;
    setProjectCache((prev) => {
      const updates = {};
      for (const project of projectsList) {
        const slug = project.slug?.current;
        if (slug && !prev[slug]) {
          updates[slug] = project;
        }
      }
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  // Trigger entrance slide animation (hard refresh on home page)
  const triggerEntrance = useCallback(() => setAnimationPhase('grid-entering'), []);
  const completeEntrance = useCallback(() => setAnimationPhase('idle'), []);

  // Seed information page on direct URL load (skip animation, go straight to ready)
  const seedInformation = useCallback(() => {
    setActiveSlug("information");
    setShowGallery(true);
    setGalleryScrollOpacity(1);
    setAnimationPhase('ready');
  }, []);

  // Sync with URL search params (for browser back/forward)
  // Skip sync when we have a pending navigation target (we control the state, not the URL)
  useEffect(() => {
    const urlSlug = searchParams.get("project");
    const urlInformation = searchParams.has("information");

    // Determine the effective "slug" for state comparison
    // "information" is a special slug that doesn't need project data
    const effectiveSlug = urlInformation ? "information" : urlSlug;

    // If we're navigating programmatically, only accept URL changes that match our target
    if (navigationTargetRef.current !== undefined) {
      if (effectiveSlug === navigationTargetRef.current) {
        // URL caught up to our target, clear the ref
        navigationTargetRef.current = undefined;
      } else {
        // URL hasn't caught up yet, ignore this update
        return;
      }
    }

    if (effectiveSlug !== activeSlug) {
      if (urlInformation) {
        // URL has ?information - show information page (no project data needed)
        setActiveSlug("information");
        setShowGallery(true);
      } else if (urlSlug) {
        // URL has a project, make sure we have data
        if (cacheRef.current[urlSlug]) {
          setActiveSlug(urlSlug);
          setShowGallery(true);
        } else {
          // Need to fetch this project
          fetchProject(urlSlug).then((project) => {
            if (project) {
              setActiveSlug(urlSlug);
              setShowGallery(true);
            }
          });
        }
      } else {
        // URL is just / - hide gallery
        setActiveSlug(null);
        setShowGallery(false);
      }
    }
  }, [searchParams, activeSlug, fetchProject]);

  // Prefetch a project on hover (fire-and-forget)
  const prefetchProject = useCallback((slug) => {
    if (!cacheRef.current[slug]) {
      fetchProject(slug);
    }
  }, [fetchProject]);

  // Select a project or "information": update URL, fetch data if needed, animate sequence
  const selectProject = useCallback(async (slug) => {
    // If already viewing this project/information, scroll to gallery if not at top
    if (slug === activeSlug) {
      if (window.scrollY > 0) {
        isSameProjectScrollingRef.current = true;
        smoothScrollTo(0, 800, materialEase).then(() => {
          isSameProjectScrollingRef.current = false;
          // Dispatch scroll event to sync React state with final position
          window.dispatchEvent(new Event('scroll'));
        });
      }
      return;
    }

    // Guard: Ignore clicks if any animation is in progress
    // Only 'idle' (landing) and 'ready' (viewing project) allow new selections
    if (animationPhase !== 'idle' && animationPhase !== 'ready') {
      return;
    }

    const isInformation = slug === "information";
    const wasFromLanding = !activeSlug;
    const isAtTop = window.scrollY === 0;

    // Hide gallery during switch to prevent flicker
    if (activeSlug) {
      setIsSwitching(true);
    }

    // For information, no project data fetch needed
    // For projects, prefetch should have already cached it
    let project = null;
    if (!isInformation) {
      project = cacheRef.current[slug];
      if (!project) {
        project = await fetchProject(slug);
      }
    }

    // Proceed if it's information (always) or if project data loaded
    if (isInformation || project) {
      // Set navigation target BEFORE any state changes
      navigationTargetRef.current = slug;

      const targetUrl = isInformation ? `/?information` : `/?project=${slug}`;

      if (wasFromLanding) {
        // FROM LANDING: Set active immediately, then animate
        setActiveSlug(slug);
        setShowGallery(true);
        setGalleryScrollOpacity(1);

        // Start the grid animation phase (enables CSS transition on padding)
        setAnimationPhase('grid-animating');

        // Scroll to top over 800ms while padding also transitions
        if (!isAtTop) {
          smoothScrollTo(0, 800, materialEase);
        }
        await new Promise(r => setTimeout(r, 800));

        // Then fade in gallery
        setAnimationPhase('gallery-fading-in');
        setIsSwitching(false);
        await new Promise(r => setTimeout(r, 300));

        setAnimationPhase('ready');
        router.push(targetUrl, { scroll: false });
      } else {
        // FROM PROJECT/INFORMATION: switching between views
        // First fade out the current gallery (keep showing old content)
        setAnimationPhase('gallery-fading-out');
        await new Promise(r => setTimeout(r, 300)); // Wait for fade-out

        // Now swap to new view
        setActiveSlug(slug);
        setShowGallery(true);
        setGalleryScrollOpacity(1);

        // Animate scroll back to top if needed
        if (!isAtTop) {
          setAnimationPhase('grid-animating');
          smoothScrollTo(0, 800, materialEase);
          await new Promise(r => setTimeout(r, 800));
        }

        // Fade in the new gallery
        setAnimationPhase('gallery-fading-in');
        setIsSwitching(false);
        await new Promise(r => setTimeout(r, 300));

        setAnimationPhase('ready');
        router.push(targetUrl, { scroll: false });
      }
    }
  }, [fetchProject, router, activeSlug, animationPhase]);

  // Close gallery and go back to home with animated sequence
  // Also handles scrolling back to landing position when already on home page
  const closeProject = useCallback(async () => {
    // Guard: Ignore clicks if close animation is already running
    if (
      animationPhase === 'gallery-preparing-fade-out' ||
      animationPhase === 'gallery-fading-out' ||
      animationPhase === 'grid-returning-js'
    ) {
      return;
    }

    // If already at home with no project, just scroll to top (landing position)
    if (!activeSlug) {
      if (window.scrollY > 0) {
        setAnimationPhase('scrolling-to-peek');
        await smoothScrollTo(0, 800, materialEase);
        setAnimationPhase('idle');
      }
      return;
    }

    // Set navigation target to null (going home) - searchParams.get("project") returns null when no param
    navigationTargetRef.current = null;

    // Phase 1a: Enable transition before changing opacity (prevents flicker)
    setAnimationPhase('gallery-preparing-fade-out');
    // Wait for browser to apply the transition property
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Phase 1b: Fade out gallery
    setAnimationPhase('gallery-fading-out');
    await new Promise(r => setTimeout(r, 300));

    // Phase 2: Animate grid from peek to landing using JS animation
    // This triggers PortfolioShell to run the animation via useEffect
    setAnimationPhase('grid-returning-js');

    // Wait for animation to complete (PortfolioShell will call onComplete)
    await new Promise(resolve => {
      setJsAnimationTarget({ onComplete: resolve });
    });

    // Phase 3: Clear state and update URL
    setActiveSlug(null);
    setShowGallery(false);
    setGalleryScrollOpacity(1);
    setJsAnimationTarget(null);
    setAnimationPhase('idle');
    router.push("/", { scroll: false });
  }, [router, activeSlug, animationPhase]);

  // Get the active project data (null for information page)
  const activeProject = (activeSlug && activeSlug !== "information") ? projectCache[activeSlug] : null;

  // Whether the information page is active
  const isInformationActive = activeSlug === "information";

  return (
    <ProjectContext.Provider
      value={{
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
        projects,
        projectCache,
        selectProject,
        prefetchProject,
        closeProject,
        seedProject,
        seedProjects,
        seedInformation,
        triggerEntrance,
        completeEntrance,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
