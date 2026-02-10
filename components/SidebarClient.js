"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHover } from "@/context/HoverContext";

export default function SidebarClient({ artistName, projects }) {
  const pathname = usePathname();
  const { hoveredProject, hoverSource, setSidebarHover, clearHover } = useHover();

  // When any hover is active (from tile or sidebar), mute non-hovered items
  const hasActiveHover = !!hoveredProject;

  console.log("SidebarClient render:", "hoveredProject:", hoveredProject, "hasActiveHover:", hasActiveHover);

  return (
    <nav className="fixed top-0 left-0 h-screen w-1/6 p-4 flex flex-col gap-8 overflow-y-auto">

      <div className="flex flex-row gap-8">
        <Link href="/">
          {artistName}
        </Link>
        <span
          className="text-muted"
          style={{
            opacity: hasActiveHover ? 0.3 : 1,
            transition: "opacity 300ms"
          }}
        >information</span>
      </div>
      <div className="flex flex-col gap-2">
        <span
          style={{
            opacity: hasActiveHover ? 0.3 : 1,
            transition: "opacity 300ms"
          }}
        >projects</span>
        <ul className="flex flex-col gap-0">
          {projects.map((project) => {
            const href = `/${project.slug.current}`;
            const projectSlug = project.slug.current;
            const isActive = pathname === href;
            const isHovered = hoveredProject === projectSlug;
            // Mute if there's an active hover and this isn't the hovered project
            const shouldMute = hasActiveHover && !isHovered;

            return (
              <li key={project._id}>
                <Link
                  href={href}
                  className={isActive ? "text-black" : "text-muted hover:text-black"}
                  style={{
                    opacity: shouldMute ? 0.3 : 1,
                    transition: "opacity 300ms"
                  }}
                  onMouseEnter={() => setSidebarHover(projectSlug)}
                  onMouseLeave={clearHover}
                >
                  {project.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
