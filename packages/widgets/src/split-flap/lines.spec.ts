import { describe, expect, it } from "vitest";

import { boardText } from "./engine/charset";
import {
  buildSplitFlapContent,
  getSplitFlapColumns,
  splitFlapAreaLines,
  splitFlapGridRows,
  splitFlapRows,
} from "./lines";

const content = ["HOMARR", "SAT, 04 OCT 2026", "09:41 PM"];

describe("buildSplitFlapContent", () => {
  it("puts the first two rows on their own lines with a blank between", () => {
    expect(buildSplitFlapContent(content).slice(0, 4)).toEqual(["HOMARR", "", "SAT, 04 OCT 2026", ""]);
  });

  it("fills the area with the third row's lines, padding a short one", () => {
    expect(buildSplitFlapContent(["A", "B", "ONE"])).toEqual(["A", "", "B", "", "ONE", "", ""]);
    expect(buildSplitFlapContent(["A", "B", "ONE\nTWO\nTHREE"])).toEqual(["A", "", "B", "", "ONE", "TWO", "THREE"]);
  });

  it("keeps the board shape whatever the area holds", () => {
    for (const third of ["", "ONE", "ONE\nTWO", "ONE\nTWO\nTHREE", "ONE\nTWO\nTHREE\nFOUR"]) {
      expect(buildSplitFlapContent(["A", "B", third])).toHaveLength(splitFlapRows);
    }
  });

  it("drops lines beyond the area", () => {
    expect(buildSplitFlapContent(["A", "B", "1\n2\n3\n4"])).toEqual(["A", "", "B", "", "1", "2", "3"]);
  });

  it("leaves one blank board row above and below the content", () => {
    // Two more rows than content, so centring them cannot land two blanks on one side.
    expect(splitFlapGridRows).toBe(splitFlapRows + 2);
  });

  it("reserves exactly the area height for the third row", () => {
    expect(splitFlapRows).toBe(4 + splitFlapAreaLines);
  });
});

describe("getSplitFlapColumns", () => {
  it("measures board text, not the raw string", () => {
    // ß prints as SS, so this needs two more flaps than the string has characters.
    expect(getSplitFlapColumns(["ßß", "", ""])).toBe(getSplitFlapColumns(["SSSS", "", ""]));
  });

  it("clamps to the bounds", () => {
    expect(getSplitFlapColumns(["A", "", ""])).toBe(12);
    expect(getSplitFlapColumns(["A".repeat(80), "", ""])).toBe(40);
    expect(getSplitFlapColumns([])).toBe(12);
  });

  it("leaves room for the widest line of the whole board", () => {
    const lines = buildSplitFlapContent(content);
    expect(getSplitFlapColumns(lines)).toBe(boardText(content[1] as string).length + 2);
  });

  it("ignores a blank row when measuring", () => {
    expect(getSplitFlapColumns(["AB", "", "CD"])).toBe(getSplitFlapColumns(["", "", ""]));
  });
});
