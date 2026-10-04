import { describe, expect, test } from "vitest";

import { HEALTH_GLYPHS, STATUS_GLYPHS, textToCells } from "./engine/charset";
import { greetingText, healthText, heaviestText, splitFlapNoData } from "./maintainer";

const at = (hour: number) => new Date(2026, 0, 1, hour, 30);

describe("greetingText", () => {
  test("bands the greeting by hour", () => {
    expect(greetingText(at(8), null)).toBe("GOOD MORNING");
    expect(greetingText(at(14), null)).toBe("GOOD AFTERNOON");
    expect(greetingText(at(21), null)).toBe("GOOD EVENING");
  });

  test("turns the band over on the hour", () => {
    expect(greetingText(at(11), null)).toBe("GOOD MORNING");
    expect(greetingText(at(12), null)).toBe("GOOD AFTERNOON");
    expect(greetingText(at(17), null)).toBe("GOOD AFTERNOON");
    expect(greetingText(at(18), null)).toBe("GOOD EVENING");
  });

  test("appends a name when there is one and stays bare when there is not", () => {
    expect(greetingText(at(8), "Omar")).toBe("GOOD MORNING - Omar");
    expect(greetingText(at(8), "  ")).toBe("GOOD MORNING");
  });

  test("prints nothing before the clock is known", () => {
    expect(greetingText(null, "Omar")).toBe("");
  });
});

describe("healthText", () => {
  test("maps each level to its glyph and word", () => {
    expect(healthText("ok")).toBe(`${HEALTH_GLYPHS.ok} HEALTHY`);
    expect(healthText("warn")).toBe(`${HEALTH_GLYPHS.warn} WARNING`);
    expect(healthText("crit")).toBe(`${HEALTH_GLYPHS.crit} CRITICAL`);
  });

  test("falls back to NO DATA for anything else", () => {
    expect(healthText("paused")).toBe(splitFlapNoData);
    expect(healthText(undefined)).toBe(splitFlapNoData);
    expect(healthText(null)).toBe(splitFlapNoData);
  });
});

describe("heaviestText", () => {
  test("prints the name, uppercased, with the size when both fit", () => {
    expect(heaviestText("comfyui", "8.5 GiB", 40)).toBe("COMFYUI 8.5 GIB");
  });

  test("drops the size when the pair would not fit the board", () => {
    expect(heaviestText("a-very-long-container-name", "8.5 GiB", 12)).toBe("A-VERY-LONG-CONTAINER-NAME");
  });

  test("prints the name alone when no size came back", () => {
    expect(heaviestText("comfyui", null, 40)).toBe("COMFYUI");
  });

  test("falls back to NO DATA without a name", () => {
    expect(heaviestText("", "8.5 GiB", 40)).toBe(splitFlapNoData);
    expect(heaviestText(undefined, undefined, 40)).toBe(splitFlapNoData);
  });
});

describe("status glyphs", () => {
  test("each glyph is one flap", () => {
    for (const glyph of Object.values(HEALTH_GLYPHS)) {
      expect(textToCells(glyph)).toEqual([glyph]);
    }
  });

  test("each glyph has its own shape and colour", () => {
    const shapes = Object.values(STATUS_GLYPHS).map((glyph) => glyph.shape);
    expect(shapes).toEqual(["heart", "pumpkin", "alert"]);
    expect(new Set(Object.values(STATUS_GLYPHS).map((glyph) => glyph.color)).size).toBe(3);
  });
});
