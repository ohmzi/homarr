import { describe, expect, it } from "vitest";

import { boardText } from "./engine/charset";
import { buildSplitFlapContent, getSplitFlapColumns, splitFlapGridRows, splitFlapRows } from "./lines";

const content = ["HOMARR", "SAT, 04 OCT 2026", "09:41 PM"];

describe("buildSplitFlapContent", () => {
  it("puts the content rows on five rows with a blank between each", () => {
    expect(buildSplitFlapContent(content)).toEqual(["HOMARR", "", "SAT, 04 OCT 2026", "", "09:41 PM"]);
    expect(buildSplitFlapContent(content)).toHaveLength(splitFlapRows);
  });

  it("keeps the row count when a row is blank", () => {
    expect(buildSplitFlapContent(["", "DATE", ""])).toHaveLength(splitFlapRows);
  });

  it("leaves one blank board row above and below the content", () => {
    // Two more rows than content, so centring them cannot land two blanks on one side.
    expect(splitFlapGridRows).toBe(splitFlapRows + 2);
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

  it("leaves room for the widest row", () => {
    expect(getSplitFlapColumns(content)).toBe(boardText(content[1] as string).length + 2);
  });

  it("ignores a blank row when measuring", () => {
    expect(getSplitFlapColumns(["AB", "", "CD"])).toBe(getSplitFlapColumns(["", "", ""]));
  });
});
