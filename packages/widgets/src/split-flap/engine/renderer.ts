// Split-flap canvas renderer, ported from MMacLaine/split-flap, src/renderer.js — see
// UPSTREAM-LICENSE.txt in this directory. Every geometry value is a ratio of tile
// height (H) unless marked px or ms: one 2D canvas, no CSS 3D, no filters, no per-frame
// shadows or blur, so a Raspberry Pi can keep up.
//
// Dropped in the port because the widget does not use them: the editor's zone highlight
// (setHighlight), the thumbnail renderer (renderStatic), the power-up idle roll (roll),
// the "faint flap" letter clock (retargetFaint) and the fill-the-viewport grid sizing
// (the widget derives its own rows and columns from the board text).

import { centreLine } from "./center-line";
import { buildRainbowPalette, isLightBoard, newRainbowSeed, rainbowColorFor } from "../glyph-color";
import { parseHex, rgbToHsl, shade } from "../color-math";
import { CHIPS, HALVES, STATUS_GLYPHS, cellChar, drumPath, isStatusGlyph, textToCells } from "./charset";

export const GEOM = {
  tileW: 0.68, // flap width / H
  gapX: 0.11, // housing gap between columns
  gapY: 0.17, // housing gap between rows (holds the flap stack edges)
  radius: 0.05, // flap corner radius
  crease: 0.022, // dark split line at 0.5H (min 1 device px)
  lip: 0.01, // highlight directly under the crease: top edge of the lower flap
  notchW: 0.035, // hinge pin notch, fraction of flap WIDTH
  notchH: 0.05, // hinge pin notch height
  capHeight: 0.46, // glyph cap height
  baseline: 0.73, // glyph baseline from flap top (cap top lands at 0.27H, centred on the split)
  stack1: 0.01, // first peeking flap edge, offset below flap bottom
  stack2: 0.03, // second peeking flap edge
  fit: 1, // the flap grid fills the canvas on its limiting axis; the frame goes to the edges
} as const;

export interface FlapTheme {
  id: string;
  face: string;
  faceHi: string;
  faceB: string;
  faceLo: string;
  housing: string;
  crease: string;
  lip: string;
  stack: string;
  pin: string;
  glyph: string;
  // The fork already ships IBM Plex Mono (apps/nextjs/src/styles/ohmz-brand.scss), so
  // upstream's DM Mono is not vendored; the fallbacks carry the widget if it is missing.
  font: string;
  weight: number;
  capRatio: number;
  frame: string;
  frameEdge: string;
  frameShade: string;
  framePad: number;
  frameRadius: number;
  rail?: string;
  screws?: boolean;
  screw?: string;
  backdrop: readonly [string, string];
  shadow: number;
  occl: number;
  cast: number;
  fallDark: number;
  riseLight: number;
  edge: string;
  filled: string;
}

// The board palette is painted from the ohmz brand tokens in
// apps/nextjs/src/styles/ohmz-brand.scss, whose source of truth is
// ai-stack/branding/ohmz.css. Roles the brand does not name — the recess behind the flaps
// and the crease across them — are mixed down from the darkest token of the same family,
// so the whole ramp stays on the brand's warm ramp rather than falling to neutral black.
const brandDark = {
  canvas: "#1a1917",
  panel: "#211f1d",
  raise: "#262421",
  hover: "#2d2a26",
  line: "#3a3733",
  lineSoft: "#302d2a",
  text: "#f0edea",
  secondary: "#cbc5be",
  muted: "#8b857e",
  code: "#131211",
} as const;

const brandLight = {
  canvas: "#faf9f7",
  panel: "#f0edea",
  line: "#ddd7d0",
  text: "#1a1917",
  offWhite: "#f6f4f2",
  muted: "#8b857e",
} as const;

/** Mixes down from a token, so a shade is still on the brand's ramp. */
const below = (hex: string, amount: number): string => {
  const parsed = parseHex(hex);
  return parsed === null ? hex : shade(rgbToHsl(parsed), amount);
};

