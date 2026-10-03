# Homarr fork → upstream v2.0.0 Upgradation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase this Homarr fork's custom work onto upstream v2.0.0 as grouped commits, preserving all seven custom areas and the live dashboard's data.

**Architecture:** Branch from the `v2.0.0` tag and land each custom area as one focused commit — a *grouped rebase*, not a 33-commit replay and not a merge. v2 is authoritative wherever it rebuilt a component; the fork's work is re-expressed on v2's structures. Database migrations are renumbered deliberately and proven against a copy of the live SQLite before the live file is touched.

**Tech Stack:** pnpm workspaces + Turborepo, TypeScript, Next.js, tRPC, Drizzle ORM (SQLite + PostgreSQL), Mantine, Vitest, oxlint/oxfmt.

**Spec:** `docs/superpowers/specs/2026-10-02-homarr-v2-upgrade-design.md`

## Global Constraints

- **Target base:** the `v2.0.0` tag, never `upstream/main` (which moves).
- **Integration branch:** `feat/v2-integration`. `develop` stays untouched and deployed until cutover.
- **Never point v2 at the live DB first.** `/data/compose/5/homarr/appdata/db/` is copied to scratch; migrations are proven there.
- **v2 drops MySQL.** No MySQL config, migrations, or driver work is carried forward. `packages/db/schema/mysql.ts` is deleted by v2.
- **v2 migration high-water marks:** SQLite idx **47** (`0047_add_byte_unit_system`), PostgreSQL idx **15** (`0015_add_byte_unit_system`).
- **v2 reshapes board layout by design** (`0004_unify_sections_and_gutters`). Data preserved; layout not byte-identical. Not to be altered.
- **Verification commands** (run from repo root):
  - `pnpm turbo typecheck` — full typecheck
  - `pnpm lint` — oxlint via turbo
  - `pnpm test` — vitest, excludes e2e
  - `pnpm db:migration:sqlite:run` / `pnpm db:migration:postgresql:run` — migration runners
- **Deployment:** `./deploy-homarr.sh --build` only. Never hand-write `docker run` for homarr.
- **Commit messages** end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

Five failure modes this plan's tests do **not** fully cover. Each is pinned to the task that owns the code.

1. **Already-migrated live SQLite.** The live DB has the *fork's* `0042_regular_dragon_lord` recorded in its journal. After renumbering, v2 must not re-run it or skip v2's own 0042. → pinned in **Task 4**.
2. **Boards with dynamic sections / side rails.** v2's container migration handles legacy categories and rails; layouts that used the fork's `0044`-era gutters may land differently. → pinned in **Task 4**.
3. **Custom widgets authored against the v1 API.** After v2, widgets whose JSX used v1-only components must fail loudly, not render blank. → pinned in **Task 11**.
4. **Partially-applied cutover.** If the container starts but migration fails midway, the SQLite backup must be restorable without a second guess. → pinned in **Task 14**.
5. **Force-push after cutover.** `origin/develop` history rewrite must not strand another clone. → pinned in **Task 14**.

---

## File Structure

Work happens on `feat/v2-integration` (cut from `v2.0.0`). Files below are grouped by the area that owns them.

| Area | Files brought from `develop` | v2 status |
|---|---|---|
| DB reconciliation | `packages/db/migrations/sqlite/0042_regular_dragon_lord.sql` → `0048_*`, `packages/db/migrations/postgresql/0010_strange_triathlon.sql` → `0016_*`, `packages/db/schema/{index,sqlite,postgresql}.ts`, journal + snapshots | collision at idx 42 / 10 |
| deploy/docs | `deploy-homarr.sh`, `AGENTS.md`, `.gitignore`, `apps/docs/docs/advanced/environment-variables/index.mdx` | both changed |
| pwa | `apps/nextjs/src/app/manifest.ts` | both changed |
| rebrand | `packages/ui/src/theme.ts`, `apps/nextjs/src/app/[locale]/auth/login/{_login-form.tsx,page.tsx}`, `apps/nextjs/src/{metadata.ts}`, `apps/nextjs/src/app/[locale]/{layout.tsx,manage/settings/page.tsx}`, `apps/nextjs/src/components/layout/logo/{board-logo,homarr-logo,logo}.tsx`, `packages/translation/src/lang/en.json` | both changed |
| glances | `packages/integrations/src/glances/glances-integration.ts`, `packages/integrations/src/{creator.ts,index.ts}`, `packages/definitions/src/{integration.ts,docs/integration-doc-slugs.ts}`, `apps/docs/docs/integrations/glances/index.mdx` | both changed |
| uptime-status | `packages/widgets/src/system-resources/{component.tsx,index.ts}`, `packages/integrations/src/plex/plex-integration.ts`, `packages/api/src/router/widgets/{index.ts,uptime-status.ts}`, `packages/widgets/src/{catalog.ts,index.tsx,manifest.ts,refetch-intervals.ts}` | both changed |
| tday-tasks | `packages/widgets/src/**tday**`, `packages/integrations/src/**tday**`, `packages/cron-jobs/**`, `apps/nextjs/src/app/[locale]/manage/tools/tasks/_components/tasks-table.tsx`, `apps/docs/docs/management/tasks/index.mdx` | mostly fork-new |
| custom-widget | `packages/api/src/router/custom-widget/display-data.ts`, `packages/validation/src/custom-widget.ts`, `packages/widgets/src/custom-api/{component.tsx,jsx-whitelist.ts,jsx-interactive-components.tsx}`, `packages/api/src/router/widgets/custom-api.ts` | **rewritten/deleted by v2 — port, not merge** |

