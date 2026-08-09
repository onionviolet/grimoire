---
phase: 05-one-inventory-one-journey
plan: 01
subsystem: ui
tags: [react, typescript, i18n, locker, accessible-tablist]

# Dependency graph
requires:
  - phase: 04-locker-and-foundry-as-one-object
    provides: shared LockerGlobalView shell, GlobalSoundShelf, sound inventory read model, Set-deduplicated Global counters
provides:
  - Three-value LockerMode (all | looks | sounds) with bare /locker/global defaulting to All content
  - globalInventoryRailRows merged projection hiding zero-count rail rows, plus firstGlobalRailRowKey
  - Three-segment Global selector, merged rail, membership caveat and filtered-zero reset state
  - Whole phase English catalog: Active source vocabulary at fourteen existing keys and every key plans 02 to 06 consume
affects: [05-02, 05-03, 05-04, 05-05, 05-06, Weblate re-translation]

# Actuals (#2632) - pairs with the plan's estimate (80000 tokens)
actuals:
  tokens: 9815   # chars/4 over the realized diff (39260 diff chars)
  tasks: 2       # tasks completed
  commits: 3     # 2 task commits + 1 final metadata commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure rail projection beside the shared Set-deduplicated counters: the component maps over the projection, never a section-branching ternary"
    - "Value-only i18n consolidation: same key names, new values, zero call-site churn; stale translated locales are the accepted consequence until Weblate re-translates"

key-files:
  created: []
  modified:
    - src/lib/lockerMode.ts
    - src/lib/globalInventory.ts
    - src/pages/Locker.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - src/lib/lockerMode.test.ts
    - src/lib/globalInventory.test.ts
    - src/components/foundry/AssetSourcesPanel.test.tsx
    - src/components/foundry/ChangePools.test.tsx

key-decisions:
  - "The third LockerMode member is named 'all'; bare /locker/global defaults to All content and the canonical URL for the default carries no query (D-05)"
  - "Hide-empty is a fixed always-on rule with no preference control (D-04, planner assumption settled)"
  - "Active source consolidation is a value edit at existing key names, excluding the build-time collision family and the three excluded keys"
  - "Task 2 also updated two renderer tests asserting the old winner wording; the plan's full-suite-green acceptance criterion took precedence over the catalog-only diff guardrail (Rule 1)"

patterns-established:
  - "Rail row presence is decided once per render pass by the same groups/soundCounts computation the header total reads, so rows never flicker while counts resolve"

requirements-completed: [REQ-global-inventory-coherence, REQ-sound-locker-surface, REQ-ui-consequence-and-vocabulary]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Three-value LockerMode with bare /locker/global defaulting to All content while ?mode=looks, ?mode=sounds and every legacy /locker/sounds* path resolve exactly as before"
    requirement: REQ-global-inventory-coherence
    verification:
      - kind: unit
        ref: "src/lib/lockerMode.test.ts#opens a bare Global drill-in on All content"
        status: pass
      - kind: unit
        ref: "src/lib/lockerMode.test.ts#routes the three legacy sound shapes"
        status: pass
    human_judgment: false
  - id: D2
    description: "globalInventoryRailRows merged All-content projection hiding zero-count rows in every section, with firstGlobalRailRowKey for the highlight fallback"
    requirement: REQ-global-inventory-coherence
    verification:
      - kind: unit
        ref: "src/lib/globalInventory.test.ts#globalInventoryRailRows"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three-segment Global selector, merged rail, membership caveat and filtered-zero reset state render in LockerGlobalView under the existing accessible tablist contract"
    requirement: REQ-global-inventory-coherence
    verification: []
    human_judgment: true
    rationale: "No DOM-level test exists for Locker.tsx in this repo; the route and projection layers are unit-proven, but the rendered selector, rail highlight glide, reset state, membership caveat placement and rail width (longest-label backstop) need a human in the running app."
  - id: D4
    description: "English catalog carries the Active source vocabulary at fourteen existing keys and every key plans 02 to 06 consume, with build-time collision wording and the four superseded provenance keys untouched"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: other
        ref: "node catalog assertion script: Active source values, 24 new key paths, 4 unchanged provenance keys, 2 unchanged collision keys"
        status: pass
      - kind: other
        ref: "pnpm i18n:check && pnpm encoding:check && node scripts/gen-locale-manifest.mjs --check"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy /locker/sounds* rewrites still land on the Sounds section through the explicit ?mode=sounds navigation, proving REQ-sound-locker-surface's URL contract survives the widened default"
    requirement: REQ-sound-locker-surface
    verification:
      - kind: unit
        ref: "src/lib/lockerMode.test.ts#routes the three legacy sound shapes"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-09
status: complete
---

# Phase 5 Plan 1: One Inventory, One Journey Summary

