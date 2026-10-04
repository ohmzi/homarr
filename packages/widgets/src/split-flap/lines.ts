// What the split-flap board says. The board sizes and centres the grid itself (see
// engine/renderer.ts), so this only interleaves the content rows and measures how wide
// the board has to be for them to fit. Kept free of React and the canvas so it can be
// tested alone.

import { textToCells } from "./engine/charset";

/** The board always shows five rows of flaps: content, blank, content, blank, content. */
export const splitFlapRows = 5;
export const splitFlapGridRows = splitFlapRows + 2;
export const splitFlapMinColumns = 12;
export const splitFlapMaxColumns = 40;

const linePadding = 2;

/**
 * The five rows, unpadded: the content rows with a blank between each. The board centres
 * them and fills the rest of the grid with blanks.
 */
export const buildSplitFlapContent = (rows: readonly string[]): string[] =>
  rows.flatMap((row, index) => (index === 0 ? [row] : ["", row]));

/** The narrowest board the content fits on, so nothing is cut. */
export const getSplitFlapColumns = (rows: readonly string[]): number => {
  if (rows.length === 0) return splitFlapMinColumns;
  // Measured in flaps, not characters: ß prints as SS, and anything the drum cannot carry
  // — including the narrow no-break space some locales put before AM/PM — prints as one
  // blank, so it still takes a column.
  const longest = Math.max(...rows.map((row) => textToCells(row).length));
  return Math.min(splitFlapMaxColumns, Math.max(splitFlapMinColumns, longest + linePadding));
};
