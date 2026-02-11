import "@/app/site.css";
import { client } from "@/sanity/lib/client";
import { siteSettingsQuery, allProjectsQuery } from "@/sanity/lib/queries";
import SiteLayoutClient from "@/components/SiteLayoutClient";

export default async function SiteLayout({ children }) {
  const [settings, projects] = await Promise.all([
    client.fetch(siteSettingsQuery),
    client.fetch(allProjectsQuery),
  ]);

  return (
    <SiteLayoutClient
      artistName={settings?.artistName || "iris kim"}
      projects={projects || []}
    >
      {children}
    </SiteLayoutClient>
  );
}
