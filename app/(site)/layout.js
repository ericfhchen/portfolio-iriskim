import "@/app/site.css";
import { client } from "@/sanity/lib/client";
import { siteSettingsQuery, allProjectsQuery } from "@/sanity/lib/queries";
import SiteLayoutClient from "@/components/SiteLayoutClient";

export const revalidate = 60;

export async function generateMetadata() {
  const settings = await client.fetch(siteSettingsQuery);
  if (!settings) return {};

  const title = settings.metaTitle || settings.name || "iris kim";
  const description = settings.metaDescription || undefined;
  const siteUrl = settings.siteUrl || "https://iriskim.co";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s — ${settings.name || "iris kim"}`,
    },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: settings.name || "iris kim",
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
  // CDN client + ISR (revalidate=60) — webhook handles immediate revalidation on publish
  const [settings, projects] = await Promise.all([
    client.fetch(siteSettingsQuery),
    client.fetch(allProjectsQuery),
  ]);

  const siteUrl = settings?.siteUrl || "https://iriskim.co";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: settings?.name || "iris kim",
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
