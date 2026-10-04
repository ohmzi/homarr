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
import type { CustomThemeFamily, Rgb } from "./color-math";
import { parseHex, rgbToHsl, shade, toHex } from "./color-math";

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
