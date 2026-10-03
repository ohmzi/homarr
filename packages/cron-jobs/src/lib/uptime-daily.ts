/**
 * Shared write path for the daily uptime history.
 *
 * Uptime is kept as one row per monitor per day, so every source - Uptime Kuma beats, the
 * host's Glances uptime, the OpenWebUI probe - funnels through these helpers to accumulate
 * up/down seconds into the right days.
 */
import { and, db, desc, eq, isNotNull, sql } from "@homarr/db";
import { uptimeDaily } from "@homarr/db/schema";

/** How long a day is kept before the window rolls past it. */
export const RETENTION_DAYS = 90;

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addToDayAsync = async (input: {
  sourceId: string;
  monitorId: string;
  monitorName: string;
  date: string;
  upSeconds: number;
  downSeconds: number;
  lastBeatAt: Date;
}) => {
  const { sourceId, monitorId, monitorName, date, upSeconds, downSeconds, lastBeatAt } = input;

  // Increments rather than absolute values: each sync adds only what it has not already
  // counted, so re-reading the same window cannot double count. `lastBeatAt` only ever
  // moves forward, so it is set outright rather than with a dialect-specific max().
  await db
    .insert(uptimeDaily)
    .values({ sourceId, monitorId, monitorName, date, upSeconds, downSeconds, lastBeatAt })
    .onConflictDoUpdate({
      target: [uptimeDaily.sourceId, uptimeDaily.monitorId, uptimeDaily.date],
      set: {
        monitorName,
        upSeconds: sql`${uptimeDaily.upSeconds} + ${upSeconds}`,
        downSeconds: sql`${uptimeDaily.downSeconds} + ${downSeconds}`,
        lastBeatAt,
      },
    });
};

/** Adds a span of seconds to whichever days it overlaps, so a multi-day outage lands correctly. */
export const addRangeAsync = async (input: {
  sourceId: string;
  monitorId: string;
  monitorName: string;
  from: Date;
  to: Date;
  upSeconds: number;
  downSeconds: number;
  lastBeatAt: Date;
}) => {
  const { sourceId, monitorId, monitorName, from, to, upSeconds, downSeconds, lastBeatAt } = input;

  if (to.getTime() <= from.getTime()) return;

  const totalSeconds = (to.getTime() - from.getTime()) / 1000;

  // Step by calendar day rather than by 24h so a DST change cannot skip or repeat a date.
  for (let cursor = startOfDay(from); cursor.getTime() < to.getTime();) {
    const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const overlapSeconds =
      (Math.min(dayEnd.getTime(), to.getTime()) - Math.max(cursor.getTime(), from.getTime())) / 1000;

    if (overlapSeconds > 0) {
      const share = overlapSeconds / totalSeconds;
      await addToDayAsync({
        sourceId,
        monitorId,
        monitorName,
        date: toDateKey(cursor),
        upSeconds: Math.round(upSeconds * share),
        downSeconds: Math.round(downSeconds * share),
        lastBeatAt,
      });
    }

    cursor = dayEnd;
  }
};

/**
 * Newest moment already recorded for a monitor, or null if it has never been recorded.
 *
 * Deliberately per monitor rather than per day: a single interval can straddle midnight,
 * and a monitor probing daily always does.
 */
export const getAnchorAsync = async (sourceId: string, monitorId: string) => {
  const row = await db.query.uptimeDaily.findFirst({
    where: and(
      eq(uptimeDaily.sourceId, sourceId),
      eq(uptimeDaily.monitorId, monitorId),
      isNotNull(uptimeDaily.lastBeatAt),
    ),
    orderBy: desc(uptimeDaily.lastBeatAt),
  });

  return row?.lastBeatAt ?? null;
};
