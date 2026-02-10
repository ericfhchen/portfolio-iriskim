import { client } from "@/sanity/lib/client";
import { projectDetailQuery, allProjectsQuery } from "@/sanity/lib/queries";
import { notFound } from "next/navigation";
import ProjectPageClient from "@/components/ProjectPageClient";

export async function generateStaticParams() {
  const projects = await client.fetch(
    `*[_type == "project"]{ "slug": slug.current }`
  );
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const [project, projects] = await Promise.all([
    client.fetch(projectDetailQuery, { slug }),
    client.fetch(allProjectsQuery),
  ]);

  if (!project) notFound();

  return <ProjectPageClient project={project} projects={projects || []} />;
}
