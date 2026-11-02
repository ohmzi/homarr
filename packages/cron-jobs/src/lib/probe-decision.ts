/**
 * When a service probe runs, and what its result says about the window it lands in.
 *
 * A probe samples an instant but its verdict is attributed to a whole window, so the window is
 * what actually gets decided: one attempt plus two retries half an hour apart, and if all three
 * fail the window is recorded as down in full.
 *
 * A window gets exactly one verdict written over the whole of itself, rather than each result
 * covering the stretch back to the previous one. Chaining from the previous result looks
 * equivalent but is not: a window decided by a *retry* ends mid-window, so the rest of that window
 * is attributed by nobody, and a job that was disabled for a day would have that whole day
 * credited as up the moment one probe succeeded. One verdict per window tiles the timeline by
 * construction, so there are no holes and nothing is counted twice.
 *
 * The decision is derived from the clock and the stored anchor alone rather than from counters,
 * so it needs no state of its own — a restart, a disabled job or a missed tick cannot leave a
 * stale counter behind. That is why this module imports nothing: these functions are pure and are
 * unit tested directly, without a database.
 */

/** The stretch one probe result speaks for. */
export const PROBE_WINDOW_MS = 6 * 60 * 60 * 1000;
/** How long to wait before retrying a failed probe. */
export const PROBE_RETRY_MS = 30 * 60 * 1000;
/** One attempt plus two retries, per the configured policy. */
export const PROBE_MAX_ATTEMPTS = 3;

export interface ProbeSource {
  sourceId: string;
  monitorId: string;
  monitorName: string;
}

/** The window `now` falls in. Half-open: the end belongs to the next window. */
export const getProbeWindow = (now: Date) => {
  const start = Math.floor(now.getTime() / PROBE_WINDOW_MS) * PROBE_WINDOW_MS;
  return { from: new Date(start), to: new Date(start + PROBE_WINDOW_MS) };
};

export type ProbeAction =
  | { kind: "skip" }
  /** `decideOnFailure` marks a monitor with no history, whose single sample settles the window. */
  | { kind: "probe"; attempt: number; window: { from: Date; to: Date }; decideOnFailure: boolean }
  | { kind: "concede"; window: { from: Date; to: Date } };

/**
 * Decides what the tick at `now` should do.
 *
 * Three cases carry the weight here.
 *
 * The concession requires `attempt === PROBE_MAX_ATTEMPTS` rather than `>=`, because the attempt
 * count is inferred from how far into the window we are, and that only reflects attempts actually
 * made while the job was running. A restart two hours into a window, or a job re-enabled after a
 * day off, lands at 4 or 8 — and `>=` would then declare the window down without having taken a
 * single sample, inventing an outage out of a quiet process. Arriving past the retry slots means
 * "we were not watching", so the honest answer is to sample now instead.
 *
 * A monitor with no history gets a single sample that settles the window either way. It cannot
 * use the retry arithmetic, because that clock predates it: a first tick landing late in a window
 * would otherwise concede immediately, and forcing the attempt count to zero instead would leave
 * a fresh monitor whose target is down probing on every tick — which on a quota-limited target
 * eventually reports quota rejections as outages.
 *
 * The anchor is only ever a "this window is decided" marker. It is written as the moment of the
 * write, which always falls inside the window, so no boundary arithmetic is needed to tell one
 * window from the next.
 *
 * The known gap: if the process happens to be down on exactly the concession tick, the window is
 * never conceded and stays undecided, so it renders as no data rather than as an outage. That is
 * a deliberate direction to fail in — the alternative, inferring downtime from a window nobody
 * observed, is what the rest of this module exists to avoid. The same applies to a window that
 * passes while the job is disabled: it stays empty rather than being credited after the fact.
 */
export const decideProbeAction = (input: { now: Date; anchor: Date | null }): ProbeAction => {
  const window = getProbeWindow(input.now);
  const anchor = input.anchor?.getTime() ?? null;

  // The anchor is written at the moment of a decision, which is always inside its own window, so
  // falling inside this one means this window already has a verdict.
  if (anchor !== null && anchor >= window.from.getTime() && anchor < window.to.getTime()) {
    return { kind: "skip" };
  }

  if (anchor === null) {
    return { kind: "probe", attempt: 0, window, decideOnFailure: true };
  }

  const attempt = Math.floor((input.now.getTime() - window.from.getTime()) / PROBE_RETRY_MS);
  if (attempt === PROBE_MAX_ATTEMPTS) {
    return { kind: "concede", window };
  }

  return { kind: "probe", attempt, window, decideOnFailure: false };
};
