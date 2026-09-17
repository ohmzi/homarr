"use client";

import { useMemo } from "react";
import { Box, Group, Stack, Text, Tooltip, useComputedColorScheme } from "@mantine/core";
import type { RouterOutputs } from "@homarr/api";
import { clientApi } from "@homarr/api/client";
import { useScopedI18n } from "@homarr/translation/client";

import type { WidgetComponentProps } from "../definition";
import { buildDaySlots } from "./day-slots";

type Monitor = RouterOutputs["widget"]["uptimeStatus"]["getHistory"]["monitors"][number];
type DaySlot = Monitor["days"][number];
type DayState = "up" | "partial" | "down" | "empty";

/**
 * One colour per day, from the day's up/down split. A day with any downtime stays
 * orange or red for its lifetime - that is the trade for keeping only daily totals.
 */
const getDayState = (day: DaySlot): DayState => {
  if (day.upSeconds + day.downSeconds === 0) return "empty";
  if (day.downSeconds === 0) return "up";
  if (day.upSeconds === 0) return "down";
  return "partial";
};

const formatPercent = (value: number) => `${value >= 99.995 ? "100" : value.toFixed(value >= 99.95 ? 1 : 2)}%`;

export default function UptimeStatusWidget({ options, integrationIds }: WidgetComponentProps<"uptimeStatus">) {
  const t = useScopedI18n("widget.uptimeStatus");
  const colorScheme = useComputedColorScheme("light");

  const { data } = clientApi.widget.uptimeStatus.getHistory.useQuery({
    integrationIds,
    includeHost: options.includeHost,
    includeOpenWebUi: options.includeOpenWebUi,
    days: options.visibleDays,
  });

  const shade = colorScheme === "dark" ? 5 : 6;
  const colors: Record<DayState, string> = {
    up: `var(--mantine-color-green-${shade})`,
    partial: `var(--mantine-color-orange-${shade})`,
    down: `var(--mantine-color-red-${shade})`,
    empty: "var(--mantine-color-default-border)",
  };

  // Memoised so the fallback array keeps a stable identity and does not defeat the memo below.
  const monitors = useMemo(() => data?.monitors ?? [], [data]);

  const slots = useMemo(
    () =>
      buildDaySlots({
        dates: monitors.flatMap((monitor) => monitor.days.map((day) => day.date)),
        visibleDays: options.visibleDays,
        today: new Date(),
      }),
    [monitors, options.visibleDays],
  );

  if (monitors.length === 0) {
    return (
      <Stack h="100%" justify="center" p="xs">
        <Text c="dimmed" size="xs" ta="center">
          {t("empty")}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xs" h="100%" p="xs" style={{ overflowY: "auto" }}>
      {monitors.map((monitor) => {
        const byDate = new Map(monitor.days.map((day) => [day.date, day]));

        let upSeconds = 0;
        let downSeconds = 0;
        for (const slot of slots) {
          const day = byDate.get(slot);
          if (!day) continue;
          upSeconds += day.upSeconds;
          downSeconds += day.downSeconds;
        }

        const total = upSeconds + downSeconds;
        const percent = total === 0 ? null : (upSeconds / total) * 100;

        return (
          <Box key={monitor.id}>
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Text size="xs" fw={600} lineClamp={1}>
                {monitor.name}
              </Text>
              {options.showUptimePercent && percent !== null && (
                <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                  {formatPercent(percent)}
                </Text>
              )}
            </Group>
            <Group gap={2} wrap="nowrap" mt={4} h={14}>
              {slots.map((slot) => {
                const day = byDate.get(slot);
                const state = day ? getDayState(day) : "empty";

                return (
                  <Tooltip
                    key={slot}
                    openDelay={80}
                    withArrow
                    label={
                      day && state !== "empty"
                        ? `${slot} — ${state === "up" ? t("day.up") : formatPercent((day.upSeconds / (day.upSeconds + day.downSeconds)) * 100)}`
                        : `${slot} — ${t("day.empty")}`
                    }
                  >
                    <Box
                      style={{
                        flex: 1,
                        minWidth: 1,
                        height: "100%",
                        borderRadius: 2,
                        backgroundColor: colors[state],
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Group>
          </Box>
        );
      })}
    </Stack>
  );
}
