import { describe, expect, it } from "vitest";

import type { DownloadEntrySummary } from "./summary";
import { summariseDownloads, summariseUptime, sumRequestStats } from "./summary";

const entry = (states: string[], down = 0): DownloadEntrySummary => ({
  data: { status: { rates: { down } }, items: states.map((state) => ({ state })) },
});

describe("summariseDownloads", () => {
  it("counts only the states that mean still moving, and completed separately", () => {
    const summary = summariseDownloads([entry(["downloading", "seeding", "completed", "completed", "paused"])]);

    expect(summary.active).toBe(1);
    expect(summary.completed).toBe(2);
  });

  it("adds the speed across clients and skips the ones that failed", () => {
    const summary = summariseDownloads([entry([], 1200), { data: null }, entry([], 800)]);

    expect(summary.downSpeed).toBe(2000);
  });

  it("reports nothing for an empty board", () => {
    expect(summariseDownloads([])).toEqual({ active: 0, completed: 0, downSpeed: 0 });
  });
});

const monitor = (...days: [number, number][]) => ({
  days: days.map(([upSeconds, downSeconds]) => ({ upSeconds, downSeconds })),
});

describe("summariseUptime", () => {
  it("counts a monitor as up only when it never dipped", () => {
    const summary = summariseUptime([monitor([100, 0], [200, 0]), monitor([100, 0], [0, 50])]);

    expect(summary.up).toBe(1);
    expect(summary.down).toBe(1);
  });

  it("totals the seconds for the percentage", () => {
    const summary = summariseUptime([monitor([90, 10]), monitor([0, 0])]);

    expect(summary.upSeconds).toBe(90);
    expect(summary.downSeconds).toBe(10);
  });

  it("survives an empty history", () => {
    expect(summariseUptime([])).toEqual({ up: 0, down: 0, upSeconds: 0, downSeconds: 0 });
    expect(summariseUptime([monitor()])).toMatchObject({ up: 1, down: 0 });
  });
});

describe("sumRequestStats", () => {
  it("adds one field across the integrations that answered", () => {
    const stats = [
      { pending: 2, approved: 5, available: 9 },
      { pending: 3, approved: 1, available: 4 },
    ];

    expect(sumRequestStats(stats, "pending")).toBe(5);
    expect(sumRequestStats(stats, "approved")).toBe(6);
    expect(sumRequestStats(stats, "available")).toBe(13);
    expect(sumRequestStats([], "pending")).toBe(0);
  });
});
