"use client";

// Reads one headline figure out of another widget on the same board.
//
// Each adapter calls the same tRPC query the source widget calls, with the same input, so
// TanStack serves both from one cache entry — the board costs no extra requests. The
// input comes from the source widget's own resolved options and integration ids, which is
// why picking a widget on the board inherits its integration without asking for it again.
//
// Adapters render nothing. They report their text up through `onValue`, and the widget
// composes the board from whatever the rows reported.
//
// Words in these values ("UP", "ACTIVE") are deliberately literal English: the drum only
// carries Latin capitals, so a translated word would come out blank on a non-Latin
// locale. The metric labels in the options panel are translated as usual.

import { useEffect } from "react";

import { clientApi } from "@homarr/api/client";
import { useByteFormatter } from "@homarr/settings";
import { useI18n } from "@homarr/translation/client";

import { getPreferredUnit, getPreferredWindSpeed } from "../weather/format";
import { getWeatherKind } from "../weather/icon";
import { summariseDownloads, summariseUptime, sumRequestStats } from "./summary";

export interface SplitFlapAdapterProps {
  /** The source widget's options, resolved against its definition's defaults. */
  options: Record<string, unknown>;
  integrationIds: string[];
  metric: string;
  /** Stable across renders; the widget hands the same callback to every row. */
  onValue: (text: string) => void;
}

const useReported = (text: string | null, onValue: (text: string) => void) => {
  useEffect(() => {
    onValue(text ?? "");
  }, [onValue, text]);
};

/** For a row that cannot resolve: reports blank so a stale figure never sticks. */
export const Nothing = ({ onValue }: { onValue: (text: string) => void }) => {
  useReported(null, onValue);
  return null;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
};

const asNumber = (value: unknown, fallback: number): number => (typeof value === "number" ? value : fallback);

const asBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

const readLocation = (value: unknown): { latitude: number; longitude: number } | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") return null;
  return { latitude: record.latitude, longitude: record.longitude };
};

// --- health monitoring and system resources -------------------------------------------
// Both widgets read the same procedure; they differ only in how they draw it.

