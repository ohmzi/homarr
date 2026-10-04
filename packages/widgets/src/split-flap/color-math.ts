// Color arithmetic, shared by the built-in board palette and the custom one so both
// derive their shades the same way.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export const parseHex = (hex: string): Rgb | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = match?.[1];
  if (digits === undefined) return null;
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
};

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

export const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === red
      ? ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
      : max === green
        ? ((blue - red) / delta + 2) * 60
        : ((red - green) / delta + 4) * 60;
  return { h: hue, s: saturation, l: lightness };
};

export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  const sector = Math.floor(h / 60) % 6;
  const [red, green, blue] = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector] as [number, number, number];
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
};

export type CustomThemeFamily = "light" | "dark";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A lighter or darker version of a color. Highlights take a share of the headroom left
 * above the color and shadows take a share of the color itself, so a near-white board still
 * gets a visible ramp instead of every shade piling up at white.
 */
export const shade = (base: Hsl, amount: number, saturationShift = 0): string => {
  const lightness = amount >= 0 ? base.l + amount * (1 - base.l) : base.l * (1 + amount);
  return toHex(hslToRgb({ h: base.h, s: clamp(base.s + saturationShift), l: clamp(lightness) }));
};
