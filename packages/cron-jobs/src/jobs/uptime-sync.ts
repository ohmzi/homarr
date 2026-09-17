import { decryptSecret } from "@homarr/common/server";
import { EVERY_5_MINUTES } from "@homarr/cron-jobs-core/expressions";
import { createLogger } from "@homarr/core/infrastructure/logs";
import { ErrorWithMetadata } from "@homarr/core/infrastructure/logs/error";
import { db, eq, lt } from "@homarr/db";
import { integrations, uptimeDaily } from "@homarr/db/schema";
import { createIntegrationAsync } from "@homarr/integrations";
import { uptimeKumaHeartbeatStatus } from "@homarr/integrations/types";

import { createCronJob } from "../lib";
import { addRangeAsync, addToDayAsync, getAnchorAsync, RETENTION_DAYS, toDateKey } from "../lib/uptime-daily";

const logger = createLogger({ module: "uptimeSyncJob" });

/** `sourceId` used for the machine Homarr itself runs on. */
const HOST_SOURCE_ID = "host";
/** `monitorName` shown for the host row, which is derived rather than probed. */
const HOST_MONITOR_NAME = "Homelab Server Power";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const loadKumaIntegrationsAsync = () =>
  db.query.integrations.findMany({ where: eq(integrations.kind, "uptimeKuma"), with: { secrets: true } });

const loadGlancesIntegrationsAsync = () =>
  db.query.integrations.findMany({ where: eq(integrations.kind, "glances"), with: { secrets: true } });

type IntegrationWithSecrets = Awaited<ReturnType<typeof loadKumaIntegrationsAsync>>[number];

const toIntegrationInput = (integration: IntegrationWithSecrets) => ({
  id: integration.id,
  name: integration.name,
  url: integration.url,
  externalUrl: null,
  decryptedSecrets: integration.secrets.map((secret) => ({
    kind: secret.kind,
    value: decryptSecret(secret.value),
  })),
});

/**
 * Uptime Kuma stores heartbeat times as UTC and returns them as "YYYY-MM-DD HH:mm:ss.SSS".
 * `new Date()` parses that shape as *local* time, so anchor it to UTC explicitly - getting
 * this wrong shifts beats across the day boundary and misdates whole days.
 */
