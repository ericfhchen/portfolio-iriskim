"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { useIsMobile } from "@/hooks/useIsMobile";

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

function EmailBlock({ email }) {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        // Fallback for mobile Safari / non-HTTPS
        const textArea = document.createElement("textarea");
        textArea.value = email;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Mobile: only show "copied" label, never "copy"
  // Desktop: show "copy" on hover, "copied" after click
  const showLabel = isMobile ? copied : (hovered || copied);
  const labelText = isMobile ? "copied" : (copied ? "copied" : "copy");

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: "0.4em", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCopy}
    >
      <span style={{ opacity: (isMobile ? copied : hovered) ? 0.3 : 1, transition: "opacity 200ms" }}>
        {email}
      </span>
      <span
        style={{
          opacity: showLabel ? (copied ? 0.25 : 0.4) : 0,
          transition: "opacity 200ms",
          fontSize: "0.85em",
        }}
      >
        {labelText}
      </span>
    </span>
  );
}

function renderTextWithEmails(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(EMAIL_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<EmailBlock key={match.index} email={match[0]} />);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

const portableTextComponents = {
  block: {
    normal: ({ value, children }) => {
      const text = value.children?.map((c) => c.text || "").join("").trim();
      if (!text) return <br />;
      // Check if any plain span contains an email — if not, use default rendering
      const hasEmail = value.children?.some(
        (c) => c._type === "span" && !c.marks?.length && EMAIL_RE.test(c.text || "")
      );
      // Reset regex lastIndex since it's global
      EMAIL_RE.lastIndex = 0;
      if (!hasEmail) return <p>{children}</p>;
      // Re-render children manually so we can split plain spans on emails
      // Marked spans are wrapped in their mark tags; plain spans get email scanning
      const rendered = value.children?.map((child, i) => {
        if (child._type !== "span") return null;
        if (!child.marks?.length) {
          return <span key={i}>{renderTextWithEmails(child.text || "")}</span>;
        }
        // Apply marks manually (link, strong, em)
        let content = <>{child.text}</>;
        for (const mark of [...child.marks].reverse()) {
          if (mark === "strong") content = <strong>{content}</strong>;
          else if (mark === "em") content = <em>{content}</em>;
          // link marks are objects on value.markDefs — look up by _key
          else {
            const def = value.markDefs?.find((d) => d._key === mark);
            if (def?._type === "link") {
              content = (
                <a
                  href={def.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-60"
                  style={{ transition: "opacity 200ms" }}
                >
                  {content}
                </a>
              );
            }
          }
        }
        return <span key={i}>{content}</span>;
      });
      return <p>{rendered}</p>;
    },
  },
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

  // Track viewport height for responsive column stacking
  const [viewportHeight, setViewportHeight] = useState(null);

  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Stack columns when viewport is too short (< 600px) to prevent text cropping
  const isShortViewport = viewportHeight && viewportHeight < 600;

  const imageUrl = informationImage?.asset?.url;
  const imageDimensions = informationImage?.asset?.metadata?.dimensions;
  const imageWidth = imageDimensions?.width || 1200;
  const imageHeight = imageDimensions?.height || 800;

  return (
    <div
      className={`w-full h-full flex flex-col overflow-y-auto ${isMobile ? "p-2 pt-12" : "p-4"}`}
    >
      {/* Image */}
      {imageUrl && (
        <div
          style={{
            width: isMobile ? "100%" : isShortViewport ? "35%" : "50%",
            marginBottom: isMobile ? "1.5rem" : "2rem",
          }}
        >
          <Image
            src={imageUrl}
            alt={settings?.name || ""}
            width={imageWidth}
            height={imageHeight}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              WebkitTouchCallout: "none",
              userSelect: "none",
            }}
            priority
          />
        </div>
      )}

      {/* Two-column text layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isShortViewport ? "2fr 2fr 1fr" : "1fr 1fr 2fr",
          gap: isMobile ? "1rem" : "3rem",
        }}
      >
        {/* Bio column (wider) */}
        <div className="">
          {bio ? (
            <PortableText value={bio} components={portableTextComponents} />
          ) : null}
        </div>

        {/* Contact & Links column (narrower) */}
        <div className="">
          {contactLinks ? (
            <PortableText value={contactLinks} components={portableTextComponents} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
