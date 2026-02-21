import "@/app/site.css";
import { freshClient } from "@/sanity/lib/client";
import { siteSettingsQuery, allProjectsQuery } from "@/sanity/lib/queries";
import SiteLayoutClient from "@/components/SiteLayoutClient";

export async function generateMetadata() {
  const settings = await freshClient.fetch(siteSettingsQuery);
  if (!settings) return {};

  const title = settings.metaTitle || settings.name || "Iris Kim";
  const description = settings.metaDescription || undefined;
  const siteUrl = settings.siteUrl || "https://iriskim.co";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s — ${settings.name || "Iris Kim"}`,
    },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: settings.name || "Iris Kim",
      ...(settings.ogImageUrl && { images: [{ url: settings.ogImageUrl, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(settings.ogImageUrl && { images: [settings.ogImageUrl] }),
    },
    ...(settings.faviconUrl && {
      icons: { icon: settings.faviconUrl },
    }),
  };
}

export default async function SiteLayout({ children }) {
  // Use freshClient to bypass CDN cache - ensures new uploads appear immediately
  const [settings, projects] = await Promise.all([
    freshClient.fetch(siteSettingsQuery),
    freshClient.fetch(allProjectsQuery),
  ]);

  const siteUrl = settings?.siteUrl || "https://iriskim.co";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: settings?.name || "Iris Kim",
    url: siteUrl,
    jobTitle: "Artist",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteLayoutClient
        artistName={settings?.name || "iris kim"}
        settings={settings || {}}
        projects={projects || []}
      >
        {children}
      </SiteLayoutClient>
    </>
  );
}
