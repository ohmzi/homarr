// The maintainer readout's pure parts: what each row prints given the service's answer.
// Kept free of React and the canvas so the mapping can be tested alone. The words are
// deliberately literal English, like the other data sources: the drum only carries Latin
// capitals, so a translated word would print blank on a non-Latin locale.

import { HEALTH_GLYPHS, textToCells } from "./engine/charset";

export const splitFlapMaintainerMetrics = ["greeting", "health", "fun"] as const;
export type SplitFlapMaintainerMetric = (typeof splitFlapMaintainerMetrics)[number];

export const isMaintainerMetric = (value: unknown): value is SplitFlapMaintainerMetric =>
  typeof value === "string" && (splitFlapMaintainerMetrics as readonly string[]).includes(value);

const healthWords: Record<string, string> = { ok: "HEALTHY", warn: "WARNING", crit: "CRITICAL" };

/** What a row prints when the service has nothing to say. */
export const splitFlapNoData = "NO DATA";

export interface SplitFlapTopConsumer {
  name: string | null;
  size: string | null;
}

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

// Fun lines for a healthy board: server-flavoured, motivational, or a film line. All are
// uppercase and within the drum's character set, so they print rather than blank out.
export const splitFlapQuotes = [
  "MAY THE FORCE BE WITH YOU",
  "I'LL BE BACK",
  "TO INFINITY AND BEYOND",
  "LIVE LONG AND PROSPER",
  "DO OR DO NOT, THERE IS NO TRY",
  "TURN IT OFF AND ON AGAIN",
  "PLOT TWIST: IT WAS DNS",
  "IT WORKS ON MY MACHINE",
  "KEEP CALM AND CARRY ON",
  "ALL SYSTEMS NOMINAL",
  "ZERO DOWNTIME, ZERO DRAMA",
  "THE CAKE IS A LIE",
  "WINTER IS COMING",
  "CACHE ME IF YOU CAN",
  "HOUSTON, WE HAVE UPTIME",
  "SHIP IT",
  "GOOD VIBES ONLY",
  "STAY CURIOUS",
  "TALK IS CHEAP, SHOW ME THE CODE",
  "NO PLACE LIKE 127.0.0.1",
  "THE SERVER IS CALM TODAY",
  "SLEEP IS FOR THE WEAK",
] as const;

/** Draws one fun line. Called once per board load, so the board settles on a single line. */
export const pickQuote = (random: () => number = Math.random): string =>
  splitFlapQuotes[Math.floor(random() * splitFlapQuotes.length)] ?? splitFlapQuotes[0];

const rankedLine = (top: SplitFlapTopConsumer, rank: number, maxColumns: number): string | null => {
  const name = typeof top.name === "string" ? top.name.trim().toUpperCase() : "";
  if (name === "") return null;
  const prefix = `${rank} `;
  const size = typeof top.size === "string" ? top.size.trim().toUpperCase() : "";
  const withSize = size === "" ? null : `${prefix}${name} ${size}`;
  if (withSize !== null && textToCells(withSize).length <= maxColumns) return withSize;
  return `${prefix}${name}`;
};

/** The heaviest consumers as board lines, heaviest first, one line each. */
export const rankedHeaviestText = (tops: readonly SplitFlapTopConsumer[], maxColumns: number): string =>
  tops
    .map((top, index) => rankedLine(top, index + 1, maxColumns))
    .filter((line): line is string => line !== null)
    .join("\n");

/**
 * The third row: a fun line when the system is healthy, and the heaviest consumers when it
 * is not, so a warning or critical board says what is actually carrying the load.
 */
export const funText = (
  level: unknown,
  tops: readonly SplitFlapTopConsumer[],
  quote: string,
  maxColumns: number,
): string => {
  if (level === "ok") return quote;
  const ranked = rankedHeaviestText(tops, maxColumns);
  return ranked === "" ? splitFlapNoData : ranked;
};
