"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useComputedColorScheme } from "@mantine/core";

import { useSession } from "@homarr/auth/client";
import { useCurrentLayout, useOptionalBoard } from "@homarr/boards/context";
import type { WidgetKind } from "@homarr/definitions";
import { useSettings } from "@homarr/settings";
import { useCurrentIntlLocale } from "@homarr/translation/client";
import { loadWidgetDefinition, reduceWidgetOptionsWithDefinition } from "../manifest";

import { useWidgetNow } from "../common/use-widget-now";
import type { WidgetComponentProps } from "../definition";
import { FlapBoard } from "./engine/renderer";
import { buildSplitFlapContent, getSplitFlapColumns, splitFlapGridRows, splitFlapMinColumns } from "./lines";
import { resolveClientSource, splitFlapContentRows } from "./sources";
import { resolveFlapTheme } from "./theme-mode";
import type { SplitFlapGlyphMode } from "./glyph-color";
import type { SplitFlapSourceContext } from "./sources";
import { SplitFlapMaintainer } from "./maintainer-value";
import { Nothing, SplitFlapWidgetValue } from "./widget-value";
import { isSplitFlapReadableKind } from "./widget-kinds";

/**
 * Resolves a source widget's stored options against its definition's defaults. The stored
 * options are sparse, so a weather widget the user never touched would otherwise have no
 * location to query, and the board would disagree with the widget it is mirroring.
 */
const ResolvedWidgetRow = ({
  kind,
  rawOptions,
  integrationIds,
  metric,
  onValue,
}: {
  kind: WidgetKind;
  rawOptions: Record<string, unknown>;
  integrationIds: string[];
  metric: string;
  onValue: (text: string) => void;
}) => {
  const settings = useSettings();
  const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    loadWidgetDefinition(kind)
      .then((definition) => {
        if (cancelled) return;
        setResolved(reduceWidgetOptionsWithDefinition(definition, settings, rawOptions));
      })
      .catch(() => {
        // Unreadable definition: the row stays blank rather than showing a stale figure.
      });
    return () => {
      cancelled = true;
    };
  }, [kind, rawOptions, settings]);

  if (resolved === null) return null;
  return (
    <SplitFlapWidgetValue
      kind={kind}
      options={resolved}
      integrationIds={integrationIds}
      metric={metric}
      onValue={onValue}
    />
  );
};

