const MIN_ROW_HEIGHT = 200;
const MAX_ROW_HEIGHT = 250;
const BASE_HEIGHT = 225; // Target height for calculations

// Size multipliers affect the target height for tiles
const SIZE_MULTIPLIERS = {
  large: 1.0,
  medium: 0.85,
  small: 0.7,
};

export function buildGridRows(projects, viewportWidth = 1400) {
  if (!projects || projects.length === 0) return [];

  const rows = [];
  let currentRow = [];

  for (const project of projects) {
    const aspectRatio = project.coverAspectRatio || 1.5;
    const sizeMultiplier = SIZE_MULTIPLIERS[project.tileSize] || SIZE_MULTIPLIERS.medium;

    currentRow.push({
      project,
      aspectRatio,
      sizeMultiplier,
    });

    // Check if current row can fit within height constraints
    const rowHeight = calculateRowHeight(currentRow, viewportWidth);

    // If row height drops below minimum, the row is too full
    // Finalize with previous tiles (excluding the one just added)
    if (rowHeight < MIN_ROW_HEIGHT && currentRow.length > 1) {
      const lastTile = currentRow.pop();
      rows.push(finalizeRow(currentRow, viewportWidth));
      currentRow = [lastTile];
    }
  }

  // Add the last row without scaling to fill
  if (currentRow.length > 0) {
    rows.push(finalizeRow(currentRow, viewportWidth, false));
  }

  return rows;
}

function calculateRowHeight(tiles, viewportWidth) {
  // Sum of (aspectRatio * sizeMultiplier) for all tiles
  // rowHeight = viewportWidth / sum(aspectRatio * sizeMultiplier)
  const sumAspectWeights = tiles.reduce((sum, t) => {
    return sum + t.aspectRatio * t.sizeMultiplier;
  }, 0);

  return viewportWidth / sumAspectWeights;
}

function finalizeRow(tiles, viewportWidth, scaleToFill = true) {
  const rowHeight = calculateRowHeight(tiles, viewportWidth);

  // Clamp row height to constraints (only for non-last rows)
  const finalRowHeight = scaleToFill
    ? Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, rowHeight))
    : Math.min(MAX_ROW_HEIGHT, rowHeight); // Last row: don't force minimum

  const finalTiles = tiles.map((t) => {
    // Width = rowHeight * aspectRatio * sizeMultiplier
    const tileWidth = finalRowHeight * t.aspectRatio * t.sizeMultiplier;
    const widthPercent = (tileWidth / viewportWidth) * 100;

    return {
      ...t,
      widthPercent,
    };
  });

  return {
    tiles: finalTiles,
    rowHeight: finalRowHeight,
  };
}