export const flapThemes: Record<"black" | "white" | "solari", FlapTheme> = {
  black: {
    id: "black",
    face: brandDark.panel,
    faceHi: brandDark.raise,
    faceB: brandDark.canvas,
    faceLo: brandDark.code,
    housing: below(brandDark.code, -0.35),
    crease: below(brandDark.code, -0.55),
    lip: "rgba(255,255,255,0.06)",
    stack: brandDark.hover,
    pin: brandDark.line,
    glyph: brandDark.text,
    font: '"IBM Plex Mono"',
    weight: 500,
    capRatio: 0.7,
    frame: brandDark.code,
    frameEdge: brandDark.line,
    frameShade: below(brandDark.code, -0.25),
    framePad: 0.5,
    frameRadius: 0.12,
    backdrop: [brandDark.panel, brandDark.code],
    shadow: 0.6,
    occl: 0.28,
    cast: 0.35,
    fallDark: 0.55,
    riseLight: 0.1,
    edge: brandDark.line,
    filled: brandDark.text,
  },
  white: {
    id: "white",
    face: brandLight.panel,
    faceHi: brandLight.offWhite,
    faceB: brandLight.line,
    faceLo: below(brandLight.line, -0.25),
    housing: below(brandLight.line, -0.45),
    crease: below(brandLight.line, -0.62),
    lip: "rgba(255,255,255,0.7)",
    stack: brandLight.line,
    pin: brandLight.muted,
    glyph: brandLight.text,
    font: '"IBM Plex Mono"',
    weight: 500,
    capRatio: 0.7,
    frame: brandLight.line,
    frameEdge: brandLight.offWhite,
    frameShade: below(brandLight.line, -0.38),
    framePad: 0.5,
    frameRadius: 0.12,
    backdrop: [brandLight.canvas, brandLight.line],
    shadow: 0.28,
    occl: 0.16,
    cast: 0.22,
    fallDark: 0.3,
    riseLight: 0.18,
    edge: brandLight.offWhite,
    filled: brandLight.text,
  },
  solari: {
    id: "solari",
    face: "#2A2B2D",
    faceHi: "#313235",
    faceB: "#28292B",
    faceLo: "#1E1F21",
    housing: "#0C0D0E",
    crease: "#050506",
    lip: "rgba(255,255,255,0.08)",
    stack: "#3B3C40",
    pin: "#55575C",
    glyph: "#F2B01E",
    font: '"IBM Plex Mono"',
    weight: 700,
    capRatio: 0.72,
    frame: "#1C1D1F",
    frameEdge: "#3A3C40",
    frameShade: "#0A0A0B",
    framePad: 0.9,
    frameRadius: 0.06,
    rail: "#161719",
    screws: true,
    screw: "#6A6D72",
    backdrop: ["#303236", "#1B1C1F"],
    shadow: 0.5,
    occl: 0.3,
    cast: 0.35,
    fallDark: 0.5,
    riseLight: 0.1,
    edge: "#5A5C61",
    filled: "#F2B01E",
  },
};

export type FlapThemeId = keyof typeof flapThemes;

// Timing (ms). One flip = one character step on the drum.
export const flapSpeeds = {
  fast: { step: 70, final: 160, settle: 90, maxSteps: 10 },
  gentle: { step: 110, final: 260, settle: 120, maxSteps: 14 },
  // Every flap between here and there, like the hardware. Steps are quicker than fast so
  // a full turn of the drum (74 flaps) lands in about four seconds.
  authentic: { step: 52, final: 160, settle: 90, maxSteps: Number.POSITIVE_INFINITY },
} as const;
export type FlapSpeed = keyof typeof flapSpeeds;

// fold angle = PI * t^1.35 (gravity: slow release, accelerating fall)
const foldExponent = 1.35;
const settleAngle = 0.13; // rebound after the final flap lands (radians)
const fadeDuration = 140; // reduced motion crossfade

export const stagger = {
  classic: (_row: number, column: number) => column * 22 + Math.random() * 30,
  wave: (row: number, column: number) => (row + column) * 28,
  drift: () => Math.random() * 1200,
  curtain: (row: number, column: number) => row * 140 + column * 6,
};
export type FlapTransition = keyof typeof stagger;

export const thetaAt = (t: number): number => Math.PI * Math.pow(Math.min(1, Math.max(0, t)), foldExponent);

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

// The heart, as a path: shared by the ♥ character and the green status heart.
const heartPath = (ctx: CanvasRenderingContext2D, centerX: number, top: number, capHeight: number) => {
  const halfWidth = capHeight * 0.54;
  ctx.beginPath();
  ctx.moveTo(centerX, top + capHeight);
  ctx.bezierCurveTo(
    centerX - halfWidth * 0.35,
    top + capHeight * 0.72,
    centerX - halfWidth,
    top + capHeight * 0.52,
    centerX - halfWidth,
    top + capHeight * 0.26,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth,
    top - capHeight * 0.02,
    centerX - halfWidth * 0.25,
    top - capHeight * 0.06,
    centerX,
    top + capHeight * 0.2,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth * 0.25,
    top - capHeight * 0.06,
    centerX + halfWidth,
    top - capHeight * 0.02,
    centerX + halfWidth,
    top + capHeight * 0.26,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth,
    top + capHeight * 0.52,
    centerX + halfWidth * 0.35,
    top + capHeight * 0.72,
    centerX,
    top + capHeight,
  );
};

