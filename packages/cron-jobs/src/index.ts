import { analyticsJob } from "./jobs/analytics";
import { iconsUpdaterJob } from "./jobs/icons-updater";
import { ohmzaiProbeJob } from "./jobs/ohmzai-probe";
import { pingJob } from "./jobs/ping";
import { plexProbeJob } from "./jobs/plex-probe";
import { uptimeSyncJob } from "./jobs/uptime-sync";
import { createCronJobGroup } from "./lib";

const getJobGroup = () => {
  return createCronJobGroup({
    analytics: analyticsJob,
    iconsUpdater: iconsUpdaterJob,
    ohmzaiProbe: ohmzaiProbeJob,
    ping: pingJob,
    plexProbe: plexProbeJob,
    uptimeSync: uptimeSyncJob,
  });
};

declare global {
  var cronJobs: ReturnType<typeof getJobGroup> | undefined;
}

global.cronJobs ??= getJobGroup();

export const jobGroup = global.cronJobs;

export type JobGroupKeys = ReturnType<(typeof jobGroup)["getKeys"]>[number];
