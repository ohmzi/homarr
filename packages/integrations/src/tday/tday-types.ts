import { z } from "zod/v4";

export const tdayTaskViewSchema = z.enum(["today", "scheduled", "overdue", "floater"]);
export type TdayTaskView = z.infer<typeof tdayTaskViewSchema>;

export const tdayTaskKindSchema = z.enum(["todo", "floater"]);
export type TdayTaskKind = z.infer<typeof tdayTaskKindSchema>;

/** Normalized task shape returned to the widget, regardless of the underlying Tday entity. */
export const tdayTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.string(),
  due: z.string().nullable(),
  instanceDate: z.string().nullable(),
  completed: z.boolean(),
  kind: tdayTaskKindSchema,
  listId: z.string().nullable(),
  listName: z.string().nullable(),
  listIconKey: z.string().nullable(),
  listColor: z.string().nullable(),
});
export type TdayTask = z.infer<typeof tdayTaskSchema>;

// Raw Tday API payloads — only the fields we use; extra keys are stripped by zod.
const tdayTodoDtoSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  priority: z.string().default("Low"),
  due: z.string().nullable().optional(),
  instanceDate: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  listID: z.string().nullable().optional(),
});

const tdayFloaterDtoSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  priority: z.string().default("Low"),
  completed: z.boolean().default(false),
  listID: z.string().nullable().optional(),
});

export const tdayTodosResponseSchema = z.object({ todos: z.array(tdayTodoDtoSchema) });
export const tdayFloatersResponseSchema = z.object({ floaters: z.array(tdayFloaterDtoSchema) });
export const tdaySessionResponseSchema = z.object({
  user: z.object({ timeZone: z.string().nullable().optional() }),
});

export const tdayPrioritySchema = z.enum(["Low", "Medium", "High"]);
export type TdayPriority = z.infer<typeof tdayPrioritySchema>;

export const tdayListSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconKey: z.string().nullable(),
  color: z.string().nullable(),
});
export type TdayList = z.infer<typeof tdayListSchema>;

const tdayListDtoSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  iconKey: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});
export const tdayListsResponseSchema = z.object({ lists: z.array(tdayListDtoSchema) });

export const tdayTasksInputSchema = z.object({ view: tdayTaskViewSchema });
export type TdayTasksInput = z.infer<typeof tdayTasksInputSchema>;

export const tdayListsInputSchema = z.object({ view: tdayTaskViewSchema });
export type TdayListsInput = z.infer<typeof tdayListsInputSchema>;

export const tdayCompleteInputSchema = z.object({
  id: z.string(),
  kind: tdayTaskKindSchema,
  instanceDate: z.string().nullable().optional(),
});
export type TdayCompleteInput = z.infer<typeof tdayCompleteInputSchema>;

export const tdayUncompleteInputSchema = tdayCompleteInputSchema;
export type TdayUncompleteInput = z.infer<typeof tdayUncompleteInputSchema>;

export const tdayDeleteInputSchema = z.object({
  id: z.string(),
  kind: tdayTaskKindSchema,
  instanceDate: z.string().nullable().optional(),
});
export type TdayDeleteInput = z.infer<typeof tdayDeleteInputSchema>;

export const tdayUpdateInputSchema = z.object({
  kind: tdayTaskKindSchema,
  id: z.string(),
  title: z.string().min(1).max(500).optional(),
  priority: tdayPrioritySchema.optional(),
  // null clears the list assignment; undefined leaves it unchanged.
  listId: z.string().nullable().optional(),
  // ISO local datetime ("YYYY-MM-DDTHH:mm[:ss]"); only applies to todos (floaters have no due).
  due: z.string().nullable().optional(),
});
export type TdayUpdateInput = z.infer<typeof tdayUpdateInputSchema>;

export const tdayQuickAddInputSchema = z.object({
  view: tdayTaskViewSchema,
  titles: z.array(z.string().min(1).max(500)).min(1).max(50),
  priority: tdayPrioritySchema.default("Low"),
  listId: z.string().min(1).nullable().optional(),
  // Optional ISO local datetime for todos; when omitted the integration defaults to end of today.
  due: z.string().nullable().optional(),
});
export type TdayQuickAddInput = z.infer<typeof tdayQuickAddInputSchema>;

export const tdayQuickAddResultSchema = z.object({
  created: z.number(),
  failedTitles: z.array(z.string()),
});
export type TdayQuickAddResult = z.infer<typeof tdayQuickAddResultSchema>;
