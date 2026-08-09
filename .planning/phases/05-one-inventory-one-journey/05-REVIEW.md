---
phase: 05-one-inventory-one-journey
reviewed: 2026-08-09T09:10:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - src/lib/lockerMode.ts
  - src/lib/globalInventory.ts
  - src/pages/Locker.tsx
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/lib/lockerMode.test.ts
  - src/lib/globalInventory.test.ts
  - src/components/foundry/AssetSourcesPanel.test.tsx
  - src/components/foundry/ChangePools.test.tsx
  - src/components/locker/HeroPortraitFamilies.test.tsx
  - src/components/locker/HeroCardPicker.tsx
  - src/components/locker/HeroPortraitFamilies.tsx
  - src/components/foundry/PortraitBrowse.tsx
  - src/components/foundry/MyChanges.tsx
  - src/lib/heroPortraitIdentity.test.ts
  - src/lib/bulkUndo.ts
  - src/lib/bulkUndo.test.ts
  - src/pages/Installed.tsx
  - src/lib/derivedPakName.ts
  - src/lib/derivedPakName.test.ts
  - src/components/locker/useUnnamedPakEntries.ts
  - src/lib/provenance.ts
  - src/lib/provenance.test.ts
  - src/pages/Conflicts.tsx
  - src/pages/Profiles.tsx
  - src/components/foundry/FoundryBuildTray.tsx
  - src/components/locker/SoundEntryRow.tsx
  - src/components/locker/GlobalSoundShelf.tsx
  - src/components/locker/HeroSoundShelf.tsx
  - src/components/foundry/ChangePools.tsx
  - src/components/foundry/AssetSourcesPanel.tsx
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-09T09:10:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the 31 source files phase 05 lists in its six SUMMARY artifacts
(05-01 through 05-06), cross-checked against the phase commits. The scope
includes the new pure modules (`bulkUndo`, `derivedPakName`, `provenance`,
`globalInventory` rail projection, `useUnnamedPakEntries`), the page/components
that consume them (`Installed`, `Locker`, `Conflicts`, `Profiles`, the Foundry
and Locker sub-components), the locale catalogs, and the phase's tests.
Planning artifacts (`docs/portrait-alias-sweep-plan.md`,
`.planning/REQUIREMENTS.md`) were excluded as out of scope.

The pure logic is generally well-tested and clean: all 128 phase-related tests
pass, the locale catalog is valid and its key count matches the manifest, and
the provenance helper correctly percent-encodes ids for all five call sites.

The dominant defect is in the phase's flagship feature, one-shot bulk undo:
`offerBulkUndo` is invoked from the same render closure that captured the
pre-batch snapshot, so it diffs the snapshot against the identical pre-batch
`mods` array. A fully successful batch therefore never shows an Undo toast
(`bulkChangedCount` returns 0), and a partial batch's Undo restores nothing
(`bulkUndoPlan` returns an empty plan). The pure-module tests pass because they
never exercise this wiring, and the SUMMARY defers the end-to-end check to
in-app sign-off that has not been recorded.

## Critical Issues

### CR-01: Bulk undo is non-functional — snapshot is diffed against the same pre-batch mods array

**File:** `src/pages/Installed.tsx:2539-2561` (also call sites at 2637-2641, 2662-2665, 2696-2698, 2725-2727, 2756-2758)

**Issue:** `offerBulkUndo` is a `useCallback` whose body closes over the `mods`
value from the render in which the callback was created. The five bulk handlers
invoke it from the same render closure that captured the snapshot at
`captureBulkSnapshot(mods, selection)` (e.g. lines 2625/2638-2640). Because the
store updates between the snapshot and the offer do not rebind the running
handler's closure, `bulkChangedCount(snapshot, mods)` compares the snapshot to
the identical pre-batch array and always returns 0. The guard
`if (changed === 0 && !partial) return;` (line 2547) then suppresses the Undo
toast for every fully successful batch. For a partial batch the toast does
appear, but `runRestore` computes `bulkUndoPlan(snapshot, mods)` (line 2555)
against the same pre-batch array, producing an empty op list and a "0 mods
restored" toast. The feature works neither path. This also means the restore
plan is never built against the live list at click time, violating the
module's documented invariant ("a change the user made by hand between the
batch and the undo is never silently stomped").

**Fix:** read the current mods at the moment each value is needed instead of
from the render closure — at offer time for the count and at click time for the
plan:

```ts
// Inside offerBulkUndo:
const liveMods = useAppStore.getState().mods;
const changed = bulkChangedCount(snapshot, liveMods);

// Inside runRestore (runs when the user clicks Undo):
const ops = bulkUndoPlan(snapshot, useAppStore.getState().mods);
```

