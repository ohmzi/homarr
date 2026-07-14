import type { TdayTask, TdayTaskView } from "@homarr/integrations";
import { createIntegrationAsync } from "@homarr/integrations";

import { createIntegrationRequestHandler } from "./lib/integration-request-handler";

export const tdayTasksRequestHandler = createIntegrationRequestHandler<TdayTask[], "tday", { view: TdayTaskView }>({
  async requestAsync(integration, input) {
    const instance = await createIntegrationAsync(integration);
    return instance.getTasksAsync(input.view);
  },
});