**The Global drill-in gained a three-view inventory (All content, Visuals, Sounds) with a merged hide-empty rail, and the English catalog now holds the whole phase's Active source vocabulary plus every key plans 02 to 06 read.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T02:38:00Z
- **Completed:** 2026-08-09T02:46:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `LockerMode` widened to `'all' | 'looks' | 'sounds'`; bare `/locker/global` and `/locker/global/` now default to All content (D-05), while `?mode=looks`, `?mode=sounds`, `?mode=all` and every legacy `/locker/sounds*` rewrite resolve exactly as before.
- `globalInventoryRailRows` and `firstGlobalRailRowKey` added beside the shared counters: one pure merged projection that tags rows by vocabulary and hides zero-count rows in all three sections (D-04).
- `LockerGlobalView` renders a three-segment tablist, maps the rail over the projection, shows the section-membership caveat once above the All content list, and replaces a fully-filtered narrower section with a three-part reset state naming what is missing, why, and a "Show all content" action.
- The catalog pass landed D-17's Active source consolidation as value edits at fourteen existing keys, added the twenty-four keys plans 02 to 06 consume, provably left the build-time collision family and four superseded provenance keys untouched, and regenerated the manifest (3110 keys, idempotent).

## Task Commits

Each task was committed atomically:

1. **Task 1: End to end "select All content" through route, projection, tablist and pane** - `6e15a99` (feat)
2. **Task 2: Land the whole phase's catalog change: Active source vocabulary plus every key plans 02 to 06 consume** - `9251c8c` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `src/lib/lockerMode.ts` - Three-member `LockerMode`, `lockerModeFromSearch` accepts `all`, global branch defaults to `'all'`; legacy branch untouched
- `src/lib/globalInventory.ts` - `GlobalRailRowInput`, `GlobalRailRow`, `globalInventoryRailRows`, `firstGlobalRailRowKey`
- `src/pages/Locker.tsx` - Three-entry `GLOBAL_SECTION_TABS`, `railRows` useMemo, `selectedAllKey` state, `paneIsSounds`, merged rail render with reset state and membership caveat, canonical `onSelectSection` URLs
- `src/locales/en/translation.json` - Five new `locker.global` keys, 24 new keys across nine namespaces, 14 Active source value edits
- `src/locales/manifest.json` - Regenerated (3110 keys, 4 languages)
- `src/lib/lockerMode.test.ts` - New default section, third mode value, preserved legacy cases
- `src/lib/globalInventory.test.ts` - Projection vocabulary/tag/order/zero-drop cases plus `firstGlobalRailRowKey`
- `src/components/foundry/AssetSourcesPanel.test.tsx` - Assertion updated to "Active source: ..." (Rule 1)
- `src/components/foundry/ChangePools.test.tsx` - Assertions and comment updated to "Active source" (Rule 1)

## Decisions Made
- All planner decisions were carried as written: `'all'` as the third member, fixed always-on hide-empty, value-only Active source consolidation excluding the collision family, and the common.actions.retry reuse for later retry actions. The executor did not re-litigate any of them.
- Task 2's two renderer-test assertion updates were the only execution-time decision: the plan's hard acceptance criterion "full suite exits 0 with no previously passing test now failing" required them even though the task's file list anticipated only catalog files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated renderer tests asserting the old winner wording**
- **Found during:** Task 2 (catalog change)
- **Issue:** Changing values at existing key names (`poolView.winner`, `foundry.sources.winner`) broke two renderer tests that asserted the old strings ("in game now", "Current winner: ...").
- **Fix:** Updated the assertions and one explanatory comment to the locked "Active source" vocabulary in `AssetSourcesPanel.test.tsx` and `ChangePools.test.tsx`.
- **Files modified:** src/components/foundry/AssetSourcesPanel.test.tsx, src/components/foundry/ChangePools.test.tsx
- **Verification:** Full Vitest suite green (1898 passed, 12 skipped)
- **Committed in:** 9251c8c (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required by the plan's own full-suite-green acceptance criterion and touched only test assertions; no production call site changed. Task 2's `git diff --name-only` therefore lists two test files in addition to the catalog files, which the summary records as the accepted consequence.

## Issues Encountered
- None beyond the deviation above. The manifest regeneration was confirmed idempotent by hash before and after a repeated `pnpm i18n:manifest` run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 1 complete; ready for wave 2 (05-02 randomization captions and portrait states, 05-03 bulk undo, 05-04 derived pak descriptions).
- Every key those plans consume already exists in `src/locales/en/translation.json`, so no later plan needs to reopen the catalog.
- The remaining `human_judgment` item (D3, rendered tri-state behavior) is queued for the phase's `$gsd-verify-work` run.

---
*Phase: 05-one-inventory-one-journey*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: SUMMARY, lockerMode.ts, globalInventory.ts, Locker.tsx, translation.json, manifest.json
- Commits verified in git log: `6e15a99`, `9251c8c`
- Stub scan clean: no TODO/FIXME/placeholder patterns, no `dangerouslySetInnerHTML` introduced
- Full verification suite green: `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` (1898 passed), `pnpm i18n:check`, `pnpm encoding:check`, `node scripts/gen-locale-manifest.mjs --check`, manifest idempotent
