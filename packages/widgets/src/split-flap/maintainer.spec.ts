import { describe, expect, test } from "vitest";

import { HEALTH_GLYPHS, STATUS_GLYPHS, boardText, textToCells } from "./engine/charset";
import { splitFlapMaxColumns } from "./lines";
import {
  funText,
  greetingText,
  healthText,
  pickQuote,
  rankedHeaviestText,
  splitFlapNoData,
  splitFlapQuotes,
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

describe("rankedHeaviestText", () => {
  const tops = [
    { name: "comfyui", size: "7.9 GiB" },
    { name: "immich_machine_learning", size: "1.2 GiB" },
    { name: "tunarr-host-net", size: "1.1 GiB" },
  ];

  test("lists the consumers heaviest first, one line each, with no rank number", () => {
    expect(rankedHeaviestText(tops, splitFlapMaxColumns)).toBe(
      "COMFYUI 7.9 GIB\nIMMICH MACHINE 1.2 GIB\nTUNARR HOST 1.1 GIB",
    );
  });

  test("keeps only the first two words of a name", () => {
    // immich_machine_learning is the reason: three words is more than the board needs to name the app.
    expect(rankedHeaviestText([{ name: "immich_machine_learning", size: null }], splitFlapMaxColumns)).toBe(
      "IMMICH MACHINE",
    );
    expect(rankedHeaviestText([{ name: "a-b-c-d", size: null }], splitFlapMaxColumns)).toBe("A B");
    expect(rankedHeaviestText([{ name: "solo", size: null }], splitFlapMaxColumns)).toBe("SOLO");
    expect(rankedHeaviestText([{ name: "  spaced___out  ", size: null }], splitFlapMaxColumns)).toBe("SPACED OUT");
  });

  test("drops the size from a line that would not fit the board", () => {
    expect(rankedHeaviestText(tops, 18)).toBe("COMFYUI 7.9 GIB\nIMMICH MACHINE\nTUNARR HOST");
  });

  test("skips a consumer with no name", () => {
    expect(rankedHeaviestText([{ name: null, size: "1 GIB" }], splitFlapMaxColumns)).toBe("");
  });
});

describe("funText", () => {
  const tops = [{ name: "comfyui", size: "7.9 GiB" }];

  test("prints the fun line when healthy", () => {
    expect(funText("ok", tops, "SHIP IT", splitFlapMaxColumns)).toBe("SHIP IT");
  });

  test("lists the heaviest consumers when not healthy", () => {
    expect(funText("warn", tops, "SHIP IT", splitFlapMaxColumns)).toBe("COMFYUI 7.9 GIB");
    expect(funText("crit", tops, "SHIP IT", splitFlapMaxColumns)).toBe("COMFYUI 7.9 GIB");
  });

  test("falls back to NO DATA when the level is unknown or nothing is heavy", () => {
    expect(funText("ok", [], "SHIP IT", splitFlapMaxColumns)).toBe("SHIP IT");
    expect(funText("warn", [], "SHIP IT", splitFlapMaxColumns)).toBe(splitFlapNoData);
    expect(funText(undefined, tops, "SHIP IT", splitFlapMaxColumns)).toBe("COMFYUI 7.9 GIB");
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
