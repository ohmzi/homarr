import { describe, expect, it } from "vitest";

import { decideProbeAction, getProbeWindow, PROBE_RETRY_MS, PROBE_WINDOW_MS } from "./probe-decision";

/** A 6-hour boundary, which every UTC midnight is. */
const WINDOW_START = new Date(Date.UTC(2026, 8, 20, 0, 0, 0));
const WINDOW_END = new Date(WINDOW_START.getTime() + PROBE_WINDOW_MS);
const WINDOW = { from: WINDOW_START, to: WINDOW_END };
const at = (offsetMs: number) => new Date(WINDOW_START.getTime() + offsetMs);
const minutes = (value: number) => value * 60 * 1000;

describe("getProbeWindow", () => {
  it("aligns windows to fixed boundaries wherever in the window the tick lands", () => {
    for (const offset of [0, minutes(1), minutes(90), PROBE_WINDOW_MS - 1]) {
      expect(getProbeWindow(at(offset))).toEqual(WINDOW);
    }
  });

  it("gives the boundary itself to the next window", () => {
    expect(getProbeWindow(at(PROBE_WINDOW_MS))).toEqual({
      from: WINDOW_END,
      to: new Date(WINDOW_END.getTime() + PROBE_WINDOW_MS),
    });
  });
});

describe("decideProbeAction", () => {
  it("takes a single sample on a fresh install, which settles the window either way", () => {
    // The retry arithmetic cannot apply to a monitor the clock predates.
    expect(decideProbeAction({ now: at(minutes(10)), anchor: null })).toEqual({
      kind: "probe",
      attempt: 0,
      window: WINDOW,
      decideOnFailure: true,
    });
  });

  it("does not let a first tick late in a window concede without sampling", () => {
    const action = decideProbeAction({ now: at(minutes(150)), anchor: null });
    expect(action).toMatchObject({ kind: "probe", decideOnFailure: true });
  });

  it("skips the rest of a window once a verdict has been recorded in it", () => {
    const anchor = at(minutes(1));

    for (const offset of [minutes(30), minutes(120), minutes(330)]) {
      expect(decideProbeAction({ now: at(offset), anchor })).toEqual({ kind: "skip" });
    }
  });

  it("probes at the start of each window when the service is healthy", () => {
    const anchor = at(-minutes(1));

    expect(decideProbeAction({ now: new Date(WINDOW_END.getTime() + minutes(1)), anchor })).toEqual({
      kind: "probe",
      attempt: 0,
      window: { from: WINDOW_END, to: new Date(WINDOW_END.getTime() + PROBE_WINDOW_MS) },
      decideOnFailure: false,
    });
  });

  it("allows one attempt plus two retries, then concedes the whole window", () => {
    const anchor = at(-minutes(1));

    expect(decideProbeAction({ now: at(0), anchor })).toMatchObject({ kind: "probe", attempt: 0 });
    expect(decideProbeAction({ now: at(PROBE_RETRY_MS), anchor })).toMatchObject({ kind: "probe", attempt: 1 });
    expect(decideProbeAction({ now: at(PROBE_RETRY_MS * 2), anchor })).toMatchObject({ kind: "probe", attempt: 2 });

    expect(decideProbeAction({ now: at(PROBE_RETRY_MS * 3), anchor })).toEqual({ kind: "concede", window: WINDOW });
  });

  it("does not treat the window after a concession as already decided", () => {
    // The anchor is the moment the concession was written, which is inside the conceded window.
    const anchor = at(PROBE_RETRY_MS * 3);

    expect(decideProbeAction({ now: new Date(WINDOW_END.getTime() + minutes(1)), anchor })).toMatchObject({
      kind: "probe",
      attempt: 0,
    });
  });

  it("samples rather than concedes when a restart lands it past the retry slots", () => {
    // The attempt count only reflects attempts taken while the job was running, so conceding here
    // would invent an outage that nothing observed.
    const anchor = at(-minutes(1));

    expect(decideProbeAction({ now: at(minutes(120)), anchor })).toMatchObject({ kind: "probe", attempt: 4 });
  });

  it("samples rather than concedes after the job has been disabled for a day", () => {
    const anchor = at(-minutes(1));
    const twentyEightHoursLater = new Date(WINDOW_START.getTime() + 28 * 60 * minutes(1));

    expect(decideProbeAction({ now: twentyEightHoursLater, anchor })).toMatchObject({ kind: "probe", attempt: 8 });
  });

  it("treats an anchor on either edge of the window correctly", () => {
    // Exactly at the start counts as inside, so the window is decided.
    expect(decideProbeAction({ now: at(minutes(30)), anchor: WINDOW_START })).toEqual({ kind: "skip" });

    // Exactly at the end belongs to the next window, so this one is still open.
    expect(decideProbeAction({ now: at(minutes(30)), anchor: WINDOW_END })).toMatchObject({
      kind: "probe",
      attempt: 1,
    });
  });

  it("bounds probing to three attempts per window for a service that stays down", () => {
    // Replays what the job does with each action across a day: a failed probe records nothing, a
    // verdict advances the anchor, and the first window settles on its single sample.
    let anchor: Date | null = null;
    const probesPerWindow = new Map<number, number>();
    const verdicts = new Map<number, "up" | "down">();

    for (let tick = 0; tick < 48; tick++) {
      const now = new Date(WINDOW_START.getTime() + tick * PROBE_RETRY_MS);
      const action = decideProbeAction({ now, anchor });

      if (action.kind === "skip") continue;

      if (action.kind === "concede") {
        verdicts.set(action.window.from.getTime(), "down");
        anchor = now;
        continue;
      }

      const key = action.window.from.getTime();
      probesPerWindow.set(key, (probesPerWindow.get(key) ?? 0) + 1);

      if (action.decideOnFailure) {
        verdicts.set(key, "down");
        anchor = now;
      }
    }

    // One window per six hours across a day, each conceded exactly once.
    expect([...verdicts.keys()]).toEqual([
      WINDOW_START.getTime(),
      WINDOW_START.getTime() + PROBE_WINDOW_MS,
      WINDOW_START.getTime() + PROBE_WINDOW_MS * 2,
      WINDOW_START.getTime() + PROBE_WINDOW_MS * 3,
    ]);

    // The first window has no history to retry against, so it samples once; the rest get the full
    // three attempts. Never more — each one costs a real inference on a quota-limited target.
    expect([...probesPerWindow.values()]).toEqual([1, 3, 3, 3]);
  });

  it("leaves a window empty rather than inventing a verdict when the job misses it entirely", () => {
    // Disabled across a whole window, then re-enabled: the missed window is never conceded,
    // because nothing observed it, and the current one is sampled normally.
    const anchor = at(-minutes(1));
    const afterGap = new Date(WINDOW_START.getTime() + PROBE_WINDOW_MS * 2 + minutes(5));

    expect(decideProbeAction({ now: afterGap, anchor })).toMatchObject({ kind: "probe", attempt: 0 });
  });
});
