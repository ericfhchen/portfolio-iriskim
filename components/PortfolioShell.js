"use client";

import { useRef, useEffect } from "react";
import MediaGallery from "./MediaGallery";
import ProjectGrid from "./ProjectGrid";
import { useProject } from "@/context/ProjectContext";

export default function PortfolioShell({ projects, initialProject }) {
  const shellRef = useRef(null);
  const galleryRef = useRef(null);

  const {
    activeProject,
    showGallery,
    selectProject,
    prefetchProject,
    seedProject,
  } = useProject();

  // Seed the cache with SSR-fetched project on mount
  useEffect(() => {
    if (initialProject) {
      seedProject(initialProject);
    }
  }, [initialProject, seedProject]);

  const handleProjectClick = (project) => {
    selectProject(project.slug.current);
  };

  const handleProjectHover = (project) => {
    prefetchProject(project.slug.current);
  };

  const displayProject = showGallery ? activeProject : null;

  return (
    <div ref={shellRef}>
      {displayProject && (
        <div ref={galleryRef}>
          <MediaGallery project={displayProject} />
        </div>
      )}

      <div className="p-4">
        <ProjectGrid
          projects={projects}
          onProjectClick={handleProjectClick}
          onProjectHover={handleProjectHover}
        />
      </div>
    </div>
  );
}
