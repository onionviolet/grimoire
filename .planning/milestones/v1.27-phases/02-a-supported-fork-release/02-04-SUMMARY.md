---
phase: 02-a-supported-fork-release
plan: 04
subsystem: infra
tags: [git, merge, i18n, foundry, locker, refactor]

requires:
  - phase: 02-a-supported-fork-release
    provides: "02-01, 02-02, 02-03 landed on main first, so this merge's translation.json/manifest.json conflict resolves against their final state rather than twice"
provides:
  - "structural-refactor-7's five commits are reachable from main via a real two-parent merge commit"
  - "One shared asset-claims pure core (buildAssetClaimsIndex) importable from both the main process and the renderer, plus a separate renderer-only cached IPC layer (inspectedAssetClaims.ts)"
  - "One shared hero-identity table (heroIdentity.ts) replacing four independent hero-name tables"
  - "One shared sound vocabulary (soundVocabulary.ts) replacing two independent classification tables"
affects: [foundry-asset-sources, locker-sound-shelf, hero-identity, structural-refactor-7-deletion]

actuals:
  tokens: 13684
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Pure-core / renderer-cache-layer split: a module importable from the main process must stay in its own file with zero renderer-only imports (no ./api, no window), even when a sibling module layers an IPC cache directly on top of it. Combining both halves in one file transitively pulls window-using code into the main process's DOM-less tsconfig build graph."

key-files:
  created:
    - src/lib/inspectedAssetClaims.ts
    - src/lib/inspectedAssetClaims.test.ts
  modified:
    - src/lib/assetClaims.ts
    - src/lib/assetClaims.test.ts
    - src/lib/useAssetClaims.ts
    - src/lib/soundInventory.ts
    - src/lib/soundInventory.test.ts
    - src/lib/globalSoundSections.ts
    - src/lib/heroPortraitIdentity.ts
    - src/lib/heroPortraitIdentity.test.ts
    - src/lib/heroCodenames.test.ts
    - electron/main/services/heroPoseModels.ts
    - electron/main/services/foundryAssetSources.ts
    - src/components/foundry/GlobalSoundBrowse.tsx
    - src/components/foundry/PortraitBrowse.test.ts
    - src/components/foundry/ChangePools.tsx
    - src/components/foundry/MyChanges.tsx
    - src/components/foundry/LibraryBrowse.tsx
    - src/components/foundry/PortraitEditor.tsx
    - src/components/foundry/MySoundChanges.tsx
    - src/components/foundry/TextureBrowse.tsx
    - src/stores/appStore.ts
    - src/pages/Foundry.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - docs/merge-plan-upstream-2026-08.md

key-decisions:
  - "assetClaims design collision (Task 2, human decision: combine): kept buildAssetClaimsIndex as the single shared main+renderer pure implementation; electron/main/services/foundryAssetSources.ts imports it directly (its own diverged inline duplicate winner-picking loop was discarded); kept recordedClaims.ts from the branch as the shared cheap-local overlap check, which also closed a pre-existing gap where portraitInventory.ts had never been wired to the shared module at all; layered the branch's LRU cache as a separately-named export (InspectedAssetClaims, not AssetClaimsIndex) so the 10 renderer call sites keep their caching behavior without colliding with the pure core's own type name"
  - "Uncommitted working-tree paths at Task 1 (7 total): the repository owner chose to commit everything as-is rather than stash or discard, explicitly including the unrelated 'stable mod uid' feature (5 files, pre-existing and unrelated to this plan) and .planning/config.json. Committed as its own honestly-labeled, non-scoped commit (e9a5584) rather than attributed to this plan's task numbering, per the owner's explicit instruction"
  - "structural-refactor-7 worktree confirmed inactive by the repository owner (last commit 8 days old, clean status) before the merge began, satisfying the plan's blocking safety gate"

patterns-established:
  - "Pure-core / renderer-cache-layer split (see tech-stack.patterns above)"

requirements-completed: []