const parseBeatTime = (time: string) => {
  const parsed = new Date(`${time.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const syncIntegrationAsync = async (integration: IntegrationWithSecrets) => {
  const client = await createIntegrationAsync({ ...toIntegrationInput(integration), kind: "uptimeKuma" });

  for (const monitor of await client.getMonitorHeartbeatsAsync()) {
    const monitorId = String(monitor.id);

    const beats = monitor.heartbeats
      .map((heartbeat) => {
        const at = parseBeatTime(heartbeat.time);
        return at === null ? null : { at: at.getTime(), status: heartbeat.status };
      })
      .filter((beat): beat is { at: number; status: number } => beat !== null)
      .toSorted((a, b) => a.at - b.at);

    if (beats.length < 2) continue;

    const anchor = (await getAnchorAsync(integration.id, monitorId))?.getTime() ?? 0;

    // Attribute the gap since the previous beat to this beat's status, matching how Uptime
    // Kuma's own calcUptime sums beat durations. No interval is assumed, so a monitor probing
    // every 15 minutes and one probing daily are weighted correctly by the same code.
    for (let index = 1; index < beats.length; index++) {
      const previous = beats[index - 1];
      const beat = beats[index];
      if (!previous || !beat) continue;

      // Clamped to the anchor so an interval already counted is never counted twice. The
      // window's leading gap is deliberately skipped: when the anchor predates every beat we
      // pulled, that stretch is unobserved, and crediting it would fabricate coverage.
      const from = Math.max(previous.at, anchor);
      const seconds = (beat.at - from) / 1000;
      if (seconds <= 0) continue;

      const isUp = beat.status === uptimeKumaHeartbeatStatus.up;
      const isDown = beat.status === uptimeKumaHeartbeatStatus.down;
      // Pending and maintenance are deliberate non-answers, so they count as neither.
      if (!isUp && !isDown) continue;

      await addRangeAsync({
        sourceId: integration.id,
        monitorId,
        monitorName: monitor.name,
        from: new Date(from),
        to: new Date(beat.at),
        upSeconds: isUp ? seconds : 0,
        downSeconds: isDown ? seconds : 0,
        lastBeatAt: new Date(beat.at),
      });
    }
  }
};

/** Prefer a Glances pointed at this machine; a homelab can easily have several. */
const isLocalUrl = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);

/** Host boot time derived from Glances' uptime counter. */
const getHostBootTimeAsync = async () => {
  const candidates = await loadGlancesIntegrationsAsync();
  if (candidates.length === 0) return null;

  const integration = candidates.find((candidate) => isLocalUrl(candidate.url)) ?? candidates.at(0);
  if (!integration) return null;

  try {
    const client = await createIntegrationAsync({ ...toIntegrationInput(integration), kind: "glances" });
    const { uptime } = await client.getSystemInfoAsync();
    return new Date(Date.now() - uptime * 1000);
  } catch (cause) {
    logger.error(new ErrorWithMetadata("Failed to read host uptime from Glances", { url: integration.url }, { cause }));
    return null;
  }
};

/**
 * Records the machine Homarr runs on. It cannot probe itself while it is off, so downtime
 * is reconstructed from Glances' host uptime rather than observed directly.
 */
const syncHostAsync = async () => {
  const now = new Date();
  const source = { sourceId: HOST_SOURCE_ID, monitorId: "host", monitorName: HOST_MONITOR_NAME };

  const gapStart = await getAnchorAsync(HOST_SOURCE_ID, "host");

  if (gapStart === null) {
    // First ever run: there is no gap to reconstruct, so just record the moment.
    await addToDayAsync({ ...source, date: toDateKey(now), upSeconds: 0, downSeconds: 0, lastBeatAt: now });
    return;
  }

  const bootAt = await getHostBootTimeAsync();
  if (bootAt === null) {
    logger.debug("No usable Glances integration, skipping host uptime");
    return;
  }

  if (bootAt.getTime() > gapStart.getTime()) {
    // The host booted inside the gap, so it was off. Assume it went down when we last
    // saw it: that overstates downtime rather than hiding it, which is the right bias
    // for a status page.
    await addRangeAsync({
      ...source,
      from: gapStart,
      to: bootAt,
      upSeconds: 0,
      downSeconds: (bootAt.getTime() - gapStart.getTime()) / 1000,
      lastBeatAt: bootAt,
    });
    await addRangeAsync({
      ...source,
      from: bootAt,
      to: now,
      upSeconds: (now.getTime() - bootAt.getTime()) / 1000,
      downSeconds: 0,
      lastBeatAt: now,
    });
    logger.info("Recorded host downtime across a reboot", { from: gapStart, to: bootAt });
    return;
  }

  // The host was up for the entire gap, so the gap was Homarr being down, not the
  // machine. Credit it as up so the day does not read as an outage it never had.
  await addRangeAsync({
    ...source,
    from: gapStart,
    to: now,
    upSeconds: (now.getTime() - gapStart.getTime()) / 1000,
    downSeconds: 0,
    lastBeatAt: now,
  });
};

const pruneAsync = async () => {
  const cutoff = toDateKey(new Date(Date.now() - RETENTION_DAYS * MS_PER_DAY));
  await db.delete(uptimeDaily).where(lt(uptimeDaily.date, cutoff));
};

export const uptimeSyncJob = createCronJob("uptimeSync", EVERY_5_MINUTES, {
  runOnStart: true,
}).withCallback(async () => {
  const kumaIntegrations = await loadKumaIntegrationsAsync();

  // One broken integration must not stop the others, or the host row, from syncing.
  await Promise.allSettled(
    kumaIntegrations.map((integration) =>
      syncIntegrationAsync(integration).catch((cause: unknown) => {
        logger.error(new ErrorWithMetadata("Failed to sync uptime integration", { id: integration.id }, { cause }));
      }),
    ),
  );

  await syncHostAsync();
  await pruneAsync();
});
