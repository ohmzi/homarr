import { EVERY_30_MINUTES } from "@homarr/cron-jobs-core/expressions";
import { createLogger } from "@homarr/core/infrastructure/logs";
import { ErrorWithMetadata } from "@homarr/core/infrastructure/logs/error";
import { db, eq } from "@homarr/db";
import { integrations } from "@homarr/db/schema";
import { createIntegrationAsync } from "@homarr/integrations";

import { createCronJob } from "../lib";
import { isLocalUrl, toIntegrationInput } from "../lib/integrations";
import { decideProbeAction } from "../lib/probe-decision";
import { recordProbeWindowAsync } from "../lib/probe-schedule";
import { getAnchorAsync } from "../lib/uptime-daily";

const logger = createLogger({ module: "plexProbeJob" });

/** This row is produced by Homarr rather than Uptime Kuma, so it has no integration id. */
const SOURCE_ID = "plex";
const MONITOR_ID = "plex";
const MONITOR_NAME = "Plex";

const source = { sourceId: SOURCE_ID, monitorId: MONITOR_ID, monitorName: MONITOR_NAME };

/**
 * The row is keyed by constants rather than by the integration's id, so replacing the Plex
 * integration or re-pointing it at another server does not orphan the history.
 */
const loadPlexIntegrationsAsync = () =>
  db.query.integrations.findMany({ where: eq(integrations.kind, "plex"), with: { secrets: true } });

type ProbeOutcome =
  | { kind: "up"; openedMovies: string[] }
  | { kind: "down"; reason: string }
  | { kind: "skipped"; reason: string };

/**
 * Opens movie pages on the local Plex server, so the row reflects whether the library is usable
 * rather than whether the port answers.
 *
 * The credentials come from the Plex integration Homarr already holds, decrypted at runtime, so
 * this needs no configuration of its own. A localhost URL is preferred because a homelab can
 * easily have more than one Plex integration and the one on this machine is the one whose
 * uptime the dashboard is describing.
 */
const runProbeAsync = async (): Promise<ProbeOutcome> => {
  const candidates = await loadPlexIntegrationsAsync();
  const integration = candidates.find((candidate) => isLocalUrl(candidate.url)) ?? candidates.at(0);

  if (!integration) {
    return { kind: "skipped", reason: "no Plex integration is configured" };
  }

  try {
    const client = await createIntegrationAsync({ ...toIntegrationInput(integration), kind: "plex" });
    const result = await client.checkLibraryNavigationAsync();

    return { kind: "up", openedMovies: result.openedMovies };
  } catch (cause) {
    logger.error(new ErrorWithMetadata("Plex probe failed", { url: integration.url }, { cause }));
    return { kind: "down", reason: cause instanceof Error ? cause.message : String(cause) };
  }
};

export const plexProbeJob = createCronJob("plexProbe", EVERY_30_MINUTES, {
  runOnStart: true,
  // The retry policy is expressed in ticks against a 30-minute grid, so changing the interval
  // from the tasks UI would silently change how many attempts a window gets. The cadence is
  // configured here instead.
  preventCustomInterval: true,
  // A library walk is a handful of local requests, but a wedged server can spend a timeout on
  // each, so the default budget would warn on a slow-but-working server.
  expectedMaximumDurationInMillis: 60_000,
}).withCallback(async () => {
  const now = new Date();
  const anchor = await getAnchorAsync(SOURCE_ID, MONITOR_ID);
  const action = decideProbeAction({ now, anchor });

  if (action.kind === "skip") return;

  if (action.kind === "concede") {
    await recordProbeWindowAsync({ source, window: action.window, isUp: false, at: now });
    logger.warn("Conceded the whole window after every attempt failed");
    return;
  }

  const outcome = await runProbeAsync();

  // A missing integration is a configuration state, not an outage, so it must not paint the row
  // red — the row simply does not appear until one is configured.
  if (outcome.kind === "skipped") {
    logger.debug("Plex probe is not configured, skipping", { reason: outcome.reason });
    return;
  }

  if (outcome.kind === "up") {
    await recordProbeWindowAsync({ source, window: action.window, isUp: true, at: now });
    // Joined rather than passed as an array: the log formatter drops any non-primitive value, so
    // an array here would render as nothing at all.
    logger.info("Plex probe succeeded", { openedMovies: outcome.openedMovies.join(", ") });
    return;
  }

  // A failed attempt records nothing: the next tick is the retry, and the window's verdict is
  // written once, whichever way it goes. The exception is a monitor with no history, whose single
  // sample settles the window because it has no retry to fall back on.
  if (action.decideOnFailure) {
    await recordProbeWindowAsync({ source, window: action.window, isUp: false, at: now });
    logger.warn("First observation failed, conceding the window", { reason: outcome.reason });
    return;
  }

  logger.warn("Plex probe failed, will retry on the next tick", { attempt: action.attempt, reason: outcome.reason });
});
