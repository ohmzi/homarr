// What the split-flap board says. The board sizes and centres the grid itself (see
// engine/renderer.ts), so this only interleaves the content rows and measures how wide
// the board has to be for them to fit. Kept free of React and the canvas so it can be
// tested alone.

import { textToCells } from "./engine/charset";

/**
 * Board lines the third row may fill: a fun line when all is well, or the three heaviest
 * consumers when it is not. The area keeps its height either way, so the board does not
 * change shape between the two.
 */
export const splitFlapAreaLines = 3;

/** The board lines, in order: two rows with a blank between, a blank, then the area. */
export const splitFlapRows = 4 + splitFlapAreaLines;
export const splitFlapGridRows = splitFlapRows + 2;
export const splitFlapMinColumns = 12;
export const splitFlapMaxColumns = 40;

const linePadding = 2;

/**
 * The board lines: the first two rows with a blank between them, a blank, then the third
 * row's lines. A row may carry several lines separated by "\n"; the area keeps its height
 * whatever it holds, so a one-line fun row leaves the rest blank rather than shifting the
 * rows above it.
 */
export const buildSplitFlapContent = (rows: readonly string[]): string[] => {
  const [first = "", second = "", ...rest] = rows;
  const area = rest.flatMap((row) => row.split("\n")).slice(0, splitFlapAreaLines);
  return [first, "", second, "", ...Array.from({ length: splitFlapAreaLines }, (_, index) => area[index] ?? "")];
};

/** The narrowest board the content fits on, so nothing is cut. */
export const getSplitFlapColumns = (rows: readonly string[]): number => {
  if (rows.length === 0) return splitFlapMinColumns;
  // Measured in flaps, not characters: ß prints as SS, and anything the drum cannot carry
  // — including the narrow no-break space some locales put before AM/PM — prints as one
  // blank, so it still takes a column.
  const longest = Math.max(...rows.map((row) => textToCells(row).length));
  return Math.min(splitFlapMaxColumns, Math.max(splitFlapMinColumns, longest + linePadding));
};
