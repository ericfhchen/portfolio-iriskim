"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarClient({ artistName, projects }) {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 h-screen w-1/6 p-4 flex flex-col gap-8 overflow-y-auto">

      <div className="flex flex-row gap-8">
        <Link href="/">
          {artistName}
        </Link>
        <span className="text-muted">information</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="">projects</span>
        <ul className="flex flex-col gap-0">
          {projects.map((project) => {
            const href = `/${project.slug.current}`;
            const isActive = pathname === href;
            return (
              <li key={project._id}>
                <Link
                  href={href}
                  className={isActive ? "text-black" : "text-muted hover:text-black"}
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
