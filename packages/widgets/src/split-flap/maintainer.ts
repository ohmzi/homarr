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
  // Server and ops
  "IT'S NOT A BUG, IT'S A FEATURE",
  "PLOT TWIST: IT WAS DNS",
  "HAVE YOU CHECKED THE LOGS?",
  "TURN IT OFF AND ON AGAIN",
  "IT WORKS ON MY MACHINE",
  "WORKS ON MY MACHINE",
  "PING ME WHEN IT'S FIXED",
  "IF IT AIN'T BROKE, DON'T TOUCH IT",
  "IT'S BETWEEN CHAIR AND KEYBOARD",
  "THE CODE NEVER LIES",
  "IT COMPILED, MY JOB IS DONE",
  "THIS BETTER WORK",
  "REBOOT AND PRAY",
  "GIT HAPPENS",
  "COMMIT EARLY, COMMIT OFTEN",
  "KEEP CALM AND GIT PUSH",
  "MOVE FAST AND BREAK THINGS",
  "DEPLOY ON FRIDAY, LIVE ON THE EDGE",
  "IN CODE WE TRUST",
  "ZERO DOWNTIME, ZERO DRAMA",
  "ALL SYSTEMS NOMINAL",
  "THE SERVER IS CALM TODAY",
  "TALK IS CHEAP, SHOW ME THE CODE",
  "CACHE ME IF YOU CAN",
  "THE CLOUD IS SOMEONE ELSE'S COMPUTER",
  "NO PLACE LIKE 127.0.0.1",
  "DROP IT LIKE IT'S HOT",
  "VIM USERS DON'T QUIT",
  "RM -RF IS A PERSONALITY TEST",
  "SCHRODINGER'S EMAIL",
  "THE CRON JOB NOBODY WROTE",
  "EVERY APPLIANCE RUNS ON MAGIC SMOKE",
  "TO ERR IS HUMAN, TO ROOT DIVINE",
  "YOUR LACK OF BACKUPS IS DISTURBING",
  "HOUSTON, WE HAVE UPTIME",
  // Film and television
  "MAY THE FORCE BE WITH YOU",
  "DO OR DO NOT, THERE IS NO TRY",
  "I'LL BE BACK",
  "HASTA LA VISTA, BABY",
  "TO INFINITY AND BEYOND",
  "LIVE LONG AND PROSPER",
  "RESISTANCE IS FUTILE",
  "IT'S A TRAP",
  "THIS IS SPARTA",
  "NO, I AM YOUR FATHER",
  "I AM IRON MAN",
  "AVENGERS ASSEMBLE",
  "SHOW ME THE MONEY",
  "HERE'S JOHNNY",
  "I FEEL THE NEED FOR SPEED",
  "YOU'RE GONNA NEED A BIGGER BOAT",
  "WHAT WE DO IN LIFE ECHOES IN ETERNITY",
  "NEVER GIVE UP, NEVER SURRENDER",
  "ALL YOUR BASE ARE BELONG TO US",
  "WINTER IS COMING",
  "THE CAKE IS A LIE",
  // Short and sharp
  "OUT OF SCOPE",
  "READ THE DOCS",
  "BLAME THE CACHE",
  "FORCE PUSH ANYWAY",
  "LGTM, SHIP IT",
  "LEGACY CODE HAPPENS",
  "MERGED WITHOUT CONFLICTS",
  "TEST IN PRODUCTION",
  "COFFEE, THEN CODE",
  "DON'T CLICK THAT LINK",
  "MIND THE SEMICOLONS",
  "DON'T SHARE YOUR PASSWORDS",
  "THE S IN IOT STANDS FOR SECURITY",
  "THERE ARE 10 TYPES OF PEOPLE",
  "ENCRYPTION WORKS, PEOPLE DON'T",
  "99 PROBLEMS, BUT NO SYNTAX ERROR",
  "IF YOU MUST EXPLAIN IT, IT'S BAD",
  "I WILL REPLACE YOU WITH A SHELL SCRIPT",
  "AI IS NO MATCH FOR NATURAL STUPIDITY",
  "DIRTY DATA, LYING MODEL",
  "TORTURE THE DATA, IT WILL CONFESS",
  "TEACHING SAND TO THINK",
  "EVERYTHING IS A FILE",
  "AUTOMATE EVERYTHING",
  "THE SERVER IS FINE, IT'S THE USERS",
  "GOOD CODE DOCUMENTS ITSELF",
  "NOTHING LASTS LIKE A WORKAROUND",
  "THE BEST CODE IS NO CODE",
  "YOU ONLY NEED BACKUPS ONCE",
  "NINE PEOPLE CANNOT MAKE A BABY",
  "REFACTORING IS AGGRESSIVE CLEANING",
  "I'M NOT ARGUING, I'M EXPLAINING",
  "KEYBOARD NOT FOUND, PRESS F1",
  "WE'LL FIX IT IN POST",
  // The modern stack
  "IT WORKED PERFECTLY IN YAML",
  "MY LAMBDA HAS COMMITMENT ISSUES",
  "AGILE, LOST BUT FLEXIBLE",
  "IT'LL ONLY TAKE FIVE MINUTES",
  "I SURVIVED ANOTHER MEETING",
  "HUMAN IN THE LOOP: BUTTON MONITOR",
  "PROMPT ENGINEERING MY REVIEW",
  "CODE WRITTEN LAST WEEK IS A MYSTERY",
  "IT WORKS, DON'T TOUCH IT",
  // Keep going
  "KEEP CALM AND CARRY ON",
  "GOOD VIBES ONLY",
  "STAY CURIOUS",
  "SHIP IT",
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
