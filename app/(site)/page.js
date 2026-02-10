import { client } from "@/sanity/lib/client";
import { allProjectsQuery } from "@/sanity/lib/queries";
import PortfolioShell from "@/components/PortfolioShell";

export default async function HomePage() {
  const projects = await client.fetch(allProjectsQuery);

  return <PortfolioShell projects={projects || []} activeProject={null} />;
}
