"use client";

import { useState, useEffect, useRef } from "react";
import { NextStudio } from "next-sanity/studio";
import config from "@/sanity.config";

export default function StudioPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    // Estimate ~3 seconds for full load, progress accelerates as we detect more elements
    const updateProgress = () => {
      const elapsed = Date.now() - startTime.current;
      const navbar = document.querySelector('[data-ui="Navbar"]');
      const panes = document.querySelectorAll('[data-ui="Pane"]');
      const inputs = document.querySelectorAll('input[data-as="input"], textarea[data-as="textarea"]');
      const spinners = document.querySelectorAll('[data-ui="Spinner"]');

      let baseProgress = Math.min((elapsed / 3000) * 60, 60); // Time-based up to 60%

      // Add progress for detected elements
      if (navbar) baseProgress = Math.max(baseProgress, 30);
      if (panes.length > 0) baseProgress = Math.max(baseProgress, 50);
      if (inputs.length > 0 && spinners.length === 0) baseProgress = Math.max(baseProgress, 85);

      setProgress(Math.min(baseProgress, 95)); // Cap at 95% until fully loaded
    };

    // Poll for Sanity UI elements to be fully rendered
    const checkLoaded = () => {
      const spinners = document.querySelectorAll('[data-ui="Spinner"]');
      const loadingText = document.body.innerText.includes('Loading');
      const inputs = document.querySelectorAll('input[data-as="input"], textarea[data-as="textarea"]');

      if (inputs.length > 0 && spinners.length === 0 && !loadingText) {
        setProgress(100);
        setTimeout(() => setIsLoaded(true), 300);
        return true;
      }
      return false;
    };

    if (checkLoaded()) return;

    const interval = setInterval(() => {
      updateProgress();
      if (checkLoaded()) {
        clearInterval(interval);
      }
    }, 100);

    const fallback = setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setIsLoaded(true);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <>
      {/* Loading overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          flexDirection: "column",
          gap: "20px",
          opacity: isLoaded ? 0 : 1,
          pointerEvents: isLoaded ? "none" : "auto",
          transition: "opacity 200ms ease-out",
        }}
      >
        <span style={{ color: "#464861", fontSize: "11px", fontFamily: "Helvetica Neue, sans-serif", letterSpacing: "0.1em" }}>
          LOADING...
        </span>
        <div
          style={{
            width: "200px",
            height: "1px",
            backgroundColor: "#1E222E",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#464861",
              transition: "width 150ms ease-out",
            }}
          />
        </div>
      </div>
      <NextStudio config={config} />
    </>
  );
}
