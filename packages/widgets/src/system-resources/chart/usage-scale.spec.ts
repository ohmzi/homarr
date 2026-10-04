import { describe, expect, it } from "vitest";

import {
  buildCeilingUsageScale,
  buildUsageGradientStops,
  networkCeilings,
  plotAreaFor,
  valueToOffset,
} from "./usage-scale";

const colors = { ok: "#12b886", caution: "#fd7e14", critical: "#fa5252" };

const thresholds = { caution: 70, critical: 90 };
const domain = [0, 100] as const;

describe("valueToOffset", () => {
  it("puts the top of the domain at the top of the plot", () => {
    expect(valueToOffset(100, domain)).toBe(0);
    expect(valueToOffset(0, domain)).toBe(1);
    expect(valueToOffset(50, domain)).toBeCloseTo(0.5);
  });

  it("clamps a value outside the domain", () => {
    expect(valueToOffset(140, domain)).toBe(0);
    expect(valueToOffset(-20, domain)).toBe(1);
  });

  it("does not divide by an empty domain", () => {
    expect(valueToOffset(5, [5, 5])).toBe(0);
  });
});

describe("buildUsageGradientStops", () => {
  const stops = buildUsageGradientStops(thresholds, domain, colors);

  it("runs red, then orange, then green from the top down", () => {
    expect(stops.map((stop) => stop.color)).toEqual([
      colors.critical,
      colors.critical,
      colors.caution,
      colors.caution,
      colors.ok,
      colors.ok,
    ]);
  });

  it("changes color abruptly at each threshold, without blending across it", () => {
    // Two stops share each threshold offset; that hard edge is what keeps the line one
    // solid color below the threshold instead of fading through it.
    const offsets = stops.map((stop) => stop.offset);

    expect(offsets[1]).toBe(offsets[2]);
    expect(offsets[3]).toBe(offsets[4]);
    expect(offsets[1]).toBeCloseTo(0.1); // 90%
    expect(offsets[3]).toBeCloseTo(0.3); // 70%
  });

  it("spans the whole plot", () => {
    expect(stops[0]?.offset).toBe(0);
    expect(stops[stops.length - 1]?.offset).toBe(1);
  });

  it("still reads top-to-bottom when the thresholds are passed the wrong way round", () => {
    const swapped = buildUsageGradientStops({ caution: 90, critical: 70 }, domain, colors);

    expect(swapped.map((stop) => stop.color)).toEqual(stops.map((stop) => stop.color));
    expect(swapped.map((stop) => stop.offset)).toEqual(stops.map((stop) => stop.offset));
  });

  it("sits the thresholds correctly on a bytes axis", () => {
    const capacity = 16_000_000_000;
    const bytes = buildUsageGradientStops({ caution: capacity * 0.7, critical: capacity * 0.9 }, [0, capacity], colors);

    expect(bytes[1]?.offset).toBeCloseTo(0.1);
    expect(bytes[3]?.offset).toBeCloseTo(0.3);
  });
});

describe("plotAreaFor", () => {
  it("insets the element box by the chart's own margin", () => {
    expect(plotAreaFor(60)).toEqual({ y1: 5, y2: 55 });
  });

  it("never inverts on a chart too short to inset", () => {
    expect(plotAreaFor(8).y2).toBeGreaterThan(plotAreaFor(8).y1);
  });
});

describe("buildCeilingUsageScale", () => {
  it("puts the thresholds at 70% and 90% of the ceiling", () => {
    expect(buildCeilingUsageScale(1_000)).toEqual({ caution: 700, critical: 900, domain: [0, 1_000] });
  });

  it("scales the axis to the ceiling, so the colors mean the same as the axis", () => {
    // If these disagreed, a spike far below saturation would still read as red.
    const scale = buildCeilingUsageScale(networkCeilings.down);

    expect(scale.domain[1]).toBe(networkCeilings.down);
    expect(valueToOffset(networkCeilings.down * 0.9, scale.domain)).toBeCloseTo(0.1);
    expect(valueToOffset(networkCeilings.down * 0.7, scale.domain)).toBeCloseTo(0.3);
  });

  it("reads the ceilings as the link speeds they came from", () => {
    expect(networkCeilings.down * 8).toBe(1_200_000_000);
    expect(networkCeilings.up * 8).toBe(40_000_000);
  });

  it("has a lower ceiling for up than down", () => {
    expect(networkCeilings.up).toBeLessThan(networkCeilings.down);
  });
});
