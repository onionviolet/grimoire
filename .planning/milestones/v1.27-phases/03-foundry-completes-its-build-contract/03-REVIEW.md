---
phase: 03-foundry-completes-its-build-contract
reviewed: 2026-08-09T01:20:54Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - electron/main/ipc/foundry.ts
  - electron/main/services/foundryForge.test.ts
  - electron/main/services/foundryForge.ts
  - electron/main/services/foundryRecolor.ts
  - electron/preload/index.ts
  - src/components/foundry/HeroWorkshop.tsx
  - src/components/foundry/MyChanges.tsx
  - src/components/foundry/RecolorTool.tsx
  - src/components/foundry/ShuffleToggleButton.tsx
  - src/components/foundry/SoundBrowse.tsx
  - src/components/foundry/buildTray.test.ts
  - src/components/foundry/buildTray.ts
  - src/components/foundry/changeList.test.ts
  - src/components/foundry/changeList.ts
  - src/components/foundry/recolorStagedEdit.test.ts
  - src/components/foundry/recolorStagedEdit.ts
  - src/components/locker/HeroColorPicker.tsx
  - src/components/locker/HeroEffectsPanel.tsx
  - src/components/locker/HeroSkinsPanel.tsx
  - src/lib/api.ts
  - src/lib/foundrySoundShuffle.test.ts
  - src/lib/foundrySoundShuffle.ts
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/pages/Foundry.tsx
  - src/types/electron.ts
  - src/types/foundry.ts
  - src/types/mod.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Adversarial deep review of the phase 03 implementation (recolor staging into
the Foundry build tray, the shared sound-shuffle toggle, and the recolor
change-list row). All 28 changed source files were read in full and traced
across the main process (`foundryRecolor.ts` -> `heroColors.ts` bake cache ->
`foundryForge.ts` merge), the preload bridge, and the renderer (staging,
tray, change list, shuffle surfaces).

The core architecture holds up under tracing. The "one bake, not two" claim is
real: `buildHeroEffectVpkForExport` caches by fully normalized request
parameters, so staging-time entry discovery and forge-time build hit the same
VPK, and `buildFoundryForgeVpk` re-verifies the merged output's actual write
set against the reviewed write set before exporting. The no-op recolor
cleanup correctly preserves the shared per-hero bake cache, and the
`foundry:inspectAssetSources` path does include the Locker's grimoire colors
VPK, so the enabled-owner acknowledgement fires for the common "already
applied in the Locker" case. The shuffle extraction is a faithful reuse of the
existing store/pool machinery, and the `never` guards keep the widened
`FoundryForgeEdit`/`FoundryChangeKind` unions exhaustive at compile time.

Independent gates run as a cross-check: `pnpm typecheck`, `pnpm lint`,
`pnpm i18n:check`, and `pnpm encoding:check` all pass, and the 64 targeted
tests covering the new forge/review/staging/shuffle logic pass. Green gates
are not treated as evidence of correctness; the findings below are behavior
contract violations found by reading the code, not by the suite.

Three warnings: the Foundry staging mount still exposes the immediate-apply
"Remove" (revert) action; the "Staged, not yet forged" status line is local
component state that can contradict the tray in both directions; and the
neutral fallback for forged/future change kinds is defeated by a throwing
filter path. One info item flags a shadowed test fixture.

## Warnings

### WR-01: Foundry staging mount still exposes the immediate-apply Remove (revert) action

**File:** `src/components/locker/HeroColorPicker.tsx:469-490`, `:1066-1076`
**Issue:** The phase changes the Foundry Abilities picker to a stage-only
interaction model: the staging path explicitly comments "stage, never apply"
and "nothing is installed or reordered", and the plan rationale (03-01-PLAN.md
D-01) reserves the immediate-apply path, Applied status, and revert button
for the Locker mount. But `applied` is derived from `getActiveHeroColor`
(Locker applied-recolor metadata) on every mount, so on a Foundry mount
(`onStage` set) with a Locker-applied recolor the "Remove" button renders and
`handleRemove` calls `revertHeroColor(heroName)` immediately — rebuilding and
deleting the Locker's applied colors VPK entry, with no confirmation. A user
in the Foundry who expects tray-only semantics can click Remove to "unstage"
and instead silently lose their applied Locker recolor (and the staged edit
stays in the tray, since `stagedEdit` is not cleared). This contradicts the
mount's own "This stages into the Foundry build tray. It will not take effect
until you forge." caption and the phase's UI-SPEC statement that no destructive
action ships on this surface.
**Fix:** Gate the revert on the Locker mount only — short-circuit `handleRemove`
when `onStage` is set and hide the button there, or, if removing is intended to
be a valid Foundry action, stage a revert edit into the tray instead of calling
the immediate-apply API:
```tsx
const handleRemove = async () => {
  if (busy || onStage) return;
  // ... existing immediate revert (Locker mount only)
};
```
and render it only when staging is not active:
```tsx
{!onStage && applied && (
  <button type="button" onClick={handleRemove} ...>...</button>
)}
```

