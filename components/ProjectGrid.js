"use client";

import { useMemo, useState, useEffect } from "react";
import { buildGridRows } from "@/lib/gridLayout";
import GridTile from "./GridTile";

export default function ProjectGrid({ projects, onProjectClick, onProjectHover }) {
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rows = useMemo(
    () => buildGridRows(projects, windowWidth || 375),
    [projects, windowWidth]
  );

  return (
    <div className="w-full flex flex-col gap-6" data-rendered-width={windowWidth || 375}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-start w-full">
          {row.tiles.map((tile) => (
            <GridTile
              key={tile.project._id}
              project={tile.project}
              widthPercent={tile.widthPercent}
              aspectRatio={tile.aspectRatio}
              onClick={onProjectClick}
              onHover={onProjectHover}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