// A status glyph paints its shape in its own colour — not the board ink a letter uses —
// so the maintainer readout reads at a glance. Shapes are drawn, never typeset, for the
// same reason ♥ is: a fallback font would render an emoji.
const paintStatusGlyph = (
  ctx: CanvasRenderingContext2D,
  glyph: { shape: "heart" | "pumpkin" | "alert"; color: string },
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const capHeight = h * GEOM.capHeight;
  const top = y + h * (GEOM.baseline - GEOM.capHeight);
  const centerX = x + w / 2;
  ctx.fillStyle = glyph.color;

  if (glyph.shape === "heart") {
    heartPath(ctx, centerX, top, capHeight);
    ctx.fill();
    return;
  }

  if (glyph.shape === "pumpkin") {
    const bodyW = capHeight * 1.25;
    const bodyH = capHeight * 0.9;
    const cy = top + capHeight - bodyH / 2;
    ctx.beginPath();
    ctx.ellipse(centerX, cy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stem and ridges are shaded over the body so they read on a solid shape.
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(
      centerX - capHeight * 0.06,
      top + capHeight - bodyH - capHeight * 0.15,
      capHeight * 0.12,
      capHeight * 0.18,
    );
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, capHeight * 0.06);
    for (const lean of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(centerX + lean * bodyW * 0.1, cy, bodyW * 0.36, bodyH * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  // Alert light: a lamp on a base, with rays.
  const domeR = capHeight * 0.32;
  const baseY = top + capHeight;
  ctx.beginPath();
  ctx.arc(centerX, baseY - capHeight * 0.14, domeR, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(centerX - domeR * 1.2, baseY - capHeight * 0.14, domeR * 2.4, capHeight * 0.14);
  ctx.strokeStyle = glyph.color;
  ctx.lineWidth = Math.max(1, capHeight * 0.07);
  const rayOriginY = baseY - capHeight * 0.14 - domeR - capHeight * 0.02;
  for (const angle of [-0.75, 0, 0.75]) {
    const innerX = centerX + Math.sin(angle) * domeR * 0.55;
    const innerY = rayOriginY - Math.cos(angle) * capHeight * 0.03;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(centerX + Math.sin(angle) * (domeR + capHeight * 0.16), innerY - Math.cos(angle) * capHeight * 0.2);
    ctx.stroke();
  }
};

const paintFace = (
  ctx: CanvasRenderingContext2D,
  character: string,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FlapTheme,
  ink: string,
) => {
  const hinge = y + h / 2;
  const radius = h * GEOM.radius;
  // a half flap is a blank face with one half in its color
  const half = Object.hasOwn(HALVES, character) ? HALVES[character] : undefined;
  const key = half ? half[0] : character;
  const tint = key === "f" ? ink : Object.hasOwn(CHIPS, key) ? CHIPS[key] : undefined;
  const [chipY, chipHeight] = half ? (half[1] === "top" ? [y, hinge - y] : [hinge, y + h - hinge]) : [y, h];
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  let gradient = ctx.createLinearGradient(0, y, 0, y + h);
  if (tint && half) {
    gradient.addColorStop(0, theme.faceHi);
    gradient.addColorStop(0.5, theme.face);
    gradient.addColorStop(0.5, theme.faceB);
    gradient.addColorStop(1, theme.faceLo);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tint;
    ctx.fillRect(x, chipY, w, chipHeight);
    const sheen = ctx.createLinearGradient(0, chipY, 0, chipY + chipHeight);
    sheen.addColorStop(0, half[1] === "top" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)");
    sheen.addColorStop(1, half[1] === "top" ? "rgba(255,255,255,0)" : "rgba(0,0,0,0.14)");
    ctx.fillStyle = sheen;
    ctx.fillRect(x, chipY, w, chipHeight);
  } else if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    gradient.addColorStop(0, "rgba(255,255,255,0.07)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.04)");
    gradient.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
  } else {
    gradient.addColorStop(0, theme.faceHi);
    gradient.addColorStop(0.5, theme.face);
    gradient.addColorStop(0.5, theme.faceB);
    gradient.addColorStop(1, theme.faceLo);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    const status = isStatusGlyph(character) ? STATUS_GLYPHS[character] : undefined;
    if (status) {
      paintStatusGlyph(ctx, status, x, y, w, h);
    } else if (character === "♥") {
      // Drawn as a shape: the board faces may not carry the glyph, and a fallback font
      // would draw an emoji. Cap height tall, in the glyph color.
      ctx.fillStyle = ink;
      heartPath(ctx, x + w / 2, y + h * (GEOM.baseline - GEOM.capHeight), h * GEOM.capHeight);
      ctx.fill();
    } else if (character !== " ") {
      const fontSize = (h * GEOM.capHeight) / theme.capRatio;
      ctx.font = `${theme.weight} ${fontSize}px ${theme.font}, ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = ink;
      ctx.fillText(character, x + w / 2, y + h * GEOM.baseline);
    }
  }
  // hinge occlusion: the halves shade each other near the split
  gradient = ctx.createLinearGradient(0, hinge - h * 0.08, 0, hinge);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${theme.occl})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, hinge - h * 0.08, w, h * 0.08);
  gradient = ctx.createLinearGradient(0, hinge, 0, hinge + h * 0.06);
  gradient.addColorStop(0, `rgba(0,0,0,${theme.occl})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, hinge, w, h * 0.06);
  // crease + lip
  const crease = Math.max(1, Math.round(h * GEOM.crease));
  const creaseY = Math.round(hinge - crease / 2);
  ctx.fillStyle = theme.crease;
  ctx.fillRect(x, creaseY, w, crease);
  ctx.fillStyle = theme.lip;
  ctx.fillRect(x, creaseY + crease, w, Math.max(1, Math.round(h * GEOM.lip)));
  // hinge pin notches, cut into both side edges
  const notchWidth = Math.max(1, Math.round(w * GEOM.notchW));
  const notchHeight = Math.max(2, Math.round(h * GEOM.notchH));
  ctx.fillStyle = theme.housing;
  ctx.fillRect(x, Math.round(hinge - notchHeight / 2), notchWidth, notchHeight);
  ctx.fillRect(x + w - notchWidth, Math.round(hinge - notchHeight / 2), notchWidth, notchHeight);
  ctx.restore();
};

class Atlas {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  get(character: string, w: number, h: number, theme: FlapTheme, ink: string): HTMLCanvasElement {
    // The ink is part of the key: a custom or rainbow color makes several faces for the
    // same character on one board.
    const key = `${theme.id}|${ink}|${character}|${w}x${h}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (context) paintFace(context, character, 0, 0, w, h, theme, ink);
    this.cache.set(key, canvas);
    return canvas;
  }

  clear() {
    this.cache.clear();
  }
}

// theta: 0 = old char flat, PI/2 = top flap edge-on, PI = new char flat.
const drawFold = (
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FlapTheme,
  from: string,
  to: string,
  theta: number,
  ink: string,
) => {
  const halfHeight = Math.round(h / 2);
  const hinge = y + halfHeight;
  const faceFrom = atlas.get(from, w, h, theme, ink);
  const faceTo = atlas.get(to, w, h, theme, ink);
  if (theta <= 0) {
    ctx.drawImage(faceFrom, x, y);
    return;
  }
  if (theta >= Math.PI) {
    ctx.drawImage(faceTo, x, y);
    return;
  }
  ctx.save();
  roundRect(ctx, x, y, w, h, h * GEOM.radius);
  ctx.clip();
  ctx.drawImage(faceTo, 0, 0, w, halfHeight, x, y, w, halfHeight); // next char, top half (revealed)
  ctx.drawImage(faceFrom, 0, halfHeight, w, h - halfHeight, x, hinge, w, h - halfHeight); // previous char, bottom half
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  if (theta < Math.PI / 2) {
    ctx.fillStyle = `rgba(0,0,0,${(theme.cast * cos).toFixed(3)})`;
    ctx.fillRect(x, y, w, halfHeight);
    const fallingHeight = Math.max(1, halfHeight * cos);
    ctx.drawImage(faceFrom, 0, 0, w, halfHeight, x, hinge - fallingHeight, w, fallingHeight); // falling top flap
    ctx.fillStyle = `rgba(0,0,0,${(theme.fallDark * sin).toFixed(3)})`;
    ctx.fillRect(x, hinge - fallingHeight, w, fallingHeight);
  } else {
    const landingHeight = Math.max(1, halfHeight * -cos);
    const shadeHeight = h * 0.12;
    const gradient = ctx.createLinearGradient(0, hinge + landingHeight, 0, hinge + landingHeight + shadeHeight);
    gradient.addColorStop(0, `rgba(0,0,0,${(theme.cast * sin).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, hinge + landingHeight, w, Math.min(shadeHeight, halfHeight - landingHeight));
    ctx.drawImage(faceTo, 0, halfHeight, w, h - halfHeight, x, hinge, w, landingHeight); // landing flap
    ctx.fillStyle = `rgba(255,255,255,${(theme.riseLight * sin).toFixed(3)})`;
    ctx.fillRect(x, hinge, w, landingHeight);
  }
  if (sin > 0.85) {
    // flap edge catching the light near edge-on
    const edge = Math.max(1, Math.round(h * 0.012));
    ctx.globalAlpha = (sin - 0.85) / 0.15;
    ctx.fillStyle = theme.edge;
    ctx.fillRect(x, hinge - edge, w, edge);
    ctx.globalAlpha = 1;
  }
  const crease = Math.max(1, Math.round(h * GEOM.crease));
  ctx.fillStyle = theme.crease;
  ctx.fillRect(x, Math.round(hinge - crease / 2), w, crease);
  ctx.restore();
};

const paintCellBed = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  gapX: number,
  theme: FlapTheme,
) => {
  ctx.fillStyle = theme.stack;
  ctx.fillRect(
    x + tileWidth * 0.03,
    y + tileHeight + Math.round(tileHeight * GEOM.stack1),
    tileWidth * 0.94,
    Math.max(1, Math.round(tileHeight * 0.012)),
  );
  ctx.globalAlpha = 0.55;
  ctx.fillRect(
    x + tileWidth * 0.07,
    y + tileHeight + Math.round(tileHeight * GEOM.stack2),
    tileWidth * 0.86,
    Math.max(1, Math.round(tileHeight * 0.01)),
  );
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.pin;
  const pinHeight = Math.max(2, Math.round(tileHeight * 0.04));
  const pinWidth = Math.max(1, Math.round(gapX * 0.35));
  ctx.fillRect(x - pinWidth, Math.round(y + tileHeight / 2 - pinHeight / 2), pinWidth, pinHeight);
  ctx.fillRect(x + tileWidth, Math.round(y + tileHeight / 2 - pinHeight / 2), pinWidth, pinHeight);
};

const paintScrew = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  theme: FlapTheme,
  angle: number,
) => {
  ctx.fillStyle = theme.frameShade;
  ctx.beginPath();
  ctx.arc(centerX, centerY + radius * 0.18, radius * 1.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.screw ?? "#6A6D72";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.frameShade;
  ctx.lineWidth = Math.max(1, radius * 0.28);
  ctx.beginPath();
  ctx.moveTo(centerX - Math.cos(angle) * radius * 0.7, centerY - Math.sin(angle) * radius * 0.7);
  ctx.lineTo(centerX + Math.cos(angle) * radius * 0.7, centerY + Math.sin(angle) * radius * 0.7);
  ctx.stroke();
};

type CellAction =
  | { kind: "flip"; from: string; to: string; start: number; duration: number; final: boolean }
  | { kind: "fade"; from: string; to: string; start: number; duration: number }
  | { kind: "settle"; from: string; to: string; start: number; duration: number };

interface Cell {
  current: string;
  queue: string[];
  action: CellAction | null;
  due: number;
  column: number;
  speed: FlapSpeed | null;
}

export interface FlapBoardOptions {
  rows?: number;
  /** Column count. Grown to fill the canvas when `autoCols` is set. */
  cols?: number;
  /**
   * Grow the column count until the grid's shape matches the canvas, so the flaps reach
   * every edge instead of leaving a backdrop margin. The row count is left alone: it fixes
   * how many blank rows frame the content, so an auto side-to-side board never gains a
   * stray blank row at the bottom.
   */
  autoCols?: boolean;
  /** A built-in board id, or a whole theme as built by theme-custom.ts. */
  theme?: FlapThemeId | FlapTheme;
  /** "standard" prints in the board's own ink; "rainbow" and "custom" override it. */
  glyphMode?: "standard" | "rainbow" | "custom";
  /** Used when `glyphMode` is "custom". */
  glyphColor?: string;
  speed?: FlapSpeed;
  transition?: FlapTransition;
  maxDpr?: number;
  reduced?: boolean;
}

interface ResolvedOptions {
  rows: number;
  cols: number;
  autoCols: boolean;
  theme: FlapTheme;
  glyphMode: "standard" | "rainbow" | "custom";
  glyphColor: string;
  speed: FlapSpeed;
  transition: FlapTransition;
  maxDpr: number;
  reduced: boolean;
}

// Beyond this an auto-sized board's flaps get too small to read as flaps.
const maxAutoCols = 60;

export class FlapBoard {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly atlas = new Atlas();
  private readonly background: HTMLCanvasElement;
  private readonly observer: ResizeObserver;
  private readonly options: ResolvedOptions;
  // The caller's column floor, kept apart from `options.cols` so auto-sizing can shrink
  // the board again when the widget changes shape.
  private readonly minCols: number;
  private readonly lightBoard: boolean;
  private readonly rainbow: readonly string[];
  private rainbowSeed = newRainbowSeed();
  private cells: Cell[][] = [];
  private target: string[] | null = null;
  private frameHandle = 0;
  private lastFrame = 0;
  private slowFrames = 0;
  private sizeKey = "";
  private width = 0;
  private height = 0;
  private tileHeight = 0;
  private tileWidth = 0;
  private gapX = 0;
  private gapY = 0;
  private pad = 0;
  private gridWidth = 0;
  private gridHeight = 0;
  private gridX = 0;
  private gridY = 0;

  constructor(canvas: HTMLCanvasElement, options: FlapBoardOptions = {}) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("split-flap: canvas 2d context unavailable");
    this.ctx = context;
    this.background = document.createElement("canvas");
    this.options = {
      rows: options.rows ?? 5,
      cols: options.cols ?? 12,
      autoCols: options.autoCols ?? false,
      theme: typeof options.theme === "string" ? flapThemes[options.theme] : (options.theme ?? flapThemes.black),
      glyphMode: options.glyphMode ?? "standard",
      glyphColor: options.glyphColor ?? "#ffffff",
      speed: options.speed ?? "fast",
      transition: options.transition ?? "classic",
      maxDpr: options.maxDpr ?? 2,
      reduced:
        options.reduced ??
        (typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
          : false),
    };
    this.minCols = this.options.cols;
    this.lightBoard = isLightBoard(this.options.theme);
    this.rainbow = buildRainbowPalette(this.lightBoard);
    this.build();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    if (document.fonts) {
      void document.fonts.ready.then(() => {
        this.atlas.clear();
        this.paintFull();
      });
    }
  }

  private build() {
    const previous = this.cells;
    this.cells = [];
    for (let row = 0; row < this.options.rows; row++) {
      const cells: Cell[] = [];
      for (let column = 0; column < this.options.cols; column++) {
        const existing = previous[row]?.[column];
        cells.push({
          current: existing ? existing.current : " ",
          queue: [],
          action: null,
          due: 0,
          column,
          speed: null,
        });
      }
      this.cells.push(cells);
    }
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr);
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (width < 1 || height < 1) return; // a canvas a fraction of a pixel tall mid-layout: wait for the real size
    const key = `${width}x${height}|${this.options.theme.id}|${this.options.autoCols ? "auto" : `${this.options.rows}x${this.options.cols}`}`;
    if (key === this.sizeKey) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.atlas.clear();
    this.applyAutoCols();
    this.layout();
    this.paintBackground();
    this.paintFull();
    this.sizeKey = key; // only once painted, so a failed paint is tried again at the same size
  }

  // Grow the column count until the grid's shape matches the canvas, so the flaps reach
  // the sides instead of leaving a margin. The row count is the caller's, untouched: it is
  // what decides how many blank rows frame the content, and growing it would tip an extra
  // blank row onto whichever side the centring rounds towards.
  //
  // Columns the content needs are a hard floor — a wider board means more flaps, not
  // smaller text, since the whole grid is scaled to one tile size.
  private applyAutoCols() {
    if (!this.options.autoCols) return;
    const { framePad } = this.options.theme;
    const unitHeight = this.options.rows + (this.options.rows - 1) * GEOM.gapY + 2 * framePad;
    const wanted = unitHeight * (this.width / this.height);
    const columns = Math.min(
      maxAutoCols,
      Math.max(this.minCols, Math.round((wanted + GEOM.gapX - 2 * framePad) / (GEOM.tileW + GEOM.gapX))),
    );
    if (columns === this.options.cols) return;
    this.options.cols = columns;
    this.build();
    if (this.target) this.setGrid(this.target);
  }

  private layout() {
    const theme = this.options.theme;
    const rows = this.options.rows;
    const columns = this.options.cols;
    const pad = theme.framePad;
    const unitWidth = columns * GEOM.tileW + (columns - 1) * GEOM.gapX + 2 * pad;
    const unitHeight = rows + (rows - 1) * GEOM.gapY + 2 * pad;
    let tileHeight = Math.floor(Math.min((this.width * GEOM.fit) / unitWidth, (this.height * GEOM.fit) / unitHeight));
    tileHeight = Math.max(8, tileHeight - (tileHeight % 2));
    this.tileHeight = tileHeight;
    this.tileWidth = Math.round(tileHeight * GEOM.tileW);
    this.gapX = Math.round(tileHeight * GEOM.gapX);
    this.gapY = Math.round(tileHeight * GEOM.gapY);
    this.pad = Math.round(tileHeight * pad);
    this.gridWidth = columns * this.tileWidth + (columns - 1) * this.gapX;
    this.gridHeight = rows * tileHeight + (rows - 1) * this.gapY;
    this.gridX = Math.round((this.width - this.gridWidth) / 2);
    this.gridY = Math.round((this.height - this.gridHeight) / 2);
  }

  private cellXY(row: number, column: number): [number, number] {
    return [this.gridX + column * (this.tileWidth + this.gapX), this.gridY + row * (this.tileHeight + this.gapY)];
  }

  private paintBackground() {
    const theme = this.options.theme;
    const background = this.background;
    background.width = this.width;
    background.height = this.height;
    const ctx = background.getContext("2d");
    if (!ctx) return;
    const { width, height, tileHeight } = this;
    // The frame spans the whole canvas: there is no margin between it and the widget edge.
    // The backdrop still sits underneath it for the sliver the frame's rounded corners leave.
    const gradient = ctx.createRadialGradient(
      width / 2,
      height * 0.46,
      0,
      width / 2,
      height * 0.46,
      Math.hypot(width, height) * 0.6,
    );
    const [backdropStart, backdropEnd] = theme.backdrop;
    gradient.addColorStop(0, backdropStart);
    gradient.addColorStop(1, backdropEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const frameRadius = tileHeight * theme.frameRadius;
    ctx.fillStyle = theme.frame;
    roundRect(ctx, 0, 0, width, height, frameRadius);
    ctx.fill();
    const lineWidth = Math.max(1, Math.round(tileHeight * 0.012));
    ctx.fillStyle = theme.frameEdge;
    ctx.fillRect(frameRadius, 0, width - 2 * frameRadius, lineWidth);
    ctx.fillStyle = theme.frameShade;
    ctx.fillRect(frameRadius, height - lineWidth, width - 2 * frameRadius, lineWidth);
    // The housing bed fills everything inside the frame, however much room the centred
    // grid leaves over.
    const bedPad = Math.round(Math.min(this.gapX, this.gapY) * 0.8);
    const bedX = Math.max(0, this.pad - bedPad);
    const bedWidth = width - 2 * bedX;
    ctx.fillStyle = theme.housing;
    roundRect(ctx, bedX, bedX, bedWidth, height - 2 * bedX, tileHeight * 0.04);
    ctx.fill();
    if (theme.rail) {
      ctx.fillStyle = theme.rail;
      for (let row = 0; row < this.options.rows; row++) {
        const [, y] = this.cellXY(row, 0);
        ctx.fillRect(bedX, y + tileHeight * 0.42, bedWidth, tileHeight * 0.16);
      }
    }
    for (let row = 0; row < this.options.rows; row++) {
      for (let column = 0; column < this.options.cols; column++) {
        const [x, y] = this.cellXY(row, column);
        paintCellBed(ctx, x, y, this.tileWidth, tileHeight, this.gapX, theme);
      }
    }
    if (theme.screws) {
      const radius = tileHeight * 0.075;
      const inset = this.pad * 0.5;
      const points: [number, number][] = [
        [inset, inset],
        [width - inset, inset],
        [inset, height - inset],
        [width - inset, height - inset],
        [width / 2, inset],
        [width / 2, height - inset],
      ];
      if (width / height > 2.5) {
        points.push(
          [width / 4, inset],
          [(width * 3) / 4, inset],
          [width / 4, height - inset],
          [(width * 3) / 4, height - inset],
        );
      }
      points.forEach(([x, y], index) => paintScrew(ctx, x, y, radius, theme, 0.4 + index * 1.3));
    }
  }

  private paintFull() {
    if (!this.width || !this.height || !this.background.width || !this.background.height) return;
    this.ctx.drawImage(this.background, 0, 0);
    const now = performance.now();
    for (let row = 0; row < this.options.rows; row++) {
      for (let column = 0; column < this.options.cols; column++) this.drawCell(row, column, now);
    }
  }

  private drawCell(row: number, column: number, now: number) {
    const [x, y] = this.cellXY(row, column);
    const { tileWidth, tileHeight, ctx } = this;
    const theme = this.options.theme;
    ctx.drawImage(this.background, x, y, tileWidth, tileHeight, x, y, tileWidth, tileHeight);
    const cell = this.cells[row]?.[column];
    if (!cell) return;
    const ink = this.inkFor(row, column);
    const action = cell.action;
    if (!action) {
      ctx.drawImage(this.atlas.get(cell.current, tileWidth, tileHeight, theme, ink), x, y);
      return;
    }
    const t = Math.min(1, Math.max(0, (now - action.start) / action.duration));
    if (action.kind === "fade") {
      ctx.drawImage(this.atlas.get(action.from, tileWidth, tileHeight, theme, ink), x, y);
      ctx.globalAlpha = t;
      ctx.drawImage(this.atlas.get(action.to, tileWidth, tileHeight, theme, ink), x, y);
      ctx.globalAlpha = 1;
      return;
    }
    if (action.kind === "settle") {
      drawFold(
        ctx,
        this.atlas,
        x,
        y,
        tileWidth,
        tileHeight,
        theme,
        action.to,
        action.to,
        Math.PI - settleAngle * Math.sin(Math.PI * t),
        ink,
      );
      return;
    }
    drawFold(ctx, this.atlas, x, y, tileWidth, tileHeight, theme, action.from, action.to, thetaAt(t), ink);
  }

  private dealRainbow(): boolean {
    this.rainbowSeed = newRainbowSeed();
    return true;
  }

  /** The ink for one flap: the board's own, one color for all of them, or per cell. */
  private inkFor(row: number, column: number): string {
    if (this.options.glyphMode === "custom") return this.options.glyphColor;
    if (this.options.glyphMode === "rainbow") return rainbowColorFor(row, column, this.rainbow, this.rainbowSeed);
    return this.options.theme.glyph;
  }

  // True when no flap is moving or queued.
  isIdle(): boolean {
    return this.cells.every((row) => row.every((cell) => !cell.action && cell.queue.length === 0));
  }

  /**
   * Send the board to these lines. Each is centred across the grid and the block of them
   * is centred down it, so a caller hands over just its content and the board frames it
   * with whatever blank rows and columns are left.
   */
  setGrid(lines: string[], { instant = false }: { instant?: boolean } = {}) {
    this.target = lines;
    // Every spin deals the rainbow again, so no two rolls look alike. Flaps that stay put
    // would otherwise keep the ink they were drawn with, so the board is repainted to the
    // new deal before anything turns.
    const redealt = this.options.glyphMode === "rainbow" && this.dealRainbow();
    const now = performance.now();
    const staggerFor = stagger[this.options.transition];
    const speed = flapSpeeds[this.options.speed];
    const top = Math.max(0, Math.floor((this.options.rows - lines.length) / 2));
    const centred = lines.map((line) => centreLine(textToCells(line), this.options.cols));
    let any = false;
    for (let row = 0; row < this.options.rows; row++) {
      const cells = this.cells[row];
      if (!cells) continue;
      const line = centred[row - top];
      for (let column = 0; column < this.options.cols; column++) {
        const cell = cells[column];
        if (!cell) continue;
        const want = cellChar(line?.[column]);
        if (instant) {
          cell.current = want;
          cell.queue = [];
          cell.action = null;
          continue;
        }
        const destination = cell.queue.length
          ? (cell.queue[cell.queue.length - 1] ?? cell.current)
          : cell.action && cell.action.kind !== "settle"
            ? cell.action.to
            : cell.current;
        if (want === destination) continue;
        cell.queue = this.options.reduced ? [want] : this.path(destination, want, speed.maxSteps);
        cell.speed = null;
        if (!cell.action) cell.due = now + staggerFor(row, column);
        any = true;
      }
    }
    if (instant) this.paintFull();
    else {
      if (redealt) this.paintFull();
      if (any) this.kick();
    }
  }

  // The drum path between two flaps.
  private path(from: string, to: string, maxSteps: number): string[] {
    const path = drumPath(from, to, maxSteps);
    if (path.length) path[path.length - 1] = to;
    return path;
  }

  private kick() {
    if (this.frameHandle) return;
    this.lastFrame = 0;
    this.slowFrames = 0;
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  private start(cell: Cell, now: number, speed: (typeof flapSpeeds)[FlapSpeed]): CellAction {
    const to = cell.queue.shift() as string;
    const final = cell.queue.length === 0;
    if (this.options.reduced) return { kind: "fade", from: cell.current, to, start: now, duration: fadeDuration };
    return {
      kind: "flip",
      from: cell.current,
      to,
      start: now,
      duration: final ? speed.final : speed.step,
      final,
    };
  }

  // Frame budget: 45 long frames (over 34ms, so under ~30fps) in one run of animation
  // means the device cannot keep up at this density. Drop to 1x once; it stays there.
  private budget(now: number) {
    if (this.lastFrame && this.options.maxDpr > 1 && (window.devicePixelRatio || 1) > 1) {
      const delta = now - this.lastFrame;
      if (delta > 34 && delta < 250 && !document.hidden) this.slowFrames++; // over 250ms is a background tab
      if (this.slowFrames > 45) {
        this.options.maxDpr = 1;
        this.slowFrames = 0;
        this.sizeKey = "";
        this.resize();
      }
    }
    this.lastFrame = now;
  }

  private tick = (now: number) => {
    this.frameHandle = 0;
    let active = false;
    const speed = flapSpeeds[this.options.speed];
    this.budget(now);
    for (let row = 0; row < this.cells.length; row++) {
      const cells = this.cells[row];
      if (!cells) continue;
      for (const cell of cells) {
        const cellSpeed = cell.speed ? flapSpeeds[cell.speed] : speed; // a roll runs at its own timing
        if (!cell.action && cell.queue.length && now >= cell.due) cell.action = this.start(cell, now, cellSpeed);
        const action = cell.action;
        if (action) {
          if (now - action.start >= action.duration) {
            if (action.kind === "flip") {
              cell.current = action.to;
              cell.action = action.final
                ? { kind: "settle", from: action.to, to: action.to, start: now, duration: cellSpeed.settle }
                : null;
            } else {
              cell.current = action.to;
              cell.action = null;
            }
            if (!cell.action && cell.queue.length) cell.action = this.start(cell, now, cellSpeed);
            if (!cell.action && !cell.queue.length) cell.speed = null;
          }
          this.drawCell(row, cell.column, now);
        }
        if (cell.action || cell.queue.length) active = true;
      }
    }
    if (active) this.frameHandle = requestAnimationFrame(this.tick);
    else this.lastFrame = 0;
  };

  destroy() {
    cancelAnimationFrame(this.frameHandle);
    this.observer.disconnect();
  }
}
