import { z } from "zod/v4";

import { isRecord } from "@homarr/common";
import { executeCustomWidgetRequest } from "@homarr/custom-widgets/server";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

// The split-flap board's maintainer readout. The service lives on the host's loopback, so
// the fetch happens on the server — a phone looking at a board cannot reach 127.0.0.1.
// The request goes through the same executor Custom JSX widgets use, which refuses any
// address the loopback scope does not allow, so the URL cannot be pointed at another host.

const maintainerInput = z.object({
  url: z.string().trim().min(1).max(2048).default("http://127.0.0.1:9111"),
});

const readRouteAsync = async (url: string, path: string) => {
  try {
    const response = await executeCustomWidgetRequest({
      baseUrl: url,
      targetUrl: path,
      method: "GET",
      kind: "query",
      networkScope: "loopback",
      // Shared across boards, so a wall of boards costs one fetch per window, not one each.
      cacheKey: `split-flap-maintainer:${url}:${path}`,
      cacheTtlSeconds: 10,
    });
    return response.ok ? response.data : null;
  } catch {
    // A maintainer outage or a refused address is not an error for the board: the rows
    // print NO DATA, which the widget decides.
    return null;
  }
};

const readString = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
};

export const splitFlapRouter = createTRPCRouter({
  getMaintainer: protectedProcedure.input(maintainerInput).query(async ({ input }) => {
    const [overview, guard] = await Promise.all([
      readRouteAsync(input.url, "/overview"),
      readRouteAsync(input.url, "/guard"),
    ]);

    const top = isRecord(guard) && Array.isArray(guard.top) ? guard.top[0] : null;
    return {
      level: readString(overview, "level"),
      topName: readString(top, "n"),
      topSize: readString(top, "h"),
    };
  }),
});
