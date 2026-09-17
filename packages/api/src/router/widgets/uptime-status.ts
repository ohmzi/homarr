import { z } from "zod/v4";

import { and, asc, gte, inArray } from "@homarr/db";
import { uptimeDaily } from "@homarr/db/schema";

import { createManyIntegrationMiddleware } from "../../middlewares/integration";
import { createTRPCRouter, publicProcedure } from "../../trpc";

/** Mirrors HOST_SOURCE_ID / SOURCE_ID in the cron jobs that write these rows. */
const HOST_SOURCE_ID = "host";
const OPENWEBUI_SOURCE_ID = "openwebui";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const UPTIME_RETENTION_DAYS = 90;

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const uptimeStatusRouter = createTRPCRouter({
  /**
   * Daily uptime history per monitor. Deliberately day-granular: the widget's bar is one
   * segment per day, so intraday detail is summarised by the sync job rather than shipped.
   */
  getHistory: publicProcedure
    .meta({
      mcp: {
        enabled: true,
        description:
          "Get daily uptime history (up/down seconds per day, last 90 days) for Uptime Kuma monitors, the Homarr host and OpenWebUI. OPTIONAL: integrationIds (array of Uptime Kuma integration IDs from integration_all), includeHost (boolean), includeOpenWebUi (boolean), days (number, max 90)",
      },
    })
    .input(
      z.object({
        includeHost: z.boolean().default(true),
        includeOpenWebUi: z.boolean().default(true),
        days: z.number().int().min(1).max(UPTIME_RETENTION_DAYS).default(UPTIME_RETENTION_DAYS),
      }),
    )
    .concat(createManyIntegrationMiddleware("query", "uptimeKuma"))
    .query(async ({ ctx, input }) => {
      const sourceIds = [
        ...ctx.integrations.map((integration) => integration.id),
        ...(input.includeHost ? [HOST_SOURCE_ID] : []),
        ...(input.includeOpenWebUi ? [OPENWEBUI_SOURCE_ID] : []),
      ];

      if (sourceIds.length === 0) {
        return { days: input.days, monitors: [] };
      }

      const cutoff = toDateKey(new Date(Date.now() - input.days * MS_PER_DAY));
      const rows = await ctx.db.query.uptimeDaily.findMany({
        where: and(inArray(uptimeDaily.sourceId, sourceIds), gte(uptimeDaily.date, cutoff)),
        orderBy: asc(uptimeDaily.date),
      });

      const monitors = new Map<
        string,
        {
          id: string;
          name: string;
          sourceId: string;
          isHost: boolean;
          days: { date: string; upSeconds: number; downSeconds: number }[];
        }
      >();

      for (const row of rows) {
        const key = `${row.sourceId}:${row.monitorId}`;
        const monitor = monitors.get(key) ?? {
          id: key,
          name: row.monitorName,
          sourceId: row.sourceId,
          isHost: row.sourceId === HOST_SOURCE_ID,
          days: [],
        };

        monitor.days.push({ date: row.date, upSeconds: row.upSeconds, downSeconds: row.downSeconds });
        monitors.set(key, monitor);
      }

      // The host is the machine this dashboard runs on, so it belongs at the top.
      const sorted = [...monitors.values()].toSorted((a, b) => Number(b.isHost) - Number(a.isHost));

      return { days: input.days, monitors: sorted };
    }),
});