coverage:
  - id: D1
    description: "The five structural-refactor-7 commits are reachable from main via a real two-parent merge commit, and git branch --no-merged main is empty"
    verification:
      - kind: other
        ref: "git rev-list --left-right --count main...structural-refactor-7 -> '124 0'; git log -1 --format=%P main | wc -w -> 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every one of the ten reported conflicts is resolved with no surviving conflict marker anywhere in the tracked tree, and the assetClaims add/add collision is resolved by the repository owner's recorded combine decision rather than an automatic pick"
    verification:
      - kind: other
        ref: "git grep -c '<<<<<<<' -- src electron docs scripts -> no match (exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The full repository gate is green on the merged tree: typecheck, lint, all tests, i18n:check, locale manifest check, encoding:check, refs:check, engine-pin:check"
    verification:
      - kind: other
        ref: "pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && node scripts/gen-locale-manifest.mjs --check && pnpm encoding:check && pnpm refs:check && pnpm engine-pin:check"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run -> 154 test files, 1716 tests, all passing"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-08-07
status: complete
---

# Phase 02 Plan 04: Fold structural-refactor-7 into main Summary

**Merged the last unreachable branch's five refactor commits into `main` through a real merge commit, resolving ten conflicts (one by a recorded human design decision, the assetClaims add/add), and proved the merged tree green across the entire repository gate: typecheck, lint, 1716 tests, i18n, encoding, and the upstream-backlink guard.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-07
- **Tasks:** 3 (checkpoint, checkpoint, auto)
- **Files modified:** 36 (merge commit) + 5 (Task 1 reconciliation, unrelated to this plan)

## Accomplishments

- `structural-refactor-7` (5 commits: hero-identity consolidation, asset-claims derivation, sound-vocabulary consolidation, browse-hero-context requirement, and a global-inventory-link fix) is now fully reachable from `main` via merge commit `c0571a2`
- The assetClaims design collision was resolved as a human-decided **combine**: `buildAssetClaimsIndex` stays the one pure, dependency-free implementation shared by the main process (`foundryAssetSources.ts`) and the renderer's recorded-only half (`recordedClaims.ts`); the branch's LRU-cached IPC layer now lives in its own file, `inspectedAssetClaims.ts`, so importing the pure core from the main process never drags renderer-only code into its build graph
- `heroIdentity.ts` (branch) is now the one hero-alias table, replacing four duplicate tables; main's own later additions (six reworked heroes' pinned `modelEntry` paths) are preserved because they already exist as rows in the consolidated table
- `soundVocabulary.ts` (branch) is now the one sound classification vocabulary shared between the Locker and Foundry's base-game catalog, replacing a duplicate rule table in `soundInventory.ts` and a separate ad hoc implementation in `portraitInventory.ts`
- Full repository gate green post-merge: `pnpm typecheck`, `pnpm lint`, `pnpm test` (154 files, 1716 tests), `pnpm i18n:check`, locale manifest check, `pnpm encoding:check`, `pnpm refs:check`, `pnpm engine-pin:check`

## Task Commits

1. **Task 1: Confirm the worktree is inactive and reconcile the working tree** (checkpoint:human-verify) - live evidence gathered and presented; repository owner confirmed the worktree inactive and chose to commit all seven dirty paths as-is:
   - `e9a5584` (`feat`) - the unrelated pre-existing "stable mod uid" feature, committed at the owner's explicit direction, deliberately not attributed to this plan's task numbering
   - `8187ec3` (`docs(02-04)`) - reconciled `docs/merge-plan-upstream-2026-08.md`'s uncommitted verification-build guidance
   - `482c1d8` (`chore`) - local worktree tooling default
   - `592b157` (`chore`) - GSD planning workflow config
2. **Task 2: Decide the assetClaims design collision** (checkpoint:decision) - evidence presented for `keep-main`/`keep-branch`/`combine`; repository owner selected **combine**, adopting the executor's recommended synthesis
3. **Task 3: Merge, resolve every conflict, and run the full gate** (auto) - `c0571a2` (`merge`)

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP updates)

## Files Created/Modified

