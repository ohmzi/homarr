import { z } from "zod/v4";

import { isRecord } from "@homarr/common";
import { executeCustomWidgetRequest } from "@homarr/custom-widgets/server";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

// The split-flap board's monitoring readout. The service lives on the host's loopback, so the fetch happens on the
// server — a phone looking at a board cannot reach 127.0.0.1. The request goes through the same executor Custom JSX
// widgets use, which refuses any address the loopback scope does not allow, so the URL cannot be pointed elsewhere.
//
// It reads the maintainer's /pipeline route: the monitoring pipeline's verdict (ok | degraded | down) plus the parts
// that are not healthy, so the board can name the stage that is broken.

const pipelineInput = z.object({
  url: z.string().trim().min(1).max(2048).default("http://127.0.0.1:9111"),
});

const readPipelineAsync = async (url: string) => {
  try {
    // The executor validates its target with `new URL`, so it must be absolute: the route is resolved first.
    const target = new URL("/pipeline", url).toString();
    const response = await executeCustomWidgetRequest({
      baseUrl: target,
      method: "GET",
      kind: "query",
      networkScope: "loopback",
      // Shared across boards, so a wall of boards costs one fetch per window, not one each.
      cacheKey: `split-flap-pipeline:${target}`,
      cacheTtlSeconds: 10,
    });
    return response.ok ? response.data : null;
  } catch {
    // A maintainer outage or a refused address is not an error for the board: the rows print NO DATA, which the
    // widget decides.
    return null;
  }
};

const readString = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
};

/** At most three parts: the board's third row has three lines and no more. */
export const splitFlapUnhealthyLimit = 3;

export const splitFlapRouter = createTRPCRouter({
  getPipeline: protectedProcedure.input(pipelineInput).query(async ({ input }) => {
    const doc = await readPipelineAsync(input.url);

    const rows = isRecord(doc) && Array.isArray(doc.unhealthy) ? doc.unhealthy : [];
    const unhealthy = rows
      .filter(isRecord)
      .slice(0, splitFlapUnhealthyLimit)
      .map((row) => ({ title: readString(row, "title"), state: readString(row, "state") }));

    const reasons = isRecord(doc) && Array.isArray(doc.reasons)
      ? doc.reasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return { level: readString(doc, "level"), reasons, unhealthy };
  }),
});
