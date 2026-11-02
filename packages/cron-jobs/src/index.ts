import { analyticsJob } from "./jobs/analytics";
import { iconsUpdaterJob } from "./jobs/icons-updater";
import { openWebUiProbeJob } from "./jobs/openwebui-probe";
import { pingJob } from "./jobs/ping";
import { uptimeSyncJob } from "./jobs/uptime-sync";
import { createCronJobGroup } from "./lib";

const getJobGroup = () => {
  return createCronJobGroup({
    analytics: analyticsJob,
    iconsUpdater: iconsUpdaterJob,
    openWebUiProbe: openWebUiProbeJob,
    ping: pingJob,
    uptimeSync: uptimeSyncJob,
  });
};

declare global {
  var cronJobs: ReturnType<typeof getJobGroup> | undefined;
}

global.cronJobs ??= getJobGroup();

export const jobGroup = global.cronJobs;

export type JobGroupKeys = ReturnType<(typeof jobGroup)["getKeys"]>[number];