- `src/lib/assetClaims.ts` - trimmed to the pure core only (`normalizeAssetPath`, `AssetClaimant`, `AssetClaim`, `AssetClaimsIndex`, `buildAssetClaimsIndex`); no IPC/renderer imports
- `src/lib/inspectedAssetClaims.ts` (new) - the renderer-only LRU-cached IPC layer (`assetClaims`, `peekAssetClaims`, `invalidateAssetClaims`, `assetClaimsGeneration`, `inspectAssetClaims`, `InspectedAssetClaims`), split out of a combined draft mid-gate when `pnpm typecheck` revealed it transitively broke the main process's build
- `src/lib/assetClaims.test.ts` / `src/lib/inspectedAssetClaims.test.ts` - test suites split to match the module split
- `src/lib/useAssetClaims.ts` (new, from branch) - the hook the branch adds, now pointed at `inspectedAssetClaims.ts`
- `src/lib/soundInventory.ts` / `.test.ts` - adopted the branch's `soundVocabulary.ts`-backed classification and `recordedClaims.ts`-backed overlap check
- `src/lib/globalSoundSections.ts` - adopted `soundTermLabel` from the shared vocabulary; kept main's later removal of `globalSoundFoundryCategory` intact (no current call site needs it)
- `src/lib/heroPortraitIdentity.ts` / `.test.ts` - adopted the branch's `heroIdentity.ts`-backed consolidation; test's one `portraitHeroDefinitions`-dependent case rewritten against `allHeroIdentities()`
- `src/lib/heroCodenames.test.ts` - same `portraitHeroDefinitions` -> `allHeroIdentities()` fix, filtered to heroes with a panorama presence to match the retired table's implicit scope
- `electron/main/services/heroPoseModels.ts` - adopted `modelCodenamesForHero`/`modelEntryForHero` from `heroIdentity.ts`; verified all nine of main's `MODEL_ENTRY_OVERRIDES` pins survive as rows in the consolidated table before deleting the local table
- `electron/main/services/foundryAssetSources.ts` - merged automatically with zero edits; main's own post-fork history had already added the `buildAssetClaimsIndex` import the branch's diverged copy never got
- `src/components/foundry/GlobalSoundBrowse.tsx` - adopted wholesale from the branch (`RailTerm`/`refineCatalogTerm`/`hero: null` prop), verified consistent with the already-unconflicted `Foundry.tsx` call site
- `src/components/foundry/PortraitBrowse.test.ts` - same `portraitHeroDefinitions` -> `allHeroIdentities()` fix
- `src/components/foundry/{ChangePools,MyChanges,LibraryBrowse,PortraitEditor,MySoundChanges,TextureBrowse}.tsx` - import path updated to `inspectedAssetClaims`
- `src/stores/appStore.ts` - `invalidateAssetClaims` import path updated to `inspectedAssetClaims`
- `src/pages/Foundry.tsx` - `linkedGlobalSoundCategory` now translates through the catalog's own coarse vocabulary (matching `GlobalSoundBrowse.tsx`'s `RailTerm`), not the Locker's `SoundCategory`; the now-unused `CATEGORY_ORDER`/`SoundCategory` import from `soundInventory.ts` removed
- `src/locales/en/translation.json` - additive: kept both sides' `foundry.globalSound.category.*` keys
- `src/locales/manifest.json` - regenerated via `pnpm i18n:manifest`, not hand-merged
- `docs/merge-plan-upstream-2026-08.md` - Task 1 reconciliation of an unrelated uncommitted edit (verification-build env var guidance, stop-and-ask rule 9)

## Decisions Made

See `key-decisions` in frontmatter. Summarized: the assetClaims collision was resolved as a human-decided **combine** (pure core shared by both processes, renderer cache layered on top in its own file); all seven Task 1 dirty paths were committed as-is per the repository owner's explicit instruction, with the unrelated mod-uid feature honestly labeled and not attributed to this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Split the combined assetClaims.ts into two files after the gate caught a cross-process leak**
- **Found during:** Task 3, first `pnpm typecheck` run after the merge commit's staging
- **Issue:** The Task 2 combine decision was implemented as a single `assetClaims.ts` file holding both the pure core and the renderer-only IPC cache layer. `electron/main/services/foundryAssetSources.ts` (main process) imports `buildAssetClaimsIndex` from this file; because the file also contained `import { foundryInspectAssetSources } from './api'` (a renderer-only module using `window.electronAPI`), TypeScript's project-reference build (`tsc -b`) pulled the entire renderer-only import graph into the main process's DOM-less `tsconfig.node.json` compilation unit, producing ~180 `Cannot find name 'window'` errors in `src/lib/api.ts`.
- **Fix:** Split into `src/lib/assetClaims.ts` (pure core, zero renderer imports) and a new `src/lib/inspectedAssetClaims.ts` (the IPC cache layer). Updated `useAssetClaims.ts`, six Foundry components, and `appStore.ts` to import the cache layer from its new location. Split `assetClaims.test.ts` accordingly and added `inspectedAssetClaims.test.ts`.
- **Files modified:** `src/lib/assetClaims.ts`, `src/lib/inspectedAssetClaims.ts` (new), `src/lib/assetClaims.test.ts`, `src/lib/inspectedAssetClaims.test.ts` (new), `src/lib/useAssetClaims.ts`, `src/stores/appStore.ts`, `src/components/foundry/{ChangePools,MyChanges,LibraryBrowse,PortraitEditor,MySoundChanges,TextureBrowse}.tsx`
- **Verification:** `pnpm typecheck` clean; both split test files pass (18 tests total)
- **Committed in:** `c0571a2` (part of the merge commit; discovered and fixed before committing)

