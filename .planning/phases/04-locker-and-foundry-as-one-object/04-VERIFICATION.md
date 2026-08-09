---
phase: 04-locker-and-foundry-as-one-object
verified: 2026-08-09T07:33:50Z
status: human_needed
score: 7/10 must-haves verified
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC1 — A staged visual edit is visible on the 3D model before the user forges it"
    test: "Start a slotted dev build (GRIMOIRE_DEV_SLOT=2 GRIMOIRE_DEV_NO_BACKGROUNDING=1 pnpm dev), open a Foundry hero workshop, select Model, stage a visual edit, and watch the tray build land on the model"
    expected: "The staged edit's bytes appear on the 3D model before Forge is pressed; a stale pill labels an older build while a newer one builds"
    why_human: "The pipeline (useTrayPreview -> foundry:buildTrayPreview -> previewVpkRegistry -> HeroPoseViewer via resolvePreviewVpk) is present, wired and state-machine-tested, but no test runs three.js; only a real renderer proves the model draws the staged edit"
  - truth: "SC2 — A Locker action that will overwrite something says what it will overwrite before it runs"
    test: "In the Locker Effects tab, apply a recolor on a hero with no contesting mod (one press), install a mod that writes the same ability-particle paths and apply again (must stop and name the mod), then move a slider and press again; repeat with a deliberately corrupted VPK in the mod folder"
    expected: "Routine apply proceeds in one press with the inline path list; a contested apply stops before the write, shows owners and the path count, and applies only on a second 'Apply anyway' press; any parameter change re-arms the gate; an unreadable VPK blocks only that apply and leaves installed state untouched"
    why_human: "The pure consequence module and gate predicate are unit-tested and the handler sequence is structurally correct, but the disclose-before-write ordering invariant in the component is not exercised by any test and needs real installed mods to observe"
  - truth: "A contested recolor write stops before the write and requires a second explicit press keyed to the exact serialized request; the gate re-arms on any parameter change"
    test: "With a contesting mod enabled, press Apply once (gate stops), press Apply anyway (writes), then move any hue/saturation/mode/gradient/trippy parameter and press Apply again"
    expected: "The second press with an unchanged request applies; after any parameter change the disclosure clears and the gate requires a fresh check and a new 'Apply anyway' press"
    why_human: "The request-keyed disclosure state, the re-arm effects, and the contested early return are present and the pure predicate is tested, but no component test exercises the state transition across a parameter change"
