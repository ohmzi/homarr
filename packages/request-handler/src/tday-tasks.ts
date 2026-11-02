import type { TdayTask, TdayTaskView } from "@homarr/integrations";
import { createIntegrationAsync } from "@homarr/integrations";

import { createIntegrationRequestHandler } from "./lib/integration-request-handler";

export const tdayTasksRequestHandler = createIntegrationRequestHandler<
  TdayTask[],
  "tday",
  { view: TdayTaskView; listId?: string | null }
>({
  async requestAsync(integration, input) {
    const instance = await createIntegrationAsync(integration);
    // `listId` is the widget option's encoded selection; the integration reads it back, and an
    // unreadable one falls back to the view rather than failing the widget.
    return instance.getTasksAsync(input.view, input.listId);
  },
});
