// The maintainer readout's pure parts: what each row prints given the service's answer.
// Kept free of React and the canvas so the mapping can be tested alone. The words are
// deliberately literal English, like the other data sources: the drum only carries Latin
// capitals, so a translated word would print blank on a non-Latin locale.

import { HEALTH_GLYPHS, textToCells } from "./engine/charset";

export const splitFlapMaintainerMetrics = ["greeting", "health", "heaviest"] as const;
export type SplitFlapMaintainerMetric = (typeof splitFlapMaintainerMetrics)[number];

export const isMaintainerMetric = (value: unknown): value is SplitFlapMaintainerMetric =>
  typeof value === "string" && (splitFlapMaintainerMetrics as readonly string[]).includes(value);

const healthWords: Record<string, string> = { ok: "HEALTHY", warn: "WARNING", crit: "CRITICAL" };

/** What a row prints when the service has nothing to say. */
export const splitFlapNoData = "NO DATA";

/** Good morning / afternoon / evening, with the viewer's name when there is one. */
export const greetingText = (now: Date | null, name: string | null): string => {
  if (now === null) return "";
  const hour = now.getHours();
  const greeting = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? greeting : `${greeting} - ${trimmed}`;
};

/** The level word with its glyph, or NO DATA when the level is unknown or missing. */
export const healthText = (level: unknown): string => {
  if (typeof level !== "string") return splitFlapNoData;
  const glyph = (HEALTH_GLYPHS as Record<string, string | undefined>)[level];
  const word = healthWords[level];
  return glyph === undefined || word === undefined ? splitFlapNoData : `${glyph} ${word}`;
};

/** The heaviest consumer's name, with its size when both fit the board. */
export const heaviestText = (name: unknown, size: unknown, maxColumns: number): string => {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed === "") return splitFlapNoData;
  const base = trimmed.toUpperCase();
  const suffix = typeof size === "string" ? size.trim().toUpperCase() : "";
  if (suffix !== "" && textToCells(`${base} ${suffix}`).length <= maxColumns) return `${base} ${suffix}`;
  return base;
};
