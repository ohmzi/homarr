# Split-flap board: maintainer system readout

Date: 2026-10-04
Status: design approved, spec for review
Branch: `feat/split-flap-maintainer` (worktree off `feat/v2-integration`)

## Goal

The split-flap board's three content rows become a live readout of the homelab maintainer
service (`homelab-maint-www`, `http://127.0.0.1:9111`):

1. `GOOD MORNING - OMAR` — a time-of-day greeting and the signed-in user's name.
2. `<glyph> HEALTHY` — the maintainer's overall level, with a status glyph on the drum:
   a green heart (healthy), an orange pumpkin (warning) or a red alert-light (critical).
3. `COMFYUI` — the application using the most memory right now.

The board keeps its current look: seven flap rows, three of them configurable.

## Non-goals

- Routes other than `/overview` and `/guard`, and fields other than those named below.
- Fetching anything outside the loopback scope. The source is the same loopback policy
  Custom JSX widgets already use; there is no general "fetch any URL" widget source. The URL
  is configurable, but one that does not resolve to loopback is refused at run time and the
  row prints `NO DATA`.
- Per-row text colours. Only the three status glyphs carry a colour of their own.
- More than three content rows, or changing the existing row sources.

## Row model (unchanged)

Each content row already stores `rowNSource`, `rowNText`, `rowNWidget` and `rowNValue`
(`packages/widgets/src/split-flap/index.ts`). This adds one source value, `maintainer`,
with `rowNValue` selecting which of the three readouts the row prints.

| `rowNValue` | Answered by | Text |
| --- | --- | --- |
| `greeting` | the client, no query | `GOOD MORNING - OMAR` |
| `health` | the maintainer procedure | `<glyph> HEALTHY` |
| `heaviest` | the maintainer procedure | `COMFYUI` |

## Data

| Row | Route | Field | Shown |
| --- | --- | --- | --- |
| health | `/overview` | `level` (`ok`/`warn`/`crit`) | green heart `HEALTHY`, orange pumpkin `WARNING`, red alert-light `CRITICAL` |
| heaviest | `/guard` | `top[0].n`, `top[0].h` | the name, uppercased; the size appended when the two fit the board width (`COMFYUI 8.5G`) |

`/guard`'s `top` is the largest memory consumers (`spike_sampler.largest`), so "heaviest"
means "holding the most memory right now" in this spec. The row prints the name alone when
`name size` would exceed the board's maximum width (40 flaps).

Anything else — an unknown level, a stale payload, or a failed fetch — prints `NO DATA`
with no glyph. A row that cannot resolve never breaks the board.

## Status glyphs (`packages/widgets/src/split-flap/engine`)

Three new single UTF-16-unit drum characters, appended after the colour chips so the drum
order for everything before them is unchanged — the same way `HALVES` was added. A
`STATUS_GLYPHS` map in `charset.ts` names each one: heart + green, pumpkin + orange,
alert-light + red.

`paintFace` gains one branch: a status glyph paints the face normally and then draws its
shape as a vector in its own fixed colour. This is the technique the renderer already uses
for `♥` (drawn rather than typeset, because a fallback font would draw an emoji), so no new
rendering approach is introduced. The atlas caches a face per `(theme, ink, character)`;
because these glyphs have a fixed colour the cache cost is the same as a chip's.

`charset` exposes the characters through the same helpers as the chips, so `textToCells`,
the drum path and the atlas treat them like any other flap — each glyph counts as one
column.

## Server procedure

One new procedure on the widget router, `widget.splitFlap.getMaintainer`
(`packages/api/src/router/widgets/`), protected like the rest of the router:

- **input** `{ url: string }` — the base URL, default `http://127.0.0.1:9111`
- **output** `{ level: "ok" | "warn" | "crit" | null, topName: string | null, topSize: string | null }`
- fetches `GET {url}/overview` and `GET {url}/guard` in parallel
- reuses `executeCustomWidgetRequest` and `resolveAndValidateHost` from
  `@homarr/custom-widgets/server` with `networkScope: "loopback"`, which is the SSRF and
  address policy Custom JSX widgets already enforce — no new network code and no new
  address surface
- carries a short `cacheSeconds` (~10 s) so several boards polling at once cost one fetch,
  not one each
- never throws on upstream failure: it returns the fields as `null` so a maintainer outage
  shows `NO DATA` rather than a broken tile

## Client

- `greeting` resolves through `resolveClientSource` in `sources.ts` — it needs only the
  clock the widget already tracks (`useWidgetNow`) and the signed-in user (`useSession`).
  Bands: before 12:00 `GOOD MORNING`, before 18:00 `GOOD AFTERNOON`, otherwise
  `GOOD EVENING`; the row is `<greeting> - <NAME>`.
- `health` and `heaviest` share one `clientApi.widget.splitFlap.getMaintainer` query in a
  new adapter beside the existing `widget-value.tsx` adapters, so the board costs one
  request. Both report their text up through `onValue`, as every adapter does.
- Rows stay independent: one failing row leaves the others untouched.

## Options

- `sourceOptions` gains `{ value: "maintainer" }`.
- `rowNValue` becomes visible when the source is `widget` **or** `maintainer`. Its
  `useOptions` already sees the row's other options, so it returns the three maintainer
  metrics when the source is `maintainer` and the widget's metrics otherwise.
- New option `maintainerUrl` (`factory.text`, default `http://127.0.0.1:9111`), shown when
  any row uses the maintainer source.

## Translations

`packages/translation/src/lang/en.json` gains the source and metric labels. The words the
board prints (`HEALTHY`, `WARNING`, `CRITICAL`, `NO DATA`) stay literal English, following
the existing precedent in `widget-value.tsx`: the drum only carries Latin capitals, so a
translated word would print blank on a non-Latin locale.

## Testing

- **Unit** (`sources.spec.ts` and friends): the greeting bands, the level-to-glyph-and-word
  mapping, the payload-to-row-text mapping, and a charset round-trip proving each new glyph
  is one column.
- **Engine**: the three glyphs through the existing esbuild + Playwright harness, one
  screenshot per status on a light and a dark board, since a canvas board cannot be
  asserted in jsdom.
- **Manual**: one board with the three rows configured; confirm the board re-flips only
  when a line's text actually changes.

## Rollout

The widget lives on `feat/v2-integration`, so shipping needs a rebuild and
`./deploy-homarr.sh --build`. No database change: the widget is placed with existing
board-item options, so nothing here touches `custom_widget_v2_definition` or
`custom_widget_v2_secret`.
