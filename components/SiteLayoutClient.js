"use client";

import { Suspense } from "react";
import { HoverProvider } from "@/context/HoverContext";
import { ProjectProvider } from "@/context/ProjectContext";
import SidebarClient from "./SidebarClient";

function SiteLayoutInner({ artistName, projects, children }) {
  return (
    <ProjectProvider projects={projects}>
      <HoverProvider>
        <div className="flex min-h-screen">
          <SidebarClient artistName={artistName} projects={projects} />
          <main className="ml-[16.666%] w-[83.333%] min-h-screen">
            {children}
          </main>
        </div>
      </HoverProvider>
    </ProjectProvider>
  );
}

export default function SiteLayoutClient({ artistName, projects, children }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen">
        <div className="fixed top-0 left-0 h-screen w-1/6 p-4" />
        <main className="ml-[16.666%] w-[83.333%] min-h-screen" />
      </div>
    }>
      <SiteLayoutInner artistName={artistName} projects={projects}>
        {children}
      </SiteLayoutInner>
    </Suspense>
  );
}
