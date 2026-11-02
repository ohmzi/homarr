// What color the flaps print in, independent of what the board itself is made of.

import type { FlapTheme } from "./engine/renderer";

export const splitFlapGlyphModes = ["standard", "rainbow", "custom"] as const;
export type SplitFlapGlyphMode = (typeof splitFlapGlyphModes)[number];

/** Eight hues, spaced so no two neighbours on the board read as the same color. */
const rainbowHues = [0, 42, 88, 140, 178, 214, 262, 316];

/** Relative luminance of a #rrggbb color, 0 (black) to 1 (white). */
const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
};

/** Whether the board's flaps are light, so the ink has to be dark to be readable. */
export const isLightBoard = (theme: FlapTheme): boolean => luminance(theme.face) > 0.5;

/** Darker inks on a light board, lighter inks on a dark one, so every hue stays legible. */
export const buildRainbowPalette = (lightBoard: boolean): readonly string[] =>
  rainbowHues.map((hue) => `hsl(${hue} 78% ${lightBoard ? 36 : 72}%)`);

/**
 * The color one cell prints in, from a deal of the palette.
 *
 * The seed is held for the whole of a roll, so a flap keeps its ink while it turns — a
 * color that changed every frame would shimmer — and is re-dealt on the next spin, so no
 * two rolls come out alike. The hash spreads neighboring cells apart, so the board does
 * not read as diagonal stripes.
 *
 * `Math.imul` keeps the mixing in 32-bit territory; plain multiplication would exceed the
 * exact integer range and quietly collapse the spread.
 */
export const rainbowColorFor = (row: number, column: number, palette: readonly string[], seed: number): string => {
  const hash = (Math.imul(row, 73_856_093) ^ Math.imul(column, 19_349_663) ^ Math.imul(seed, 83_492_791)) >>> 0;
  return palette[hash % palette.length] as string;
};

/** A fresh deal for the next spin. */
export const newRainbowSeed = (): number => Math.floor(Math.random() * 0x7fffffff);
