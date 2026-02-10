"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import MediaGallery from "./MediaGallery";
import ProjectGrid from "./ProjectGrid";

export default function PortfolioShell({ projects, activeProject }) {
  const router = useRouter();
  const pathname = usePathname();
  const shellRef = useRef(null);
  const galleryRef = useRef(null);

  const [lastVisitedProject, setLastVisitedProject] = useState(activeProject || null);
  const [showGallery, setShowGallery] = useState(!!activeProject);

  // Sync activeProject from server on route change
  useEffect(() => {
    if (activeProject) {
      setLastVisitedProject(activeProject);
      setShowGallery(true);
    }
  }, [activeProject]);

  // Scroll observation: detect when user scrolls past gallery
  useEffect(() => {
    if (!galleryRef.current || !showGallery) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When gallery leaves viewport (scrolled past), we stay in grid mode
        // When it re-enters (scrolled back up), gallery is visible again
      },
      { threshold: 0 }
    );
    observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, [showGallery]);

  const handleProjectClick = useCallback(
    (project) => {
      setLastVisitedProject(project);
      setShowGallery(true);
      router.push(`/${project.slug.current}`, { scroll: false });

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router]
  );

  // Handle scroll to detect if we should show/hide gallery
  useEffect(() => {
    const handleScroll = () => {
      if (!galleryRef.current) return;
      const rect = galleryRef.current.getBoundingClientRect();
      // Gallery is "past" when its bottom is above viewport
      if (rect.bottom < 0 && showGallery) {
        // User scrolled past gallery - keep gallery in DOM but it's off-screen
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showGallery]);

  // Sync URL when on home page but we have a last-visited project to show
  useEffect(() => {
    if (pathname === "/" && lastVisitedProject && showGallery) {
      // If user navigated to /, hide gallery
      setShowGallery(false);
    }
  }, [pathname, lastVisitedProject, showGallery]);

  const displayProject = showGallery ? lastVisitedProject : null;

  return (
    <div ref={shellRef}>
      {displayProject && (
        <div ref={galleryRef}>
          <MediaGallery project={displayProject} />
        </div>
      )}

      <div className="p-4">
        <ProjectGrid projects={projects} onProjectClick={handleProjectClick} />
      </div>
    </div>
  );
}
