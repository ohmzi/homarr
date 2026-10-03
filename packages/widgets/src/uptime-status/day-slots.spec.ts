import { describe, expect, it } from "vitest";

import { buildDaySlots } from "./day-slots";

const today = new Date(2026, 8, 17); // 2026-09-17, month is zero-indexed

describe("buildDaySlots", () => {
  it("is a single full-width segment on the first day of history", () => {
    expect(buildDaySlots({ dates: ["2026-09-17"], visibleDays: 90, today })).toEqual(["2026-09-17"]);
  });

  it("grows a segment per day of history", () => {
    const slots = buildDaySlots({ dates: ["2026-09-15", "2026-09-16", "2026-09-17"], visibleDays: 90, today });
    expect(slots).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
  });

  it("runs oldest first, ending on today", () => {
    const slots = buildDaySlots({ dates: ["2026-09-16", "2026-09-17"], visibleDays: 90, today });
    expect(slots.at(-1)).toBe("2026-09-17");
    expect(slots.at(0)).toBe("2026-09-16");
  });

  it("caps the bar at the configured maximum once history is longer", () => {
    // 200 days of history, but the option caps the bar at 90 segments.
    const dates = Array.from({ length: 200 }, (_, index) => new Date(2026, 8, 17 - index).toLocaleDateString("en-CA"));
    expect(buildDaySlots({ dates, visibleDays: 90, today })).toHaveLength(90);
  });

  it("honours a smaller configured maximum", () => {
    const slots = buildDaySlots({ dates: ["2026-09-10", "2026-09-17"], visibleDays: 7, today });
    expect(slots).toHaveLength(7);
    expect(slots.at(-1)).toBe("2026-09-17");
  });

  it("falls back to today when no dates are recorded at all", () => {
    // Otherwise the bar would render with zero segments.
    expect(buildDaySlots({ dates: [], visibleDays: 90, today })).toEqual(["2026-09-17"]);
  });

  it("ignores dates in the future rather than extending the bar", () => {
    const slots = buildDaySlots({ dates: ["2026-09-17", "2026-12-01"], visibleDays: 90, today });
    expect(slots).toEqual(["2026-09-17"]);
  });
});
