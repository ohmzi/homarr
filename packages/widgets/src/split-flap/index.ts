import { IconLayoutBoardSplit } from "@tabler/icons-react";

import { useOptionalBoard } from "@homarr/boards/context";
import { useI18n } from "@homarr/translation/client";

import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";
import type { SelectOption } from "../_inputs/widget-select-input";
import { isSplitFlapReadableKind, getSplitFlapMetrics } from "./widget-kinds";
import type { SplitFlapReadableKind } from "./widget-kinds";

// One list reused by all three rows: the labels do not depend on which row is asking.
const sourceOptions = [
  { value: "blank", label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.blank" as never) },
  {
    value: "boardName",
    label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.boardName" as never),
  },
  {
    value: "boardLayout",
    label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.boardLayout" as never),
  },
  {
    value: "userName",
    label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.userName" as never),
  },
  { value: "date", label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.date" as never) },
  { value: "time", label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.time" as never) },
  {
    value: "weekday",
    label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.weekday" as never),
  },
  { value: "text", label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.text" as never) },
  {
    value: "widget",
    label: (t: (key: never) => string) => t("widget.splitFlap.option.source.options.widget" as never),
  },
] satisfies SelectOption[];

const isWidgetSource = (source: unknown) => source === "widget";

export const { definition, componentLoader } = createWidgetDefinition("splitFlap", {
  icon: IconLayoutBoardSplit,
  createOptions() {
    return optionsBuilder.from(
      (factory) => ({
        theme: factory.select({
          defaultValue: "auto",
          withDescription: true,
          options: [
            { value: "auto", label: (t) => t("widget.splitFlap.option.theme.options.auto") },
            { value: "light", label: (t) => t("widget.splitFlap.option.theme.options.light") },
            { value: "dark", label: (t) => t("widget.splitFlap.option.theme.options.dark") },
            { value: "solari", label: (t) => t("widget.splitFlap.option.theme.options.solari") },
            { value: "customLight", label: (t) => t("widget.splitFlap.option.theme.options.customLight") },
            { value: "customDark", label: (t) => t("widget.splitFlap.option.theme.options.customDark") },
          ],
        }),
        customLightColor: factory.color({ defaultValue: "#dfe6ef", withDescription: true }),
        customDarkColor: factory.color({ defaultValue: "#232a33", withDescription: true }),
        glyph: factory.select({
          defaultValue: "standard",
          withDescription: true,
          options: [
            { value: "standard", label: (t) => t("widget.splitFlap.option.glyph.options.standard") },
            { value: "rainbow", label: (t) => t("widget.splitFlap.option.glyph.options.rainbow") },
            { value: "custom", label: (t) => t("widget.splitFlap.option.glyph.options.custom") },
          ],
        }),
        glyphColor: factory.color({ defaultValue: "#e0913f" }),
        speed: factory.select({
          defaultValue: "authentic",
          options: [
            { value: "authentic", label: (t) => t("widget.splitFlap.option.speed.options.authentic") },
            { value: "fast", label: (t) => t("widget.splitFlap.option.speed.options.fast") },
            { value: "gentle", label: (t) => t("widget.splitFlap.option.speed.options.gentle") },
          ],
        }),
        timeFormat: factory.select({
          defaultValue: "12h",
          options: [
            { value: "12h", label: (t) => t("widget.splitFlap.option.timeFormat.options.12h") },
            { value: "24h", label: (t) => t("widget.splitFlap.option.timeFormat.options.24h") },
          ],
        }),
        liveTime: factory.switch({ defaultValue: false, withDescription: true }),

        row1Source: factory.select({ defaultValue: "boardName", options: sourceOptions }),
        row1Text: factory.text({ defaultValue: "" }),
        row1Widget: factory.dynamicSelect({
          withDescription: true,
          useOptions(query) {
            const t = useI18n();
            const board = useOptionalBoard();
            return {
              isPending: false,
              options: listBoardWidgets(board?.items ?? [], query, t),
            };
          },
        }),
        row1Value: factory.dynamicSelect({
          withDescription: true,
          useOptions(_query, _integrationIds, options) {
            const t = useI18n();
            const board = useOptionalBoard();
            return { isPending: false, options: listMetrics(board?.items ?? [], options.row1Widget, t) };
          },
        }),

        row2Source: factory.select({ defaultValue: "date", options: sourceOptions }),
        row2Text: factory.text({ defaultValue: "" }),
        row2Widget: factory.dynamicSelect({
          withDescription: true,
          useOptions(query) {
            const t = useI18n();
            const board = useOptionalBoard();
            return { isPending: false, options: listBoardWidgets(board?.items ?? [], query, t) };
          },
        }),
        row2Value: factory.dynamicSelect({
          withDescription: true,
          useOptions(_query, _integrationIds, options) {
            const t = useI18n();
            const board = useOptionalBoard();
            return { isPending: false, options: listMetrics(board?.items ?? [], options.row2Widget, t) };
          },
        }),

        row3Source: factory.select({ defaultValue: "time", options: sourceOptions }),
        row3Text: factory.text({ defaultValue: "" }),
        row3Widget: factory.dynamicSelect({
          withDescription: true,
          useOptions(query) {
            const t = useI18n();
            const board = useOptionalBoard();
            return { isPending: false, options: listBoardWidgets(board?.items ?? [], query, t) };
          },
        }),
        row3Value: factory.dynamicSelect({
          withDescription: true,
          useOptions(_query, _integrationIds, options) {
            const t = useI18n();
            const board = useOptionalBoard();
            return { isPending: false, options: listMetrics(board?.items ?? [], options.row3Widget, t) };
          },
        }),
      }),
      {
        customLightColor: { shouldHide: ({ theme }) => theme !== "customLight" },
        customDarkColor: { shouldHide: ({ theme }) => theme !== "customDark" },
        glyphColor: { shouldHide: ({ glyph }) => glyph !== "custom" },
        row1Text: { shouldHide: ({ row1Source }) => row1Source !== "text" },
        row1Widget: { shouldHide: ({ row1Source }) => !isWidgetSource(row1Source) },
        row1Value: { shouldHide: ({ row1Source }) => !isWidgetSource(row1Source) },
        row2Text: { shouldHide: ({ row2Source }) => row2Source !== "text" },
        row2Widget: { shouldHide: ({ row2Source }) => !isWidgetSource(row2Source) },
        row2Value: { shouldHide: ({ row2Source }) => !isWidgetSource(row2Source) },
        row3Text: { shouldHide: ({ row3Source }) => row3Source !== "text" },
        row3Widget: { shouldHide: ({ row3Source }) => !isWidgetSource(row3Source) },
        row3Value: { shouldHide: ({ row3Source }) => !isWidgetSource(row3Source) },
      },
    );
  },
}).withDynamicImport(() => import("./component"));

interface BoardItem {
  id: string;
  kind: string;
}

/** Widgets on this board that a row can read. Names come from the kind, with an index
 *  when the board holds several of the same kind, since board items carry no name. */
const listBoardWidgets = (
  items: readonly BoardItem[],
  query: string,
  t: (key: never) => string,
): { value: string; label: string }[] => {
  const readable = items.filter((item) => isSplitFlapReadableKind(item.kind));
  const seen = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const item of readable) totals.set(item.kind, (totals.get(item.kind) ?? 0) + 1);

  return readable
    .map((item) => {
      const index = (seen.get(item.kind) ?? 0) + 1;
      seen.set(item.kind, index);
      const name = t(`widget.${item.kind}.name` as never);
      return {
        value: item.id,
        label: (totals.get(item.kind) ?? 0) > 1 ? `${name} (${index})` : name,
      };
    })
    .filter((option) => query.trim() === "" || option.label.toLowerCase().includes(query.trim().toLowerCase()));
};

/** The figures the picked widget can offer. Empty until a widget is picked. */
const listMetrics = (
  items: readonly BoardItem[],
  selection: unknown,
  t: (key: never) => string,
): { value: string; label: string }[] => {
  const widgetId = readSelectedValue(selection);
  const item = widgetId === null ? undefined : items.find((candidate) => candidate.id === widgetId);
  if (!item || !isSplitFlapReadableKind(item.kind)) return [];
  const kind: SplitFlapReadableKind = item.kind;
  return getSplitFlapMetrics(kind).map((metric) => ({
    value: metric,
    label: t(`widget.splitFlap.metric.${metric}` as never),
  }));
};

const readSelectedValue = (selection: unknown): string | null => {
  if (typeof selection !== "object" || selection === null) return null;
  const value = (selection as Record<string, unknown>).value;
  return typeof value === "string" ? value : null;
};
