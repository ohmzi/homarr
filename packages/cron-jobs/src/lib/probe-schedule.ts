/**
 * Writes a probe's verdict into the daily history.
 *
 * The scheduling decision itself lives in `probe-decision.ts`; this half knows about the
 * database, and is kept separate so the decision can be tested without one.
 */
import type { ProbeSource } from "./probe-decision";
import { addRangeAsync } from "./uptime-daily";

/**
 * Records one window's verdict.
 *
 * The whole window is written, not the stretch back to the previous result, so consecutive
 * windows tile the timeline with no gaps and no overlap. That does mean writing the part of the
 * window that has not elapsed yet — a window judged down at its third retry is down for its
 * remaining hours too, which is what "consider it fail for entire 6 hours" asks for. The
 * optimistic case is symmetric: a window judged up is up for the whole of itself.
 *
 * `lastBeatAt` is the moment of the write rather than either end of the range. It is only read
 * back as a "this window is decided" marker, and the moment of the write always falls inside the
 * window, whatever the range's own boundaries are.
 */
export const recordProbeWindowAsync = async (input: {
  source: ProbeSource;
  window: { from: Date; to: Date };
  isUp: boolean;
  at: Date;
}) => {
  const { source, window, isUp, at } = input;
  const seconds = (window.to.getTime() - window.from.getTime()) / 1000;

  await addRangeAsync({
    ...source,
    from: window.from,
    to: window.to,
    upSeconds: isUp ? seconds : 0,
    downSeconds: isUp ? 0 : seconds,
    lastBeatAt: at,
  });
};
