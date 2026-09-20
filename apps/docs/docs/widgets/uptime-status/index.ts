import { WidgetDefinition } from "@site/src/types";
import { IconActivityHeartbeat } from "@tabler/icons-react";

export const uptimeStatusWidget: WidgetDefinition = {
  icon: IconActivityHeartbeat,
  name: "Uptime Status",
  description: "Daily uptime history for Uptime Kuma monitors and the machine Homarr runs on.",
  path: "../../widgets/uptime-status",
  configuration: {
    items: [
      {
        name: "Show server power",
        description: "Include the machine Homarr runs on, reconstructed from its Glances uptime counter",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Show Ohmz AI",
        description: "Include the Ohmz AI probe, which asks the model a question every six hours",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Show Plex",
        description: "Include the Plex probe, which opens a movie page every six hours",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Show uptime",
        description: "Display the uptime percentage across the visible days",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Maximum days",
        description: "Upper limit on the bar's length. The bar grows one segment per day of history, up to this",
        values: "A whole number between 7 and 90.",
        defaultValue: "90",
      },
    ],
  },
};
