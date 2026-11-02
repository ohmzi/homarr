import type { TdayTaskView } from "@homarr/integrations";

/** The built-in views, offered first in the widget's single "List" picker. */
export const tdayWidgetViews = ["today", "scheduled", "overdue", "floater"] as const satisfies readonly TdayTaskView[];

/**
 * What the widget shows: one of the built-in views, or one of the user's own lists. Both live in
 * the same `list` option, so there is one picker and nothing for a second one to override.
 *
 * Values: `"view:<view>"` for a built-in view, `"todo:<id>"` / `"floater:<id>"` for a list (the
 * integration's own encoding, see `encodeTdayListSelection`).
 */
export type TdayWidgetSelection =
  | { type: "view"; view: TdayTaskView }
  | { type: "list"; kind: "todo" | "floater"; id: string; encoded: string };

export const encodeTdayViewSelection = (view: TdayTaskView) => `view:${view}`;

export const parseTdayWidgetSelection = (value: string | null | undefined): TdayWidgetSelection => {
  const fallback: TdayWidgetSelection = { type: "view", view: "today" };
  if (!value) return fallback;
  const separator = value.indexOf(":");
  if (separator < 1) return fallback;
  const prefix = value.slice(0, separator);
  const rest = value.slice(separator + 1);
  if (prefix === "view") {
    return (tdayWidgetViews as readonly string[]).includes(rest)
      ? { type: "view", view: rest as TdayTaskView }
      : fallback;
  }
  if ((prefix === "todo" || prefix === "floater") && rest.length > 0) {
    return { type: "list", kind: prefix, id: rest, encoded: value };
  }
  return fallback;
};

/**
 * Widgets saved before the merge carry a separate `view` string and maybe a `list` object. A chosen
 * list always won over the view, so it is kept; otherwise the old view becomes the selection.
 */
export const normalizeTdayTasksOptions = (options: Record<string, unknown>): Record<string, unknown> => {
  if (!("view" in options)) return options;
  const { view, ...rest } = options;
  const list = rest.list as { value?: unknown } | null | undefined;
  if (list && typeof list.value === "string" && list.value.length > 0) return rest;
  const legacyView =
    typeof view === "string" && (tdayWidgetViews as readonly string[]).includes(view)
      ? (view as TdayTaskView)
      : "today";
  return {
    ...rest,
    list: { value: encodeTdayViewSelection(legacyView), label: legacyView },
  };
};
