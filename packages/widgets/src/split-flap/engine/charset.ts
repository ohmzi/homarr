// Ported from MMacLaine/split-flap, src/charset.js — see UPSTREAM-LICENSE.txt in this
// directory for the MIT notice. Trimmed to what the widget needs: the Vestaboard import
// helpers, the composer input mapping and the "faint flap" letter-clock feature are gone.
//
// What the flaps carry, in drum order. A flap only ever moves forward through this
// string, wrapping at the end, so the order IS the animation: Z to B goes the long way.
//
// Uppercase only, like the hardware. Nordic letters sit on the drum (not folded into
// lookalikes: Ø is not Ö to a Norwegian reader). The color chips are stored as
// lowercase keys so they can never collide with a printed letter.

export const CHIPS: Record<string, string> = {
  r: "#D5352B",
  o: "#EE7D22",
  y: "#F2BE2E",
  g: "#2C9A5A",
  b: "#2B6FC4",
  v: "#7A4DB2",
  w: "#EFECE5",
  k: "#141415",
};

// f = "filled": a chip in the theme's glyph color
export const CHIP_KEYS = ["r", "o", "y", "g", "b", "v", "w", "k", "f"] as const;
export type ChipKey = (typeof CHIP_KEYS)[number];

// Half flaps: only the top or the bottom half colored, so a line chart has two heights
// per row. They are private-use characters, one UTF-16 unit each like every other flap,
// that no keyboard types, and they sit after the chips so the drum's order for
// everything before them is unchanged.
export const HALVES: Record<string, readonly [ChipKey, "top" | "bottom"]> = {
  "": ["g", "top"],
  "": ["g", "bottom"],
  "": ["r", "top"],
  "": ["r", "bottom"],
  "": ["f", "top"],
  "": ["f", "bottom"],
};

export const isHalf = (ch: unknown): boolean => typeof ch === "string" && Object.hasOwn(HALVES, ch);

export const DRUM =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖÆØÜÉ0123456789.,:;!?'\"-+/&%#@()=$°♥" +
  CHIP_KEYS.join("") +
  Object.keys(HALVES).join("");

const DRUM_IDX = new Map<string, number>([...DRUM].map((character, index) => [character, index]));

// Characters that are not on the drum but have an honest stand-in.
const FOLD_MAP: Record<string, string> = {
  È: "E",
  Ê: "E",
  Ë: "E",
  Á: "A",
  À: "A",
  Â: "A",
  Í: "I",
  Ì: "I",
  Ó: "O",
  Ò: "O",
  Ô: "O",
  Ú: "U",
  Ù: "U",
  Ñ: "N",
  Ç: "C",
  ß: "SS",
  "❤": "♥",
  "♡": "♥", // ❤ and ♡: a phone keyboard's hearts
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "´": "'",
  "`": "'",
  // Latin letters that Unicode does not split into a letter and a mark. Hungarian's
  // long umlauts read as the umlauts the drum has.
  Ł: "L",
  Đ: "D",
  Ħ: "H",
  Œ: "OE",
  Þ: "TH",
  Ð: "D",
  Ŀ: "L",
  Ŧ: "T",
  Ŋ: "NG",
  Ə: "E",
  Ő: "Ö",
  Ű: "Ü",
};