export default function SplitFlapWidget({ options }: WidgetComponentProps<"splitFlap">) {
  const locale = useCurrentIntlLocale();
  const board = useOptionalBoard();
  const layoutId = useCurrentLayout();
  const session = useSession();
  const now = useWidgetNow("minute");
  // "Auto" boards follow whatever scheme the rest of Homarr resolved to, so the board does
  // not stay dark on a light board.
  const appScheme = useComputedColorScheme("dark");
  const flapTheme = resolveFlapTheme(options.theme, appScheme, {
    light: options.customLightColor,
    dark: options.customDarkColor,
  });

  // With liveTime off the board lands on the time it loaded at and stops there, which is
  // the point of the flapboard; the first tick we see is the one it settles on.
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (now !== null) setLoadedAt((current) => current ?? now);
  }, [now]);
  const displayedNow = options.liveTime ? now : loadedAt;

  const context: SplitFlapSourceContext = {
    boardName: board?.name ?? null,
    boardLayout: board?.layouts.find((layout) => layout.id === layoutId)?.name ?? null,
    userName: session.data?.user?.name ?? null,
    now: displayedNow,
    locale,
    hour12: options.timeFormat === "12h",
  };

  const rows = [
    { source: options.row1Source, text: options.row1Text, widget: options.row1Widget, metric: options.row1Value },
    { source: options.row2Source, text: options.row2Text, widget: options.row2Widget, metric: options.row2Value },
    { source: options.row3Source, text: options.row3Text, widget: options.row3Widget, metric: options.row3Value },
  ];

  // Widget-backed rows report their text from the hidden adapters below.
  const [widgetTexts, setWidgetTexts] = useState<Record<number, string>>({});
  const reportWidgetText = useCallback((index: number, text: string) => {
    setWidgetTexts((current) => (current[index] === text ? current : { ...current, [index]: text }));
  }, []);
  const noop = useCallback(() => undefined, []);
  const reportForRow = useMemo(
    () => Array.from({ length: splitFlapContentRows }, (_, index) => (text: string) => reportWidgetText(index, text)),
    [reportWidgetText],
  );

  // Widget-backed and maintainer rows report their text from the hidden adapters below.
  const rowTexts = rows.map((row, index) =>
    row.source === "widget" || row.source === "maintainer"
      ? (widgetTexts[index] ?? "")
      : (resolveClientSource(row.source, row.text, context) ?? ""),
  );

  // Joined then split so the lines keep one identity while the text is unchanged: a poll
  // returning the same figure must not re-run the board effect.
  const rowTextsKey = rowTexts.join("\u0000");
  // Measured from the built board lines, not the raw rows: the third row may carry several
  // lines, and measuring the whole run as one would size the board for a line that is never
  // printed on its own.
  const { lines, columns } = useMemo(() => {
    const built = buildSplitFlapContent(rowTextsKey.split("\u0000"));
    return { lines: built, columns: getSplitFlapColumns(built) };
  }, [rowTextsKey]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<FlapBoard | null>(null);
  const linesRef = useRef<string[] | null>(null);

  // Declared before the board effect: on every change the lines are stored first, so a
  // board that is rebuilt for a new column count lands on the current text.
  useEffect(() => {
    linesRef.current = lines;
    if (boardRef.current) boardRef.current.setGrid(lines);
  }, [lines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const flapBoard = new FlapBoard(canvas, {
      // One blank row above and below the content, always.
      rows: splitFlapGridRows,
      cols: columns === 0 ? splitFlapMinColumns : columns,
      // Grow the columns to the shape of the widget, so the board meets its sides instead
      // of leaving a backdrop margin around the bezel.
      autoCols: true,
      theme: flapTheme,
      glyphMode: options.glyph as SplitFlapGlyphMode,
      glyphColor: options.glyphColor,
      speed: options.speed,
      transition: "classic",
    });
    boardRef.current = flapBoard;
    if (linesRef.current) flapBoard.setGrid(linesRef.current);
    return () => {
      boardRef.current = null;
      flapBoard.destroy();
    };
  }, [columns, flapTheme, options.glyph, options.glyphColor, options.speed]);

  return (
    <>
      {/*
        The adapters render nothing; they exist so each row can call its own kind's query
        hook, which a switch in the parent could not do without breaking the rules of
        hooks. Hidden rather than absent so their queries stay subscribed.
      */}
      <Box style={{ display: "none" }} aria-hidden>
        {rows.map((row, index) => {
          if (row.source !== "widget" && row.source !== "maintainer") return null;
          const report = reportForRow[index] ?? noop;
          if (row.source === "maintainer") {
            return (
              <SplitFlapMaintainer
                key={index}
                metric={row.metric?.value ?? ""}
                url={options.maintainerUrl}
                name={options.maintainerName}
                onValue={report}
              />
            );
          }
          const widgetId = row.widget?.value ?? null;
          const item = widgetId === null ? null : (board?.items.find((candidate) => candidate.id === widgetId) ?? null);
          if (item === null || !isSplitFlapReadableKind(item.kind)) {
            // Clears the row: whatever the previous target reported must not linger.
            return <Nothing key={index} onValue={report} />;
          }
          return (
            <ResolvedWidgetRow
              key={`${index}-${item.id}`}
              kind={item.kind}
              rawOptions={item.options}
              integrationIds={item.integrationIds}
              metric={row.metric?.value ?? ""}
              onValue={report}
            />
          );
        })}
      </Box>
      <Box h="100%" w="100%" style={{ overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </Box>
    </>
  );
}
