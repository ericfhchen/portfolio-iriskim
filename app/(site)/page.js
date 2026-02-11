import { freshClient } from "@/sanity/lib/client";
import { allProjectsQuery, projectDetailQuery } from "@/sanity/lib/queries";
import PortfolioShell from "@/components/PortfolioShell";

export default async function HomePage({ searchParams }) {
  const { project: projectSlug } = await searchParams;

  // Use freshClient to bypass CDN cache - ensures new uploads appear immediately
  const projects = await freshClient.fetch(allProjectsQuery);

  let initialProject = null;
  if (projectSlug) {
    initialProject = await freshClient.fetch(projectDetailQuery, { slug: projectSlug });
  }

  return (
    <PortfolioShell
      projects={projects || []}
      initialProject={initialProject}
    />
  );
}