// Greek and Cyrillic, letter by letter, the way departure boards in Athens and Kyiv
// print them for visitors. Hard and soft signs print nothing.
const TRANSLIT: Record<string, string> = {
  Α: "A",
  Β: "V",
  Γ: "G",
  Δ: "D",
  Ε: "E",
  Ζ: "Z",
  Η: "I",
  Θ: "TH",
  Ι: "I",
  Κ: "K",
  Λ: "L",
  Μ: "M",
  Ν: "N",
  Ξ: "X",
  Ο: "O",
  Π: "P",
  Ρ: "R",
  Σ: "S",
  Τ: "T",
  Υ: "Y",
  Φ: "F",
  Χ: "CH",
  Ψ: "PS",
  Ω: "O",
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Е: "E",
  Ё: "E",
  Ж: "ZH",
  З: "Z",
  И: "I",
  Й: "Y",
  К: "K",
  Л: "L",
  М: "M",
  Н: "N",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  У: "U",
  Ф: "F",
  Х: "KH",
  Ц: "TS",
  Ч: "CH",
  Ш: "SH",
  Щ: "SHCH",
  Ъ: "",
  Ы: "Y",
  Ь: "",
  Э: "E",
  Ю: "YU",
  Я: "YA",
  І: "I",
  Ї: "YI",
  Є: "YE",
  Ґ: "G",
  Ў: "U",
  Ђ: "DJ",
  Ј: "J",
  Љ: "LJ",
  Њ: "NJ",
  Ћ: "C",
  Џ: "DZ",
  Ѓ: "GJ",
  Ќ: "KJ",
  Ѕ: "DZ",
};

// A color flap, whole or half: never typed, never read aloud.
export const isChip = (ch: unknown): boolean =>
  ch === "f" || (typeof ch === "string" && (Object.hasOwn(CHIPS, ch) || isHalf(ch)));

const at = (map: Record<string, string>, key: string): string | undefined =>
  Object.hasOwn(map, key) ? map[key] : undefined;

// One character to what the flaps print for it: itself, a stand-in of one or more
// letters, '' for a letter that prints nothing, or null when there is no stand-in.
// Accents the drum has no flap for are dropped, and Å Ä Ö Ü É keep their own flaps
// because they are looked up first.
const fold = (ch: unknown): string | null => {
  if (isHalf(ch)) return null; // drawn by the chart only, never from text
  const upper = String(ch).toUpperCase();
  if (upper.length === 1 && DRUM_IDX.has(upper)) return upper;
  const mapped = at(FOLD_MAP, upper) ?? (typeof ch === "string" ? at(FOLD_MAP, ch) : undefined) ?? at(TRANSLIT, upper);
  if (mapped != null) return mapped;
  const bare = upper.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (bare && bare !== upper) {
    const parts = [...bare].map((part) => fold(part));
    return parts.includes(null) ? null : parts.join("");
  }
  return null;
};

// Greek writes the sound u as two letters, and letter by letter it would print OY.
const preFold = (value: string): string => String(value || "").replace(/[οΟ][υύΥΎ]/g, "OU");

// A stored cell to a drum entry. Chips pass through; everything else is cleaned.
export const cellChar = (ch: unknown): string => {
  if (isChip(ch)) return ch as string;
  const folded = fold(ch);
  return folded != null && folded.length === 1 ? folded : " ";
};

// Free text to flaps, expanding multi-letter stand-ins (ß to SS, Ж to ZH). Chips are not
// reachable from free text on purpose: lowercase letters must print as capitals.
export const textToCells = (value: string): string[] => {
  const out: string[] = [];
  for (const ch of preFold(value)) {
    if (ch === "️") continue; // emoji presentation selector, sent after ❤ by phones
    if (ch === "\n" || ch === "\t") {
      out.push(" ");
      continue;
    }
    const folded = fold(ch);
    out.push(...(folded == null ? " " : folded));
  }
  return out;
};

// The same, as a string: what a name from a data source prints, so lines are measured
// and cut at the length they will have on the board.
export const boardText = (value: string): string => textToCells(value).join("");

// The forward path a flap takes from one entry to another, ending on the target.
// max caps the visible steps (the flap starts nearer the target); Infinity is the
// full authentic rotation.
export const drumPath = (from: string, to: string, max = Number.POSITIVE_INFINITY): string[] => {
  const size = DRUM.length;
  const fromIndex = DRUM_IDX.get(from) ?? 0;
  const toIndex = DRUM_IDX.get(to);
  if (toIndex === undefined) return [];
  const steps = (((toIndex - fromIndex) % size) + size) % size || size;
  const count = Math.min(steps, max);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(DRUM[(((toIndex - i) % size) + size) % size] as string);
  }
  return out;
};