---

### Task 1: Branches, backups, and area mapping

**Files:**
- Create: branch `backup-pre-v2-<sha>`, branch `feat/v2-integration`
- Modify: none

**Interfaces:**
- Consumes: nothing.
- Produces: `feat/v2-integration` (HEAD at `v2.0.0`), a backup ref, and `/tmp/v2-areas.txt` listing fork commits per area for later tasks.

- [ ] **Step 1: Confirm a clean-enough starting point**

Run:
```bash
cd /home/ohmz/StudioProjects/homarr
git status --short
git rev-parse --abbrev-ref HEAD
```
Expected: on `feat/uptime-depth-probes` with exactly two modified files
(`packages/api/src/router/widgets/uptime-status.ts`,
`packages/integrations/src/glances/glances-integration.ts`). Those two are committed in Step 2 — do not discard them.

- [ ] **Step 2: Preserve the in-flight work**

```bash
git add packages/api/src/router/widgets/uptime-status.ts \
        packages/integrations/src/glances/glances-integration.ts
git commit -m "feat(uptime-status): finish depth probes and glances rate handling

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 3: Create the backup ref**

```bash
git branch backup-pre-v2-$(git rev-parse --short develop) develop
git log --oneline -1 backup-pre-v2-*
```
Expected: the backup ref points at `e1702da79 feat(uptime-status): daily uptime history widget…`.

- [ ] **Step 4: Cut the integration branch from the v2.0.0 tag**

```bash
git checkout -b feat/v2-integration v2.0.0
git log --oneline -1
```
Expected: `d80a53f52 chore(release): 2.0.0 [skip ci]`.

- [ ] **Step 5: Record the area→commit mapping**

```bash
cat > /tmp/v2-areas.txt <<'EOF'
uptime-status: e1702da79 c650e96f5 f92760cb1
db:            ffd892d6a
custom-widget: 76538c828 0a13af9c2 88ef3c303 091c5aa3d 3de93e160
pwa:           e01dd8ebb
glances:       984668e63 a35d5784b
deploy-docs:   dc2d3b5aa
rebrand:       880095548 167c4f42d 0954f7f39 6c0f81220 bd495c624 41e2bdc3f
               c8787e1a9 23eb1374b 60406069e 6f3911c76 af62d412c 015623b00