**2. [Rule 1 - Bug] Fixed three test files that referenced the table this merge retired**
- **Found during:** Task 3, `pnpm typecheck` after fixing deviation #1
- **Issue:** `src/lib/heroPortraitIdentity.test.ts`, `src/lib/heroCodenames.test.ts`, and `src/components/foundry/PortraitBrowse.test.ts` (none on the plan's declared conflict list; all auto-merged cleanly to main's pre-merge content) still imported `portraitHeroDefinitions`, a local table `heroPortraitIdentity.ts` no longer exports after adopting the branch's `heroIdentity.ts` consolidation.
- **Fix:** Rewrote the affected test cases to read the roster from `heroIdentity.ts`'s `allHeroIdentities()` instead. `heroCodenames.test.ts`'s comparison filtered to heroes with a non-empty `panoramaCodenames` array, matching the retired table's implicit scope (it never listed the five unreleased heroes `allHeroIdentities()` now also returns).
- **Files modified:** `src/lib/heroPortraitIdentity.test.ts`, `src/lib/heroCodenames.test.ts`, `src/components/foundry/PortraitBrowse.test.ts`
- **Verification:** `pnpm typecheck` clean; full test suite green (1716 tests)
- **Committed in:** `c0571a2` (part of the merge commit; discovered and fixed before committing)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs surfaced by the gate the plan itself mandated running)
**Impact on plan:** Both were caught and fixed within Task 3's own gate loop, before the merge commit was created — a red gate here would have been attributable to this merge, and it never went red in the committed state. No scope creep: both fixes are strictly required to make the Task 2 combine decision actually compile and to keep existing test coverage exercising the consolidated table.

## Issues Encountered

- `electron/main/services/heroCodenames.ts`'s `divergentBodyModelForHero` function is no longer called from production code (its only production call site, in `heroPoseModels.ts`, was replaced by `heroIdentity.ts`'s `modelCodenames` field). It remains exported and covered by its own `heroCodenames.test.ts` tests, and `heroCodenames.ts` itself is still live (other exports are still consumed by `heroColors.ts`). Left as-is: removing it is a separate, out-of-scope cleanup and it causes no lint/typecheck/test failure. Noted here for visibility, not filed to `WINDOWS.md` since it is dead code, not a stub, skipped test, or unmet truth.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `structural-refactor-7` is fully merged and holds no unmerged work; `git branch --no-merged main` is empty. Deletion of the branch (and the `dev-slot-seeding` branch, and retiring `docs/merge-plan-upstream-2026-08.md`) is plan 02-05's job, per this plan's own objective and per `REQUIREMENTS.md`'s REQ-upstream-merge-aug-2026 wording (Phase B/this plan vs Phase C/02-05).
- **REQ-upstream-merge-aug-2026 intentionally left open** (not marked complete in REQUIREMENTS.md by this plan): the requirement's own text bundles the merge (done here) with branch deletion and doc retirement (not yet done). Marking it complete now would be inaccurate; plan 02-05 should mark it complete once those steps land.
- No blockers for 02-05: the merge is a real two-parent commit (not a squash/rebase), so `git branch -d structural-refactor-7` will succeed once 02-05 runs it.

---
*Phase: 02-a-supported-fork-release*
*Completed: 2026-08-07*

## Self-Check: PASSED

All created files verified present (`src/lib/inspectedAssetClaims.ts`, `src/lib/inspectedAssetClaims.test.ts`, `src/lib/assetClaims.ts`, `src/lib/useAssetClaims.ts`, `src/lib/heroIdentity.ts`, this SUMMARY). All five commits (`e9a5584`, `8187ec3`, `482c1d8`, `592b157`, `c0571a2`) verified present in git log.
