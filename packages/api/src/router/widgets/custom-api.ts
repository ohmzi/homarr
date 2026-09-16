import { TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod/v4";

import { decryptSecret } from "@homarr/common/server";
import { customWidgetDefinitions } from "@homarr/db/schema";
import { eq } from "@homarr/db";
import { createLogger } from "@homarr/core/infrastructure/logs";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { applyAuth } from "../custom-widget/auth";
import {
  extractActionButtonDisplay,
  extractDisplayDataWithFallback,
  resolveActionButtonActive,
} from "../custom-widget/display-data";

const logger = createLogger({ module: "widget:customApi" });

const FETCH_TIMEOUT_MS = 10_000;

const validateUrl = (urlString: string): URL => new URL(urlString);

export const customApiRouter = createTRPCRouter({
  getData: protectedProcedure.input(z.object({ definitionId: z.string() })).query(async ({ ctx, input }) => {
    const definition = await ctx.db.query.customWidgetDefinitions.findFirst({
      where: eq(customWidgetDefinitions.id, input.definitionId),
      with: { secrets: true },
    });

    if (!definition) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Custom widget definition not found" });
    }

    if (!definition.enabled) {
      return { type: "disabled" };
    }

    let displayConfig: Record<string, unknown>;
    try {
      displayConfig = superjson.parse(definition.displayConfig) as Record<string, unknown>;
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Widget has corrupt display configuration" });
    }

    if (definition.displayType === "actionButton") {
      const base = extractActionButtonDisplay(displayConfig) as Record<string, unknown>;
      const stateUrl = displayConfig.stateUrl as string | undefined;
      const statePath = displayConfig.statePath as string | undefined;

      // The action url is never fetched - it performs the action. stateUrl is a
      // separate read-only endpoint used purely to decide whether this button is
      // the active selection. A failure here must not break the button.
      if (!stateUrl || !statePath) return base;

      try {
        const stateController = new AbortController();
        const stateTimeout = setTimeout(() => stateController.abort(), FETCH_TIMEOUT_MS);
        try {
          const stateResponse = await fetch(validateUrl(stateUrl).toString(), {
            method: "GET",
            headers: new Headers({ Accept: "application/json" }),
            redirect: "follow",
            signal: stateController.signal,
          });
          if (!stateResponse.ok) return base;
          const stateJson: unknown = await stateResponse.json();
          return { ...base, isActive: resolveActionButtonActive(stateJson, displayConfig) };
        } finally {
          clearTimeout(stateTimeout);
        }
      } catch (error) {
        logger.warn("Failed to read actionButton state", { definitionId: input.definitionId, error });
        return base;
      }
    }

    const decryptedSecrets = definition.secrets.map((s) => ({
      kind: s.kind,
      value: decryptSecret(s.value),
    }));

    const url = validateUrl(definition.url);
    const headers = new Headers({ Accept: "application/json" });

    if (definition.method !== "GET" && definition.requestBody) {
      headers.set("Content-Type", "application/json");
    }

    applyAuth(headers, url, definition.authType, decryptedSecrets, definition.headerName);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: definition.method,
        headers,
        body: definition.method !== "GET" ? definition.requestBody : undefined,
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `API returned ${response.status}: ${response.statusText}`,
        });
      }

      const json: unknown = await response.json();
      return extractDisplayDataWithFallback(json, definition.displayType, displayConfig);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error("Failed to fetch custom API data", { definitionId: input.definitionId, error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch data from external API",
      });
    } finally {
      clearTimeout(timeout);
    }
  }),
});
