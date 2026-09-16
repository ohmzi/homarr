import { Card, Group, Text, useComputedColorScheme } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";

import { useRequiredBoard } from "@homarr/boards/context";
import { useScopedI18n } from "@homarr/translation/client";

import type { LabelDisplayModeOption } from "..";

/**
 * Compact uptime, e.g. "12d 4h 31m". The health-monitoring widget spells it out
 * in full, but this strip is narrow and sits next to CPU/MEM/GPU, so it keeps
 * the same terse register as those cards.
 */
const formatUptime = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const SystemResourceUptimeCard = ({
  uptimeInSeconds,
  labelDisplayMode,
}: {
  uptimeInSeconds: number;
  labelDisplayMode: LabelDisplayModeOption;
}) => {
  const t = useScopedI18n("widget.systemResources.card");
  const colorScheme = useComputedColorScheme("light");
  const board = useRequiredBoard();

  // Same surface treatment as CommonChart so the strip reads as one of the cards.
  const opacity = board.opacity / 100;
  const backgroundColor = colorScheme === "dark" ? `rgba(57, 57, 57, ${opacity})` : `rgba(246, 247, 248, ${opacity})`;

  const showIcon = labelDisplayMode === "icon" || labelDisplayMode === "textWithIcon";
  const showText = labelDisplayMode === "text" || labelDisplayMode === "textWithIcon";

  return (
    <Card
      className="system-resources-uptime-card"
      h="100%"
      p={0}
      bg={backgroundColor}
      radius={board.itemRadius}
      style={{ overflow: "hidden" }}
    >
      <Group h="100%" px={8} gap={5} wrap="nowrap" align="center">
        {showIcon && <IconClock color="var(--mantine-color-dimmed)" size={14} stroke={1.5} />}
        {showText && (
          <Text c="dimmed" size="xs" fw="bold">
            {t("uptime")}
          </Text>
        )}
        <Text className="system-resources-uptime-value" c="dimmed" size="xs" lineClamp={1} ml="auto">
          {formatUptime(uptimeInSeconds)}
        </Text>
      </Group>
    </Card>
  );
};