tday-tasks:    e3f8b7609 d02dceae7 a9240040f 69099116a 03f187ba5
EOF
cat /tmp/v2-areas.txt
```
Expected: the file prints with all ten areas listed. `ffd892d6a` (mysql snapshot repair) is
recorded for completeness but is **not** carried forward — MySQL is gone in v2.

- [ ] **Step 6: Commit nothing; verify state**

```bash
git status --short && git rev-parse --abbrev-ref HEAD
```
Expected: clean tree on `feat/v2-integration`. No commit in this task — the branch creation *is* the checkpoint.

---

### Task 2: DB reconciliation — renumber the fork's migrations

**Files:**
- Create: `packages/db/migrations/sqlite/0048_uptime_daily.sql`, `packages/db/migrations/sqlite/meta/0048_snapshot.json`
- Create: `packages/db/migrations/postgresql/0016_uptime_daily.sql`, `packages/db/migrations/postgresql/meta/0016_snapshot.json`
- Modify: `packages/db/migrations/sqlite/meta/_journal.json`, `packages/db/migrations/postgresql/meta/_journal.json`
- Modify: `packages/db/schema/{index.ts,sqlite.ts,postgresql.ts}`
- Delete: nothing in this task (v2 already deleted `schema/mysql.ts`)
- Test: `packages/db/test/migration-journal.spec.ts`

**Interfaces:**
- Consumes: `develop`'s `packages/db/migrations/sqlite/0042_regular_dragon_lord.sql` and `packages/db/migrations/postgresql/0010_strange_triathlon.sql` (extracted from commit `e1702da79`).
- Produces: a `uptime_daily` table (`source_id`, `monitor_id`, `monitor_name`, `date`, `up_seconds`, `down_seconds`, `last_beat_at`; PK `(source_id, monitor_id, date)`; index `uptime_daily__date_idx`) declared at migration idx **48** (SQLite) / **16** (PostgreSQL), which Task 9's widget depends on.

- [ ] **Step 1: Write the failing test**

The table must exist after migration. Add to `packages/db/test/schema.spec.ts`:

```ts
import { uptimeDaily } from "../schema";

