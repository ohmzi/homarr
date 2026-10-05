import { describe, expect, test } from "vitest";

import { HEALTH_GLYPHS, STATUS_GLYPHS, boardText, textToCells } from "./engine/charset";
import { splitFlapMaxColumns } from "./lines";
import {
  funText,
  greetingText,
  healthText,
  pickQuote,
  splitFlapNoData,
  splitFlapQuotes,
  unhealthyText,
} from "./maintainer";

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
  test("maps each pipeline level to its glyph and word", () => {
    expect(healthText("ok")).toBe(`${HEALTH_GLYPHS.ok} HEALTHY`);
    expect(healthText("degraded")).toBe(`${HEALTH_GLYPHS.degraded} DEGRADED`);
    expect(healthText("down")).toBe(`${HEALTH_GLYPHS.down} DOWN`);
  });

  test("falls back to NO DATA for anything else", () => {
    expect(healthText("warn")).toBe(splitFlapNoData); // the host's own level, not the pipeline's
    expect(healthText(undefined)).toBe(splitFlapNoData);
    expect(healthText(null)).toBe(splitFlapNoData);
  });
});

describe("unhealthyText", () => {
  const parts = [
    { title: "Runner (check tier)", state: "degraded" },
    { title: "Live monitor", state: "down" },
  ];

  test("names the parts that are not healthy, one board line each", () => {
    // The maintainer's own titles, upper-cased for the drum; parentheses are on it.
    expect(unhealthyText(parts)).toBe("RUNNER (CHECK TIER)\nLIVE MONITOR");
  });

  test("skips a part with no title", () => {
    expect(unhealthyText([{ title: null, state: "down" }])).toBe("");
  });
});

describe("funText", () => {
  const parts = [{ title: "Runner (check tier)", state: "degraded" }];

  test("prints the fun line while the pipeline is healthy", () => {
    expect(funText("ok", parts, [], "SHIP IT")).toBe("SHIP IT");
    expect(funText("ok", [], [], "SHIP IT")).toBe("SHIP IT");
  });

  test("names the unhealthy parts when it is not healthy", () => {
    expect(funText("degraded", parts, [], "SHIP IT")).toBe("RUNNER (CHECK TIER)");
    expect(funText("down", parts, [], "SHIP IT")).toBe("RUNNER (CHECK TIER)");
  });

  test("falls back to the verdict's reason, then NO DATA", () => {
    expect(funText("degraded", [], ["self-health data is 1 h old"], "SHIP IT")).toBe("SELF-HEALTH DATA IS 1 H OLD");
    expect(funText("degraded", [], [], "SHIP IT")).toBe(splitFlapNoData);
    expect(funText(undefined, [], [], "SHIP IT")).toBe(splitFlapNoData);
  });
});

describe("pickQuote", () => {
  test("draws within the pool", () => {
    expect(pickQuote(() => 0)).toBe(splitFlapQuotes[0]);
    expect(pickQuote(() => 0.999)).toBe(splitFlapQuotes.at(-1));
  });

  test("has no duplicates", () => {
    expect(new Set(splitFlapQuotes).size).toBe(splitFlapQuotes.length);
  });

  test("every fun line prints whole and fits the board", () => {
    for (const quote of splitFlapQuotes) {
      // boardText folds anything the drum cannot carry to a blank, so an exact match means
      // every character prints; the board pads by two, and forty is the widest it goes.
      expect(boardText(quote)).toBe(quote);
      expect(textToCells(quote).length).toBeLessThanOrEqual(splitFlapMaxColumns - 2);
    }
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
