---
phase: 04-locker-and-foundry-as-one-object
plan: 01
subsystem: ui
tags: [react, three.js, electron, hero-stage, tray-preview, i18n]

requires:
  - phase: 03-foundry-completes-its-build-contract
    provides: HeroPoseViewer's pose-failure taxonomy, useTrayPreview's build lifecycle, and the shared HeroDetailFrame chrome
provides:
  - "HeroDetailFrame platePreview/platePanel slot props: a composable replaceable stage the frame stays ignorant of"
  - "heroStageMode hook: per-surface model/image stage choice persisted under its own localStorage key"
  - "HeroPoseViewer onFailureChange callback reporting failure kind outward"
  - "Locker hero page rendering the 3D model as its stage by default, with segmented Model/Image control, pop-out, and auto-fallback banner"
  - "Foundry workshop on the same stage slot with an opt-in Image default, tray preview building only while the model is visible, and the tray-preview stale pill"
affects: [04-02-locker-effects-disclosure, 05-one-inventory-one-journey, uat-04]

actuals:
  tokens: 8299    # chars/4 over the realized src diff (33196 chars added+deleted)
  tasks: 3        # tasks completed (2 auto + 1 auto-approved human-verify checkpoint)
  commits: 2      # production commits (per-task); final docs commit separate

tech-stack:
  added: []
  patterns:
    - "Domain-ignorant frame slot: caller-supplied ReactNode plate plus a plain ARIA bag, enforced by a static source test"
    - "Per-surface localStorage preference hook, sibling to useModelPanelOpen, with union validation on every read"
    - "Derived stale state from useTrayPreview's existing return shape (building && previewId !== null), no hook change"

key-files:
  created:
    - src/components/locker/heroStageMode.ts
    - src/components/locker/heroStageMode.test.ts
    - src/components/common/HeroDetailFrame.test.tsx
    - src/components/foundry/useTrayPreview.test.ts
  modified:
    - src/components/common/HeroDetailFrame.tsx
    - src/components/locker/HeroPoseViewer.tsx
    - src/pages/LockerHero.tsx
    - src/components/foundry/HeroWorkshop.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json

key-decisions:
  - "Stage-mode persistence uses a NEW per-surface key (grimoire.{surface}.heroStage.mode); the panel-open boolean keeps its original meaning and becomes the pop-out state"
  - "Locker defaults optimistically to Model per D-02; a definitive pose failure flips only the displayed mode for that mount and is never persisted"
  - "Foundry gets no auto-fallback banner: an opted-in preview keeps the model and shows HeroPoseViewer's own failure state"
  - "The four obsolete 3D-toggle i18n keys (hide3dModel, showLive3dModel, hide3dPreview, show3dPreview) were removed once i18n:check proved no references remained, per the plan's conditional"
  - "The plan's literal acceptance grep over-matches the pre-existing lockerUtils import; the plan's precise path-based verification is satisfied and test-enforced"

patterns-established:
  - "Frame slot pattern: optional ReactNode prop plus a plain ARIA prop bag, documented in the same voice as topRight/railExtra/after"
  - "Sibling-hook pattern: a per-surface preference hook that imports the existing ModelPanelSurface union instead of re-declaring the two strings"
  - "Latest-callback ref pattern for HeroPoseViewer's onFailureChange so an inline arrow never restarts the loader"

requirements-completed: [REQ-locker-model-as-stage, REQ-locker-foundry-parity-lanes]

