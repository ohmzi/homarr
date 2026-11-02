/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { AreaChartSeries } from "@mantine/charts";
import { AreaChart, LineChart } from "@mantine/charts";
import { Card, Center, Group, Stack, Text, Tooltip, useComputedColorScheme, useMantineTheme } from "@mantine/core";
import { useElementSize, useHover, useMergedRef } from "@mantine/hooks";
import type { YAxisProps } from "recharts";

import { useRequiredBoard } from "@homarr/boards/context";
import { zoomCompensatedSize } from "@homarr/ui";
import type { TablerIcon } from "@homarr/ui";

import type { LabelDisplayModeOption } from "..";
import type { UsageThresholds } from "./usage-scale";
import { buildUsageGradientStops, plotAreaFor, usageColorNames } from "./usage-scale";

export const CommonChart = ({
  data,
  dataKey,
  series,
  title,
  icon: Icon,
  labelDisplayMode,
  tooltipLabel,
  yAxisProps,
  lastValue,
  chartType = "line",
  advanced = false,
  usageScale,
}: {
  data: Record<string, any>[];
  dataKey: string;
  series: AreaChartSeries[];
  title: ReactNode;
  icon: TablerIcon;
  labelDisplayMode: LabelDisplayModeOption;
  // What to show on hover. Defaults to lastValue when omitted. Pass a function to reflect
  // the datum under the cursor as it moves across multi-point data (e.g. memory's
  // used/available at that point), instead of always showing the latest value.
  tooltipLabel?: ReactNode | ((index: number) => ReactNode);
  yAxisProps?: Omit<YAxisProps, "ref">;
  lastValue?: string;
  chartType?: "line" | "area";
  advanced?: boolean;
  // Colour the line by its value: green below the caution threshold, orange up to the
  // critical one, red above. Only the parts that climb past a threshold change colour.
  usageScale?: UsageThresholds & { series?: string; domain: readonly [number, number] };
}) => {
  const { ref: elementSizeRef, height } = useElementSize();
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme("light");
  const board = useRequiredBoard();
  const { hovered, ref: hoverRef } = useHover();
  const ref = useMergedRef(elementSizeRef, hoverRef);

  const opacity = board.opacity / 100;
  let backgroundColor = colorScheme === "dark" ? `rgba(57, 57, 57, ${opacity})` : `rgba(246, 247, 248, ${opacity})`;
  const cardStyle: CSSProperties = { overflow: "hidden" };
  const chartRootStyle: CSSProperties = {
    padding: 5,
    borderRadius: theme.radius[board.itemRadius],
  };
  if (advanced) {
    backgroundColor = "rgb(from var(--mantine-color-primaryColor-filled) r g b / calc(var(--opacity, 1) * 0.12))";
    cardStyle.border =
      "1px solid rgb(from var(--mantine-color-secondaryColor-filled) r g b / calc(var(--opacity, 1) * 0.45))";
    chartRootStyle.backgroundColor = backgroundColor;
  }

  const ChartComponent = chartType === "line" ? LineChart : AreaChart;
  const showIcon = labelDisplayMode === "icon" || labelDisplayMode === "textWithIcon";
  const showText = labelDisplayMode === "text" || labelDisplayMode === "textWithIcon";

  // Track which data point the cursor is over so the tooltip can reflect that point
  // instead of always showing the latest value while scrubbing across the chart.
  const [hoveredIndex, setHoveredIndex] = useState(data.length - 1);

  // The gradient is positioned in the SVG's own coordinates, so it needs the height the
  // chart actually rendered at rather than the card's.
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState<number | null>(null);
  useEffect(() => {
    const measured = chartAreaRef.current?.querySelector("svg")?.getBoundingClientRect().height ?? 0;
    setSvgHeight(measured > 0 ? measured : null);
  }, [height, data]);
  const gradientId = useId().replace(/:/g, "");
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (data.length <= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (data.length - 1));
    setHoveredIndex(Math.min(data.length - 1, Math.max(0, index)));
  };

  const usageSeriesName = usageScale?.series ?? series[0]?.name;
  const usageGradient =
    usageScale && svgHeight !== null
      ? {
          id: gradientId,
          area: plotAreaFor(svgHeight),
          // Read through the theme so a themed palette is respected; the stops need real
          // colors, not CSS variable references.
          stops: buildUsageGradientStops(usageScale, usageScale.domain, {
            ok: theme.colors[usageColorNames.ok[1]][usageColorNames.ok[0]],
            caution: theme.colors[usageColorNames.caution[1]][usageColorNames.caution[0]],
            critical: theme.colors[usageColorNames.critical[1]][usageColorNames.critical[0]],
          }),
        }
      : null;
  const paintedSeries =
    usageGradient === null
      ? series
      : series.map((entry) =>
          entry.name === usageSeriesName ? { ...entry, color: `url(#${usageGradient.id})` } : entry,
        );

  // Clamp on read rather than syncing via an effect - handles data growing/shrinking
  // between renders (e.g. history resetting on integration change) without ever
  // handing a stale or out-of-range index to tooltipLabel.
  const clampedHoveredIndex = Math.max(0, Math.min(hoveredIndex, data.length - 1));
  const resolvedTooltipLabel =
    typeof tooltipLabel === "function" ? tooltipLabel(clampedHoveredIndex) : (tooltipLabel ?? lastValue);

  return (
    <Tooltip.Floating label={resolvedTooltipLabel} disabled={data.length <= 1 || !resolvedTooltipLabel}>
      <Card
        ref={ref}
        h={"100%"}
        pos={"relative"}
        style={cardStyle}
        p={0}
        bg={backgroundColor}
        radius={board.itemRadius}
        onPointerMove={handlePointerMove}
      >
        {data.length > 1 && height > 40 && !hovered && (
          <Group
            pos={"absolute"}
            top={0}
            left={0}
            p={8}
            pt={6}
            gap={5}
            wrap={"nowrap"}
            style={{ zIndex: 2, pointerEvents: "none" }}
            align="center"
          >
            {showIcon && (
              <Icon
                color="var(--mantine-color-dimmed)"
                style={zoomCompensatedSize(height > 100 ? 20 : 14)}
                stroke={1.5}
              />
            )}
            {showText && (
              <Text c={"dimmed"} size={height > 100 ? "md" : "xs"} fw={"bold"}>
                {title}
              </Text>
            )}
            {lastValue && (
              <Text c={"dimmed"} size={height > 100 ? "md" : "xs"} lineClamp={1}>
                {lastValue}
              </Text>
            )}
          </Group>
        )}
        {advanced && data.length > 1 && height > 0 && height <= 40 && lastValue && !hovered && (
          <Center pos="absolute" w="100%" h="100%" style={{ zIndex: 2, pointerEvents: "none" }}>
            <Text size="xs" fw={600}>
              {lastValue}
            </Text>
          </Center>
        )}
        {data.length <= 1 ? (
          <Center pos="absolute" w="100%" h="100%">
            <Stack px={"xs"} align={"center"} gap={4}>
              {showIcon && (
                <Icon
                  color="var(--mantine-color-dimmed)"
                  style={zoomCompensatedSize(height > 100 ? 20 : 14)}
                  stroke={1.5}
                />
              )}
              {showText && (
                <Text c={"dimmed"} size={height > 100 ? "md" : "xs"} fw={"bold"} ta="center">
                  {title}
                </Text>
              )}
              {advanced && lastValue && (
                <Text size={height > 100 ? "md" : "xs"} fw={600} ta="center">
                  {lastValue}
                </Text>
              )}
            </Stack>
          </Center>
        ) : (
          <ChartComponent
            ref={chartAreaRef}
            data={data}
            dataKey={dataKey}
            h={"100%"}
            series={paintedSeries}
            curveType="monotone"
            tickLine="none"
            gridAxis="none"
            withXAxis={false}
            withYAxis={false}
            withDots={false}
            bg={backgroundColor}
            styles={{ root: chartRootStyle }}
            withTooltip={false}
            yAxisProps={yAxisProps}
            fillOpacity={chartType === "area" ? 0.3 : undefined}
          >
            {usageGradient && (
              <defs>
                <linearGradient
                  id={usageGradient.id}
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  x2={0}
                  y1={usageGradient.area.y1}
                  y2={usageGradient.area.y2}
                >
                  {usageGradient.stops.map((stop, index) => (
                    <stop key={index} offset={stop.offset} stopColor={stop.color} />
                  ))}
                </linearGradient>
              </defs>
            )}
          </ChartComponent>
        )}
      </Card>
    </Tooltip.Floating>
  );
};
