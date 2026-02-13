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
  // 'idle' | 'scrolling-to-peek' | 'grid-animating' | 'gallery-fading-in' | 'ready'
  // Return phases: 'gallery-fading-out' | 'grid-returning'
  const [animationPhase, setAnimationPhase] = useState('idle');

  // Gallery opacity based on scroll/overlap (set by PortfolioShell, consumed by SidebarClient)
  const [galleryScrollOpacity, setGalleryScrollOpacity] = useState(1);

  // Track the target slug during programmatic navigation (ref for synchronous access)
  // Uses undefined to mean "no navigation in progress", null means "navigating to home"
  const navigationTargetRef = useRef(undefined);

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

  // Sync with URL search params (for browser back/forward)
  // Skip sync when we have a pending navigation target (we control the state, not the URL)
  useEffect(() => {
    const urlSlug = searchParams.get("project");

    // If we're navigating programmatically, only accept URL changes that match our target
    if (navigationTargetRef.current !== undefined) {
      if (urlSlug === navigationTargetRef.current) {
        // URL caught up to our target, clear the ref
        navigationTargetRef.current = undefined;
      } else {
        // URL hasn't caught up yet, ignore this update
        return;
      }
    }

    if (urlSlug !== activeSlug) {
      if (urlSlug) {
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

  // Select a project: update URL, fetch data if needed, animate sequence
  const selectProject = useCallback(async (slug) => {
    // If already viewing this project, do nothing
    if (slug === activeSlug) return;

    const wasFromLanding = !activeSlug;
    const isAtTop = window.scrollY === 0;

    // Hide gallery during switch to prevent flicker
    if (activeSlug) {
      setIsSwitching(true);
    }

    // Prefetch should have already cached it, but fetch if not
    let project = cacheRef.current[slug];
    if (!project) {
      project = await fetchProject(slug);
    }

    if (project) {
      // Set navigation target BEFORE any state changes
      navigationTargetRef.current = slug;

      setActiveSlug(slug);
      setShowGallery(true);
      setGalleryScrollOpacity(1);

      if (wasFromLanding) {
        // FROM LANDING: Animate scroll and padding simultaneously to peek position
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
        router.push(`/?project=${slug}`, { scroll: false });
      } else {
        // FROM PROJECT: already at peek padding, but may be scrolled down
        // Animate scroll back to top while keeping padding at peek
        if (!isAtTop) {
          setAnimationPhase('grid-animating');
          smoothScrollTo(0, 800, materialEase);
          await new Promise(r => setTimeout(r, 800));
        }

        setAnimationPhase('gallery-fading-in');
        setIsSwitching(false);
        await new Promise(r => setTimeout(r, 300));

        setAnimationPhase('ready');
        router.push(`/?project=${slug}`, { scroll: false });
      }
    }
  }, [fetchProject, router, activeSlug]);

  // Close gallery and go back to home with animated sequence
  // Also handles scrolling back to landing position when already on home page
  const closeProject = useCallback(async () => {
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
  }, [router, activeSlug]);

  // Get the active project data
  const activeProject = activeSlug ? projectCache[activeSlug] : null;

  return (
    <ProjectContext.Provider
      value={{
        activeSlug,
        activeProject,
        showGallery,
        isSwitching,
        animationPhase,
        galleryScrollOpacity,
        setGalleryScrollOpacity,
        jsAnimationTarget,
        projects,
        projectCache,
        selectProject,
        prefetchProject,
        closeProject,
        seedProject,
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