The toast's `onAction` closure is frozen when the toast is created, so the plan
must be computed from the store at click time, not from the closure at offer
time. A `useRef` kept in sync each render (`ref.current = mods`) is an
equivalent alternative. Add a component-level test (or at minimum a manual
sign-off) that selects N mods, runs a batch, and asserts the toast appears and
restores the pre-batch state.

## Warnings

### WR-01: The D-16 undo blocker line is never rendered; the toolbar button's aria-describedby dangles during a restore

**File:** `src/pages/Installed.tsx:5166-5201`, `4433-4437`, `2549-2584`

**Issue:** The `installed-bulk-blocker` element (line 5192) renders only inside
the floating select bar, which is gated on `selectMode` (line 5166). When the
user clicks Undo, select mode is off (the batch already called
`exitSelectMode()`), and `runRestore` sets `setSelectMode(true)` in the same
synchronous batch as `setUndoBusy(false)` in the `finally`, so the bar never
visibly shows the "Restoring the previous state…" line. During the entire
restore the only disabled control is the toolbar Select button, whose
`aria-describedby="installed-bulk-blocker"` (line 4437) points at an element
that is not in the DOM. The phase's stated D-16 contract — a rendered blocker
line, never tooltip-only — is unmet for the undo state.

**Fix:** render the blocker line somewhere that is actually mounted while
`undoBusy` (hoist it into the toolbar region or keep the select bar mounted
during the restore), and only emit `aria-describedby` when the referenced
element is present in the same render.

### WR-02: HTML ids built from raw game-file paths break the aria-describedby pairing for ignored global files

**File:** `src/pages/Conflicts.tsx:1209`, `1216-1217`

**Issue:** `conflicts-ignored-global-${file}` interpolates the raw ignored file
path into both the `id` and the `aria-describedby` value. Windows game paths
commonly contain spaces (the default Steam install is
`C:\Program Files (x86)\Steam\…`); an id with a space is invalid, and
`aria-describedby` tokenizes on whitespace, so the reference resolves to
nonexistent ids exactly when the blocker line is active. The other per-site ids
are safe because they derive from mod identity/pair keys; only the global-file
site uses the raw path.

**Fix:** encode the path for the id (e.g. `` `conflicts-ignored-global-${encodeURIComponent(file)}` ``)
used consistently in both the `id` and the `aria-describedby`, or describe the
control with a stable element instead of a path-derived id.

## Info

### IN-01: Dead `?? 'looks'` fallback contradicts the new "all" default

**File:** `src/pages/Locker.tsx:1515`

**Issue:** `section={globalSection ?? 'looks'}` is unreachable: for
`drillIn === 'global'`, `resolveLockerRoute` now defaults a bare path to
`'all'` (`lockerModeFromSearch(search) ?? 'all'`), so `globalSection` is never
null when the overlay renders. The fallback misleads readers into thinking a
bare `/locker/global` opens on Visuals.

**Fix:** drop the fallback (`section={globalSection}`) or change it to
`'all'` to match the resolver.

### IN-02: translation.json indentation is damaged around the phase's edits

**File:** `src/locales/en/translation.json:439-440`, `552`, `589`, `599`, `2094-2105`, `3898`

**Issue:** Several keys edited by the phase use 2-space indentation (and line
2105 closes a block with `},` at column 0) while the rest of the file uses
4-space style. The JSON is valid and the total key count (3110) matches the
manifest, so this is cosmetic, but it will keep churning diffs and hide real
edits in review.

**Fix:** run the project's formatter over the locale file.

### IN-03: Unconditional aria-describedby to a conditionally-rendered element

**File:** `src/components/foundry/FoundryBuildTray.tsx:201` (and the same
pattern at `src/pages/Installed.tsx:4437`, covered functionally by WR-01)

**Issue:** The Forge button always sets `aria-describedby="foundry-forge-blocker"`,
but the element only exists while the button is disabled (line 194-199). When
the button is enabled the reference dangles. Harmless in practice, but
inconsistent with the conditional wiring used everywhere else in the phase.

**Fix:** make the attribute conditional:
`aria-describedby={(!review.selected.length || busy) ? 'foundry-forge-blocker' : undefined}`.

### IN-04: Partial-failure copy counts never-attempted mods as failed

**File:** `src/pages/Installed.tsx:2587-2593`

**Issue:** `failed: Math.max(0, partial.total - partial.done)` counts every
target the loop did not reach. When a batch stops early — the 99-enabled cap or
a first failure — the remaining mods were skipped, not attempted, yet the toast
says "{{failed}} could not be changed" for all of them.

**Fix:** track the number actually attempted (or the failure reason) and pass
that count, or reword the message so skipped targets are not described as
failed.

---

_Reviewed: 2026-08-09T09:10:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
