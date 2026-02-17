"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

const HoverContext = createContext(null);

export function HoverProvider({ children }) {
  // Which project slug is being hovered (null = none)
  const [hoveredProject, setHoveredProject] = useState(null);
  // Source of hover: "tile" or "sidebar"
  const [hoverSource, setHoverSource] = useState(null);
  // Lock hover state during animations (prevents rapid hover triggers)
  const [isHoverLocked, setIsHoverLocked] = useState(false);

  // Ref to hold scroll handler registered by PortfolioShell
  const scrollHandlerRef = useRef(null);
  // Ref to hold clear callback (for resetting scroll state when hover clears)
  const clearCallbackRef = useRef(null);

  const setTileHover = useCallback((projectSlug) => {
    setHoveredProject(projectSlug);
    setHoverSource(projectSlug ? "tile" : null);
  }, []);

  const setSidebarHover = useCallback((projectSlug) => {
    setHoveredProject(projectSlug);
    setHoverSource(projectSlug ? "sidebar" : null);
    // Trigger scroll handler if registered and slug is provided
    if (projectSlug && scrollHandlerRef.current) {
      scrollHandlerRef.current(projectSlug);
    }
  }, []);

  const clearHover = useCallback(() => {
    setHoveredProject(null);
    setHoverSource(null);
    // Notify registered clear callback
    if (clearCallbackRef.current) {
      clearCallbackRef.current();
    }
  }, []);

  const registerScrollHandler = useCallback((handler, onClear) => {
    scrollHandlerRef.current = handler;
    clearCallbackRef.current = onClear;
  }, []);

  const unregisterScrollHandler = useCallback(() => {
    scrollHandlerRef.current = null;
    clearCallbackRef.current = null;
  }, []);

  return (
    <HoverContext.Provider
      value={{
        hoveredProject,
        hoverSource,
        isHoverLocked,
        setIsHoverLocked,
        setTileHover,
        setSidebarHover,
        clearHover,
        registerScrollHandler,
        unregisterScrollHandler,
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