human_verification:
  - test: "Locker stage draws the model (plan 04-01 Task 3 steps 1-3): start GRIMOIRE_DEV_SLOT=2 GRIMOIRE_DEV_NO_BACKGROUNDING=1 pnpm dev, confirm the slot via dev-driver, open a Locker hero with a cached pose"
    expected: "The live model fills the full-bleed stage (not a floating panel); Image swaps to the 2D chain and the choice survives a reload; a hero that cannot be posed falls back to the image with a working Retry banner, and opening a different hero still starts on Model"
    why_human: "jsdom proves the plate branch is selected, not that three.js drew a frame; frame timing and fallback behavior need a running renderer"
  - test: "Judge the veil blur over a live canvas (UI-SPEC E2 partial backstop): run tools/veil-blur-bench.js on the target machine and compare against the fallback ladder in docs/locker-deep-dive.md"
    expected: "The blurred left edge over a moving model reads as intended, or the reading is recorded as inconclusive with the fallback ladder as the escape hatch"
    why_human: "Human measurement on hardware; the plan records the capable-hardware reading as inconclusive"
  - test: "Foundry workshop preview lifecycle (plan 04-01 Task 3 step 5): open a Foundry hero, verify no preview build starts on Image, select Model, stage a visual edit, then change it"
    expected: "The previous model stays on screen with the stale pill beside the building pill while the newer build is in flight; both clear when the new build lands; the failed pill keeps its own treatment"
    why_human: "The state machine is unit-tested, but the visual co-occurrence of the pills over a live canvas needs a running renderer"
  - test: "Pop out from either surface (plan 04-01 Task 3 step 6): open the Model stage in Locker and Foundry and press the PictureInPicture2 pop-out"
    expected: "The model moves into the floating panel, the plate returns to 2D, and closing the panel puts the model back on the stage; exactly one viewer instance exists at any moment"
    why_human: "Mount/unmount behavior of the lazy three.js viewer under panel state changes is not render-tested"
  - test: "Recolor disclosure interactive contract (plan 04-02 acceptance): one-press uncontested apply, contested second-press gate, slider re-arm, corrupted-VPK block"
    expected: "A routine recolor applies in one press with the inline disclosure; a contested write stops, names the mod and file count, and applies only on 'Apply anyway'; moving any slider re-runs the check; an unreadable VPK is reported by name and the managed colors VPK is not rebuilt"
    why_human: "Requires a running renderer with real installed mods; the pure module and wiring are verified, the interactive contract is not"
  - test: "Foundry hero grid live badge swap (plan 04-02 acceptance): open Foundry before the mod list resolves, then after"
    expected: "Every card shows a neutral pulse dot in the badge position until the mod list resolves, then the pulse is replaced by the accent numeral on heroes with authored changes and by nothing on heroes without"
    why_human: "Render tests pin the three branches; the live swap reading is visual"
  - test: "Portrait three-source intake user flow (SC 3): open PortraitEditor in Foundry and use 'Use current art', a recent framed image, and a file pick/drop"
    expected: "All three sources load the image into the crop frame and stage through the same editor"
    why_human: "Capability is wired and verified structurally; completing the user flow across the three sources is human-only"
  - test: "Locale wrap backstops (E1/E4 long-text): view the stage-mode control and the auto-fallback banner in the longest shipped locale"
    expected: "Model/Image segment labels stay on one line and the banner wraps rather than clips"
    why_human: "Longest-locale rendering cannot be checked by grep"
---

# Phase 4: Locker And Foundry As One Object — Verification Report

