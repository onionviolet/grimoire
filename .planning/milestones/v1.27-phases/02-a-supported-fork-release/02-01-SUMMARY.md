---
phase: 02-a-supported-fork-release
plan: 01
subsystem: support-links
tags: [i18n, react, fork-maintenance, d-03]
dependency-graph:
  requires: []
  provides:
    - "Fork-owned support destination (GitHub Issues) on UpdateModal.tsx and SupportSection.tsx"
    - "supportDestinations.test.ts two-sided guard (support surfaces clean, attribution surfaces intact)"
    - "Written D-03 decision record in docs/fork-maintenance.md"
  affects:
    - "src/locales/en/translation.json (settings.support.* key set)"
tech-stack:
  added: []
  patterns:
    - "Two-sided guard test (readFileSync source scan) asserting both an absence and a presence, so an over-correction fails as loudly as an under-correction"
    - "ESM __dirname via fileURLToPath(import.meta.url) for a src/ test file, since tsconfig.app.json has no node types"
key-files:
  created:
    - src/components/supportDestinations.test.ts
  modified:
    - src/components/UpdateModal.tsx
    - src/components/settings/sections/SupportSection.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - docs/fork-maintenance.md
decisions:
  - "D-03 support destination confirmed as https://github.com/onionviolet/grimoire/issues, consolidating onto the existing FORK_REPO/issues destination rather than standing up a new fork Discord or forum"
  - "DISCORD_INVITE and DiscordIcon deleted from SupportSection.tsx as dead code once their two support-context usages were removed; no other file imports them"
  - "settings.support.channels, bugReportDescription, joinDiscord, joinDiscordTitle, openDiscord deleted (meaning changed) rather than reworded in place, per the i18n delete-and-add rule; forkChannels and bugReportShareDescription added"
actuals:
  tokens: 4895
  tasks: 3
  commits: 4
metrics:
  duration_minutes: 20
  completed: 2026-08-06
status: complete
---

# Phase 02 Plan 01: A Supported Fork Release - Support Destination Summary

Moved every fork-owned support destination (update modal footer, Settings bug/feature row, Settings generated-report action row) from the upstream project's Discord to this fork's own GitHub Issues tracker, and locked the decision in place with a two-sided automated guard plus a written record.

## What Was Built

- **`src/components/UpdateModal.tsx`**: replaced the footer's upstream Discord anchor with an anchor to `https://github.com/onionviolet/grimoire/issues`, reusing the existing `settings.support.githubIssues`/`githubIssuesTitle` i18n keys verbatim and the `Github` icon from `lucide-react`. A `FORK_ISSUES` module constant is declared locally (deliberately not hoisted to a shared constants module, since none exists in this repo for two call sites).
- **`src/components/settings/sections/SupportSection.tsx`**: deleted the two Discord-support anchors (the "found a bug" row's Discord button, and the generated-report action row's "Open Discord" button), while leaving the "About Grimoire" attribution block and its four upstream/fork links completely untouched. Deleted the now-dead `DISCORD_INVITE` constant and local `DiscordIcon` component.
- **`src/locales/en/translation.json`**: retired `settings.support.channels`, `bugReportDescription`, `joinDiscord`, `joinDiscordTitle`, `openDiscord` (their meaning changed with the surfaces they served, so they were deleted rather than reworded in place per the project's i18n rule) and added `settings.support.forkChannels` and `settings.support.bugReportShareDescription`, each naming only GitHub. Regenerated `src/locales/manifest.json` to match.
- **`src/components/supportDestinations.test.ts`** (new): a plain node-environment vitest file that reads `UpdateModal.tsx`, `SupportSection.tsx`, `electron/main/services/discordRpc.ts`, and `README.md` as text and asserts both directions of D-03: the upstream Discord invite literal is absent from the two support surfaces and still present in the two attribution surfaces; both support surfaces reference the fork's issues URL; the About block's `UPSTREAM_REPO` usages survive.
- **`docs/fork-maintenance.md`**: added a "Support destination (D-03)" subsection to the Attribution section recording the destination, the three moved call sites, the four deliberately-untouched attribution surfaces with their individual reasons, and naming the guard test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `supportDestinations.test.ts` failed `pnpm typecheck` under strict `tsc -b`**
- **Found during:** Task 3's full-gate verification (`pnpm typecheck && pnpm lint && pnpm test`)
- **Issue:** `src/` is type-checked under `tsconfig.app.json`, which sets `"types": ["vite/client"]` with no Node types. The test file (created in Task 1, extended in Task 2) imported `node:fs`/`node:path` and referenced the CJS `__dirname` global, both of which `tsc -b` rejected (`TS2307`, `TS2304`) even though vitest itself ran the file correctly.
- **Fix:** Added a `/// <reference types="node" />` directive (the repo already carries `@types/node` as a devDependency) and derived `__dirname` via `fileURLToPath(import.meta.url)` plus `dirname()`, matching the ESM-safe path-resolution pattern this repo's own `.mjs` scripts already use, instead of relying on the CJS global.
- **Files modified:** `src/components/supportDestinations.test.ts`
- **Commit:** `2fa40ae`

No other deviations. Task 1 and Task 2 executed as written; the UpdateModal anchor's Tailwind classes were updated from the Discord-brand palette (`border-brand-discord`, `bg-brand-discord`) to the neutral GitHub-issues palette already used by `SupportSection.tsx`'s equivalent anchor, since the plan's "same anchor shape as `SupportSection.tsx` lines 163 to 172" instruction implies matching styling, not a GitHub icon rendered in Discord-brand colors.

## Verification

- `pnpm exec vitest run src/components/supportDestinations.test.ts` - 7 tests pass (two-sided guard on both surfaces)
- `pnpm typecheck` - clean
- `pnpm lint` - clean, no unused-variable errors for the removed `DISCORD_INVITE`/`DiscordIcon`
- `pnpm test` - 1602/1602 tests pass (149/149 files); two tests in `chatWheel.roundtrip.test.ts` and `dmmMigration.guards.test.ts` timed out on the first full-suite run under parallel load and passed cleanly on immediate rerun both in isolation and as part of a second full-suite run - confirmed pre-existing flakiness unrelated to this plan's changes, not a regression
- `pnpm i18n:check` - clean, no new orphaned or missing keys
- `node scripts/gen-locale-manifest.mjs --check` - manifest matches catalogs
- `pnpm encoding:check` - clean (607 files scanned)
- `git diff --name-only` confirms no file under `electron/` and no `README.md` change across all three tasks
- `git status --short` shows no staged change outside this plan's `files_modified` list

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/components/UpdateModal.tsx
- FOUND: src/components/settings/sections/SupportSection.tsx
- FOUND: src/components/supportDestinations.test.ts
- FOUND: docs/fork-maintenance.md
- FOUND commit: 62ced59
- FOUND commit: cf0238d
- FOUND commit: 2fa40ae
- FOUND commit: 4efe0a3
