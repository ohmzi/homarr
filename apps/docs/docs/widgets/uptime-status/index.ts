import { WidgetDefinition } from "@site/src/types";
import { IconActivityHeartbeat } from "@tabler/icons-react";

export const uptimeStatusWidget: WidgetDefinition = {
  icon: IconActivityHeartbeat,
  name: "Uptime Status",
  description:
    "Displays a daily uptime history for Uptime Kuma monitors, this machine, and the Ohmz AI and Plex probes.",
  path: "../../widgets/uptime-status",
  configuration: {
    items: [
      {
        name: "Include this machine",
        description: "Shows the uptime of the machine Homarr itself runs on",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Include Ohmz AI",
        description: "Shows the Ohmz AI probe row",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Include Plex",
        description: "Shows the Plex probe row",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Show uptime percentage",
        description: "Displays each row's uptime percentage next to its history",
        values: { type: "boolean" },
        defaultValue: "yes",
      },
      {
        name: "Visible days",
        description: "How many days of history the widget shows",
        values: { type: "select", options: ["7 days", "30 days", "90 days"] },
        defaultValue: "90 days",
      },
    ],
  },
};
