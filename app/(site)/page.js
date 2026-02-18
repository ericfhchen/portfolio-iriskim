import { freshClient } from "@/sanity/lib/client";
import { allProjectsQuery, projectDetailQuery, siteSettingsQuery } from "@/sanity/lib/queries";
import PortfolioShell from "@/components/PortfolioShell";

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const projectSlug = params.project;
  const showInformation = "information" in params;

  // Use freshClient to bypass CDN cache - ensures new uploads appear immediately
  const [projects, settings] = await Promise.all([
    freshClient.fetch(allProjectsQuery),
    freshClient.fetch(siteSettingsQuery),
  ]);

  let initialProject = null;
  if (projectSlug) {
    initialProject = await freshClient.fetch(projectDetailQuery, { slug: projectSlug });
  }

  return (
    <PortfolioShell
      projects={projects || []}
      initialProject={initialProject}
      initialInformation={showInformation}
      settings={settings || {}}
    />
  );
}
