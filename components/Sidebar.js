import { client } from "@/sanity/lib/client";
import { siteSettingsQuery, allProjectsQuery } from "@/sanity/lib/queries";
import SidebarClient from "./SidebarClient";

export default async function Sidebar() {
  const [settings, projects] = await Promise.all([
    client.fetch(siteSettingsQuery),
    client.fetch(allProjectsQuery),
  ]);

  return (
    <SidebarClient
      artistName={settings?.artistName || "iris kim"}
      projects={projects || []}
    />
  );
}
