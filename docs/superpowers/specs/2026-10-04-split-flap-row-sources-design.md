# Split-flap board: configurable row sources

Date: 2026-10-04
Status: design approved, implementing

## Goal

The split-flap widget prints a fixed board name / date / time. Let each of its three
content rows print whatever the user chooses: a built-in Homarr value, custom text, or a
headline figure read from another widget on the same board.

## Non-goals

- Reading widgets on a different board.
- Reading arbitrary widget kinds. Only the eight kinds below are implemented; an
  unsupported kind resolves to blank rather than something generic.
- More than three content rows.
- Integration-backed sources that are not reachable through a widget already on the board.

## Row model

The board is always seven flap rows: three content rows and four structural blanks (one
above, one below, one between each pair). Only the three content rows are configurable, so
the one-row margin the board was built around cannot be configured away. The default is
board name / date / time — unchanged from before this feature.

Each content row stores four options:

| Option        | Shown when      | Value                                                              |
| ------------- | --------------- | ------------------------------------------------------------------ |
| `rowNSource`  | always          | `blank`, `boardName`, `boardLayout`, `userName`, `date`, `time`, `weekday`, `text`, `widget` |
| `rowNText`    | source = `text` | free text                                                          |
| `rowNWidget`  | source = `widget` | `{ value: itemId, label }` — a widget on this board, filtered to readable kinds |
| `rowNValue`   | source = `widget` | `{ value: metricKey, label }` — what to read from that widget      |

## Built-in sources

Resolved on the client, no query:

- `boardName` — the board the widget sits on (`useOptionalBoard`).
- `boardLayout` — the active layout's name (`useCurrentLayout` plus `board.layouts`).
- `userName` — the signed-in user's name; blank when signed out (`useSession`).
- `date`, `time`, `weekday` — from `useWidgetNow`, formatted with `Intl` and the active
  locale. The date uses a two-digit day and the time a two-digit hour so the row is the
  same width all day: a live clock must not re-flow the grid.
- `text` — literal.
- `blank` — empty.

## Widget-backed sources

| Kind                        | Query                          | Input                                                    | Values                          |
| --------------------------- | ------------------------------ | -------------------------------------------------------- | ------------------------------- |
| `healthMonitoring`          | `widget.healthMonitoring.getSystemHealthStatus` | `integrationIds`                        | cpu %, memory %, load, uptime   |
| `systemResources`           | same as above                  | `integrationIds`                                          | cpu %, memory %, uptime         |
| `weather`                   | `widget.weather.atLocation`    | lat/long from the widget's `location` option              | temperature, feels like, humidity, wind, condition |
| `uptimeStatus`              | `widget.uptimeStatus.getHistory` | `integrationIds` + `includeHost`, `includeOhmzAi`, `includePlex`, `days` | monitors up, monitors down, uptime % |
| `downloads`                 | `widget.downloads.getJobsAndStatuses` | `integrationIds` + `limitPerIntegration`            | downloading, completed, total speed |
| `mediaServer`               | `widget.mediaServer.getCurrentStreams` | `integrationIds` + `showOnlyPlaying`               | streams                         |
| `mediaRequests-requestStats`| `widget.mediaRequests.getStats` | `integrationIds`                                         | pending, approved, available, total |
| `mediaReleases`             | `widget.mediaRelease.getMediaReleases` | `integrationIds`                                  | upcoming                        |

Where a source widget covers several integrations, the row reads the first entry that
returned data.

## Getting a source widget's settings

`useOptionalBoard().items[]` carries each item's `id`, `kind`, raw `options` and
`integrationIds`. Stored options are sparse, so an adapter resolves them against the
widget definition's defaults with `reduceWidgetOptionsWithDefinition(definition, settings,
rawOptions)`; the definition comes from `loadWidgetResources(kind)`, which the widget
manifest memoizes. That is what lets a row inherit the source widget's configured
integration and settings without asking for either again.

## Data flow

1. Each row resolves to a string — built-in sources synchronously, widget sources through
   a per-kind hook.
2. The three strings are interleaved with blanks into five lines and handed to
   `FlapBoard.setGrid`, which centres them in the seven-row board.
3. `setGrid` runs only when a line's text actually changes, so a poll returning the same
   figure does not re-flip the board.

## Failure behaviour

A row whose widget was deleted, is of an unsupported kind, has no integration configured,
is still loading, or whose query errors resolves to blank. Rows are independent: one
failing row never affects the others and never breaks the board.

## Testing

- Unit: built-in source resolution and the row-to-lines interleaving, as pure functions.
- Manual: each adapter rendered in Chrome through the existing esbuild + Playwright
  harness with fixture data, since a canvas board cannot be asserted in jsdom.
- The options panel and its two dynamic dropdowns verified in the running app.

## Colour mode (added 2026-10-04)

The board's `theme` option became a colour mode: `auto` (default), `light`, `dark`, `solari`.
`auto` resolves through `useComputedColorScheme`, so the board follows whichever scheme
Homarr is showing rather than staying dark on a light board.

The values `black` and `white` are kept working because they are what boards stored before
the mode existed, and they meant a fixed board rather than "follow the app"; `resolveFlapTheme`
in `theme-mode.ts` honours them. Anything unrecognised falls back to `auto`.

The dark and light boards were re-coloured onto the app's own warm ramp
(`packages/ui/src/theme.ts`: panel `#211f1d`, canvas `#1a1917`; light `#f7f5f3`, `#f0edea`,
`#e2ddd8`, `#cbc5be`) instead of Vestaboard's cool greys, so a board sits in the dashboard
rather than reading as a panel from another product. Solari amber is left alone — it is a
deliberate aesthetic, not a light or dark variant.

