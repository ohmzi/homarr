// Which flap board the widget draws. "Auto" follows the color scheme the rest of Homarr
// is showing, so a board does not stay dark when the app is in light mode.

import type { FlapTheme } from "./engine/renderer";
import { flapThemes } from "./engine/renderer";
import { buildCustomTheme } from "./theme-custom";

export const splitFlapModes = ["auto", "light", "dark", "solari", "customLight", "customDark"] as const;
export type SplitFlapMode = (typeof splitFlapModes)[number];

/**
 * Resolves the stored option to a board.
 *
 * "black" and "white" are the values stored before the mode option existed. They still
 * mean what they meant then — one fixed board whatever the app is doing — so they are
 * honoured rather than treated as an unknown value that would silently follow the scheme.
 */
export const resolveFlapTheme = (
  mode: unknown,
  appScheme: "light" | "dark",
  custom: { light: string; dark: string },
): FlapTheme => {
  // "black" and "white" are the values stored before the mode option existed. They still
  // mean what they meant then — one fixed board whatever the app is doing — so they are
  // honored rather than treated as an unknown value that would silently follow the scheme.
  if (mode === "customLight") return buildCustomTheme(custom.light, "light");
  if (mode === "customDark") return buildCustomTheme(custom.dark, "dark");
  if (mode === "black" || mode === "white" || mode === "solari") return flapThemes[mode];
  if (mode === "light") return flapThemes.white;
  if (mode === "dark") return flapThemes.black;
  return appScheme === "light" ? flapThemes.white : flapThemes.black;
};
