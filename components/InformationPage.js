"use client";

import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { useIsMobile } from "@/hooks/useIsMobile";

const portableTextComponents = {
  marks: {
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:opacity-60"
        style={{ transition: "opacity 200ms" }}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong>{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
  },
};

export default function InformationPage({ settings }) {
  const isMobile = useIsMobile();
  const { informationImage, bio, contactLinks } = settings || {};

  const imageUrl = informationImage?.asset?.url;
  const imageDimensions = informationImage?.asset?.metadata?.dimensions;
  const imageWidth = imageDimensions?.width || 1200;
  const imageHeight = imageDimensions?.height || 800;

  return (
    <div
      className={`w-full h-full flex flex-col overflow-y-auto ${isMobile ? "p-2 pt-8" : "p-4"}`}
    >
      {/* Image */}
      {imageUrl && (
        <div
          style={{
            width: isMobile ? "100%" : "50%",
            marginBottom: isMobile ? "1.5rem" : "2rem",
            flexShrink: 0,
          }}
        >
          <Image
            src={imageUrl}
            alt={settings?.name || ""}
            width={imageWidth}
            height={imageHeight}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
            priority
          />
        </div>
      )}

      {/* Two-column text layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "3fr 2fr" : "3fr 2fr",
          gap: isMobile ? "1.5rem" : "3rem",
        }}
      >
        {/* Bio column (wider) */}
        <div className="text-muted leading-relaxed">
          {bio ? (
            <PortableText value={bio} components={portableTextComponents} />
          ) : null}
        </div>

        {/* Contact & Links column (narrower) */}
        <div className="text-muted leading-relaxed">
          {contactLinks ? (
            <PortableText value={contactLinks} components={portableTextComponents} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