## Text color, independent of the board (added 2026-10-04)

The board color and the color its flaps print in are separate options:

- **Background** (`theme`): auto / light / dark / solari amber — the flaps, housing, frame
  and backdrop, as described above.
- **Text color** (`glyph`): `standard` prints in the board's own ink, `rainbow` gives each
  flap its own color, `custom` uses a ColorInput picker (`glyphColor`).

Rainbow draws from a fixed eight-hue palette rather than a fresh random color per flap, for
two reasons: the atlas caches a rendered face per (theme, ink, character), so unbounded
colors would grow it without limit — measured at 640 entries after two full rolls, about
12 MB, against 74 for standard; and a color that changed per frame would shimmer while a
flap turns. Each cell's color is a spatial hash of its row and column, so it is stable
across a flip and does not form stripes.

The palette is shaded by the board's own lightness (`isLightBoard`, from the relative
luminance of the flap face): darker inks at 36% lightness on a light board, lighter at 72%
on a dark one, so every hue stays readable on either.

`color` is a new shared widget option type (`factory.color`, `WidgetColorInput`), reusing
`BoardColorInput` from `@homarr/ui` for the swatches. It is available to every widget.

### Rainbow is re-dealt on every spin (2026-10-04)

The rainbow is not a fixed pattern: each spin deals the colors again, so no two rolls look
alike. `setGrid` takes a fresh seed (`newRainbowSeed`), the ink for every cell is derived
from `(row, column, seed)` through `Math.imul` mixing, and because flaps that stay put
would otherwise keep the ink they were drawn with, the whole board is repainted to the new
deal before anything turns.

The seed is held for the whole of a roll rather than sampled per frame — sampling per frame
would make the board shimmer as the flaps turn. Measured in the browser: a spin recolors
all 133 cells, the ink is identical at every point during the roll, all eight palette
colors appear, and the atlas stays at ~626 entries, so re-dealing costs no memory.

### Custom light and dark boards (2026-10-04)

`Background` gained `customLight` and `customDark`, each with its own color picker
(`customLightColor`, `customDarkColor`). The user picks one color; the whole board is
derived from it.

A flap board reads as three-dimensional because a shade ramp and the renderer's lighting
ratios work together. Guessing the ramp from one color would flatten it, so
`theme-custom.ts` derives the ramp around the picked color — highlights take a share of the
headroom left above it, shadows take a share of the color itself — and borrows the lighting
ratios (`cast`, `fallDark`, `occl`, `riseLight`, `shadow`) from the built-in board of the
same family. Taking headroom proportionally rather than adding a flat amount is what lets a
near-white pick still produce a visible crease instead of piling every shade up at white.

Ink is derived too: near-neutral (the base hue at 6% saturation) and dark on a light family
or light on a dark one, so a saturated pick does not print saturated text.

Derived boards are cached by family and color, so the same pick returns the same object —
the widget rebuilds its canvas when the theme identity changes, and a fresh object each
render would rebuild it constantly. The `id` includes the color, so the render cache cannot
collide between two custom boards.

### The built-in boards paint from the brand palette (2026-10-04)

The light and dark boards take their colors from the ohmz brand tokens in
`apps/nextjs/src/styles/ohmz-brand.scss` (source of truth: `ai-stack/branding/ohmz.css`),
so a board sits in the dashboard rather than beside it:

| Role             | Dark             | Light               |
| ---------------- | ---------------- | ------------------- |
| flap face        | `--ohmz-panel`   | `--ohmz-l-panel`    |
| lit top half     | `--ohmz-raise`   | `--ohmz-off-white`  |
| shadowed halves  | `--ohmz-canvas`, `--ohmz-code` | `--ohmz-l-line` down |
| frame            | `--ohmz-code`    | `--ohmz-l-line`     |
| frame edge       | `--ohmz-line`    | `--ohmz-off-white`  |
| peeking edges    | `--ohmz-hover`   | `--ohmz-l-line`     |
| ink              | `--ohmz-text`    | `--ohmz-l-text`     |
| backdrop         | panel → code     | `--ohmz-l-canvas` → line |

The brand names no role for the recess behind the flaps or the crease across them, so
those are mixed *down* from the darkest token of the family with `color-math.shade`
rather than set to a neutral black — the recesses keep the brand's warmth.

`brand-palette.spec.ts` pins every one of these mappings, so the boards cannot drift off
the palette without someone deciding to.

The custom board pickers now start at the brand's own surfaces (`#f0edea` light,
`#211f1d` dark), so "your own board" begins as the brand board and is tinted from there.
