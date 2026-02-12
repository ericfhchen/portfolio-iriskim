"use client";

import Link from "next/link";
import { useHover } from "@/context/HoverContext";
import { useProject } from "@/context/ProjectContext";

export default function SidebarClient({ artistName, projects }) {
  const { hoveredProject, hoverSource, setSidebarHover, clearHover } = useHover();
  const { activeSlug, galleryScrollOpacity, selectProject, prefetchProject } = useProject();

  // When any hover is active OR a project is selected (and gallery visible), mute non-active items
  // When gallery is faded (scrolled past), sidebar should be fully visible (not muted)
  const hasActiveHover = !!hoveredProject;
  const hasActiveProject = !!activeSlug && galleryScrollOpacity > 0.5;
  const shouldMuteOthers = hasActiveHover || hasActiveProject;

  const handleProjectClick = (e, slug) => {
    e.preventDefault();
    selectProject(slug);
  };

  const handleProjectMouseEnter = (slug) => {
    setSidebarHover(slug);
    prefetchProject(slug);
  };

  return (
    <nav className="fixed top-0 left-0 h-screen w-1/6 p-4 flex flex-col gap-8 overflow-y-auto">

      <div className="flex flex-row gap-8">
        <Link href="/">
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
        <ul className="flex flex-col gap-0">
          {projects.map((project) => {
            const projectSlug = project.slug.current;
            const isActive = activeSlug === projectSlug;
            const isHovered = hoveredProject === projectSlug;
            // Mute if there's an active hover/selection and this isn't the highlighted project
            // When hovering, use hover state; otherwise use active state
            const isHighlighted = hasActiveHover ? isHovered : isActive;
            const shouldMute = shouldMuteOthers && !isHighlighted;

            return (
              <li key={project._id}>
                <a
                  href={`/?project=${projectSlug}`}
                  onClick={(e) => handleProjectClick(e, projectSlug)}
                  className={isActive ? "text-black" : "text-muted hover:text-black"}
                  style={{
                    opacity: shouldMute ? 0.3 : 1,
                    transition: "opacity 300ms"
                  }}
                  onMouseEnter={() => handleProjectMouseEnter(projectSlug)}
                  onMouseLeave={clearHover}
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
