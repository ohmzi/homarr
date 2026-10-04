import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";

import { useByteFormatter } from "@homarr/settings";
import { useI18n } from "@homarr/translation/client";

import type { LabelDisplayModeOption } from "..";
import { CommonChart } from "./common-chart";
import { buildCeilingUsageScale, networkCeilings } from "./usage-scale";

export const NetworkTrafficChart = ({
  usageOverTime,
  isUp,
  hasShadow,
  labelDisplayMode,
  advanced = false,
}: {
  usageOverTime: number[];
  isUp: boolean;
  hasShadow: boolean;
  labelDisplayMode: LabelDisplayModeOption;
  advanced?: boolean;
}) => {
  const chartData = usageOverTime.map((usage, index) => ({ index, usage }));
  const t = useI18n("widget.systemResources.card");
  const { formatByteRate } = useByteFormatter();

  const latest = usageOverTime.at(-1) ?? 0;
  // Scaled to the link rather than to the window's own peak: the axis and the colour
  // thresholds have to agree, and both are only meaningful against a real ceiling.
  const ceiling = isUp ? networkCeilings.up : networkCeilings.down;
  const usageScale = buildCeilingUsageScale(ceiling);

  return (
    <CommonChart
      data={chartData}
      dataKey={"index"}
      series={[{ name: "usage", color: "yellow.5" }]}
      title={isUp ? t("up") : t("down")}
      icon={isUp ? IconArrowUp : IconArrowDown}
      yAxisProps={{ domain: usageScale.domain }}
      usageScale={usageScale}
      lastValue={formatByteRate(Math.round(latest))}
      chartType={hasShadow ? "area" : "line"}
      labelDisplayMode={labelDisplayMode}
      advanced={advanced}
      tooltipLabel={(index) => formatByteRate(Math.round(usageOverTime[index] ?? 0))}
    />
  );
};
