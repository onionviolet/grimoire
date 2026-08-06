---
phase: 01-verified-against-the-game
plan: 03
subsystem: testing
tags: [vitest, jsdom, react-dom, foundry, render-testing, web-audio, canvas, ipc-stub]

# Dependency graph
requires:
  - phase: 01-verified-against-the-game
    provides: "The proven render-test harness shape from plan 01-01 (jsdom pragma, i18n side-effect import, IS_REACT_ACT_ENVIRONMENT + createRoot/act lifecycle, window.electronAPI.foundry stub)"
provides:
  - "src/components/foundry/SoundImportEditor.test.tsx: seeded sound editor render coverage across all four seedTrimWindow fit outcomes (none/exact/clamped/dropped)"
  - "src/components/foundry/PortraitEditor.test.tsx: portrait editor crop-and-apply, MAX_OUTPUT_LONG cap, and whole-family staging render coverage"
  - "A reusable pattern for stubbing jsdom-missing Web Audio (AudioContext/decodeAudioData/createBufferSource), HTMLImageElement decode (src-assignment queues a load microtask, naturalWidth/Height controllable), and HTMLCanvasElement 2D context (shared fake instance so multiple draw call sites land in one recorded call list), each asserted on rather than merely silenced"
affects: []

# Actuals (#2632)
actuals:
  tokens: 6730
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Web Audio stub: a class-based fake AudioContext assigned to window.AudioContext, with decodeAudioData resolving a fake AudioBuffer carrying real (non-zero) sample data via getChannelData, since the waveform peak reducer and RMS reducer both walk it"
    - "HTMLImageElement decode stub: vi.spyOn accessor mocks on naturalWidth/naturalHeight getters plus the src setter, dispatching a real 'load' Event from a queued microtask, so both a component's own new Image() calls and a child component's independent new Image() calls resolve consistently against one shared controllable dimension"
    - "Shared fake canvas 2D context: a single object returned by every HTMLCanvasElement.prototype.getContext('2d') call, so drawImage calls from two different canvases (an intermediate crop-frame canvas and a final target-sized bake canvas) both land in one inspectable call list, discriminated by their distinct output (dw, dh) arguments"
    - "Deriving expected pixel rectangles from mirrored production math (LockerImageCropper's unexported frame-sizing constants/formulas, reproduced in the test) or from directly imported pure helpers (cropToTargetRect, seedTrimWindow), never hand-typed pixel literals"

key-files:
  created:
    - src/components/foundry/SoundImportEditor.test.tsx
    - src/components/foundry/PortraitEditor.test.tsx
  modified: []

key-decisions:
  - "SoundImportEditor's normalize/match-volume path (targetClipPath) was left untested: it is optional, renders only when a target clip path is supplied, and D-04's four required outcomes are all about seedTrimWindow fit, not the normalizer. Testing it would have required stubbing foundryVoiceclip and fetch() for no coverage the plan asked for."
  - "PortraitEditor's own applyCrop() draws to a second, target-sized canvas independent of LockerImageCropper's own bake canvas; both share one stubbed getContext('2d') instance so both drawImage calls are recorded together, discriminated by their distinct (dw, dh) output arguments rather than by which canvas element issued them"
  - "The MAX_OUTPUT_LONG cap test reuses the anchor (card, 600x800) item's target aspect at 10x the frame size rather than inventing a separate fixture, so the same fitAspect/expectedFramedRect helpers used by the uncapped case exercise the cap without new bookkeeping"

patterns-established:
  - "For any future canvas-drawing render test: stub HTMLCanvasElement.prototype.getContext once with a single retained fake context object (not a fresh mock per call), so draws from multiple canvas elements created during one interaction are all visible in one call list"
  - "For any future Image-decoding render test: spy on the accessor pair (naturalWidth/naturalHeight getters, src setter) rather than assigning the real setter, avoiding jsdom's own (unimplemented) network-fetch attempt for the src URL"

requirements-completed: [REQ-renderer-test-harness]

