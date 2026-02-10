"use client";

import PortfolioShell from "./PortfolioShell";

export default function ProjectPageClient({ project, projects }) {
  return <PortfolioShell projects={projects} activeProject={project} />;
}
