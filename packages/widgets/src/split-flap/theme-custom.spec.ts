import { describe, expect, it } from "vitest";

import { flapThemes } from "./engine/renderer";
import { isLightBoard } from "./glyph-color";
import { buildCustomTheme } from "./theme-custom";

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return (0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff)) / 255;
};

describe("buildCustomTheme", () => {
  it("keeps the picked color as the flap face", () => {
    expect(buildCustomTheme("#dfe6ef", "light").face).toBe("#dfe6ef");
    expect(buildCustomTheme("#232a33", "dark").face).toBe("#232a33");
  });

  it("ramps highlights above and shadows below the face, so the flap has relief", () => {
    const theme = buildCustomTheme("#dfe6ef", "light");
    const face = luminance(theme.face);

    expect(luminance(theme.faceHi)).toBeGreaterThan(face);
    expect(luminance(theme.faceB)).toBeLessThan(face);
    expect(luminance(theme.faceLo)).toBeLessThan(luminance(theme.faceB));
    // the recessed housing and the crease are the darkest parts of the board
    expect(luminance(theme.housing)).toBeLessThan(luminance(theme.faceLo));
    expect(luminance(theme.crease)).toBeLessThan(luminance(theme.housing));
  });

  it("gives a near-white board a usable ramp instead of piling up at white", () => {
    const theme = buildCustomTheme("#fbfbfb", "light");
    const contrast = luminance(theme.face) - luminance(theme.crease);

    // Highlights take headroom rather than adding a flat amount, so a board already near
    // white still has somewhere to go and the crease lands as a real line.
    expect(contrast).toBeGreaterThan(0.35);
  });

  it("keeps a dark board's ramp visible instead of collapsing to black", () => {
    const theme = buildCustomTheme("#181c20", "dark");

    // The housing and crease stay above pure black, so the relief is still readable.
    expect(luminance(theme.housing)).toBeGreaterThan(0.005);
    expect(luminance(theme.crease)).toBeGreaterThan(0.001);
    expect(luminance(theme.faceHi) - luminance(theme.faceLo)).toBeGreaterThan(0.05);
  });

  it("borrows the lighting ratios from the built-in board of the same family", () => {
    const light = buildCustomTheme("#dfe6ef", "light");
    const dark = buildCustomTheme("#232a33", "dark");

    // These ratios are what make two flaps shade each other at the hinge.
    expect(light.cast).toBe(flapThemes.white.cast);
    expect(light.fallDark).toBe(flapThemes.white.fallDark);
    expect(dark.cast).toBe(flapThemes.black.cast);
    expect(dark.fallDark).toBe(flapThemes.black.fallDark);
  });

  it("prints in ink that contrasts with the board", () => {
    const light = buildCustomTheme("#dfe6ef", "light");
    const dark = buildCustomTheme("#232a33", "dark");

    expect(luminance(light.glyph)).toBeLessThan(0.3);
    expect(luminance(dark.glyph)).toBeGreaterThan(0.7);
  });

  it("reports its own family, so the rainbow shades against it correctly", () => {
    expect(isLightBoard(buildCustomTheme("#dfe6ef", "light"))).toBe(true);
    expect(isLightBoard(buildCustomTheme("#232a33", "dark"))).toBe(false);
  });

  it("gives each color its own id, so the render cache cannot collide", () => {
    expect(buildCustomTheme("#dfe6ef", "light").id).not.toBe(buildCustomTheme("#aabbcc", "light").id);
  });

  it("returns the very same board for the same color", () => {
    // The widget rebuilds its canvas when the theme identity changes; a fresh object every
    // render would rebuild it on every render.
    expect(buildCustomTheme("#dfe6ef", "light")).toBe(buildCustomTheme("#dfe6ef", "light"));
  });

  it("falls back to the family default rather than throwing on a bad color", () => {
    expect(buildCustomTheme("not-a-color", "light").face).toBe("#f0edea");
    expect(buildCustomTheme("", "dark").face).toBe("#211f1d");
  });

  it("accepts the three-digit form", () => {
    expect(buildCustomTheme("#abc", "light").face).toBe("#aabbcc");
  });
});
