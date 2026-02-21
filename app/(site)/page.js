import { freshClient } from "@/sanity/lib/client";
import { allProjectsQuery, projectDetailQuery, siteSettingsQuery } from "@/sanity/lib/queries";
import PortfolioShell from "@/components/PortfolioShell";

function extractPlainText(portableText) {
  if (!portableText || !Array.isArray(portableText)) return "";
  return portableText
    .filter((block) => block._type === "block")
    .map((block) =>
      (block.children || []).map((child) => child.text || "").join("")
    )
    .join(" ")
    .trim();
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const projectSlug = params.project;
  const showInformation = "information" in params;

  if (projectSlug) {
    const project = await freshClient.fetch(projectDetailQuery, { slug: projectSlug });
    if (project) {
      const description = extractPlainText(project.caption) || undefined;

      return {
        title: project.title,
        description,
        openGraph: {
          title: project.title,
          description,
          ...(project.coverImageUrl && {
            images: [{ url: `${project.coverImageUrl}?w=1200&h=630&fit=crop&auto=format`, width: 1200, height: 630 }],
          }),
        },
      };
    }
  }

  if (showInformation) {
    const settings = await freshClient.fetch(siteSettingsQuery);
    const bioText = extractPlainText(settings?.bio) || undefined;
    return {
      title: "Information",
      description: bioText ? bioText.slice(0, 155) : undefined,
    };
  }

  return {};
}

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
