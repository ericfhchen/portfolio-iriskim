const DESKTOP_MIN_ROW_HEIGHT = 200;
const DESKTOP_MAX_ROW_HEIGHT = 250;
const MOBILE_MIN_ROW_HEIGHT = 100;
const MOBILE_MAX_ROW_HEIGHT = 150;
const MOBILE_BREAKPOINT = 640;

// Size multipliers affect the target height for tiles
const SIZE_MULTIPLIERS = {
  large: 1.0,
  medium: 0.85,
  small: 0.7,
};

// Calculate approximate row height for a set of tiles
export function getRowHeight(row) {
  return row?.rowHeight || DESKTOP_MAX_ROW_HEIGHT;
}

// Get the total height of N rows from the bottom, including gaps and tile labels
export function getBottomRowsHeight(rows, numRows, gap = 24) {
  if (!rows || rows.length === 0) return 0;

  const titleHeight = 20; // h-5 for title above
  const subtitleHeight = 20; // h-5 for role/year below
  const labelMargins = 4; // 2px + 2px margins
  const tileExtraHeight = titleHeight + subtitleHeight + labelMargins;

  // Get the last N rows
  const bottomRows = rows.slice(-numRows);

  let totalHeight = 0;
  bottomRows.forEach((row, i) => {
    totalHeight += row.rowHeight + tileExtraHeight;
    // Add gap between rows (not after the last one)
    if (i < bottomRows.length - 1) {
      totalHeight += gap;
    }
  });

  return totalHeight;
}

export function buildGridRows(projects, viewportWidth = 1400) {
  if (!projects || projects.length === 0) return [];

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT;
  const MIN_ROW_HEIGHT = isMobile ? MOBILE_MIN_ROW_HEIGHT : DESKTOP_MIN_ROW_HEIGHT;
  const MAX_ROW_HEIGHT = isMobile ? MOBILE_MAX_ROW_HEIGHT : DESKTOP_MAX_ROW_HEIGHT;

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
      rows.push(finalizeRow(currentRow, viewportWidth, true, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT));
      currentRow = [lastTile];
    }
  }

  // Add the last row without scaling to fill
  if (currentRow.length > 0) {
    rows.push(finalizeRow(currentRow, viewportWidth, false, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT));
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

function finalizeRow(tiles, viewportWidth, scaleToFill = true, minRowHeight = DESKTOP_MIN_ROW_HEIGHT, maxRowHeight = DESKTOP_MAX_ROW_HEIGHT) {
  const rowHeight = calculateRowHeight(tiles, viewportWidth);

  // Clamp row height to constraints (only for non-last rows)
  const finalRowHeight = scaleToFill
    ? Math.min(maxRowHeight, Math.max(minRowHeight, rowHeight))
    : Math.min(maxRowHeight, rowHeight); // Last row: don't force minimum

  const totalAspectWeight = tiles.reduce((sum, t) => sum + t.aspectRatio * t.sizeMultiplier, 0);

  const finalTiles = tiles.map((t) => {
    // For fill rows: normalize to always sum to 100% regardless of height clamping.
    // For last row: use natural proportional widths (no forced fill).
    const widthPercent = scaleToFill
      ? (t.aspectRatio * t.sizeMultiplier / totalAspectWeight) * 100
      : (finalRowHeight * t.aspectRatio * t.sizeMultiplier / viewportWidth) * 100;

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