const SystemHealthValue = ({ integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const { data } = clientApi.widget.healthMonitoring.getSystemHealthStatus.useQuery(
    { integrationIds },
    { enabled: integrationIds.length > 0 },
  );
  // A board row shows one figure, so the first integration that answered wins.
  const health = data?.find((entry) => entry.healthInfo !== null)?.healthInfo ?? null;

  let text: string | null = null;
  if (health !== null) {
    switch (metric) {
      case "cpu":
        text = `${Math.round(health.cpuUtilization)}%`;
        break;
      case "memory": {
        const total = health.memUsedInBytes + health.memAvailableInBytes;
        text = total === 0 ? null : `${Math.round((health.memUsedInBytes / total) * 100)}%`;
        break;
      }
      case "load":
        text = health.loadAverage === null ? null : health.loadAverage["1min"].toFixed(2);
        break;
      case "uptime":
        text = formatUptime(health.uptime);
        break;
      default:
        text = null;
    }
  }

  useReported(text, onValue);
  return null;
};

// --- weather --------------------------------------------------------------------------

const WeatherValue = ({ options, metric, onValue }: SplitFlapAdapterProps) => {
  const t = useI18n("widget.weather");
  const location = readLocation(options.location);
  const { data } = clientApi.widget.weather.atLocation.useQuery(
    { latitude: location?.latitude ?? 0, longitude: location?.longitude ?? 0 },
    { enabled: location !== null },
  );

  const isFahrenheit = asBoolean(options.isFormatFahrenheit, false);
  const noDecimals = asBoolean(options.disableTemperatureDecimals, false);
  const imperial = asBoolean(options.useImperialSpeed, false);

  let text: string | null = null;
  if (data) {
    switch (metric) {
      case "temperature":
        text = getPreferredUnit(data.current.temperature, isFahrenheit, noDecimals);
        break;
      case "feelsLike":
        text = getPreferredUnit(data.current.apparentTemperature, isFahrenheit, noDecimals);
        break;
      case "humidity":
        text = `${Math.round(data.current.relativeHumidity)}%`;
        break;
      case "wind":
        text = `${getPreferredWindSpeed(data.current.windSpeed, imperial)} ${imperial ? "MPH" : "KM/H"}`;
        break;
      case "condition":
        text = t(`kind.${getWeatherKind(data.current.weatherCode)}`);
        break;
      default:
        text = null;
    }
  }

  useReported(text, onValue);
  return null;
};

// --- uptime ---------------------------------------------------------------------------

const UptimeStatusValue = ({ options, integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const includeHost = asBoolean(options.includeHost, true);
  const includeOhmzAi = asBoolean(options.includeOhmzAi, false);
  const includePlex = asBoolean(options.includePlex, false);
  const days = asNumber(options.visibleDays, 90);
  const { data } = clientApi.widget.uptimeStatus.getHistory.useQuery(
    { integrationIds, includeHost, includeOhmzAi, includePlex, days },
    { enabled: integrationIds.length > 0 || includeHost || includeOhmzAi || includePlex },
  );

  let text: string | null = null;
  if (data) {
    const summary = summariseUptime(data.monitors);
    const total = summary.upSeconds + summary.downSeconds;

    switch (metric) {
      case "monitorsUp":
        text = `${summary.up} UP`;
        break;
      case "monitorsDown":
        text = `${summary.down} DOWN`;
        break;
      case "uptimePercent":
        text = total === 0 ? null : `${((summary.upSeconds / total) * 100).toFixed(1)}%`;
        break;
      default:
        text = null;
    }
  }

  useReported(text, onValue);
  return null;
};

// --- downloads ------------------------------------------------------------------------

const DownloadsValue = ({ options, integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const { formatByteRate } = useByteFormatter();
  const limitPerIntegration = asNumber(options.limitPerIntegration, 50);
  const { data } = clientApi.widget.downloads.getJobsAndStatuses.useQuery(
    { integrationIds, limitPerIntegration },
    { enabled: integrationIds.length > 0 },
  );

  let text: string | null = null;
  if (data) {
    const summary = summariseDownloads(data);

    switch (metric) {
      case "active":
        text = `${summary.active} ACTIVE`;
        break;
      case "completed":
        text = `${summary.completed} DONE`;
        break;
      case "downSpeed":
        text = formatByteRate(summary.downSpeed);
        break;
      default:
        text = null;
    }
  }

  useReported(text, onValue);
  return null;
};

// --- media ----------------------------------------------------------------------------

const MediaServerValue = ({ options, integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const showOnlyPlaying = asBoolean(options.showOnlyPlaying, true);
  const { data } = clientApi.widget.mediaServer.getCurrentStreams.useQuery(
    { integrationIds, showOnlyPlaying },
    { enabled: integrationIds.length > 0 },
  );

  const streams = data?.reduce((sum, entry) => sum + entry.sessions.length, 0) ?? null;
  useReported(metric === "streams" && streams !== null ? `${streams} STREAMS` : null, onValue);
  return null;
};

const MediaRequestsValue = ({ integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const { data } = clientApi.widget.mediaRequests.getStats.useQuery(
    { integrationIds },
    { enabled: integrationIds.length > 0 },
  );

  let text: string | null = null;
  if (data) {
    switch (metric) {
      case "pending":
        text = `${sumRequestStats(data.stats, "pending")} PENDING`;
        break;
      case "approved":
        text = `${sumRequestStats(data.stats, "approved")} APPROVED`;
        break;
      case "available":
        text = `${sumRequestStats(data.stats, "available")} AVAILABLE`;
        break;
      default:
        text = null;
    }
  }

  useReported(text, onValue);
  return null;
};

const MediaReleasesValue = ({ integrationIds, metric, onValue }: SplitFlapAdapterProps) => {
  const { data } = clientApi.widget.mediaRelease.getMediaReleases.useQuery(
    { integrationIds },
    { enabled: integrationIds.length > 0 },
  );

  useReported(metric === "upcoming" && data ? `${data.releases.length} UPCOMING` : null, onValue);
  return null;
};

/** Dispatches a row to the adapter for the kind of widget it points at. */
export const SplitFlapWidgetValue = ({ kind, ...props }: SplitFlapAdapterProps & { kind: string }) => {
  switch (kind) {
    case "healthMonitoring":
    case "systemResources":
      return <SystemHealthValue {...props} />;
    case "weather":
      return <WeatherValue {...props} />;
    case "uptimeStatus":
      return <UptimeStatusValue {...props} />;
    case "downloads":
      return <DownloadsValue {...props} />;
    case "mediaServer":
      return <MediaServerValue {...props} />;
    case "mediaRequests-requestStats":
      return <MediaRequestsValue {...props} />;
    case "mediaReleases":
      return <MediaReleasesValue {...props} />;
    default:
      return <Nothing {...props} />;
  }
};
