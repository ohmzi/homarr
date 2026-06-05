import dayjs from "dayjs";

import type { TdayTask, TdayTaskView } from "@homarr/integrations";
import { createIntegrationAsync } from "@homarr/integrations";

import { createCachedIntegrationRequestHandler } from "./lib/cached-integration-request-handler";

export const tdayTasksRequestHandler = createCachedIntegrationRequestHandler<
  TdayTask[],
  "tday",
  { view: TdayTaskView }
>({
  queryKey: "tdayTasks",
  cacheDuration: dayjs.duration(15, "seconds"),
  async requestAsync(integration, input) {
    const instance = await createIntegrationAsync(integration);
    return instance.getTasksAsync(input.view);
  },
});