coverage:
  - id: D1
    description: "Seeded SoundImportEditor renders against a decoded clip (via a stubbed Web Audio stack) and opens on the fitted trim window at every seedTrimWindow outcome (none, exact, clamped, dropped), with every expected millisecond/gain value derived by calling seedTrimWindow in the test rather than hand-typed"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/SoundImportEditor.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Portrait editor crops and applies a picked image through a real (stubbed) 2D canvas context: LockerImageCropper's own drawImage call and PortraitEditor's own target-sized re-bake are both asserted against source rectangles derived from the stubbed natural dimensions and the cropper's mirrored frame-sizing math, and the applied payload is proven to carry the stubbed toDataURL result through to the IPC stage call"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/PortraitEditor.test.tsx (test: 'crops and applies through a real 2D-context call, deriving the source rectangle from the stubbed dimensions')"
        status: pass
    human_judgment: false
  - id: D3
    description: "A heavily oversized source is capped on its long edge at MAX_OUTPUT_LONG while the output aspect holds, rather than being left uncapped or squashed"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/PortraitEditor.test.tsx (test: 'caps a heavily oversized source on its long edge while holding the target aspect')"
        status: pass
    human_judgment: false
  - id: D4
    description: "The portrait editor lists every discovered family variant (by translated label) and refuses to stage a subset: overriding only one variant leaves the Stage button disabled and clicking it stages nothing further, calls neither onStage nor onClose"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/PortraitEditor.test.tsx (test: 'lists every discovered family variant and refuses to stage a subset')"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 3: Seeded Sound Editor and Portrait Editor Render Coverage Summary

**The last two of the six Foundry render lanes now have interaction-depth jsdom coverage: `SoundImportEditor` proves all four `seedTrimWindow` fit outcomes against a stubbed Web Audio decode, and `PortraitEditor` proves crop-and-apply, the `MAX_OUTPUT_LONG` cap, and whole-family staging refusal against a stubbed canvas 2D context and image decode.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-06T17:08:58Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 (both new test files)

## Accomplishments

- `SoundImportEditor.test.tsx` drives the seeded sound editor through a real decode against a fake `AudioContext`/`decodeAudioData`/`createBufferSource` stack and a stubbed canvas 2D context (so the waveform draw block actually executes rather than taking its null-guarded early return), and asserts the rendered trim sliders plus the `onChange` payload match `seedTrimWindow`'s output at all four fit outcomes: `none` (no seed), `exact` (fits), `clamped` (end past the clip), and `dropped` (narrower than `MIN_WINDOW_MS`). Every expected millisecond and gain value is computed by calling `seedTrimWindow` in the test, never hand-typed.
- `PortraitEditor.test.tsx` drives the portrait editor through a real pick -> crop -> apply cycle against a stubbed `HTMLImageElement` decode (assigning `src` queues a `load` dispatch on a microtask; `naturalWidth`/`naturalHeight` are controllable) and a single shared stubbed canvas 2D context, proving three things the plan named:
  1. **Crop and apply:** `LockerImageCropper`'s own `drawImage` call and `PortraitEditor`'s own target-sized re-bake are both asserted against source rectangles derived from the stubbed natural dimensions and the cropper's own (unexported, mirrored-in-test) frame-sizing math, and the applied payload is proven to reach `foundryStagePortraitImage` carrying the stubbed `toDataURL` string.
  2. **The `MAX_OUTPUT_LONG` cap:** a 10x-oversized source is capped on its long edge to exactly 1280px while the output aspect holds (asserted via the identical mirrored formula, not a hand-picked "nice" pixel count).
  3. **Whole-family staging:** both discovered variants (`Hero card`, `Minimap icon`) are listed; overriding only one leaves the coverage-blocked warning showing and the Stage button disabled, and clicking it stages nothing further and calls neither `onStage` nor `onClose`.
- Neither test installs the native `canvas` package (confirmed via `git diff --exit-code package.json`); both stub only the specific browser APIs the two components actually call, read directly from source rather than assumed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Seeded SoundImportEditor opens on the fitted trim window** - `03ea7d5` (feat)
2. **Task 2: Portrait editor crops and applies through a real canvas call** - `c74a999` (feat)

