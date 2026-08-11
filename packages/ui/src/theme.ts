import type { MantineColorsTuple } from "@mantine/core";
import { createTheme, rem } from "@mantine/core";

import { modalComponent } from "./theme/modal";

/**
 * Ohmz HomeLab brand ramps, ported from the ohmz-cloud design tokens.
 *
 * The warm-grey tuple is ordered so it lands on Mantine's own dark-scheme
 * semantics without any CSS overrides: body = dark[7] (canvas),
 * surface = dark[6] (panel), hover = dark[5], border = dark[4].
 */
const ohmzDark: MantineColorsTuple = [
  "#f0edea", // text
  "#cbc5be", // secondary text
  "#8b857e", // muted
  "#7d7770", // tertiary
  "#3a3733", // line — default border
  "#2d2a26", // hover
  "#211f1d", // panel — default surface
  "#1a1917", // canvas — body background
  "#131211", // code
  "#0d0c0b",
];

const ohmzAmber: MantineColorsTuple = [
  "#fdf5ec",
  "#f8e6d2",
  "#f2d4b0",
  "#ecc08b",
  "#e8ae6d",
  "#e59f55",
  "#e0913f", // brand amber
  "#c87c31",
  "#a8631d", // light-mode amber
  "#7d4916",
];

const fontStack = "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const theme = createTheme({
  primaryColor: "ohmzAmber",
  primaryShade: { light: 8, dark: 6 },
  colors: {
    dark: ohmzDark,
    ohmzAmber,
  },
  autoContrast: true,
  respectReducedMotion: true,
  cursorType: "pointer",

  fontFamily: fontStack,
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",

  headings: {
    fontFamily: fontStack,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: rem(36), lineHeight: "1.1", fontWeight: "700" },
      h2: { fontSize: rem(24), lineHeight: "1.2", fontWeight: "700" },
      h3: { fontSize: rem(20), lineHeight: "1.3", fontWeight: "600" },
      h4: { fontSize: rem(16), lineHeight: "1.4", fontWeight: "600" },
      h5: { fontSize: rem(14), lineHeight: "1.5", fontWeight: "600" },
      h6: { fontSize: rem(12), lineHeight: "1.5", fontWeight: "600" },
    },
  },

  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },

  spacing: {
    xs: rem(10),
    sm: rem(12),
    md: rem(16),
    lg: rem(20),
    xl: rem(32),
  },

  // Brand radii: 12px for cards/panels (--ohmz-radius), 10px for the controls
  // that sit inside them (--radius-sm), pill for chips.
  radius: {
    xs: rem(6),
    sm: rem(8),
    md: rem(10),
    lg: rem(12),
    xl: rem(16),
  },
  defaultRadius: "md",

  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.06)",
    md: "0 2px 8px rgba(0, 0, 0, 0.08)",
    lg: "0 4px 12px rgba(0, 0, 0, 0.10)",
    xl: "0 8px 24px rgba(0, 0, 0, 0.12)",
  },

  components: {
    Card: {
      defaultProps: {
        withBorder: true,
        radius: "lg",
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
        radius: "lg",
      },
    },
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "md",
      },
    },
    Tooltip: {
      defaultProps: {
        openDelay: 300,
      },
    },
    Menu: {
      defaultProps: {
        withArrow: true,
      },
    },
    NavLink: {
      defaultProps: {
        style: { borderRadius: 5 },
      },
    },
    LoadingOverlay: {
      defaultProps: {
        zIndex: 1000,
        overlayProps: { radius: "sm", blur: 2 },
      },
    },
    Modal: modalComponent,
  },
});
