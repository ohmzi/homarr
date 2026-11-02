// The arithmetic behind the widget-backed rows, kept out of the adapters so it can be
// tested with fixtures: the adapters are components that need a live tRPC client, these
// are plain functions over the shapes the queries return.

/** The states a download client reports for something still moving. */
export const activeDownloadStates = new Set(["downloading", "leeching", "queued", "stalled", "processing"]);

export interface DownloadItemSummary {
  state: string;
}

export interface DownloadEntrySummary {
  data: { status: { rates: { down: number } }; items: readonly DownloadItemSummary[] } | null;
}

export interface DownloadSummary {
  active: number;
  completed: number;
  downSpeed: number;
}

export const summariseDownloads = (entries: readonly DownloadEntrySummary[]): DownloadSummary => {
  let active = 0;
  let completed = 0;
  let downSpeed = 0;
  for (const entry of entries) {
    // An integration that failed reports null data; it must not count as zero either way.
    if (entry.data === null) continue;
    downSpeed += entry.data.status.rates.down;
    for (const item of entry.data.items) {
      if (activeDownloadStates.has(item.state)) active++;
      else if (item.state === "completed") completed++;
    }
  }
  return { active, completed, downSpeed };
};

export interface UptimeMonitorSummary {
  days: readonly { upSeconds: number; downSeconds: number }[];
}

export interface UptimeSummary {
  up: number;
  down: number;
  upSeconds: number;
  downSeconds: number;
}

/** A monitor counts as up only if it did not dip all window; a dip makes it "down". */
export const summariseUptime = (monitors: readonly UptimeMonitorSummary[]): UptimeSummary => {
  let upSeconds = 0;
  let downSeconds = 0;
  let down = 0;
  for (const monitor of monitors) {
    let monitorDownSeconds = 0;
    for (const day of monitor.days) {
      upSeconds += day.upSeconds;
      downSeconds += day.downSeconds;
      monitorDownSeconds += day.downSeconds;
    }
    if (monitorDownSeconds > 0) down++;
  }
  return { up: monitors.length - down, down, upSeconds, downSeconds };
};

export type RequestStatKey = "pending" | "approved" | "available";

export const sumRequestStats = (stats: readonly Record<RequestStatKey, number>[], key: RequestStatKey): number =>
  stats.reduce((total, entry) => total + entry[key], 0);
