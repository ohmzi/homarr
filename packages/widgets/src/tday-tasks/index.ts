import { IconChecklist } from "@tabler/icons-react";

import { clientApi } from "@homarr/api/client";
import { useI18n } from "@homarr/translation/client";

import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";
import { encodeTdayViewSelection, tdayWidgetViews } from "./selection";

export const { definition, componentLoader } = createWidgetDefinition("tdayTasks", {
  icon: IconChecklist,
  supportedIntegrations: ["tday", "mock"],
  integrationsRequired: true,
  createOptions() {
    return optionsBuilder.from((factory) => ({
      // One picker for everything the widget can show: the built-in views first, then the user's
      // own lists. A second, separate list picker used to override this one silently.
      list: factory.dynamicSelect({
        defaultValue: { value: encodeTdayViewSelection("today"), label: "today" },
        useOptions(query, integrationIds) {
          const t = useI18n("widget.tdayTasks");
          const { data, isPending } = clientApi.widget.tday.getListOptions.useQuery(
            { integrationId: integrationIds[0] ?? "" },
            { enabled: integrationIds.length > 0 },
          );
          const views = tdayWidgetViews.map((view) => ({
            value: encodeTdayViewSelection(view),
            label: t(`option.list.option.${view}.label`),
          }));
          const search = query.trim().toLowerCase();
          return {
            isPending: integrationIds.length > 0 && isPending,
            options: [...views, ...(data ?? [])].filter(
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
