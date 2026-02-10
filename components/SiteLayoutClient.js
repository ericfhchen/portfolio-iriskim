"use client";

import { HoverProvider } from "@/context/HoverContext";
import SidebarClient from "./SidebarClient";

export default function SiteLayoutClient({ artistName, projects, children }) {
  return (
    <HoverProvider>
      <div className="flex min-h-screen">
        <SidebarClient artistName={artistName} projects={projects} />
        <main className="ml-[16.666%] w-[83.333%] min-h-screen">
          {children}
        </main>
      </div>
    </HoverProvider>
  );
}
