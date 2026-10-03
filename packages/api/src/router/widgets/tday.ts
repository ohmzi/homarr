import {
  createIntegrationAsync,
  tdayCompleteInputSchema,
  tdayDeleteInputSchema,
  tdayListsInputSchema,
  tdayQuickAddInputSchema,
  tdayTasksInputSchema,
  tdayUncompleteInputSchema,
  tdayUpdateInputSchema,
} from "@homarr/integrations";
import { tdayTasksRequestHandler } from "@homarr/request-handler/tday-tasks";

import { createOneIntegrationMiddleware } from "../../middlewares/integration";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../trpc";

export const tdayRouter = createTRPCRouter({
  getTasks: publicProcedure
    .concat(createOneIntegrationMiddleware("query", "tday"))
    .input(tdayTasksInputSchema)
    .query(async ({ ctx, input }) => {
      const handler = tdayTasksRequestHandler.handler(ctx.integration, { view: input.view });
      const { data } = await handler.getDataAsync();
      return data;
    }),
  getLists: publicProcedure
    .concat(createOneIntegrationMiddleware("query", "tday"))
    .input(tdayListsInputSchema)
    .query(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      return instance.getListsAsync(input.view);
    }),
  complete: protectedProcedure
    .concat(createOneIntegrationMiddleware("interact", "tday"))
    .input(tdayCompleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      await instance.completeTaskAsync(input.id, input.kind, input.instanceDate);
      tdayTasksRequestHandler.invalidateCache();
    }),
  uncomplete: protectedProcedure
    .concat(createOneIntegrationMiddleware("interact", "tday"))
    .input(tdayUncompleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      await instance.uncompleteTaskAsync(input.id, input.kind, input.instanceDate);
      tdayTasksRequestHandler.invalidateCache();
    }),
  delete: protectedProcedure
    .concat(createOneIntegrationMiddleware("interact", "tday"))
    .input(tdayDeleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      await instance.deleteTaskAsync(input.kind, input.id, input.instanceDate);
      tdayTasksRequestHandler.invalidateCache();
    }),
  update: protectedProcedure
    .concat(createOneIntegrationMiddleware("interact", "tday"))
    .input(tdayUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      await instance.updateTaskAsync(input.kind, input.id, {
        title: input.title,
        priority: input.priority,
        listId: input.listId,
        due: input.due,
      });
      tdayTasksRequestHandler.invalidateCache();
    }),
  quickAdd: protectedProcedure
    .concat(createOneIntegrationMiddleware("interact", "tday"))
    .input(tdayQuickAddInputSchema)
    .mutation(async ({ ctx, input }) => {
      const instance = await createIntegrationAsync(ctx.integration);
      const result = await instance.createTasksAsync(input.view, input.titles, input.priority, input.listId, input.due);
      tdayTasksRequestHandler.invalidateCache();
      return result;
    }),
});
