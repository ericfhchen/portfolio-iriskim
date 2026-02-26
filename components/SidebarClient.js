"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useHover } from "@/context/HoverContext";
import { useProject } from "@/context/ProjectContext";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function SidebarClient({ artistName, projects }) {
  const { hoveredProject, hoverSource, setSidebarHover, clearHover } = useHover();
  const { activeSlug, isInformationActive, galleryScrollOpacity, selectProject, prefetchProject, closeProject } = useProject();
  const isMobile = useIsMobile();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const projectsButtonRef = useRef(null);
  const [projectsButtonLeft, setProjectsButtonLeft] = useState(0);

  // Lock body scroll and hide content when overlay is open
  useEffect(() => {
    if (overlayOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.dataset.scrollY = scrollY;
    } else {
      // Restore scroll position
      const scrollY = document.body.dataset.scrollY || 0;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY));
    }
  }, [overlayOpen]);

  useEffect(() => {
    if (overlayOpen && projectsButtonRef.current) {
      setProjectsButtonLeft(projectsButtonRef.current.getBoundingClientRect().left);
    }
  }, [overlayOpen]);

  // When any hover is active OR a project/information is selected (and gallery visible), mute non-active items
  // When gallery is faded (scrolled past), sidebar should be fully visible (not muted)
  const hasActiveHover = !!hoveredProject;
  const hasActiveProject = !!activeSlug && galleryScrollOpacity > 0.5;
  const shouldMuteOthers = hasActiveHover || hasActiveProject;

  // Information is highlighted (not muted) when it's active; muted otherwise when something else is active
  const shouldMuteInformation = !isMobile && shouldMuteOthers && !isInformationActive;
  // Projects section is muted when information is active or hover/project is active
  const shouldMuteProjectsSection = shouldMuteOthers;


  const handleInformationClick = (e) => {
    e.preventDefault();
    setOverlayOpen(false);
    selectProject("information");
  };

  const handleProjectClick = (e, slug) => {
    e.preventDefault();
    setOverlayOpen(false);
    selectProject(slug);
  };

  // Track hover state for oscillation detection
  // Oscillation = cursor sitting on boundary between two items, causing rapid mouseenter events
  // We need to see A→B→A pattern (3 events) before blocking, not just A→B (2 events)
  const hoverStateRef = useRef({
    committedSlug: null,    // The slug we've actually committed to
    lastEventTime: 0,       // Time of last hover event (any slug)
    recentSlugs: [],        // Last few slugs to detect oscillation pattern
  });

  const handleProjectMouseEnter = (slug) => {
    // Skip hover handling on mobile
    if (isMobile) return;

    const state = hoverStateRef.current;
    const now = Date.now();
    const timeSinceLast = now - state.lastEventTime;
    state.lastEventTime = now;

    // If slow movement (>100ms), reset tracking and allow
    if (timeSinceLast >= 100) {
      state.recentSlugs = [slug];
      state.committedSlug = slug;
      setSidebarHover(slug);
      prefetchProject(slug);
      return;
    }

    // Fast movement - track pattern
    state.recentSlugs.push(slug);
    // Keep only last 3 events
    if (state.recentSlugs.length > 3) {
      state.recentSlugs.shift();
    }

    // Check for oscillation: A→B→A pattern (same slug at position 0 and 2)
    if (state.recentSlugs.length === 3) {
      const [first, , third] = state.recentSlugs;
      if (first === third && first !== slug) {
        // We've seen A→B→A, now seeing another event
        // If it's B again (A→B→A→B), that's oscillation - block it
        return;
      }
    }

    // Allow this hover
    state.committedSlug = slug;
    setSidebarHover(slug);
    prefetchProject(slug);
  };

  return (
    <>
      {/* Mobile header - hidden on desktop via CSS */}
      <header className="nav-text hidden max-sm:flex fixed top-0 left-0 right-0 z-40 p-2 flex-row items-center gap-6" style={{
        willChange: "transform",
        transform: "translateZ(0)",
        contain: "layout style paint",
      }}>
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            closeProject();
          }}
        >
          {artistName}
        </Link>
        <button
          onClick={handleInformationClick}
          className="text-black"
          style={{
            opacity: shouldMuteInformation ? 0.3 : 1,
            transition: "opacity 300ms",
            cursor: "pointer",
          }}
        >
          information
        </button>
        <button
          onClick={() => setOverlayOpen(!overlayOpen)}
          className="text-black"
        >
          projects
        </button>
      </header>

      {/* Mobile overlay - hidden on desktop via CSS */}
      <div
        className="nav-text hidden max-sm:flex fixed z-[110] flex-col"
        onClick={() => setOverlayOpen(false)}
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 'calc(-100px - env(safe-area-inset-bottom, 0px))',  // Extend past viewport into Safari safe area
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',  // Compensate so content doesn't shift
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          opacity: overlayOpen ? 1 : 0,
          pointerEvents: overlayOpen ? "auto" : "none",
          transition: "opacity 200ms ease-out",
        }}
      >
        {/* Header row inside overlay */}
        <div className="p-2 flex flex-row items-center gap-6" onClick={(e) => e.stopPropagation()}>
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setOverlayOpen(false);
              closeProject();
            }}
          >
            {artistName}
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInformationClick(e);
            }}
            style={{
              opacity: shouldMuteInformation ? 0.3 : 1,
              transition: "opacity 300ms",
              cursor: "pointer",
            }}
          >
            information
          </button>
          <button
            ref={projectsButtonRef}
            onClick={() => setOverlayOpen(false)}
            className="text-black"
          >
            projects <span className="">(close)</span>
          </button>
        </div>

        {/* Projects list - aligned with projects button */}
        <ul className="flex flex-col gap-0" style={{ paddingLeft: projectsButtonLeft }}>
          {projects.map((project) => {
            const projectSlug = project.slug.current;
            const isActive = activeSlug === projectSlug;

            return (
              <li key={project._id}>
                <a
                  href={`/?project=${projectSlug}`}
                  onClick={(e) => handleProjectClick(e, projectSlug)}
                  className={isActive ? "text-black" : "text-muted"}
                >
                  {project.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop sidebar - hidden on mobile via CSS */}
      <nav className="nav-text flex max-sm:hidden fixed top-0 left-0 h-screen w-1/6 p-4 pr-0 flex-col gap-8 overflow-y-auto">
        <div className="flex flex-row gap-8">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              closeProject();
            }}
          >
            {artistName}
          </Link>
          <button
            onClick={handleInformationClick}
            className="text-black"
            style={{
              opacity: shouldMuteInformation ? 0.3 : 1,
              transition: "opacity 300ms",
              cursor: "pointer",
            }}
          >
            information
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <span
            style={{
              opacity: shouldMuteProjectsSection ? 0.3 : 1,
              transition: "opacity 300ms"
            }}
          >projects</span>
          <ul className="flex flex-col gap-0" onMouseLeave={clearHover}>
            {projects.map((project) => {
              const projectSlug = project.slug.current;
              const isActive = activeSlug === projectSlug;
              const isHovered = hoveredProject === projectSlug;
              const isHighlighted = hasActiveHover ? isHovered : isActive;
              const shouldMute = shouldMuteOthers && !isHighlighted;

              return (
                <li key={project._id} className="inline-block">
                  <a
                    href={`/?project=${projectSlug}`}
                    onClick={(e) => handleProjectClick(e, projectSlug)}
                    onMouseEnter={() => handleProjectMouseEnter(projectSlug)}
                    className={`inline-block ${isActive ? "text-black" : "text-muted hover:text-black"}`}
                    style={{
                      opacity: shouldMute ? 0.3 : 1,
                      transition: "opacity 300ms",
                    }}
                  >
                    {project.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
