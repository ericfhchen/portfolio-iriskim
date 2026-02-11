"use client";

import { createContext, useContext, useState, useCallback } from "react";

const HoverContext = createContext(null);

export function HoverProvider({ children }) {
  // Which project slug is being hovered (null = none)
  const [hoveredProject, setHoveredProject] = useState(null);
  // Source of hover: "tile" or "sidebar"
  const [hoverSource, setHoverSource] = useState(null);

  const setTileHover = useCallback((projectSlug) => {
    setHoveredProject(projectSlug);
    setHoverSource(projectSlug ? "tile" : null);
  }, []);

  const setSidebarHover = useCallback((projectSlug) => {
    setHoveredProject(projectSlug);
    setHoverSource(projectSlug ? "sidebar" : null);
  }, []);

  const clearHover = useCallback(() => {
    setHoveredProject(null);
    setHoverSource(null);
  }, []);

  return (
    <HoverContext.Provider
      value={{
        hoveredProject,
        hoverSource,
        setTileHover,
        setSidebarHover,
        clearHover,
      }}
    >
      {children}
    </HoverContext.Provider>
  );
}

export function useHover() {
  const context = useContext(HoverContext);
  if (!context) {
    throw new Error("useHover must be used within a HoverProvider");
  }
  return context;
}
