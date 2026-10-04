// What a board row can print: one of Homarr's own values, literal text, or a figure read
// from another widget on the same board. The board itself is engine-driven (see
// engine/renderer.ts); this decides what each of the three content rows says.

import { formatLocalizedDate } from "../common/locale";

export const splitFlapRowSources = [
  "blank",
  "boardName",
  "boardLayout",
  "userName",
  "date",
  "time",
  "weekday",
  "text",
  "widget",
] as const;

export type SplitFlapRowSource = (typeof splitFlapRowSources)[number];

/** Content rows. The blank rows around and between them are structural, not configurable. */
export const splitFlapContentRows = 3;

// A leading-zero day and a two-digit hour keep every row the same width as the day and
// hour advance, so a live clock never re-flows the grid.
const dateFormat: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export interface SplitFlapSourceContext {
  boardName: string | null;
  boardLayout: string | null;
  userName: string | null;
  now: Date | null;
  locale: string;
  hour12: boolean;
}

/**
 * The text for a source that needs nothing but the client. `null` means the row has to be
 * answered by a widget's query instead — see widget-value.tsx.
 */
export const resolveClientSource = (
  // Typed as string, not SplitFlapRowSource: the value comes from a stored select option,
  // so it can be anything a previous version wrote. An unknown source prints blank.
  source: string,
  text: string,
  context: SplitFlapSourceContext,
): string | null => {
  switch (source) {
    case "blank":
      return "";
    case "text":
      return text;
    case "boardName":
      return context.boardName ?? "";
    case "boardLayout":
      return context.boardLayout ?? "";
    case "userName":
      return context.userName ?? "";
    case "date":
      return context.now === null ? "" : formatLocalizedDate(context.now, context.locale, dateFormat);
    case "time":
      return context.now === null
        ? ""
        : formatLocalizedDate(context.now, context.locale, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: context.hour12,
          });
    case "weekday":
      return context.now === null ? "" : formatLocalizedDate(context.now, context.locale, { weekday: "long" });
    case "widget":
      return null;
    default:
      return "";
  }
};
