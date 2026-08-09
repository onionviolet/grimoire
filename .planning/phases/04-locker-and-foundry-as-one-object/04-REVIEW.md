---
phase: 04-locker-and-foundry-as-one-object
reviewed: 2026-08-09T02:21:58Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - electron/main/services/foundryAssetSources.test.ts
  - electron/main/services/foundryAssetSources.ts
  - src/components/common/HeroDetailFrame.test.tsx
  - src/components/common/HeroDetailFrame.tsx
  - src/components/foundry/AssetSourcesPanel.test.tsx
  - src/components/foundry/ChangePools.test.tsx
  - src/components/foundry/FoundryHeroGrid.test.tsx
  - src/components/foundry/FoundryHeroGrid.tsx
  - src/components/foundry/HeroWorkshop.tsx
  - src/components/foundry/poolView.test.ts
  - src/components/foundry/portraitFamily.test.ts
  - src/components/foundry/recolorStagedEdit.test.ts
  - src/components/foundry/sourceGating.test.ts
  - src/components/foundry/useTrayPreview.test.ts
  - src/components/foundry/visualEdits.test.ts
  - src/components/locker/HeroColorPicker.tsx
  - src/components/locker/HeroPoseViewer.tsx
  - src/components/locker/heroStageMode.test.ts
  - src/components/locker/heroStageMode.ts
  - src/components/locker/recolorApplyConsequence.test.ts
  - src/components/locker/recolorApplyConsequence.ts
  - src/lib/inspectedAssetClaims.test.ts
  - src/locales/en/translation.json
  - src/locales/manifest.json
  - src/pages/LockerHero.tsx
  - src/types/foundry.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-09T02:21:58Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the phase 04 source changes (sub-plans 04-01 "composable replaceable stage"
and 04-02 "recolor write-set disclosure + Foundry loading badge") at standard depth:
the new pure consequence module and its renderer wiring, the `lockerManaged`
classification in the main-process asset-source inspection, the shared
`HeroDetailFrame` plate slot and per-surface stage-mode hook, the Locker/Foundry
pose-stage and pop-out flows, the tray-preview stale window, the hero-grid loading
badge, and the fixture/i18n updates. Cross-referenced the disclosure flow against
the IPC handlers (`foundry:prepareRecolorStage`, `foundry:inspectAssetSources`), the
bake/apply services (`heroColors.ts`, `foundryRecolor.ts`), and the shared
`AssetSourcesPanel`.

The write-set discovery is correctly wired end to end: the disclosure runs the same
cache-keyed bake the apply performs, the normalized entries match the apply's write,
the consequence module is pure over the inspection, and the request-keyed re-arm
works for parameter changes. The main defect found is that the "Apply anyway"
confirmation is keyed only to the request, not to the installed-mod state, so a
confirmation can be replayed against a different ownership picture — a gap in the
phase's own repudiation guarantee (T-04-10). Two further warnings concern the
disclosure panel still labelling Grimoire's own managed artifacts as
Third-party/unmanaged, and the Locker pose-failure fallback leaving the pop-out
panel open with a dead viewer.

## Critical Issues

### CR-01: Held "Apply anyway" confirmation is stale across mod-state changes — consent can be replayed against a different owner set

**File:** `src/components/locker/HeroColorPicker.tsx:381-403`, `src/components/locker/HeroColorPicker.tsx:582-587`

**Issue:** The held disclosure is keyed to the serialized export request only. The
gate skips re-inspection whenever `held.consequence.contested` is true, and the
re-arm effect clears the disclosure only when `requestKey` changes. Installed-mod
state is not part of the key and is never re-checked before the second press, so a
confirmation granted for one ownership picture is replayed against a different one.
The disclosure's own `AssetSourcesPanel` renders enable/disable toggles for the
listed sources, so the mod state can be changed in place: e.g., with a contested
disclosure naming mod X, the user enables mod Y (or disables X) from the panel, and
pressing "Apply anyway" applies over the current owners while the summary still
names only the stale set. The same hole exists when mods change outside the picker.
This violates the phase's T-04-10 repudiation guarantee ("a confirmation granted for
one write set can never be replayed"), which is implemented only for parameter
changes, not for ownership changes.

**Fix:** Invalidate the held disclosure whenever the mod list changes, and/or bind
the key to the inspected ownership state. Simplest correct variant:

```tsx
// Subscribe to the mod list (the same store FoundryHeroGrid/AssetSourcesPanel use).
const mods = useAppStore((s) => s.mods);
useEffect(() => {
  // Any mod enable/disable/reorder invalidates every held disclosure: the
  // ownership picture it described no longer exists.
  setDisclosure(null);
}, [mods]);
```

Alternatively, hold the inspection (or a fingerprint of
`{modId, enabled, priority, wins}` per matching source) alongside the request key
and re-run the pure `recolorApplyConsequence` against the freshest inspection
before honoring the held gate.

## Warnings

### WR-01: Locker-managed artifacts still render as "Third-party · unmanaged" in the disclosure panel

**File:** `src/components/foundry/AssetSourcesPanel.tsx:290-295`, `electron/main/services/foundryAssetSources.ts:135-138`

**Issue:** The new `lockerManaged` flag is consumed only by
`recolorApplyConsequence` (to exclude Grimoire's own artifacts from contesting
owners). The shared panel the disclosure renders still labels the Locker's own
ability-colours VPK with its provenance (`Third-party`) and `unmanaged` (because
`managed` is still `kind !== 'Third-party'` and `provenance()` never sees the
`locker*` markers). The phase summary claims the VPK is "now honest on every surface
that renders it instead of being labelled Third-party", but the disclosure surface
still shows exactly that label, so the user sees the write take over paths from a
"Third-party, unmanaged" source that is actually Grimoire's own rebuilt artifact —
the same confusion the phase set out to remove.

**Fix:** Surface the flag in the panel (e.g., render a "Locker-managed" label for
`source.lockerManaged` and suppress the "unmanaged" tag for it), and/or set
`managed: kind !== 'Third-party' || lockerManaged` when constructing the source.

### WR-02: Locker pose-failure auto-fallback leaves the pop-out panel open with a dead viewer and disables the pop-out toggle

**File:** `src/pages/LockerHero.tsx:152`, `src/pages/LockerHero.tsx:386-391`, `src/pages/LockerHero.tsx:423-453`

**Issue:** When a definitive pose failure occurs while the model is popped out,
`displayedMode` flips to `'image'`, but the `FloatingModelPanel` block is gated only
on `modelPanelOpen`, so the panel stays open and keeps mounting a `HeroPoseViewer`
that will fail again with the same key. The pop-out button is disabled while
`displayedMode !== 'model'`, so the only way out is the panel's own close control,
and the UI simultaneously claims "switched to Image" while a broken 3D viewer is
still on screen. `retryModel` restores the model while the panel remains open,
keeping both surfaces in a contradictory state.

**Fix:** On a definitive failure (`'unsupported' | 'export'`), also close the panel
or keep the pop-out toggle enabled; at minimum, unmount the panel viewer when
`displayedMode === 'image'`.

## Info

### IN-01: Disabled unreadable VPKs block a recolor apply they cannot affect

**File:** `src/components/locker/recolorApplyConsequence.ts:73`, `src/components/locker/HeroColorPicker.tsx:390-397`

**Issue:** `unreadable` maps every `unreadableMods` entry, including disabled VPKs,
and the Locker branch blocks the apply when `consequence.unreadable.length > 0`. A
disabled VPK cannot win any path, so it introduces no ambiguity; blocking on it (and
naming it in the error) is over-conservative and can wedge routine applies for users
with a broken-but-disabled mod in the library. `AssetSourcesPanel`/`sourceGating`
already distinguish enabled vs disabled unreadable sources for exactly this reason.

**Fix:** Filter to enabled unreadable sources for the apply block (or surface the
enabled ones in the message and only block on those).

### IN-02: The disclosure panel persists after the write has already happened

**File:** `src/components/locker/HeroColorPicker.tsx:1144`

**Issue:** The disclosure block renders whenever `disclosure.requestKey === requestKey`,
which stays true after a successful apply (the picker state is unchanged). The user
then sees "What this will overwrite … Applying takes them over" describing a write
that has already occurred, until a parameter change or unmount clears it.

**Fix:** Clear `disclosure` after a successful apply, or gate the panel on
`!applied || dirty` so it only describes a pending write.

---

_Reviewed: 2026-08-09T02:21:58Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