**Plan metadata:** committed separately per `<final_commit>` (worktree mode: SUMMARY.md only, STATE.md/ROADMAP.md excluded)

## Files Created/Modified

- `src/components/foundry/SoundImportEditor.test.tsx` - seeded sound editor render + interaction test (4 tests: fit none/exact/clamped/dropped)
- `src/components/foundry/PortraitEditor.test.tsx` - portrait editor crop/apply/cap/staging render + interaction test (3 tests)

## Decisions Made

- **SoundImportEditor's normalize/match-volume path left untested:** it only renders when `targetClipPath` is supplied and is optional; the plan's four required outcomes are all about `seedTrimWindow` fit, not the loudness normalizer. Testing it would have required stubbing `foundryVoiceclip` and `fetch()` for coverage the plan did not ask for.
- **A single shared fake canvas 2D context, not one per canvas:** `PortraitEditor`'s `applyCrop` creates its own `document.createElement('canvas')` independent of `LockerImageCropper`'s own bake canvas. Rather than trying to distinguish which canvas element requested a context, both draws land in one stubbed context's recorded call list and are discriminated by their distinct output (`dw`, `dh`) arguments, which are unique per draw site by construction (uncapped/capped framed size vs. the template's real target size).
- **The `MAX_OUTPUT_LONG` cap test reuses the anchor item's target aspect at 10x scale** rather than inventing a new fixture, so the same `fitAspect`/`expectedFramedRect` helpers used by the uncapped crop-and-apply test also exercise the cap, with no separate bookkeeping.
- **Expected pixel rectangles are computed, not hand-typed:** `LockerImageCropper.tsx`'s frame-sizing constants and math (`FRAME_MAX_W`, `fitAspect`, the cover-scale/offset/cap formula) are not exported, so the test mirrors them verbatim with a comment noting the source, and uses the imported `cropToTargetRect`/`seedTrimWindow` pure functions directly wherever possible. This keeps every assertion tied to production logic rather than to a value someone typed once and never re-derived.

## Deviations from Plan

None - plan executed exactly as written. Both `read_first` lists and the `<action>` guidance for stubbing Web Audio, canvas, and image decode matched what the components actually needed; no additional stubs or component changes were required.

## Issues Encountered

- **Negative-zero mismatch in `toEqual` assertions:** the cropper's centered-cover math computes offsets as `-offset.x` where `offset.x` is `0`, which JavaScript represents as `-0`. Vitest's `toEqual` distinguishes `-0` from `+0` (unlike `toBe`/`Object.is` in some other contexts), so the first assertion pass failed on a semantically-correct `0`. Fixed by normalizing `-0` to `0` in the actual call's arguments before comparing (a `normalizeZero` helper), rather than weakening the assertion.
- **`vi.fn()` without an explicit generic failed `tsc -b`** for `onClose` and `confirmFn` (the `ConfirmFn` type), matching the same pattern the 01-01 plan's summary already flagged for `ChangePools.test.tsx`. Fixed by typing each mock with its real signature (`vi.fn<() => void>()`, `vi.fn<ConfirmFn>()`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six Foundry render lanes named by `REQ-renderer-test-harness` now have interaction-depth render tests (pool cards and audition-preview from 01-01; alternatives gallery and sound trim/gain badges from 01-02; seeded sound editor and portrait editor from this plan).
- Both canvas-drawing lanes (`SoundImportEditor`, `PortraitEditor`) assert against a stubbed context's recorded calls, so neither can silently pass through its null-guarded fallback.
- The native `canvas` package remains absent from `package.json`; `pnpm exec vitest run` (full suite, 146 files / 1582 tests), `pnpm exec tsc -b`, `pnpm lint`, and `pnpm encoding:check` are all green.
- No blockers for the remaining phase-1 work (the in-game verification sweep, the rigged-preview release gate, and the performance ConVar defaults), none of which this plan touched.

## Self-Check: PASSED

- FOUND: `src/components/foundry/SoundImportEditor.test.tsx`
- FOUND: `src/components/foundry/PortraitEditor.test.tsx`
- FOUND commit: `03ea7d5`
- FOUND commit: `c74a999`

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