coverage:
  - id: D1
    description: "HeroDetailFrame plate slot: a caller-supplied platePreview renders in place of the plate img, platePanel lands on the plate wrapper, and the frame keeps no Locker, Foundry, three.js or store imports"
    requirement: REQ-locker-model-as-stage
    verification:
      - kind: unit
        ref: "src/components/common/HeroDetailFrame.test.tsx#plate slot"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-surface stage-mode hook: Locker defaults to model, Foundry to image, unknown stored values fall back to the surface default, surfaces use distinct keys, and throwing storage yields the default"
    requirement: REQ-locker-model-as-stage
    verification:
      - kind: unit
        ref: "src/components/locker/heroStageMode.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tray-preview stale window: building stays true and the previous preview id remains reported while a newer build is in flight, and failure clears the id so stale and failed cannot co-occur"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "src/components/foundry/useTrayPreview.test.ts#stale window"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 3D model is the Locker hero stage by default through the plate slot, with a shared Model/Image control, a PictureInPicture2 pop-out, and an auto-fallback banner when a hero cannot be posed"
    requirement: REQ-locker-model-as-stage
    verification:
      - kind: unit
        ref: "src/components/common/HeroDetailFrame.test.tsx#plate slot"
        status: pass
    human_judgment: true
    rationale: "A jsdom test proves the plate branch is selected, not that three.js drew a frame. In-game rendering and the veil-over-canvas reading are human-only per 04-VALIDATION.md; the plan's human-verify checkpoint was auto-approved under auto mode and stays pending for end-of-milestone UAT."
  - id: D5
    description: "Foundry drives the same stage slot on an opt-in Image default, its tray preview builds only while the model is visible, and the stale pill labels the retained build beside the building pill"
    requirement: REQ-locker-foundry-parity-lanes
    verification:
      - kind: unit
        ref: "src/components/foundry/useTrayPreview.test.ts#stale window"
        status: pass
    human_judgment: true
    rationale: "The wiring is proven by typecheck, lint and the tray state unit test, but the visual behavior (model on the plate, pills over a live canvas) needs a running renderer, which is human-only per 04-VALIDATION.md."

duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 4 Plan 1: The Composable Replaceable Stage Summary

**The 3D model is now the Locker hero page's stage and Foundry's opt-in stage through one domain-ignorant plate slot on the shared frame, with per-surface stage-mode persistence, a pop-out, a Locker auto-fallback banner, and a labelled stale tray-preview state.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-09T06:46:00Z
- **Completed:** 2026-08-09T06:57:07Z
- **Tasks:** 3 (2 auto + 1 auto-approved human-verify checkpoint)
- **Files modified:** 10

## Accomplishments

- `HeroDetailFrame` gained `platePreview` and `platePanel` slot props: the caller supplies the plate content (the live model) and a plain ARIA bag, and the frame still imports nothing from Locker, Foundry, three.js or any store. A static source test now enforces that invariant.
- `heroStageMode.ts` persists a per-surface `'model' | 'image'` choice under a new `grimoire.{surface}.heroStage.mode` key, sibling to the panel-open boolean; unknown or corrupted stored values fall back to the surface default on every read.
- `HeroPoseViewer` reports its failure kind outward through `onFailureChange` (held in a ref so an inline arrow never restarts the loader), keeping the existing failure state and per-skin attribution untouched.
- `LockerHero` renders the model as the full-bleed stage by default, with a shared `SegmentedControl` (Model/Image), a `PictureInPicture2` pop-out that moves the model into the existing floating panel, and a Locker-only auto-fallback banner whose Retry re-attempts the pose without ever persisting the fallback flip.
- `HeroWorkshop` drives the same slot with the same control on an opt-in Image default; its tray preview now builds only while the model is visible (`modelVisible`), and a new stale pill renders beside the building pill whenever a previous build is still on screen while a newer one is in flight, in both presentations.
- `useTrayPreview.ts` is untouched: the stale window is a derived fact from its existing return shape, pinned by a new unit test.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End to end "the model is the Locker hero page's stage"** - `bb6897d` (feat)
2. **Task 2: Foundry stage on its own opt-in default, and the stale tray preview** - `775fe8b` (feat)
3. **Task 3 (checkpoint:human-verify, gate=blocking): Confirm the model draws as the stage** - auto-approved under auto mode (`workflow.auto_advance: true`); in-game visual checks deferred to end-of-milestone UAT per the existing deferred real-game verification policy

## Files Created/Modified

- `src/components/common/HeroDetailFrame.tsx` - Added `platePreview` (caller-supplied plate content) and `platePanel` (ARIA bag on the plate wrapper); render order is platePreview, then the img chain, then the hero-name text fallback
- `src/components/locker/heroStageMode.ts` - New `HeroStageMode` union, `heroStageModeStorageKey`, `defaultHeroStageMode`, `readHeroStageMode`, `useHeroStageMode`
- `src/components/locker/HeroPoseViewer.tsx` - Added `onFailureChange` prop invoked beside every `setFailure` call site
- `src/pages/LockerHero.tsx` - Stage-mode control, pop-out, plate mount, panel pop-out mount, auto-fallback banner, render-phase failure reset
- `src/components/foundry/HeroWorkshop.tsx` - Same stage control, `modelVisible` preview lifetime, shared status-pill element with the stale pill
- `src/components/common/HeroDetailFrame.test.tsx` - New render coverage (4 plate cases + 1 static domain-ignorance assertion)
- `src/components/locker/heroStageMode.test.ts` - New hook coverage (6 cases)
- `src/components/foundry/useTrayPreview.test.ts` - New stale-window coverage (5 cases, mocked api, fake timers)
- `src/locales/en/translation.json` - Added 6 keys (5 Locker stage keys + previewStale), removed 4 obsolete 3D-toggle keys
- `src/locales/manifest.json` - Regenerated (3071 keys)