**Phase Goal:** Locker and Foundry stop being two products at two quality levels: Foundry gains the Locker's preview, the Locker gains Foundry's pre-write disclosure, and each hero surface shows what the user has already made
**Verified:** 2026-08-09T07:33:50Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | A staged visual edit is visible on the 3D model before the user forges it (SC 1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Pipeline wired end-to-end: `useTrayPreview` → `foundry:buildTrayPreview` → `previewVpkRegistry` (main) → `HeroWorkshop` pose sources → `heroPoseModels.resolvePreviewVpk`. Stale-window behavior test passes. The actual draw needs a running renderer (human item 1) |
| 2   | A Locker action that will overwrite something says what it will overwrite before it runs (SC 2) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Sound disclosure (`HeroSoundPicker` + `pickConsequence` + `AssetSourcesPanel`) and recolor disclosure (`HeroColorPicker` + `recolorApplyConsequence` + request-keyed gate) present and wired; pure logic test-covered. The disclose-before-write ordering in the component is not test-exercised (human item 5) |
| 3   | Foundry can source an image without requiring a file drop (SC 3) | ✓ VERIFIED | `PortraitEditor.tsx` has three wired intake paths: "Use current art" (`foundryFullImage`), recent framed images (`loadIntoFrame`), and file pick/drop. User flow completion routed to human item 7 |
| 4   | A Foundry hero card carries the same state a Locker hero card does: favorites, and a count of what the user has already made (SC 4) | ✓ VERIFIED | Shared `useHeroFavorites` store used by both `Locker.tsx` and `FoundryHeroGrid.tsx` (custom-event sync); change count derived via `countFoundryChangesByHero(mods)` from the app store; grid render tests pass |
| 5   | The stage-mode control lives in the frame's topRight slot as one shared two-segment control with the same labels on both surfaces; Locker defaults to Model, Foundry to Image; the pick persists per surface under its own key | ✓ VERIFIED | `heroStageMode.ts` + 6 unit tests pass; both `LockerHero.tsx` and `HeroWorkshop.tsx` render the same `SegmentedControl` with `locker.hero.stageMode.*` keys |
| 6   | `HeroDetailFrame` stays domain-ignorant: the plate slot carries the model on both surfaces and the frame imports nothing from three, Locker, Foundry or any store | ✓ VERIFIED | Import inspection + static source test (5th case in `HeroDetailFrame.test.tsx`) pass |
| 7   | Foundry's tray preview builds only while the model is on screen, and a distinct stale label renders beside the building pill while a previous build is still on screen | ✓ VERIFIED | `useTrayPreview(stagedEdits, modelVisible)` wired with `modelVisible = stageMode === 'model' \|\| modelPanelOpen`; stale-window unit test passes; pills render over both plate and popped-out panel |
| 8   | The recolor disclosure's paths come from the real bake output through the shared discovery path, never a second copy of the recipe; Grimoire's own managed artifacts never contest the user | ✓ VERIFIED | `recolorApplyConsequence.test.ts` (8 cases) + `foundryAssetSources.test.ts` pass; negative grep for `particles/abilities|particles/weapon_fx|texture_entries|material_entries` clean; IPC chain `HeroColorPicker` → `foundryPrepareRecolorStage` → `foundry:prepareRecolorStage` → `discoverRecolorEntries` verified |
| 9   | A contested write stops before the write and requires a second explicit press keyed to the exact serialized request; changing any picker parameter re-arms that gate; an unreadable VPK blocks only that one apply | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Handler sequence structurally correct (contested → early return; unreadable → early return; apply calls strictly follow); pure predicate tested. Component-level ordering/re-arm invariant has no test (human item 5) |
| 10  | A Foundry hero card distinguishes a genuinely zero change count from an unknown one: loading dot / accent numeral / deliberate absence | ✓ VERIFIED | `FoundryHeroGrid.test.tsx` (4 render cases) pass; `modsLoaded` threaded into `HeroCard` at the `ordered.map` call site |

**Score:** 7/10 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/components/locker/heroStageMode.ts` | Shared stage-mode contract (`HeroStageMode`, `useHeroStageMode`, `defaultHeroStageMode`, `readHeroStageMode`, `heroStageModeStorageKey`) | ✓ VERIFIED | Exists, substantive, wired into both pages; exports match the plan list |
| `src/components/common/HeroDetailFrame.tsx` | `platePreview`/`platePanel` slot props, domain-ignorant | ✓ VERIFIED | Props present; plate renders `platePreview ?? img chain ?? hero-name text`; imports only react/lucide/lib utilities |
| `src/components/common/HeroDetailFrame.test.tsx` | Render coverage for the plate override + static domain-ignorance assertion | ✓ VERIFIED | 5 tests pass |
| `src/components/locker/heroStageMode.test.ts` | Defaults, round trip, unknown-value fallback, distinct keys, throwing storage | ✓ VERIFIED | 6 tests pass |
| `src/components/foundry/useTrayPreview.test.ts` | Stale-window derivation coverage | ✓ VERIFIED | 5 tests pass; `useTrayPreview.ts` itself unmodified by this phase (last change f614bb7, pre-phase) |
| `src/components/locker/recolorApplyConsequence.ts` | Pure pre-write consequence over the inspection | ✓ VERIFIED | Exports `recolorApplyConsequence`; no react/api/store imports; no second recipe table |
| `src/components/locker/recolorApplyConsequence.test.ts` | Contested/uncontested/re-apply/unreadable coverage | ✓ VERIFIED | 8 tests pass |
| `electron/main/services/foundryAssetSources.ts` | `lockerManaged` flag from the four `locker*` markers | ✓ VERIFIED | Flag present; `provenance()` body untouched |
| `src/components/foundry/FoundryHeroGrid.test.tsx` | Loading/zero/numeral badge render coverage | ✓ VERIFIED | 4 tests pass |
| `src/components/foundry/PortraitEditor.tsx` | Three-source image intake | ✓ VERIFIED | Current-art, recent, and file sources all wired to the same crop frame |
| `src/components/foundry/useTrayPreview.ts` + `electron/main/services/previewVpkRegistry.ts` | Foundry tray preview lifecycle (parity lanes) | ✓ VERIFIED | Substantive and wired; registry resolves ids to real temp VPKs, never renderer-supplied paths |
| `src/components/locker/HeroSoundPicker.tsx` + `soundPickConsequence.ts` | Locker sound pre-write disclosure (parity lanes) | ✓ VERIFIED | `pickConsequence` computed from exact entries; `AssetSourcesPanel` renders the paths |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/pages/LockerHero.tsx` | `src/components/common/HeroDetailFrame.tsx` | `platePreview` (lazy `HeroPoseViewer` when `displayedMode === 'model' && !modelPanelOpen`) | WIRED | Model mounts on the stage; `platePanel={tabs.panelProps(displayedMode)}` |
| `src/components/foundry/HeroWorkshop.tsx` | `src/components/foundry/useTrayPreview.ts` | `useTrayPreview(stagedEdits, modelVisible)` | WIRED | Build follows the model wherever it renders |
| `src/components/locker/HeroPoseViewer.tsx` | `src/pages/LockerHero.tsx` | `onFailureChange` → `handlePoseFailureChange` | WIRED | Defines the auto-fallback banner trigger; not wired in Foundry (deliberate) |
| `src/components/locker/heroStageMode.ts` | `src/components/locker/useModelPanelOpen.ts` | sibling key `grimoire.{surface}.heroStage.mode` | WIRED | New key; panel-open boolean keeps its original meaning |
| `src/components/locker/HeroColorPicker.tsx` | `src/lib/api.ts` → IPC → main | `foundryPrepareRecolorStage` → `foundry:prepareRecolorStage` → `discoverRecolorEntries`; `foundryInspectAssetSources` → `foundry:inspectAssetSources` (mods.ts:1516) → `inspectFoundryAssetSources` | WIRED | Both channels verified in preload (`prepareRecolorStage`, `inspectAssetSources`) |
| `src/components/locker/HeroColorPicker.tsx` | `src/components/foundry/AssetSourcesPanel.tsx` | inline disclosure renders `<AssetSourcesPanel paths={...} />` | WIRED | One ownership implementation across surfaces |
| `src/components/locker/recolorApplyConsequence.ts` | `src/types/foundry.ts` | reads `FoundryAssetSourcesInspection` without re-deriving winners | WIRED | Type-checked; no renderer-side claims index |
| `src/components/foundry/FoundryHeroGrid.tsx` | `src/stores/appStore.ts` | `modsLoaded` threaded into `HeroCard` at the `ordered.map` call site | WIRED | Third badge branch reads the store |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `HeroWorkshop` → `HeroPoseViewer` | `poseSkinSources[].previewId` | `foundry:buildTrayPreview` → `previewVpkRegistry` → `heroPoseModels.resolvePreviewVpk` | Yes — real forged temp VPK from staged edits | ✓ FLOWING |
| `HeroColorPicker` disclosure | `consequence.paths` | `discoverRecolorEntries` parsing real bake output via `foundry:prepareRecolorStage` | Yes — exact normalized VPK entries | ✓ FLOWING |
| `HeroColorPicker` disclosure owners | `owners/winners` | `inspectFoundryAssetSources` claims index | Yes — read from installed mods | ✓ FLOWING |
| `FoundryHeroGrid` badge | `changeCount` | `countFoundryChangesByHero(mods)` from `appStore.mods` | Yes — derived from installed-mod provenance | ✓ FLOWING |
| `PortraitEditor` intake | `source` | `foundryFullImage` (current art), `foundryListPortraitImages` (recent), file reader | Yes — all three real | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Frame plate slot + domain ignorance | `pnpm exec vitest run src/components/common/HeroDetailFrame.test.tsx` | 5 passed | ✓ PASS |
| Stage-mode defaults/persistence/fallback | `pnpm exec vitest run src/components/locker/heroStageMode.test.ts` | 6 passed | ✓ PASS |
| Tray-preview stale window + lifecycle | `pnpm exec vitest run src/components/foundry/useTrayPreview.test.ts` | 5 passed | ✓ PASS |
| Recolor consequence (contested/uncontested/re-apply/unreadable) | `pnpm exec vitest run src/components/locker/recolorApplyConsequence.test.ts` | 8 passed | ✓ PASS |
| Grid badge loading/zero/numeral | `pnpm exec vitest run src/components/foundry/FoundryHeroGrid.test.tsx` | 4 passed | ✓ PASS |
| `lockerManaged` classification + provenance stability | `pnpm exec vitest run electron/main/services/foundryAssetSources.test.ts` | 5 passed | ✓ PASS |
| `heroStage` model plate arm + veil geometry | `pnpm exec vitest run src/lib/heroStage.test.ts` | 20 passed | ✓ PASS |
| Full phase scoped suite | 7 files, 53 tests | all passed | ✓ PASS |
| Wiring gate | `pnpm typecheck` (GRIMOIRE_SOCIAL_BASE_URL=https://example.invalid) | exit 0 | ✓ PASS |
| Catalog + encoding gates | `pnpm i18n:check` / `pnpm encoding:check` | both exit 0 | ✓ PASS |
| Manifest idempotency | `pnpm i18n:manifest` twice, content diff | content-identical (byte diff was line-ending normalization only) | ✓ PASS |

### Probe Execution

SKIPPED — no probes declared in PLAN/SUMMARY and this is a UI/React phase, not a migration/tooling phase (Step 7c not applicable).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-locker-foundry-parity-lanes | 04-01, 04-02 | Lane 2: Foundry 3D preview over ad-hoc VPK pose sources; Lane 3: Locker pre-write disclosure; Lane 4: Foundry image sourcing without file drop; Lane 5: Foundry grid favorites + change counts | ✓ SATISFIED | Lane 2: tray preview pipeline + stale pill; Lane 3: sound + recolor disclosures; Lane 4: PortraitEditor three-source intake; Lane 5: shared favorites + derived change counts + loading badge |
| REQ-locker-model-as-stage | 04-01 | The 3D model is the hero page's stage through a domain-ignorant plate slot, with per-surface defaults and persistence | ✓ SATISFIED (stage half) | Plate slot, stage-mode hook, pop-out, auto-fallback banner; 04-02's `requirement_coverage_note` records the interactive half (play an ability, see the skin's particles, hear the replaced sound) as a **stated deliberate partial** deferred from this phase — REQUIREMENTS.md's "Complete" marker should be read with that caveat |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers and no stub implementations found in any phase-modified file. The three `placeholder` text matches in `FoundryHeroGrid.tsx`/`foundryAssetSources.ts` are input placeholder attributes and a comment, not stubs |

### Human Verification Required

See the `human_verification` frontmatter block. Eight items total, three of which are `behavior_unverified` truths (SC 1, SC 2, and the contested-gate ordering invariant) plus five user-flow/visual/backstop checks harvested from plan 04-01 Task 3 and plan 04-02 acceptance criteria. These route to end-of-milestone UAT per the project's deferred real-game verification policy.

### Gaps Summary

No gaps found. All four roadmap success criteria have present, substantive, wired implementations; all plan must-have artifacts exist and pass their tests; every key link is wired; every prohibition is resolved; and the anti-pattern scan is clean. The remaining open items are behavioral — the live 3D draw, the interactive disclosure contract, and the visual readings — which no automated test can exercise, so the phase routes to human verification rather than passing.

### Notes and Deferred Items (not gaps)

- **Per-hero camera framing** is a stated, deliberate deviation recorded in 04-01: `heroSubjectX` remains unconsumed and the viewer keeps its fixed camera; per-hero calibration is deferred.
- **Interactive stage half** (play an ability, see skin particles, hear the replaced sound) is a stated deliberate partial of REQ-locker-model-as-stage, deferred with extension points kept compatible.
- **Locker hero page target state** (contested variant 3) remains an open product decision; the phase ships the composable replaceable stage so either outcome is buildable.

---

_Verified: 2026-08-09T07:33:50Z_
_Verifier: the agent (gsd-verifier)_
