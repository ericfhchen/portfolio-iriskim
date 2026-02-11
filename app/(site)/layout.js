import "@/app/site.css";
import { freshClient } from "@/sanity/lib/client";
import { siteSettingsQuery, allProjectsQuery } from "@/sanity/lib/queries";
import SiteLayoutClient from "@/components/SiteLayoutClient";

export default async function SiteLayout({ children }) {
  // Use freshClient to bypass CDN cache - ensures new uploads appear immediately
  const [settings, projects] = await Promise.all([
    freshClient.fetch(siteSettingsQuery),
    freshClient.fetch(allProjectsQuery),
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
