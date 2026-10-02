# Homarr fork: v1.77.1 → upstream v2.0.0 upgrade

**Date:** 2026-10-02
**Status:** Design — approved in conversation, pending written-spec review
**Branch of record for current work:** `develop` (fork), deployed via `deploy-homarr.sh` as `homarr:develop`

## Goal

Run upstream **Homarr v2.0.0** while preserving all seven of the fork's custom areas,
with the live dashboard's data intact end to end.

### Success criteria

1. The deployed instance reports v2.0.0 and serves the dashboard.
2. All existing boards, sections, items, and custom-widget definitions are present
   after migration — no data loss.
3. All seven custom areas work on v2 (list in §4).
4. `develop` remains untouched and deployable as the rollback path until cutover is
   verified.
5. The database migration is proven against a **copy** of the live SQLite file before
   the live file is ever touched.

### Non-goals

- Upstreaming any fork change.
- Changing v2's own design (e.g. its section/gutter model — see §6.4).
- Restoring MySQL support that v2 removes (§3.4).
- Rewriting or tidying `develop`'s history beyond the work described here.

## 1. Context

Upstream released **v2.0.0 on 2026-10-02** as an explicitly breaking release
(`feat!: release v2`, PR #6545). The fork's integration base is v1.77.1.

Verified figures (via `git diff v1.77.1 v2.0.0`):

| Measure | Value |
|---|---|
| Files changed upstream v1.77.1 → v2.0.0 | 3,287 (+289,491 / −144,480) |
| Fork's own changes since merge-base | 102 files (+13,107 / −89) |
| Files changed by **both** (true conflict surface) | **47** |
| Fork commits ahead of `upstream/main` | 33 on `develop`, 34 on `feat/uptime-depth-probes` |
| Merge commits inside that range | 4 |

The fork's `main` is stale (`82aa90521`, upstream 1.70.0) and is not a work branch.
`develop` is the deploy source; `deploy-homarr.sh` builds `IMAGE=homarr:develop`.

## 2. Approach: grouped rebase onto v2.0.0

Branch from the `v2.0.0` tag and land the fork's custom work as **grouped commits, one
per area** — not as a 33-commit replay.

**Why not a literal per-commit rebase:** the range contains 4 merge commits (a plain
`git rebase` drops them; `--rebase-merges` is fragile across a rewrite this size), and
6 commits touch the same custom-widget files v2 deletes, forcing the same subsystem to
be re-resolved six times without ever seeing its final shape.

**Why not a plain merge:** rejected in favour of linear history with the fork's work
stacked cleanly on v2. The grouped rebase keeps that outcome at ~8 conflict rounds
(7 custom areas plus DB reconciliation) instead of 33.

## 3. Facts that shape the design

### 3.1 The custom-widget subsystem was rewritten
v1 had ~5 files under `packages/api/src/router/custom-widget/`; v2 has **31**. The
fork's ActionButton work modifies files v2 deletes or replaces:

- `packages/api/src/router/custom-widget/display-data.ts`
- `packages/validation/src/custom-widget.ts`
- `packages/widgets/src/custom-api/{component.tsx,jsx-whitelist.ts,jsx-interactive-components.tsx}`
- `packages/api/src/router/widgets/custom-api.ts`

**Consequence:** this area is a *port* onto v2's component model, not a merge. It
cannot be carried over verbatim.

### 3.2 DB migration indices collide
The fork added `packages/db/migrations/sqlite/0042_regular_dragon_lord.sql` (idx 42)
and `packages/db/migrations/postgresql/0010_strange_triathlon.sql` (idx 10). v2
independently added, at the same indices, `0042_custom_widget_v2_tables` (sqlite) and
its own postgres 0010. Naive merging yields two distinct migrations claiming one index
— migrations then skip or apply out of order.

### 3.3 What the fork's new migration actually is
All three of the fork's new migration files create the same table: **`uptime_daily`**
(the uptime-status widget's daily history). So DB reconciliation is scoped to the
uptime-status area, not a standalone concern.

### 3.4 v2 removes MySQL
Verified: v2 deletes 90 MySQL migration files, ships only `sqlite.config.ts` and
`postgresql.config.ts`, and its own docs state *"Existing MySQL installations must
convert to SQLite before upgrading to v2."*

**Consequences:**
- The fork's MySQL migration (`0044_hard_joystick.sql`) and MySQL schema work become
  moot; the fork drops from 3 DB drivers to 2 on v2.
- The MySQL half of the §3.2 collision disappears.
- The deployed instance uses SQLite (`/data/compose/5/homarr/appdata/db/`), so **no
  conversion step is required** for this deployment. This is informational, not
  blocking.
- The memory note "mysql drizzle-kit generate is broken in this fork" becomes obsolete
  after this upgrade and should be retired then.

### 3.5 v2 reshapes board layout by design
`packages/db/migrations/custom/0004_unify_sections_and_gutters.ts` converts legacy
categories and dynamic sections into durable containers and migrates gutters.
**Data is preserved; layout is not byte-identical.** This is upstream's model and is
not avoidable. This is the precise sense in which "dashboard unharmed" can be honoured.

### 3.6 v2 ships a migration-journal test
`packages/db/test/migration-journal.spec.ts` validates the migration journal. This is
the primary automated gate for the DB reconciliation in §6.

## 4. Area sequence

Ordered by dependency. Each is one grouped commit on the integration branch.

| # | Area | Fork commits / files | Notes |
|---|---|---|---|
| 0 | **DB reconciliation** | migration renumber + schema files | First: later areas depend on `uptime_daily` existing |
| 1 | **deploy / docs** | `deploy-homarr.sh`, `AGENTS.md`, `.gitignore` | No code deps |
| 2 | **pwa** | orientation lock (`apps/nextjs/src/app/manifest.ts`) | |
| 3 | **rebrand** | `packages/ui/src/theme.ts`, login form/page, logo components, `metadata.ts`, `layout.tsx`, settings page, `translation/src/lang/en.json` | **Highest conflict count** — collides with v2's rebuilt editor and UI |
| 4 | **glances** | `glances-integration.ts`, `integrations/src/{creator.ts,index.ts}` | |
| 5 | **uptime-status** | widget, daily history, depth probes, system-resources strip | Depends on area 0's `uptime_daily` |
| 6 | **tday-tasks** | widget, integration, cron jobs | |
| 7 | **custom-widget ActionButton** | see §3.1 | **Port, not merge.** May be dropped — see §8 |

## 5. Per-area method

For each area:

1. Bring the change over: `cherry-pick` the relevant commit(s), or `git diff`/`git
   checkout` the specific paths for files v2 did not touch in that area.
2. Resolve conflicts against v2's structure — v2 is authoritative where it rebuilt a
   component.
3. **Verify the area compiles against v2**, separately from resolving conflicts:
   - `pnpm turbo typecheck` for the touched packages
   - `pnpm lint` (oxlint)
   - any area test that exists (e.g. `jsx-action-button.spec.ts` for area 7)
4. Commit as one grouped commit with a message naming the area.

An area is **not** done when conflicts are gone — it is done when it typechecks and its
tests pass against v2. "Clean merge ≠ working v2" is the governing rule.

## 6. Database reconciliation (area 0)

This is the only part that can damage live data.

### 6.1 Method
1. Copy the live DB to scratch: `/data/compose/5/homarr/appdata/db/` → scratch dir.
   Never point v2 at the live file first.
2. Renumber the fork's migrations to follow v2's highest index per driver:
   - SQLite: fork `0042_regular_dragon_lord` → **`0048_*`** (v2's highest is idx 47,
     `0047_add_byte_unit_system`)
   - PostgreSQL: fork `0010_strange_triathlon` → **`0016_*`** (v2's highest is idx 15)
   - MySQL: **N/A** — removed in v2 (§3.4)
   Update each driver's `meta/_journal.json` and snapshot files in the same change.
3. Run v2's migrations against the **copy** and inspect the result.

### 6.2 Verification on the copy
- `packages/db/test/migration-journal.spec.ts` passes.
- Boards, sections, items, and existing custom-widget definitions all survive.
- v2's new tables land correctly: `custom_widget_v2_tables`, layout gutters and role,
  assistant tables, header preferences/branding, byte-unit system.
- `uptime_daily` exists with the expected shape.

### 6.3 Constraints
- Snapshot files for renumbered migrations must be consistent with the renumbering.
  Regenerate where the tooling works; hand-write where it does not.

### 6.4 Accepted, non-negotiable change
v2's `0004_unify_sections_and_gutters` restructures sections. Data is preserved; the
layout model changes. This is upstream's design and is out of scope to alter.

## 7. Cutover and rollback

1. Build the integration branch: `./deploy-homarr.sh --build` (the script takes a
   SQLite backup before replacing the container).
2. Verify the container comes up, the dashboard renders, and all widgets are present.
3. Only then reconcile `develop` with the integration branch (and force-push
   `origin/develop` if that is the chosen model — decided at cutover, not before).

**Rollback:** redeploy the previous `homarr:develop` image. `develop` is untouched
until cutover, so rollback is a redeploy, not a revert. Pre-existing backup branches
(`backup-pre-1.74-03f187ba5`, `backup-pre-1.77-af62d412c`) set the precedent; a
`backup-pre-v2-<sha>` branch off current `develop` is created before any work starts.

## 8. Open question carried into planning

**Area 7 (ActionButton) may be redundant.** v2 ships a built-in custom-JSX component
system. If it already covers the fork's ActionButton use, the correct outcome is to
drop the port rather than re-implement it. This is surfaced to the human at area 7,
not decided silently during design.

## 9. Separate hardening item

Portainer stack 5 (`homarr`) still points at upstream `ghcr.io/homarr-labs/homarr:latest`.
Anyone clicking "Update the stack" there pulls upstream v2 over this fork. This should
be neutralized or repointed as part of this work, independent of the merge.

## 10. Risks

| Risk | Mitigation |
|---|---|
| v2 is day-zero; upstream bugs expected | Integration branch; staged cutover; rollback by redeploy |
| Migration collision corrupts live data | Renumber deliberately; test on a copy; `migration-journal.spec.ts` gate |
| Rebrand conflicts with v2's rebuilt UI | Surface each as a design decision; v2 authoritative where it rebuilt |
| ActionButton port is wasted work | §8 — decide at area 7 before building |
| Force-pushing `develop` rewrites shared history | `develop` untouched until cutover; backup branch first |

## 11. Verification checklist (definition of done)

- [ ] Integration branch off `v2.0.0` exists; backup branch created off `develop`
- [ ] All 7 areas landed as grouped commits, each typechecking against v2
- [ ] `pnpm turbo typecheck` green for the whole repo
- [ ] `pnpm lint` clean
- [ ] `migration-journal.spec.ts` passes
- [ ] Migration proven on a copy of the live SQLite
- [ ] Container builds and comes up via `deploy-homarr.sh`
- [ ] Dashboard renders with all widgets; no data loss
- [ ] Portainer stack 5 hazard neutralized
