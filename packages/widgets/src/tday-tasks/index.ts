import { IconChecklist } from "@tabler/icons-react";

import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";

export const { definition, componentLoader } = createWidgetDefinition("tdayTasks", {
  icon: IconChecklist,
  supportedIntegrations: ["tday"],
  integrationsRequired: true,
  createOptions() {
    return optionsBuilder.from((factory) => ({
      view: factory.select({
        options: (["today", "scheduled", "overdue", "floater"] as const).map((value) => ({
          value,
          label: (t) => t(`widget.tdayTasks.option.view.option.${value}.label`),
        })),
        defaultValue: "today",
      }),
      sort: factory.select({
        options: (["default", "due", "priority"] as const).map((value) => ({
          value,
          label: (t) => t(`widget.tdayTasks.option.sort.option.${value}.label`),
        })),
        defaultValue: "default",
      }),
      showCompleteButton: factory.switch({
        defaultValue: true,
      }),
      showQuickAdd: factory.switch({
        defaultValue: true,
      }),
    }));
  },
}).withDynamicImport(() => import("./component"));
