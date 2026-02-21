import { freshClient } from "@/sanity/lib/client";
import { allProjectsQuery } from "@/sanity/lib/queries";

export default async function sitemap() {
  const projects = await freshClient.fetch(allProjectsQuery);
  const baseUrl = "https://iriskim.co";

  const projectEntries = (projects || []).map((project) => ({
    url: `${baseUrl}/?project=${project.slug?.current}`,
    lastModified: new Date(),
  }));

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/?information`, lastModified: new Date() },
    ...projectEntries,
  ];
}
