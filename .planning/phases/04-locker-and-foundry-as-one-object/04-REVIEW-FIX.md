---
phase: 04-locker-and-foundry-as-one-object
fixed_at: 2026-08-09T07:27:46Z
review_path: .planning/phases/04-locker-and-foundry-as-one-object/04-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-08-09T07:27:46Z
**Source review:** `.planning/phases/04-locker-and-foundry-as-one-object/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02)
- Fixed: 3
- Skipped: 0

The two Info findings (IN-01, IN-02) were outside the default
`critical_warning` fix scope and were not attempted in this iteration.

## Verification notes

All verification (TypeScript syntax via `tsc.transpileModule`, ESLint on the
modified files, `scripts/check-i18n.mjs`, JSON parse of the catalogs) ran in
the isolated fixer worktree (`rf-04-56092-1786260248`, since removed),
resolving tooling from the main checkout's `node_modules` via upward path
resolution. No full typecheck or test suite was run in this iteration, per the
per-fix verification strategy.

## Fixed Issues

### CR-01: Held "Apply anyway" confirmation is stale across mod-state changes

**Files modified:** `src/components/locker/HeroColorPicker.tsx`
**Commit:** `85d9619`
**Applied fix:** Subscribed the picker to the installed-mod list
(`useAppStore((s) => s.mods)`, the same store `FoundryHeroGrid` and
`AssetSourcesPanel` use) and added an effect that clears the held disclosure
(and any granted "Apply anyway" confirmation) whenever the mod list changes.
The ownership picture a disclosure describes no longer exists after any
enable/disable/reorder, so the next press re-runs the bake + inspection and
re-arms the contested-write gate instead of replaying consent against a
different owner set.

**Status:** fixed: requires human verification (state-handling logic; confirm
the disclosure panel toggles and external mod changes invalidate as intended).

### WR-01: Locker-managed artifacts still render as "Third-party · unmanaged"

**Files modified:** `electron/main/services/foundryAssetSources.ts`,
`src/components/foundry/AssetSourcesPanel.tsx`,
`src/locales/en/translation.json`, `src/locales/manifest.json`
**Commit:** `ef38eb8`
**Applied fix:** Hoisted the `lockerManaged` computation in the main-process
source inspection and set `managed: kind !== 'Third-party' || lockerManaged`,
so the Locker's own rebuilt VPK no longer renders "not managed by Grimoire".
The disclosure panel now also renders a "Locker-managed" label for such
sources, naming Grimoire's own artifact instead of leaving the Third-party
provenance to read as opaque. Added the `foundry.sources.lockerManaged` key to
the English catalog and regenerated `src/locales/manifest.json` (3081 keys).
`scripts/check-i18n.mjs` passes.

### WR-02: Locker pose-failure auto-fallback leaves the pop-out panel open

**Files modified:** `src/pages/LockerHero.tsx`
**Commit:** `c9aa07a`
**Applied fix:** `handlePoseFailureChange` now closes the floating model panel
when a definitive failure (`'unsupported' | 'export'`) occurs, and the
`FloatingModelPanel` block is additionally gated on `displayedMode !== 'image'`
so a dead 3D viewer can never stay mounted under the "switched to Image"
banner. Retrying the model restores the stage viewer with the panel closed.

**Status:** fixed: requires human verification (state-handling logic; confirm
the panel closes and the Image fallback is the only surface on failure).

---

_Fixed: 2026-08-09T07:27:46Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
