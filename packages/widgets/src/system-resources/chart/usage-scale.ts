// Colours a usage line by how high it sits, rather than giving the whole line one colour.
//
// The chart paints the stroke with a vertical gradient, so a point's colour depends on its
// height on the plot and therefore on its value: below the caution threshold it is green,
// between the thresholds orange, above them red. Only the parts of the line that climb
// past a threshold change colour; the rest keeps its own.

export interface UsageThresholds {
  /** Value at and above which the line turns orange. */
  caution: number;
  /** Value at and above which the line turns red. */
  critical: number;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface UsageColors {
  ok: string;
  caution: string;
  critical: string;
}

/**
 * Resolved from the Mantine theme by the caller. They have to be real colors: `stop-color`
 * is a presentation attribute, so a `var(--mantine-color-*)` reference there paints
 * nothing and the line falls back to black.
 */
export const usageColorNames = {
  ok: [5, "teal"],
  caution: [5, "orange"],
  critical: [6, "red"],
} as const;

export interface UsageScale extends UsageThresholds {
  domain: [number, number];
}

/**
 * The link's ceilings in bytes per second: 1.2 Gbps down, 40 Mbps up.
 *
 * Unlike CPU and memory, a network has no ceiling it can discover, and the charts used to
 * fit their axis to whatever the window peaked at. That is left alone, the colour cannot
 * work: the gradient is positioned in the plot's own coordinates, so the axis and the
 * thresholds have to agree or a spike nowhere near saturation would still paint red.
 */
export const networkCeilings = {
  down: 1_200_000_000 / 8,
  up: 40_000_000 / 8,
} as const;

/** Thresholds at a share of a known ceiling, with the axis reading as that share. */
export const buildCeilingUsageScale = (ceiling: number): UsageScale => ({
  caution: ceiling * 0.7,
  critical: ceiling * 0.9,
  domain: [0, ceiling],
});

/** Recharts insets the plot by this much on every side when both axes are hidden. */
const chartMargin = 5;

/** Where a value sits on the plot, as a fraction of the plot's height (0 at the top). */
export const valueToOffset = (value: number, domain: readonly [number, number]): number => {
  const [min, max] = domain;
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (max - value) / (max - min)));
};

/**
 * The stops for a vertical gradient covering `svgHeight` pixels, with hard edges at the two
 * thresholds: the offset before and after each threshold is the same, so the colour changes
 * abruptly at the threshold rather than blending across it.
 */
export const buildUsageGradientStops = (
  { caution, critical }: UsageThresholds,
  domain: readonly [number, number],
  colors: UsageColors,
): GradientStop[] => {
  const cautionOffset = valueToOffset(caution, domain);
  const criticalOffset = valueToOffset(critical, domain);
  // Guard against a caller passing them the wrong way round, which would leave a gap.
  const upper = Math.min(cautionOffset, criticalOffset);
  const lower = Math.max(cautionOffset, criticalOffset);

  return [
    { offset: 0, color: colors.critical },
    { offset: upper, color: colors.critical },
    { offset: upper, color: colors.caution },
    { offset: lower, color: colors.caution },
    { offset: lower, color: colors.ok },
    { offset: 1, color: colors.ok },
  ];
};

/**
 * The gradient's y range in the SVG's own coordinates: the plot area, which is the element
 * box inset by the chart's margin. Both axes are hidden on these charts, so the margin is
 * the same on every side.
 */
export const plotAreaFor = (svgHeight: number): { y1: number; y2: number } => ({
  y1: chartMargin,
  y2: Math.max(chartMargin + 1, svgHeight - chartMargin),
});
