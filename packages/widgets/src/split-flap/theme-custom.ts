// Builds a whole flap board from one color the user picked.
//
// A flap board reads as three-dimensional because of two things working together: a ramp of
// shades (a lit top half, a shadowed bottom half, a recessed housing, a dark crease) and the
// lighting ratios the renderer folds with. Picking one color and guessing the rest would
// flatten it, so the ramp is derived around the picked color — highlights add the headroom
// left above it, shadows take a fraction of it — and the lighting ratios come from the
// built-in board of the same family.

import type { FlapTheme } from "./engine/renderer";
import { flapThemes } from "./engine/renderer";

export type CustomThemeFamily = "light" | "dark";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const parseHex = (hex: string): Rgb | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = match?.[1];
  if (digits === undefined) return null;
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
};

const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === red
      ? ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
      : max === green
        ? ((blue - red) / delta + 2) * 60
        : ((red - green) / delta + 4) * 60;
  return { h: hue, s: saturation, l: lightness };
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  const sector = Math.floor(h / 60) % 6;
  const [red, green, blue] = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector] as [number, number, number];
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A lighter or darker version of a color. Highlights take a share of the headroom left
 * above the color and shadows take a share of the color itself, so a near-white board still
 * gets a visible ramp instead of every shade piling up at white.
 */
const shade = (base: Hsl, amount: number, saturationShift = 0): string => {
  const lightness = amount >= 0 ? base.l + amount * (1 - base.l) : base.l * (1 + amount);
  return toHex(hslToRgb({ h: base.h, s: clamp(base.s + saturationShift), l: clamp(lightness) }));
};

// Shares of the base color. Tuned against the two built-in boards so a derived board has the
// same amount of relief: a lit top edge, a shadowed bottom edge, a recessed housing.
const ramp = {
  faceHighlight: 0.08,
  faceBottom: -0.035,
  faceShadow: -0.14,
  frame: -0.09,
  frameEdge: 0.12,
  frameShade: -0.22,
  housing: -0.34,
  stack: -0.12,
  pin: -0.26,
  crease: -0.45,
  edge: 0.22,
} as const;

const fallback: Record<CustomThemeFamily, string> = {
  light: "#f0edea",
  dark: "#211f1d",
};

const customThemes = new Map<string, FlapTheme>();

/** Past this many, the cache is dropped: a scrubbed color picker would otherwise pile up. */
const cacheLimit = 64;

export const buildCustomTheme = (color: string, family: CustomThemeFamily): FlapTheme => {
  const parsed = parseHex(color) ?? parseHex(fallback[family]);
  const base = rgbToHsl(parsed as Rgb);
  const normalized = toHex(parsed as Rgb);
  const key = `${family}:${normalized}`;
  const cached = customThemes.get(key);
  if (cached) return cached;

  // The built-in board of the same family lends its lighting ratios — how hard the flaps
  // shade each other at the hinge and how dark a falling flap gets. They are what make the
  // derived ramp read as relief rather than as stripes of color.
  const template = family === "light" ? flapThemes.white : flapThemes.black;
  const face = shade(base, 0);
  const frame = shade(base, ramp.frame);
  // Printing ink: near-neutral so it reads as print rather than as a tint, and dark on a
  // light board or light on a dark one.
  const ink = shade(base, family === "light" ? -0.9 : 0.9, -base.s + 0.06);

  const theme: FlapTheme = {
    ...template,
    id: `custom-${family}:${normalized}`,
    face,
    faceHi: shade(base, ramp.faceHighlight),
    faceB: shade(base, ramp.faceBottom),
    faceLo: shade(base, ramp.faceShadow),
    housing: shade(base, ramp.housing, -0.1),
    crease: shade(base, ramp.crease, -0.1),
    stack: shade(base, ramp.stack),
    pin: shade(base, ramp.pin, -0.15),
    frame,
    frameEdge: shade(base, ramp.frameEdge),
    frameShade: shade(base, ramp.frameShade),
    edge: shade(base, ramp.edge),
    backdrop: [face, frame],
    glyph: ink,
    filled: ink,
  };

  if (customThemes.size >= cacheLimit) customThemes.clear();
  customThemes.set(key, theme);
  return theme;
};