### WR-02: "Staged, not yet forged" status line is not bound to the tray's actual state

**File:** `src/components/locker/HeroColorPicker.tsx:196`, `:703-707`, `:936-942`
**Related:** `src/pages/Foundry.tsx:98`, `:106`, `:119`
**Issue:** `stagedEdit` is local component state, while the tray's
`stagedEdits` live in `Foundry.tsx` and are cleared on a successful forge or
install (`setStagedEdits([])`), removed via `removeEdit`, and never propagated
back to the picker. The status line therefore lies in both directions: it
keeps reading "Staged, not yet forged" after the edit is removed from the tray
or the tray is cleared by a successful forge, and it reads "Not staged" after
a remount (hero switch, tab change, or leaving and returning) while the tray
still holds the recolor edit. The picker also keeps showing "Staged" after the
sliders move to different parameters than the bake that was actually staged.
UI-SPEC E2 states the line "never reports a state the build tray does not
actually hold"; the current implementation violates that invariant.
**Fix:** Derive the indicator from the shared tray state instead of a local
copy — e.g., lift `stagedEdits` into the app store or pass a tray-derived
`hasStagedRecolor`/`stagedRecolorFor(hero)` prop from `Foundry.tsx`/
`HeroWorkshop.tsx`, and compute the row as the tray edit whose id is
`recolor:<canonical hero name>`. At minimum, clear `stagedEdit` when the tray's
recolor edit disappears and on unmount so the line can never claim a state the
tray does not hold.

### WR-03: `changeFilterOf` throws for a forged/future kind, defeating the neutral-fallback contract

**File:** `src/components/foundry/changeList.ts:159-176`, `:179-193`
**Related:** `src/components/foundry/MyChanges.tsx:144`, `:363-376`
**Issue:** The T-03-09 contract claims an unrecognised kind falls back to a
neutral Change label / FileQuestion icon, and `MyChanges` implements that
fallback for the icon and tag. But `filterFoundryChanges` calls
`changeFilterOf(entry)` for every row whenever a filter is active, and the
`default` branch throws `Unhandled change kind` for exactly those runtime
values. A forged or future `part.kind` therefore renders fine until the user
selects any filter, at which point the whole My changes view throws an
unhandled error. The two halves of the same contract disagree: the UI fallback
is unreachable for the one code path that guards it.
**Fix:** Make the filter's runtime default match the UI fallback — return
`'other'` in the `default` branch while keeping the compile-time `never` guard:
```ts
default: {
  // A fourth compile-time kind still fails typecheck on this assignment;
  // a runtime-forged value shelves under `other` like the UI fallback.
  const impossible: never = entry.kind;
  return 'other';
}
```

## Info

### IN-01: Test fixture shadows the outer `recolor` and passes for the wrong reason

**File:** `src/components/foundry/buildTray.test.ts:135-140`
**Issue:** The test "names an unbuildable kind rather than guessing a build
for it" declares a local `const recolor` that shadows the outer fixture and
omits the `request` payload. `toForgeRequest` throws because the shadowed
object lacks `request`, not because `recolor` is an unbuildable kind — it is
buildable now. The test passes but no longer asserts what its name claims, and
it is brittle: renaming or removing the outer fixture changes its behavior.
**Fix:** Rename the local to something outside the supported union (e.g. a
`model`-kind edit) or explicitly test the missing-payload path with a distinct
name:
```ts
const modelLike = { id: 'model', kind: 'model' as const, title: 'Model', affectedFiles: ['models/hero.vmdl_c'], precedence: 1 };
expect(unsupportedStagedEditKind([visual, modelLike])).toBe('model');
expect(() => toForgeRequest('x', reviewStagedEdits([modelLike], new Set([modelLike.id])))).toThrow('Unsupported staged edit kind');
```

---

_Reviewed: 2026-08-09_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
