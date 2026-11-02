import { describe, expect, it } from "vitest";

import { flapThemes } from "./engine/renderer";

// The values come from apps/nextjs/src/styles/ohmz-brand.scss, whose source of truth is
// ai-stack/branding/ohmz.css. Pinned here so the boards cannot drift off the brand palette
// without someone deciding to.
const brandDark = {
  canvas: "#1a1917",
  panel: "#211f1d",
  raise: "#262421",
  hover: "#2d2a26",
  line: "#3a3733",
  text: "#f0edea",
  code: "#131211",
};

const brandLight = {
  canvas: "#faf9f7",
  panel: "#f0edea",
  line: "#ddd7d0",
  text: "#1a1917",
  offWhite: "#f6f4f2",
  muted: "#8b857e",
};

describe("the dark board", () => {
  const board = flapThemes.black;

  it("is painted from the brand's dark tokens", () => {
    expect(board.face).toBe(brandDark.panel);
    expect(board.faceHi).toBe(brandDark.raise);
    expect(board.faceB).toBe(brandDark.canvas);
    expect(board.faceLo).toBe(brandDark.code);
    expect(board.stack).toBe(brandDark.hover);
    expect(board.frame).toBe(brandDark.code);
    expect(board.frameEdge).toBe(brandDark.line);
    expect(board.glyph).toBe(brandDark.text);
    expect(board.edge).toBe(brandDark.line);
    expect(board.backdrop).toEqual([brandDark.panel, brandDark.code]);
  });

  it("takes its recesses from below the palette, not from a neutral black", () => {
    const warmth = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return ((value >> 16) & 0xff) - (value & 0xff);
    };

    // The brand ramp is warm: red sits above blue in every one of its tokens. The recesses
    // are mixed down from the darkest token, so they keep that cast instead of going grey.
    expect(warmth(board.face)).toBeGreaterThan(0);
    expect(warmth(board.housing)).toBeGreaterThanOrEqual(0);
    expect(warmth(board.crease)).toBeGreaterThanOrEqual(0);
  });
});

describe("the light board", () => {
  const board = flapThemes.white;

  it("is painted from the brand's light tokens", () => {
    expect(board.face).toBe(brandLight.panel);
    expect(board.faceHi).toBe(brandLight.offWhite);
    expect(board.faceB).toBe(brandLight.line);
    expect(board.frame).toBe(brandLight.line);
    expect(board.frameEdge).toBe(brandLight.offWhite);
    expect(board.stack).toBe(brandLight.line);
    expect(board.pin).toBe(brandLight.muted);
    expect(board.glyph).toBe(brandLight.text);
    expect(board.backdrop).toEqual([brandLight.canvas, brandLight.line]);
  });

  it("keeps its recesses darker than the flaps, so they still read as recesses", () => {
    const luminance = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return (0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff)) / 255;
    };

    expect(luminance(board.faceLo)).toBeLessThan(luminance(board.faceB));
    expect(luminance(board.housing)).toBeLessThan(luminance(board.faceLo));
    expect(luminance(board.crease)).toBeLessThan(luminance(board.housing));
  });
});
