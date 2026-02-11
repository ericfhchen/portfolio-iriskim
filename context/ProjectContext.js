"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { freshClient } from "@/sanity/lib/client";
import { projectDetailQuery } from "@/sanity/lib/queries";

const ProjectContext = createContext(null);

// Custom smooth scroll with easing
function smoothScrollToTop(duration = 1400) {
  const start = window.scrollY;
  if (start === 0) return;

  const startTime = performance.now();

  // Ease-in expo, ease-out quint (firmer landing)
  const customEase = (t) => {
    if (t < 0.5) {
      return Math.pow(2, 16 * t - 8) / 2;
    }
    return 1 - Math.pow(-2 * t + 2, 4) / 2;
  };

  function scroll(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = customEase(progress);

    window.scrollTo(0, start * (1 - eased));

    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  }

  requestAnimationFrame(scroll);
}

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
    }
  }, []);

  // Sync with URL search params (for browser back/forward)
  // This effect intentionally sets state to sync with external URL state
  useEffect(() => {
    const urlSlug = searchParams.get("project");
    if (urlSlug !== activeSlug) {
      if (urlSlug) {
        // URL has a project, make sure we have data
        if (cacheRef.current[urlSlug]) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
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
        // URL is just /, hide gallery
         
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

  // Select a project: update URL, fetch data if needed, scroll to top
  const selectProject = useCallback(async (slug) => {
    // Prefetch should have already cached it, but fetch if not
    let project = cacheRef.current[slug];
    if (!project) {
      project = await fetchProject(slug);
    }

    if (project) {
      setActiveSlug(slug);
      setShowGallery(true);
      router.push(`/?project=${slug}`, { scroll: false });
      smoothScrollToTop(1400);
    }
  }, [fetchProject, router]);

  // Close gallery and go back to home
  const closeProject = useCallback(() => {
    setActiveSlug(null);
    setShowGallery(false);
    router.push("/", { scroll: false });
  }, [router]);

  // Get the active project data
  const activeProject = activeSlug ? projectCache[activeSlug] : null;

  return (
    <ProjectContext.Provider
      value={{
        activeSlug,
        activeProject,
        showGallery,
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
