# Phase 3 - UI Review

**Audited:** 2026-08-10
**Baseline:** 03-UI-SPEC.md (approved 2026-08-08)
**Screenshots:** not captured (code-only audit; component render tests in the suite cover the interaction states)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Two label variances from the approved contract, both internally consistent with the app's existing vocabulary |
| 2. Visuals | 4/4 | Hierarchy matches: primary Stage button first, subordinate status line and caption, compact link |
| 3. Color | 4/4 | Accent reserved to recolor tag, pressed toggle, stage button, focus rings; neutral status copy |
| 4. Typography | 4/4 | Declared 4 sizes / 2 weights held; compact link at `text-[11px]` |
| 5. Spacing | 4/4 | Multiples of 4 with documented legacy exceptions only |
| 6. Experience Design | 3/4 | State coverage strong; two contract backstops remain human-verification rows |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Stage label spelling/suffix variance** - the approved contract declared "Stage colour" / "Stage trippy VFX"; the implementation ships "Stage Color" / "Stage Trippy". The implementation is internally consistent with every existing apply label in the app ("Apply Color", "Apply Rainbow", "Apply Gradient", "Apply Trippy") and with the `locker.colors` key family, so the variance is accepted and recorded rather than changed. No user-facing defect.
2. **E1 partial-VFX-detection backstop** - whether a hero's partly-extractable VFX layers state which layers will be staged is not established by any artifact. Wired behavior exists (`stageUnreadable` blocks, `stageLayerConfirm` discloses), but the per-layer partial case stays a human verification row.
3. **E4 failed-pool-write revert backstop** - the shared `ShuffleToggleButton` is unit-covered on the pure helpers; the live failure-revert of `aria-pressed` remains an in-app human check.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Every visible string in the phase's surfaces is an i18n key with an English fallback (`t(key, fallback)`); no bare hardcoded strings were found in `HeroColorPicker`, `HeroEffectsPanel`, `SoundBrowse`, `LibraryBrowse`, `PortraitEditor`, `TextureBrowse`, `MyChanges`, or `FoundryBuildTray`. The declared keys all exist: `stagedStatus` ("Staged, not yet forged"), `notStaged`, `stagesIntoTray`, `stageLayerConfirm`, `stageUnreadable`, `locker.trippy.appliesImmediately`.

Findings:
- **Variance (accepted):** `stageColor` = "Stage Color" vs declared "Stage colour"; `stageTrippy` = "Stage Trippy" vs declared "Stage trippy VFX". The implementation mirrors the existing `applyColor`/`applyTrippy` labels and the app's US vocabulary; changing it would make the new labels inconsistent with the labels they replace. Recorded, no change.
- **Variance (accepted):** `locker.trippy.appliesImmediately` = "This applies immediately and does not go through the build tray." vs declared "doesn't go". Contractually equivalent; no change.
- `foundry.myChanges.shuffleOff` fallback copy is a `t(key, fallback)` call; fine.

### Pillar 2: Visuals (4/4)

The Abilities-tab staging area leads with the accent-bordered primary Stage button; the status line and distinguishing caption sit below in `text-text-secondary`; the "Open in Sound Locker" link reuses the compact-link pattern at `text-[11px]` with the `ExternalLink` icon. The sound-shuffle toggle is a same-row secondary affordance that gains accent fill only when pressed. The recolor row in My changes is complete without a preview affordance, same height as siblings.

### Pillar 3: Color (4/4)

Accent usage is confined to the declared four: the recolor `Tag`/`Palette` icon, the shuffle toggle's pressed state, the Stage button's primary variant, and `focus-visible:ring-accent`. Status lines, captions, and descriptions stay on `text-text-primary`/`text-text-secondary`. No hardcoded hex values found in the touched components. The exhausted kind switch falls back to a neutral `FileQuestion`/`Change` label rather than borrowing the texture row.

### Pillar 4: Typography (4/4)

Exactly four sizes (`text-[11px]`, `text-xs`, `text-sm`, `text-lg`) and two weights (400/600) appear in the phase's new elements. The compact link and scope captions use `text-[11px] font-normal`; the status line uses `text-xs text-text-secondary`; no fifth size or third weight was introduced.

### Pillar 5: Spacing (4/4)

New spacing is on the 8-point scale (`gap-1`, `gap-2`, `px-2`, `p-4`). The documented legacy exceptions (Tag `py-0.5`, compact-link `gap-1.5`/`px-1.5`) are reused verbatim from their pre-existing call sites, not newly authored.

### Pillar 6: Experience Design (3/4)

State coverage is strong: empty (disabled Stage button is the empty state), loading (`Button isLoading` "Staging" spinner), error (`stageUnreadable` blocks and names the mods), populated (mode-specific Stage labels), overflow (longest label same width as the label it replaced), and zero-one-many (one tray row per hero via per-hero id replace-in-place). Disabled controls carry rendered blocker lines per D-16 (verified in `FoundryBuildTray` and the Installed toolbar).

Two contract backstops remain unverified in-app and are recorded as human rows rather than silent passes: E1 partial VFX-layer detection, and E4 failed-pool-write aria-pressed revert. Both are structurally wired and unit-covered on the pure helpers; they need an in-app observation.

---

**Registry audit:** shadcn not initialized; no third-party registries; not applicable.

_Audited: 2026-08-10 (Phase 7 UI review, first UI-REVIEW ever produced for this phase)_
