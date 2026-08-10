# Phase 4 - UI Review

**Audited:** 2026-08-10
**Baseline:** 04-UI-SPEC.md (approved 2026-08-08)
**Screenshots:** not captured (code-only audit; three.js frame behavior is covered by the phase's accepted verification position)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All declared copy verbatim at the declared sites |
| 2. Visuals | 4/4 | Plate-first hierarchy with subordinate translucent stage chrome |
| 3. Color | 4/4 | Accent confined to selected segment, pop-out active state, current pill, focus rings |
| 4. Typography | 4/4 | Declared 4 sizes / 2 weights held; pill and banner copy on Label row |
| 5. Spacing | 4/4 | 8-point scale; status-pill padding reused verbatim |
| 6. Experience Design | 3/4 | State machine complete; three contract backstops stay human-verification rows |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **E1 stage-control loading behavior (backstop)** - the contract left "checking availability" vs optimistic-render open; the implementation optimistically renders "Model" and lets the attempt fail into the auto-fallback banner. Implemented and coherent; the backstop is recorded as decided-by-implementation, needs no code change.
2. **E4 partial skin-stack failure attribution (backstop)** - a stack where one skin poses and another does not is attributed at the card-badge level, not the banner; per the contract's assumption. Human row.
3. **E6 load-failure vs still-loading dot (backstop)** - the grid treats both as the same neutral dot per the contract's own assumption. Human row.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All declared strings exist verbatim: `locker.hero.stageMode.model`/`.image` ("Model"/"Image"), `locker.hero.stageModeLabel` ("Hero stage view"), `locker.hero.popOutModel` ("Open as floating panel"), `locker.hero.stageAutoFallback` ("3D preview isn't available for this hero right now. Showing the image instead."), `foundry.workshop.previewBuilding` ("Building preview"), `previewFailed`, `previewStale` ("Preview may be out of date"), `foundry.heroes.changeCountLoading` ("Change count is loading"). The retry action reuses `locker.pose.retry` verbatim; the "current" preview state is a deliberate absence (no pill), as declared.

### Pillar 2: Visuals (4/4)

The stage-mode `SegmentedControl` and pop-out `IconButton` sit in `topRight` as small translucent chrome subordinate to the full-bleed plate. The Locker auto-fallback banner is a compact inline warning with an inline Retry. Preview pills float at the plate edges, never covering the model. The loading dot occupies the exact badge position of the numeral it precedes.

### Pillar 3: Color (4/4)

Accent appears only on the selected segment, the pop-out active state, and (per the contract) is reserved but absent for the "current" pill (no pill renders). Building/stale pills are neutral `bg-black/60 text-white/80`; the failed pill is the pre-existing `bg-red-500/20 text-red-200`; the auto-fallback banner is `text-text-secondary` with a warning-toned icon. No raw hex found in the touched surfaces.

### Pillar 4: Typography (4/4)

Segmented control uses its primitive's `text-xs`; pills use `text-xs` matching the existing building/failed pills; the change-count badge reuses the legacy `text-[10px] font-semibold tabular-nums` verbatim. No new size or weight.

### Pillar 5: Spacing (4/4)

`topRight` keeps `gap-2`; the banner uses `p-4`; pills reuse `px-3 py-1`. All on the 8-point scale or documented legacy reuse.

### Pillar 6: Experience Design (3/4)

The tray-preview state machine renders building + stale co-occurring, failed alone at bottom, nothing when current. The grid distinguishes loading (dot) from zero (absent) from populated (numeral). The Locker stage falls back to image on pose failure with a working Retry (nonce remount). Pop-out is disabled unless Model is selected.

Three contract backstops remain human-verification rows: E1 stage-control loading behavior (decided by implementation), E4 partial stack failure attribution, and E6 load-failure vs loading dot (both decided per the contract's assumptions). Longest-locale wrap checks for the new strings also remain human rows.

---

**Registry audit:** shadcn not initialized; no third-party registries; not applicable.

_Audited: 2026-08-10 (Phase 7 UI review, first UI-REVIEW ever produced for this phase)_
