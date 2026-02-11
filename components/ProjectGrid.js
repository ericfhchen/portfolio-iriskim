"use client";

import { useMemo } from "react";
import { buildGridRows } from "@/lib/gridLayout";
import GridTile from "./GridTile";

export default function ProjectGrid({ projects, onProjectClick, onProjectHover }) {
  const rows = useMemo(() => buildGridRows(projects), [projects]);

  return (
    <div className="w-full flex flex-col gap-6">
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