it("exposes the uptime_daily table added by the fork", () => {
  expect(uptimeDaily).toBeDefined();
  expect(Object.keys(uptimeDaily)).toEqual(
    expect.arrayContaining(["sourceId", "monitorId", "monitorName", "date", "upSeconds", "downSeconds"]),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/test/schema.spec.ts`
Expected: FAIL — `uptimeDaily` is not exported from `../schema`.

- [ ] **Step 3: Extract the fork's migrations at their new numbers**

```bash
git show develop:packages/db/migrations/sqlite/0042_regular_dragon_lord.sql \
  > packages/db/migrations/sqlite/0048_uptime_daily.sql
git show develop:packages/db/migrations/postgresql/0010_strange_triathlon.sql \
  > packages/db/migrations/postgresql/0016_uptime_daily.sql
```
Then append journal entries. In `packages/db/migrations/sqlite/meta/_journal.json`, add after idx 47:

```json
{ "idx": 48, "version": "6", "when": 1784305283910, "tag": "0048_uptime_daily", "breakpoints": true }
```

And in `packages/db/migrations/postgresql/meta/_journal.json`, after idx 15:

```json
{ "idx": 16, "version": "6", "when": 1784305283910, "tag": "0016_uptime_daily", "breakpoints": true }
```

- [ ] **Step 4: Regenerate the snapshots**

```bash
pnpm db:migration:sqlite:generate
pnpm db:migration:postgresql:generate
git status --short packages/db/migrations
```
Expected: `0048_snapshot.json` and `0016_snapshot.json` appear; no spurious extra migrations are generated. If generate produces a *new* migration, the schema declaration is missing a step — fix Step 5 first, then re-run.

- [ ] **Step 5: Declare the table in the schema**

Add an `uptimeDaily` table to `packages/db/schema/sqlite.ts` and `packages/db/schema/postgresql.ts` matching the extracted SQL, and export it from `packages/db/schema/index.ts`.

- [ ] **Step 6: Run the tests to verify they pass**

Run:
```bash
pnpm vitest run packages/db/test/schema.spec.ts packages/db/test/migration-journal.spec.ts
```
Expected: PASS. `migration-journal.spec.ts` is v2's own guard — a green run means the journal is coherent at 48 / 16.

- [ ] **Step 7: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add uptime_daily at renumbered migration indices

The fork's uptime_daily migration collided with v2's own sqlite 0042 and
postgresql 0010. Renumber to 0048 and 0016, following v2's high-water marks.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Prove the migration against a copy of the live database

**Files:**
- Create: `/tmp/homarr-db-copy/db.sqlite`
- Modify: none

**Interfaces:**
- Consumes: the renumbered migrations from Task 2.
- Produces: a verified-clean migrated copy, and the go/no-go that Task 14's cutover depends on.

- [ ] **Step 1: Copy the live database**

```bash
mkdir -p /tmp/homarr-db-copy
cp /data/compose/5/homarr/appdata/db/db.sqlite /tmp/homarr-db-copy/
ls -la /tmp/homarr-db-copy/
```
Expected: the file is present and non-zero. If the path differs, locate it under the homarr appdata dir before continuing — do not proceed on a guess.

- [ ] **Step 2: Record the pre-migration state**

```bash
python3 - <<'EOF'
import sqlite3
c = sqlite3.connect("/tmp/homarr-db-copy/db.sqlite")
for t in ("boards", "sections", "items", "custom_widgets"):
    try: print(t, c.execute(f"select count(*) from {t}").fetchone()[0])
    except Exception as e: print(t, "ERR", e)
print("last migrations:", c.execute(
    "select hash from __drizzle_migrations order by created_at desc limit 3").fetchall())
EOF
```
Expected: non-zero counts for boards/sections/items, and the fork's `0042` hash present in the migration table. **Record these numbers — Step 4 compares against them.**

- [ ] **Step 3: Run v2's migrations against the copy**

```bash
DB_URL=/tmp/homarr-db-copy/db.sqlite pnpm db:migration:sqlite:run
```
Expected: v2's migrations apply, including `0042_custom_widget_v2_tables`, `0043_add_layout_gutters`,
`0044_add_layout_role`, `0047_add_byte_unit_system`, then `0048_uptime_daily`.

- [ ] **Step 4: Verify no data loss**

```bash
python3 - <<'EOF'
import sqlite3
c = sqlite3.connect("/tmp/homarr-db-copy/db.sqlite")
for t in ("boards", "sections", "items", "custom_widgets", "uptime_daily"):
    try: print(t, c.execute(f"select count(*) from {t}").fetchone()[0])
    except Exception as e: print(t, "ERR", e)
EOF
```
Expected: board/section/item counts **equal or greater** than Step 2 (v2's container migration may add rows, never fewer). `uptime_daily` exists. `custom_widgets` content preserved.

- [ ] **Step 5: Verify the layout model explicitly**

Open `/tmp/homarr-db-copy/db.sqlite` in a SQLite browser and confirm each board's sections render as containers with gutters. This is the human check for **Review Focus #2** — automated counts cannot tell you whether a rail-shaped section landed sensibly.
Expected: sections present and placed; note any board that looks wrong before proceeding.

- [ ] **Step 6: Commit nothing; record the go/no-go**

If counts match and layouts look right, Task 14 is cleared to cut over. If not, stop and report — the migration is the one step that can lose the dashboard.

---

### Task 4: Port the deploy/docs area

**Files:**
- Modify: `deploy-homarr.sh`, `AGENTS.md`, `.gitignore`, `apps/docs/docs/advanced/environment-variables/index.mdx`

**Interfaces:**
- Consumes: nothing.
- Produces: the deploy script Task 14 invokes.

- [ ] **Step 1: Bring the area's files over**

```bash
git checkout develop -- deploy-homarr.sh AGENTS.md .gitignore \
  apps/docs/docs/advanced/environment-variables/index.mdx
git status --short
```
Expected: four files staged as modified; no conflicts (checkout takes `develop`'s version wholesale).

- [ ] **Step 2: Reconcile the env-vars doc with v2's driver set**

v2 documents only `better-sqlite3` / `node-postgres`. Edit
`apps/docs/docs/advanced/environment-variables/index.mdx` to drop MySQL rows and keep the fork's
own additions, if any. Verify:

```bash
grep -in "mysql" apps/docs/docs/advanced/environment-variables/index.mdx || echo "no mysql refs (correct for v2)"
```

- [ ] **Step 3: Verify the deploy script is intact and hardened**

```bash
bash -n deploy-homarr.sh && grep -c "no-new-privileges" deploy-homarr.sh
```
Expected: syntax OK, and at least one `no-new-privileges` occurrence.

- [ ] **Step 4: Commit**

```bash
git add deploy-homarr.sh AGENTS.md .gitignore apps/docs/docs/advanced/environment-variables/index.mdx
git commit -m "chore(deploy): carry fork deploy hardening and docs onto v2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Port the pwa area

**Files:**
- Modify: `apps/nextjs/src/app/manifest.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Bring the file over**

```bash
git checkout develop -- apps/nextjs/src/app/manifest.ts
git diff --stat apps/nextjs/src/app/manifest.ts
```
Expected: a diff showing the orientation lock. If `git checkout` refuses, the file has a v2 conflict — read both sides and keep v2's structure while re-applying `orientation: "portrait"`.

- [ ] **Step 2: Verify the manifest still satisfies v2's shape**

Run: `pnpm turbo typecheck --filter=nextjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/nextjs/src/app/manifest.ts
git commit -m "feat(pwa): lock installed app orientation to portrait on v2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Port the rebrand area

**Files:**
- Modify: `packages/ui/src/theme.ts`, `apps/nextjs/src/app/[locale]/auth/login/_login-form.tsx`, `apps/nextjs/src/app/[locale]/auth/login/page.tsx`, `apps/nextjs/src/metadata.ts`, `apps/nextjs/src/app/[locale]/layout.tsx`, `apps/nextjs/src/app/[locale]/manage/settings/page.tsx`, `apps/nextjs/src/components/layout/logo/{board-logo,homarr-logo,logo}.tsx`, `packages/translation/src/lang/en.json`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on. **Highest-conflict area — expect design decisions.**

- [ ] **Step 1: Attempt the wholesale checkout**

```bash
git checkout develop -- packages/ui/src/theme.ts \
  apps/nextjs/src/app/[locale]/auth/login/_login-form.tsx \
  apps/nextjs/src/app/[locale]/auth/login/page.tsx \
  apps/nextjs/src/metadata.ts \
  apps/nextjs/src/app/[locale]/layout.tsx \
  apps/nextjs/src/app/[locale]/manage/settings/page.tsx \
  apps/nextjs/src/components/layout/logo/board-logo.tsx \
  apps/nextjs/src/components/layout/logo/homarr-logo.tsx \
  apps/nextjs/src/components/layout/logo/logo.tsx \
  packages/translation/src/lang/en.json
pnpm turbo typecheck --filter=nextjs --filter=@homarr/ui
```
Expected: this is the trial. Some files typecheck; those referencing v2-removed props or components fail.

- [ ] **Step 2: Triage failures by cause**

```bash
pnpm turbo typecheck --filter=nextjs --filter=@homarr/ui 2>&1 | grep -E "error TS" | sort | uniq -c | sort -rn
```
For each failure, classify: (a) mechanical — v2 renamed a prop; fix directly, or (b) design — v2 rebuilt the component, so the fork's styling no longer applies.

- [ ] **Step 3: Surface design decisions to the human**

For every (b) failure, present the choice: adopt v2's component as-is, or re-apply the Ohmz styling to v2's new structure. **Do not decide silently** — this is the rebrand's visual identity, and the spec (§10) marks it as a design decision. Wait for answers before Step 4.

- [ ] **Step 4: Apply resolutions**

Resolve each file per the human's answers. Where the fork's theme tokens survive v2's theme
structure, keep them; where v2 replaced a primitive, port the token values onto v2's shape.

- [ ] **Step 5: Verify**

Run:
```bash
pnpm turbo typecheck --filter=nextjs --filter=@homarr/ui
pnpm lint --filter=@homarr/ui --filter=nextjs
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/theme.ts apps/nextjs/src packages/translation/src/lang/en.json
git commit -m "feat(brand): carry the Ohmz HomeLab rebrand onto v2's UI

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Port the glances area

**Files:**
- Modify: `packages/integrations/src/glances/glances-integration.ts`, `packages/integrations/src/{creator.ts,index.ts}`, `packages/definitions/src/{integration.ts,docs/integration-doc-slugs.ts}`, `apps/docs/docs/integrations/glances/index.mdx`

**Interfaces:**
- Consumes: nothing.
- Produces: `GlancesIntegration` registered in v2's integration registry, consumed by Task 8's widget-registry work.

- [ ] **Step 1: Bring the area's files over**

```bash
git checkout develop -- packages/integrations/src/glances/glances-integration.ts \
  packages/integrations/src/creator.ts packages/integrations/src/index.ts \
  packages/definitions/src/integration.ts \
  packages/definitions/src/docs/integration-doc-slugs.ts \
  apps/docs/docs/integrations/glances/index.mdx
```

- [ ] **Step 2: Reconcile the integration registry with v2's shape**

```bash
pnpm turbo typecheck --filter=@homarr/integrations --filter=@homarr/definitions
```
Expected: failures only where v2 changed the registry contract. Fix by moving the glances entry into v2's
structure — do not add a parallel registration path.

- [ ] **Step 3: Verify**

Run:
```bash
pnpm turbo typecheck --filter=@homarr/integrations --filter=@homarr/definitions --filter=nextjs
pnpm vitest run packages/integrations
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/integrations packages/definitions apps/docs/docs/integrations/glances
git commit -m "feat(glances): carry mountpoint labels and rate tolerance onto v2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Port the uptime-status area

**Files:**
- Modify: `packages/api/src/router/widgets/{index.ts,uptime-status.ts}`, `packages/integrations/src/plex/plex-integration.ts`, `packages/widgets/src/{catalog.ts,index.tsx,manifest.ts,refetch-intervals.ts}`, `packages/widgets/src/system-resources/{component.tsx,index.ts}`, `packages/definitions/src/{widget.ts,widget-integration-map.ts,docs/widget-doc-slugs.ts}`

**Interfaces:**
- Consumes: the `uptime_daily` table from Task 2.
- Produces: the uptime-status widget and the system-resources uptime strip, registered in v2's widget catalog.

- [ ] **Step 1: Bring the area's files over**

```bash
git checkout develop -- packages/api/src/router/widgets/index.ts \
  packages/api/src/router/widgets/uptime-status.ts \
  packages/integrations/src/plex/plex-integration.ts \
  packages/widgets/src/catalog.ts packages/widgets/src/index.tsx \
  packages/widgets/src/manifest.ts packages/widgets/src/refetch-intervals.ts \
  packages/widgets/src/system-resources/component.tsx packages/widgets/src/system-resources/index.ts \
  packages/definitions/src/widget.ts packages/definitions/src/widget-integration-map.ts \
  packages/definitions/src/docs/widget-doc-slugs.ts
```

- [ ] **Step 2: Reconcile the widget registry**

```bash
pnpm turbo typecheck --filter=@homarr/widgets --filter=@homarr/api --filter=@homarr/definitions
```
Expected: failures where v2 changed catalog/manifest contracts. The fork adds two widgets plus a
strip — re-register them through v2's catalog rather than restoring v1's registration shape.

- [ ] **Step 3: Verify the widget queries the renumbered table**

Confirm `uptime-status.ts` reads `uptime_daily` and that the Drizzle import resolves against
`packages/db/schema`:

```bash
grep -n "uptimeDaily\|uptime_daily" packages/api/src/router/widgets/uptime-status.ts
```

- [ ] **Step 4: Verify**

Run:
```bash
pnpm turbo typecheck --filter=@homarr/widgets --filter=@homarr/api --filter=nextjs
pnpm vitest run packages/widgets packages/api
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api packages/widgets packages/integrations/src/plex packages/definitions
git commit -m "feat(uptime-status): carry uptime widget and depth probes onto v2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Port the tday-tasks area

**Files:**
- Modify/Create: the fork's tday-tasks widget, integration, and cron jobs (diff `develop` against the merge-base for the exact set), plus `apps/nextjs/src/app/[locale]/manage/tools/tasks/_components/tasks-table.tsx` and `apps/docs/docs/management/tasks/index.mdx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the tday-tasks widget registered in v2's catalog.

- [ ] **Step 1: Enumerate the area's exact files**

```bash
MB=$(git merge-base develop v2.0.0)
git diff --name-only $MB..develop | grep -iE "tday|task" | tee /tmp/tday-files.txt
```
Expected: the widget, integration, and cron-job files. Review the list before checking it out.

- [ ] **Step 2: Bring the fork-new files over**

For files that exist only in the fork (additions), take them wholesale:
```bash
while read -r f; do
  git cat-file -e develop:"$f" 2>/dev/null && git checkout develop -- "$f"
done < /tmp/tday-files.txt
git status --short | head -30
```

- [ ] **Step 3: Reconcile the tasks table with v2**

`tasks-table.tsx` is a both-changed file. Read v2's version and the fork's, and re-apply the fork's
column/interaction changes on v2's table structure.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm turbo typecheck --filter=@homarr/widgets --filter=@homarr/cron-jobs --filter=nextjs
pnpm vitest run packages/cron-jobs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/widgets packages/integrations packages/cron-jobs apps/nextjs apps/docs/docs/management/tasks
git commit -m "feat(tday-tasks): carry the tday-tasks widget onto v2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: Decide and port the custom-widget ActionButton

**Files:**
- Modify: `packages/api/src/router/custom-widget/display-data.ts`, `packages/validation/src/custom-widget.ts`, `packages/widgets/src/custom-api/{component.tsx,jsx-whitelist.ts,jsx-interactive-components.tsx}`, `packages/api/src/router/widgets/custom-api.ts`
- Test: `packages/widgets/src/custom-api/jsx-action-button.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: either an ActionButton ported onto v2's component model, or a documented decision to drop it.

- [ ] **Step 1: Determine whether v2's built-in custom JSX already covers ActionButton**

Read v2's authoring surface:
```bash
ls apps/docs/docs/management/custom-widgets/
sed -n '1,80p' apps/docs/docs/management/custom-widgets/component-reference.mdx
```
Compare against the fork's ActionButton's features (sublabel, style options, active-selection state).

- [ ] **Step 2: Present the decision to the human**

If v2's built-in components cover the use, the correct outcome is to **drop the port** — recreating
a redundant feature is the YAGNI failure the spec warns about (§8). Present findings and ask for
the call. If dropping, skip to Step 6 and commit the decision as a doc note in the PR body rather
than a code change.

- [ ] **Step 3: (If porting) Write the failing test**

Bring the fork's spec forward first:
```bash
git checkout develop -- packages/widgets/src/custom-api/jsx-action-button.spec.ts
```
Run: `pnpm vitest run packages/widgets/src/custom-api/jsx-action-button.spec.ts`
Expected: FAIL — v2 does not yet expose the ActionButton component.

- [ ] **Step 4: (If porting) Re-implement on v2's component model**

Re-express the ActionButton against v2's component registration (`jsx-whitelist`, `component.tsx`,
`jsx-interactive-components.tsx`) — **not** the v1 files v2 deleted. Port the validation additions
into v2's `authoring-validation.ts` / `secret-policy.ts` equivalents rather than `custom-widget.ts`.

- [ ] **Step 5: (If porting) Verify**

Run:
```bash
pnpm vitest run packages/widgets/src/custom-api/
pnpm turbo typecheck --filter=@homarr/widgets --filter=@homarr/api
```
Expected: PASS. Also verify **Review Focus #3**: a custom widget using a v1-only component fails
loudly rather than rendering blank.

- [ ] **Step 6: Commit**

```bash
git add packages/widgets/src/custom-api packages/api/src/router/custom-widget packages/validation/src/custom-widget.ts
git commit -m "feat(custom-widget): port ActionButton onto v2's component model

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: Whole-branch verification

**Files:**
- Modify: none

**Interfaces:**
- Consumes: all prior tasks.
- Produces: the green light for Tasks 12–14.

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: PASS with no errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Unit tests**

Run: `pnpm test`
Expected: PASS. Pay attention to `packages/db/test/*` and any fork spec.

- [ ] **Step 4: Build**

Run: `pnpm turbo build`
Expected: PASS.

- [ ] **Step 5: Confirm no v1 custom-widget leftovers**

```bash
git grep -n "jsx-interactive-components" -- packages | head
git grep -rn "router/custom-widget/display-data" -- packages | head
```
Expected: no references to v2-deleted v1 custom-widget modules remain outside intended ports.

- [ ] **Step 6: Commit nothing; report status**

Summarize each area's outcome and the Task 10 decision for the human.

---

### Task 12: Neutralize the Portainer stack 5 hazard

**Files:**
- Modify: Portainer stack 5 definition (external to this repo)

**Interfaces:**
- Consumes: nothing.
- Produces: a stack that cannot silently replace the fork with upstream.

- [ ] **Step 1: Inspect the current stack**

Open Portainer → Stacks → `homarr` (id 5) and record its image reference.
Expected: `ghcr.io/homarr-labs/homarr:latest`.

- [ ] **Step 2: Neutralize or repoint**

Either delete the stack, or repoint its image at the fork's `homarr:develop` image. **Do not leave it
pointing at upstream `:latest`** — one click there discards everything this plan preserved.

- [ ] **Step 3: Verify**

Confirm the stack no longer references upstream `:latest`. This is a manual check in the Portainer UI.

---

### Task 13: Cut over

**Files:**
- Modify: running container

**Interfaces:**
- Consumes: the verified branch from Task 11 and the go/no-go from Task 3.
- Produces: the live v2 deployment.

- [ ] **Step 1: Take a fresh backup**

```bash
TS=$(date +%Y%m%d-%H%M%S)
cp /data/compose/5/homarr/appdata/db/db.sqlite "/tmp/homarr-pre-cutover-$TS.sqlite"
ls -la /tmp/homarr-pre-cutover-*.sqlite
```

- [ ] **Step 2: Repair the migration watermark — REQUIRED**

Discovered during execution and NOT in the original plan. Drizzle applies migrations by timestamp
watermark, not by index: it runs every journal entry whose `when` exceeds the largest recorded
`created_at`. The fork's `0042_regular_dragon_lord` is stamped `1789615820333` — later than every
v2 migration (max `1788763848930`) — so without this repair v2 **skips its own 0042–0047** and
starts with missing tables. Task 3 reproduced exactly that: the seed then crashes with
`no such table: custom_widget_v2_definition`. Back-dating the single recorded row by one
millisecond is sufficient, and was verified end-to-end on a copy of the live database.

```bash
python3 - <<'PY'
import sqlite3
c = sqlite3.connect("/data/compose/5/homarr/appdata/db/db.sqlite")
n = c.execute(
    "update __drizzle_migrations set created_at = 1784305283909 where created_at = 1789615820333"
).rowcount
c.commit()
print("rows back-dated:", n, "| expect 1")
print("watermark now:", c.execute("select max(created_at) from __drizzle_migrations").fetchone()[0])
PY
```

Expected: `rows back-dated: 1` and watermark `1784305283909` (one below v2's 0042 at
`1784305283910`). If the row count is 0, the database was already repaired or never had the fork's
`0042` — stop and check rather than deploying.

**As of the post-execution fix, `./deploy-homarr.sh` performs this repair itself** (idempotently,
after the backup and before the new container starts) and aborts if it cannot confirm it. Running
the command above by hand is now only needed to inspect or pre-verify the state; Step 3 is safe to
run directly. Confirm the script logged `migration watermark repaired` or
`migration watermark already repaired`.

- [ ] **Step 3: Build and deploy**

```bash
git rev-parse --abbrev-ref HEAD   # must be feat/v2-integration
./deploy-homarr.sh --build
```
Expected: the script backs up, builds, replaces the container, and reports it came up. It fails
loudly otherwise — read its output, don't paper over it.

- [ ] **Step 4: Verify the deployment**

Open the dashboard and confirm: it renders, version reports v2.0.0, all boards are present, and each
custom area is visible (tday-tasks, uptime widget + strip, rebrand, glances).

- [ ] **Step 5: Verify rollback still works — Review Focus #4**

If anything is wrong, restore the backup and roll the image back *before* debugging:
```bash
cp /tmp/homarr-pre-cutover-*.sqlite /data/compose/5/homarr/appdata/db/db.sqlite
./deploy-homarr.sh --rollback
```
`--build` preserves the replaced image as `homarr:previous` before retagging, so `--rollback` really
redeploys the previous build. (Without that preservation the tag would already point at v2 and the
rollback would silently redeploy the broken image — the original plan's rollback step could not have
worked.) Note that the migration itself is not reversed by this: the database backup is what undoes
the schema change.

- [ ] **Step 6: Reconcile `develop` — Review Focus #5**

Only after the deployment is verified stable, decide with the human how to land the work on
`develop` (fast-forward, merge, or reset + force-push). If force-pushing, warn any other clone of
`origin/develop` first. This step is deliberately last and deliberately gated on a verified deployment.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: §2 approach → Tasks 1–10 structure; §3.1
custom-widget rewrite → Task 10; §3.2/§3.3 migration collision → Tasks 2–3; §3.4 MySQL removal →
Tasks 2, 4; §3.5 layout change → Task 3 Step 5; §3.6 journal test → Task 2 Step 6; §4 area sequence
→ Tasks 4–10; §5 per-area method → embedded in each port task; §6 DB reconciliation → Tasks 2–3;
§7 cutover/rollback → Tasks 13; §8 ActionButton open question → Task 10; §9 Portainer → Task 12;
§10 risks → Review Focus; §11 checklist → Tasks 11, 13.

**Placeholders.** No "TBD"/"add error handling" steps. Where an outcome genuinely depends on
runtime discovery (which files typecheck cleanly, whether v2 covers ActionButton), the plan names
the discovery, the command that produces it, and the decision gate — that is judgment, not a
placeholder. Task 9 Step 1 deliberately computes its file list rather than hard-coding a guess.

**Type consistency.** `uptimeDaily` (camelCase schema export) is used in Task 2's test and Task 8
Step 3's grep against `uptime_daily` (snake_case table). Migration tags `0048_uptime_daily` /
`0016_uptime_daily` are used consistently across Task 2.

**Review Focus.** All five items are pinned: #1 → Task 3 Steps 2/4, #2 → Task 3 Step 5, #3 → Task 10
Step 5, #4 → Task 13 Step 5, #5 → Task 13 Step 6.

**Post-execution amendment.** Task 13 Step 2 was added during execution: the migration watermark
repair described there is required, and the original plan omitted it. See the executor ledger
(`.superpowers/sdd/2026-10-02-homarr-v2-upgrade/progress.md`, Task 3) for the reproduction and the
verification on a database copy.
