---
phase: 03-foundry-completes-its-build-contract
fixed_at: 2026-08-09T02:10:00Z
review_path: .planning/phases/03-foundry-completes-its-build-contract/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-08-09
**Source review:** `.planning/phases/03-foundry-completes-its-build-contract/03-REVIEW.md`
**Iteration:** 1
**Fix scope:** critical + warning (IN-01 is Info and out of scope)

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Foundry staging mount still exposes the immediate-apply Remove (revert) action

**Files modified:** `src/components/locker/HeroColorPicker.tsx`
**Commit:** `cf1d169`
**Status:** fixed: requires human verification (UI-behavior change: button visibility + revert guard)
**Applied fix:** `handleRemove` now short-circuits when `onStage` is set, and the Remove button renders only when staging is not active (`{!onStage && applied && ...}`). The Foundry staging mount can no longer call `revertHeroColor` (which would silently delete the Locker's applied recolor); the immediate-apply revert path remains unchanged on the Locker mount.

### WR-02: "Staged, not yet forged" status line is not bound to the tray's actual state

**Files modified:** `src/components/foundry/recolorStagedEdit.ts`, `src/components/locker/HeroColorPicker.tsx`, `src/components/locker/HeroEffectsPanel.tsx`, `src/components/foundry/HeroWorkshop.tsx`, `src/components/foundry/RecolorTool.tsx`, `src/pages/Foundry.tsx`
**Commit:** `588e060` (+ `ff0bbc3`: drop the now-unused `canonicalHeroName` import caught by `pnpm typecheck`)
**Status:** fixed: requires human verification (state-handling change across the mount chain)
**Applied fix:** The status line is now derived from the shared tray instead of a local copy. A `findStagedRecolorForHero(edits, heroName)` helper (id `recolor:<canonical hero name>`, the same id `prepareRecolorStagedEdit` assigns) is threaded from the tray through `HeroWorkshop` and `RecolorTool` (which now receives `stagedEdits`) into `HeroEffectsPanel` and `HeroColorPicker` as a `stagedEdit` prop; the picker's local `stagedEdit` state and its `setStagedEdit` call were removed. A forge/install tray clear, a Remove, a re-stage, and a hero switch/remount now all read the tray's current truth.

### WR-03: `changeFilterOf` throws for a forged/future kind, defeating the neutral-fallback contract

**Files modified:** `src/components/foundry/changeList.ts`
**Commit:** `fe46fad` (+ `937db16`: read the `never` guard with `void` so `noUnusedLocals` stays satisfied)
**Status:** fixed: requires human verification (behavior-contract change: throw becomes neutral fallback)
**Applied fix:** The `default` branch of `changeFilterOf` now returns `'other'` while keeping the compile-time `never` guard on `entry.kind`, matching the UI fallback (`FileQuestion` icon / neutral "Change" label in `MyChanges`) so filtering can no longer throw for a runtime-forged or future kind.

## Verification

- Per-fix Tier 1 re-reads of every changed section were performed inside the
  isolated worktree; surrounding code confirmed intact.
- No syntax checker was runnable inside the worktree (it has no `node_modules`
  by design), so per-fix verification was Tier 1 only at edit time, per the
  3-tier strategy.
- Project gates ran in the **main checkout** after the review-fix branch was
  fast-forwarded (worktree-env results are not reproducible from the main
  checkout after teardown, so all numbers below are from the main tree):
  - `pnpm typecheck` — pass
  - `eslint` on all 7 changed files — pass
  - `pnpm i18n:check` and `node scripts/gen-locale-manifest.mjs --check` — pass
  - `pnpm encoding:check` — pass (640 files scanned)
  - `pnpm refs:check` (upstream backlink guard) — pass
  - `pnpm engine-pin:check` — pass
  - Targeted `vitest` runs for `changeList.test.ts` + `recolorStagedEdit.test.ts` — 25/25 pass

---

_Fixed: 2026-08-09_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
