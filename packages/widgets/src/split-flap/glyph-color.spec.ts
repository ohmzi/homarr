import { describe, expect, it } from "vitest";

import { buildRainbowPalette, isLightBoard, newRainbowSeed, rainbowColorFor } from "./glyph-color";
import { flapThemes } from "./engine/renderer";

describe("isLightBoard", () => {
  it("tells the light and dark boards apart", () => {
    expect(isLightBoard(flapThemes.white)).toBe(true);
    expect(isLightBoard(flapThemes.black)).toBe(false);
  });

  it("counts the amber board as dark, so amber ink stays pale", () => {
    expect(isLightBoard(flapThemes.solari)).toBe(false);
  });
});

describe("buildRainbowPalette", () => {
  it("keeps every hue but darkens it for a light board", () => {
    const light = buildRainbowPalette(true);
    const dark = buildRainbowPalette(false);

    expect(light).toHaveLength(dark.length);
    expect(light.every((color) => color.includes("36%"))).toBe(true);
    expect(dark.every((color) => color.includes("72%"))).toBe(true);
  });

  it("offers enough distinct colors to read as a rainbow", () => {
    expect(new Set(buildRainbowPalette(false)).size).toBeGreaterThanOrEqual(6);
  });
});

describe("rainbowColorFor", () => {
  const palette = buildRainbowPalette(false);
  const seed = 12_345;

  it("keeps a flap's color steady for the whole of a roll, so it does not shimmer", () => {
    expect(rainbowColorFor(3, 7, palette, seed)).toBe(rainbowColorFor(3, 7, palette, seed));
  });

  it("deals a different board on the next spin", () => {
    const board = (withSeed: number) =>
      Array.from({ length: 60 }, (_, index) => rainbowColorFor(Math.floor(index / 10), index % 10, palette, withSeed));
    const first = board(seed);
    const second = board(seed + 1);

    expect(first).not.toEqual(second);
    // Not merely one flap different: the deal moves most of the board.
    expect(first.filter((color, index) => color !== second[index]).length).toBeGreaterThan(20);
  });

  it("spreads colors across neighboring cells", () => {
    const across = Array.from({ length: 12 }, (_, column) => rainbowColorFor(0, column, palette, seed));

    expect(new Set(across).size).toBeGreaterThan(3);
  });

  it("never returns a color outside the palette", () => {
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 20; column++) {
        expect(palette).toContain(rainbowColorFor(row, column, palette, newRainbowSeed()));
      }
    }
  });
});

describe("newRainbowSeed", () => {
  it("stays a positive 31-bit integer, which Math.imul can mix", () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = newRainbowSeed();

      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(0x80000000);
    }
  });

  it("does not hand out the same seed twice in a row", () => {
    expect(newRainbowSeed()).not.toBe(newRainbowSeed());
  });
});
