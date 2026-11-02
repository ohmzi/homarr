import { IconActivityHeartbeat, IconServerOff } from "@tabler/icons-react";
import { z } from "zod/v4";

import { getWidgetIntegrationConfig } from "@homarr/definitions";

import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";

export const { definition, componentLoader } = createWidgetDefinition("uptimeStatus", {
  icon: IconActivityHeartbeat,
  // History only advances when the uptimeSync task runs, so there is nothing to gain
  // from polling faster than it writes.
  refetchInterval: 300,
  ...getWidgetIntegrationConfig("uptimeStatus"),
  createOptions() {
    return optionsBuilder.from((factory) => ({
      includeHost: factory.switch({
        defaultValue: true,
        withDescription: true,
      }),
      includeOpenWebUi: factory.switch({
        defaultValue: true,
        withDescription: true,
      }),
      showUptimePercent: factory.switch({
        defaultValue: true,
        withDescription: true,
      }),
      visibleDays: factory.slider({
        defaultValue: 90,
        validate: z.number().min(7).max(90),
        step: 1,
        withDescription: true,
      }),
    }));
  },
  errors: {
    INTERNAL_SERVER_ERROR: {
      icon: IconServerOff,
      message: (t) => t("widget.uptimeStatus.error.internalServerError"),
    },
  },
}).withDynamicImport(() => import("./component"));