## Decisions Made

- Stage mode persists per surface under its own key, never a reinterpretation of the panel-open boolean (planner decision adopted unchanged).
- The Locker opens optimistically on Model; the auto-fallback flip is a per-mount displayed override and is never persisted (planner decision adopted unchanged).
- Foundry opens on Image and gets no auto-fallback banner: an opted-in preview keeps the model and shows the viewer's own failure copy (planner decision adopted unchanged).
- The four obsolete 3D-toggle keys were removed only after `pnpm i18n:check` proved no references remained anywhere in `src/`, per the plan's conditional.

## Deviations from Plan

### Plan acceptance-criterion note (not a code deviation)

**1. The literal import-grep acceptance criterion over-matches a pre-existing import**
- **Found during:** Task 1
- **Issue:** The acceptance criterion `! grep -E '^import' src/components/common/HeroDetailFrame.tsx | grep -Eq 'three|locker|foundry|store'` matches the pre-existing `import { getHeroNamePath } from '../../lib/lockerUtils'` (the substring "locker"), so it can never pass on the plan's own untouched file. The plan's precise `<verification>` (no three, `@react-three/*`, `components/locker/`, `components/foundry/`, or store imports) passes, and the new static assertion in `HeroDetailFrame.test.tsx` enforces exactly that intent.
- **Fix:** None needed in code. Satisfied the stated invariant (path-precise) and documented the grep mismatch.
- **Files modified:** none beyond the plan's list
- **Verification:** `git grep -E '^import' -- src/components/common/HeroDetailFrame.tsx` shows no three/@react-three/components/locker/components/foundry/store import; static test passes

---

**Total deviations:** 0 auto-fixed (1 plan-accuracy note)
**Impact on plan:** No scope creep. All plan success criteria are met; the plan's grep was a rough heuristic that collides with a lib utility path.

## Issues Encountered

- The plan names the two new hook/tray tests with `.ts` extensions, but JSX does not parse in `.ts`. The harnesses were written with `React.createElement` to keep the plan's filenames (the acceptance criteria grep those filenames). No behavior change.
- `useTrayPreview` sets `building` immediately and only debounces the build call; the first test draft assumed the pill was debounced too, and was corrected.
- eslint-plugin-react-hooks v7 rejects synchronous `setState` inside effects, so the Locker's failure reset on hero/skin change uses React's documented render-phase "adjust state when props change" pattern instead.

## Known Stubs

None. No placeholder copy, hardcoded empty values, or unwired data sources were introduced.

## Deferred Verification

The plan's Task 3 human-verify checkpoint (in-game model drawing, veil-over-canvas reading, pop-out/fallback behavior in a running dev slot) was auto-approved because auto mode is active and the gate is `blocking`. Those checks remain human-only and are routed to end-of-milestone UAT, consistent with STATE.md's existing deferred real-game verification policy.

## Next Phase Readiness

- Ready for `04-02-PLAN.md`: the stage slot is composable and domain-ignorant, `heroStageMode` keys are in place for both surfaces, and `useTrayPreview`'s state machine is pinned by tests the stale pill derives from.
- The in-game rendering half of REQ-locker-model-as-stage remains for real-game UAT at milestone end, along with the plan's own deferred items (per-hero camera framing, interactive stage half, typed `HeroPoseInfo` reason).

---
*Phase: 04-locker-and-foundry-as-one-object*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: HeroDetailFrame.test.tsx, heroStageMode.ts, heroStageMode.test.ts, useTrayPreview.test.ts, 04-01-SUMMARY.md
- Commits verified in git log: bb6897d (Task 1), 775fe8b (Task 2)
- All plan-level verifications green: typecheck, lint, full test suite (167 files / 1878 tests), i18n:check, encoding:check, manifest idempotent, frame domain-ignorance check, useTrayPreview.ts unmodified
