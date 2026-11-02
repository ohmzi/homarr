import { describe, expect, it } from "vitest";

import type { SplitFlapSourceContext } from "./sources";
import { resolveClientSource } from "./sources";

const context: SplitFlapSourceContext = {
  boardName: "Remote-Big-Screen",
  boardLayout: "Desktop",
  userName: "Omar",
  now: new Date(2026, 9, 4, 13, 5, 0),
  locale: "en-US",
  hour12: true,
};

describe("resolveClientSource", () => {
  it("prints the board, layout and user values", () => {
    expect(resolveClientSource("boardName", "", context)).toBe("Remote-Big-Screen");
    expect(resolveClientSource("boardLayout", "", context)).toBe("Desktop");
    expect(resolveClientSource("userName", "", context)).toBe("Omar");
  });

  it("prints literal text, and nothing for a blank row", () => {
    expect(resolveClientSource("text", "Back in 5", context)).toBe("Back in 5");
    expect(resolveClientSource("blank", "ignored", context)).toBe("");
  });

  it("formats the clock in the requested hour cycle", () => {
    expect(resolveClientSource("time", "", context)).toMatch(/01:05\sPM/);
    expect(resolveClientSource("time", "", { ...context, hour12: false })).toMatch(/13:05/);
  });

  it("keeps a two-digit day so the row is the same width all month", () => {
    const ninth = resolveClientSource("date", "", { ...context, now: new Date(2026, 9, 9, 13, 5) });
    const twentyFirst = resolveClientSource("date", "", { ...context, now: new Date(2026, 9, 21, 13, 5) });

    expect(ninth).toContain("09");
    expect((ninth ?? "").length).toBe((twentyFirst ?? "").length);
  });

  it("prints the weekday on its own", () => {
    expect(resolveClientSource("weekday", "", context)).toBe("Sunday");
  });

  it("returns nothing before the clock has ticked", () => {
    const noClock = { ...context, now: null };

    expect(resolveClientSource("date", "", noClock)).toBe("");
    expect(resolveClientSource("time", "", noClock)).toBe("");
    expect(resolveClientSource("weekday", "", noClock)).toBe("");
  });

  it("hands a widget row back to the adapter rather than guessing", () => {
    expect(resolveClientSource("widget", "", context)).toBeNull();
  });

  it("prints blank for a source it does not know", () => {
    expect(resolveClientSource("somethingRemoved", "", context)).toBe("");
  });
});
