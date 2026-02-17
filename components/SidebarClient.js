"use client";

import { useRef } from "react";
import Link from "next/link";
import { useHover } from "@/context/HoverContext";
import { useProject } from "@/context/ProjectContext";

export default function SidebarClient({ artistName, projects }) {
  const { hoveredProject, hoverSource, setSidebarHover, clearHover } = useHover();
  const { activeSlug, galleryScrollOpacity, selectProject, prefetchProject, closeProject } = useProject();

  // When any hover is active OR a project is selected (and gallery visible), mute non-active items
  // When gallery is faded (scrolled past), sidebar should be fully visible (not muted)
  const hasActiveHover = !!hoveredProject;
  const hasActiveProject = !!activeSlug && galleryScrollOpacity > 0.5;
  const shouldMuteOthers = hasActiveHover || hasActiveProject;


  const handleProjectClick = (e, slug) => {
    e.preventDefault();
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
    <nav className="fixed top-0 left-0 h-screen w-1/6 p-4 flex flex-col gap-8 overflow-y-auto">

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
        <span
          className="text-muted"
          style={{
            opacity: shouldMuteOthers ? 0.3 : 1,
            transition: "opacity 300ms"
          }}
        >information</span>
      </div>
      <div className="flex flex-col gap-2">
        <span
          style={{
            opacity: shouldMuteOthers ? 0.3 : 1,
            transition: "opacity 300ms"
          }}
        >projects</span>
        <ul className="flex flex-col gap-0" onMouseLeave={clearHover}>
          {projects.map((project) => {
            const projectSlug = project.slug.current;
            const isActive = activeSlug === projectSlug;
            const isHovered = hoveredProject === projectSlug;
            // Mute if there's an active hover/selection and this isn't the highlighted project
            // When hovering, use hover state; otherwise use active state
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
  );
}
