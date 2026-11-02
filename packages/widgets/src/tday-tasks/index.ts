import { IconChecklist } from "@tabler/icons-react";

import { clientApi } from "@homarr/api/client";

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
      // One of the user's own lists, chosen instead of a view: the widget then shows the whole
      // list rather than a bucket of it. Empty keeps the view, which is what every widget that
      // predates this option does.
      list: factory.dynamicSelect({
        useOptions(query, integrationIds) {
          const { data, isPending } = clientApi.widget.tday.getListOptions.useQuery(
            { integrationId: integrationIds[0] ?? "" },
            { enabled: integrationIds.length > 0 },
          );
          const search = query.trim().toLowerCase();
          return {
            isPending,
            options: (data ?? []).filter(
              (option) => search.length === 0 || option.label.toLowerCase().includes(search),
            ),
          };
        },
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
