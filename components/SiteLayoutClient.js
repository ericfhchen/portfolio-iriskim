"use client";

import { Suspense } from "react";
import { HoverProvider } from "@/context/HoverContext";
import { ProjectProvider } from "@/context/ProjectContext";
import SidebarClient from "./SidebarClient";

function SiteLayoutInner({ artistName, settings, projects, children }) {
  return (
    <ProjectProvider projects={projects}>
      <HoverProvider>
        <div className="flex min-h-screen">
          <SidebarClient artistName={artistName} projects={projects} />
          <main className="sm:ml-[16.666%] w-full sm:w-[83.333%] min-h-screen">
            {/* Pass settings to children via cloneElement isn't practical here;
                PortfolioShell gets settings via a separate prop on the page */}
            {children}
          </main>
        </div>
      </HoverProvider>
    </ProjectProvider>
  );
}

export default function SiteLayoutClient({ artistName, settings, projects, children }) {
  return (
    <Suspense fallback={
        <div className="flex min-h-screen">
          <div className="fixed top-0 left-0 h-screen w-1/6 p-4" />
          <main className="sm:ml-[16.666%] w-full sm:w-[83.333%] min-h-screen" />
        </div>
      }>
        <SiteLayoutInner artistName={artistName} settings={settings} projects={projects}>
          {children}
        </SiteLayoutInner>
    </Suspense>
  );
}
