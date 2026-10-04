import { describe, expect, it } from "vitest";

import { centreLine } from "./center-line";

describe("centreLine", () => {
  it("pads both sides to the board width", () => {
    expect(centreLine([..."HOMARR"], 20)).toBe("       HOMARR       ");
  });

  it("gives an odd remainder to the right", () => {
    expect(centreLine([..."ABC"], 10)).toBe("   ABC    ");
  });

  it("fills an empty line with blanks", () => {
    expect(centreLine([], 6)).toBe("      ");
  });

  it("cuts a line that is too wide from the middle so both ends survive", () => {
    expect(centreLine([..."ABCDEFGHIJKLMNOP"], 14)).toBe("ABCDEF...LMNOP");
  });

  it("keeps a multi-flap stand-in from overflowing the row", () => {
    expect(centreLine([..."SSSSSSSSSSSS"], 10)).toBe("SSSS...SSS");
  });

  it("never returns more flaps than the board is wide", () => {
    for (const columns of [1, 2, 3, 4, 10]) {
      expect(centreLine([..."ABCDEFGHIJKLMNOP"], columns)).toHaveLength(columns);
    }
  });
});
