// The widget kinds a board row can read a figure from, and which figures each one offers.
// Adding a kind means adding it here, adding its adapter in widget-value.tsx, and adding
// its labels to the translation file.
//
// These drive the widget dropdown (which kinds are listed) and the value dropdown (which
// figures are offered once a widget is picked), both of which are options-panel hooks and
// so cannot import the adapters themselves.

export const splitFlapReadableKinds = {
  healthMonitoring: ["cpu", "memory", "load", "uptime"],
  systemResources: ["cpu", "memory", "uptime"],
  weather: ["temperature", "feelsLike", "humidity", "wind", "condition"],
  uptimeStatus: ["monitorsUp", "monitorsDown", "uptimePercent"],
  downloads: ["active", "completed", "downSpeed"],
  mediaServer: ["streams"],
  "mediaRequests-requestStats": ["pending", "approved", "available"],
  mediaReleases: ["upcoming"],
} as const;

export type SplitFlapReadableKind = keyof typeof splitFlapReadableKinds;
export type SplitFlapMetric<K extends SplitFlapReadableKind = SplitFlapReadableKind> =
  (typeof splitFlapReadableKinds)[K][number];

export const isSplitFlapReadableKind = (kind: string): kind is SplitFlapReadableKind =>
  Object.hasOwn(splitFlapReadableKinds, kind);

export const getSplitFlapMetrics = (kind: string): readonly string[] =>
  isSplitFlapReadableKind(kind) ? splitFlapReadableKinds[kind] : [];
