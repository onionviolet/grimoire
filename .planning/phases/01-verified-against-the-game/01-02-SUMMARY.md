---
phase: 01-verified-against-the-game
plan: 02
subsystem: testing
tags: [vitest, jsdom, react-dom, foundry, render-testing, ipc-stub]

# Dependency graph
requires: ["01-01"]
provides:
  - "src/components/foundry/AlternativesGallery.test.tsx: alternatives-gallery lane render + audition-interaction coverage (image thumbnail + sound audition, both member kinds)"
  - "src/components/foundry/MySoundChanges.test.tsx: sound trim/gain badge lane render coverage via SoundChangeDetails (tuned, untouched, expand-driven winner text)"
affects: [01-03]

# Actuals (#2632)
actuals:
  tokens: 4118
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Member fixtures for pool-derived components are built through the real buildFoundryPoolView + collectFoundryChanges pipeline (mirroring alternativePreview.test.ts), never a hand-typed FoundryPoolMember literal, so a test can never assert against a member shape the pool view does not actually produce"
    - "Toast assertions read useToastStore.getState().toasts directly (reset to [] in beforeEach) instead of spying on the showToast module export, avoiding ESM-binding-spy fragility"
    - "Deferred-promise pattern for asserting mid-flight busy/disabled state: mockImplementation returns a manually-resolved Promise so the test can assert `disabled` before resolving, matching how the component sets busy/playing state synchronously before its first await"

key-files:
  created:
    - src/components/foundry/AlternativesGallery.test.tsx
    - src/components/foundry/MySoundChanges.test.tsx
  modified: []

key-decisions:
  - "AlternativesGallery: toast assertion reads useToastStore.getState().toasts rather than spying on the showToast named import, per the plan's 'pick one and be consistent' instruction (D-04)"
  - "MySoundChanges: the plan's third badge case ('no badges', asserting the badge container is absent') is provably unreachable through any real Mod. Exhaustive proof: soundTuningBadges always returns >=1 badge because describeSoundTuning's own untouched flag is defined as exactly '!trimmed && !gained' when recorded, and 'legacy' is pushed unconditionally when unrecorded. The existing soundTuning.test.ts never exercises this case either, confirming the finding independently. Implemented as a direct assertion against the exported soundTuningBadges pure function with the one synthetic state shape that would trigger the guard, rather than asserting a DOM state no Mod fixture can produce (see must_haves prohibition: 'MUST NOT let a render test report coverage it does not have')."

patterns-established: []

requirements-completed: [REQ-renderer-test-harness]

coverage:
  - id: D1
    description: "Alternatives-gallery lane (AlternativesGallery.tsx / AlternativePreview) renders both member kinds - image-kind through SourceThumbnail's mount-time foundrySourceThumbnail effect, sound-kind through AuditionButton - and auditions the exact clicked member at interaction depth: disabled while pending, called with the exact (modId, entryPath), aria-label swap on resolve, failure toast on a resolved-null clip, and pause + label revert on a second click"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/AlternativesGallery.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sound trim/gain badge lane (MySoundChanges.tsx / SoundChangeDetails) renders the recorded tuning verbatim (no rounding, truncation, or unit conversion) for a tuned change, renders the untouched badge alone for an untuned recorded change, and resolves real per-clip winner text through the expand-driven inspectAssetSources effect"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/MySoundChanges.test.tsx (3 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 2: Alternatives Gallery and Sound Badge Lanes Summary

**Two more Foundry lanes get interaction-depth jsdom render tests: the alternatives gallery (image thumbnail + sound audition, both member kinds) and the sound trim/gain badges (tuned/untouched states plus the expand-driven winner-text effect), reusing 01-01's proven harness with zero architectural changes.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-06T11:56:00Z
- **Completed:** 2026-08-06T12:05:00Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 (both new test files)

## Accomplishments

- `AlternativesGallery.test.tsx` renders `AlternativePreview` against both member kinds the component branches on: an image-kind member resolving its mount-time `foundrySourceThumbnail` effect into a rendered `<img>`, and a sound-kind member auditioned at interaction depth across four assertions - disabled while `auditionSourceClip` is pending (via a manually-resolved deferred promise), called with the exact `(modId, entryPath)` of the clicked member, aria-label swap from play to stop form once the clip resolves (with `HTMLMediaElement.prototype.play` spied and asserted), a resolved-null clip short-circuiting before playback and firing the failure toast (read from `useToastStore.getState().toasts` directly), and a second click pausing the element (spied `pause`) and reverting the label
- `MySoundChanges.test.tsx` renders `SoundChangeDetails` inside a `ConfirmContext.Provider`, asserting the tuned change's trim and gain badges equal exactly what `soundTuningBadges(describeSoundTuning(mod))` computed (no hand-typed literal numbers, matched via `i18n.t(...)` against the real catalog templates), the untouched change renders exactly one untouched badge and no trim/gain badge, and the expanded detail surface's per-clip winner text ("This change wins every path it writes.") only appears after the mount-driven `inspectAssetSources` effect resolves, proving the effect path is covered and not just static props
- Both member/mod fixtures for the alternatives-gallery test are built through the real `buildFoundryPoolView` + `collectFoundryChanges` pipeline (mirroring `alternativePreview.test.ts`'s own convention) rather than a hand-typed `FoundryPoolMember` literal, so the tests can never assert against a shape the pool view does not actually produce

## Task Commits

Each task was committed atomically:

1. **Task 1: Alternatives gallery renders and auditions the clicked member** - `171d4bc` (feat)
2. **Task 2: Sound trim/gain badges render the recorded tuning verbatim** - `37a0dae` (feat)

**Plan metadata:** committed separately per `<final_commit>` (worktree mode: SUMMARY.md only, STATE.md/ROADMAP.md excluded)

## Files Created/Modified

- `src/components/foundry/AlternativesGallery.test.tsx` - alternatives-gallery lane render + audition-interaction test (4 tests)
- `src/components/foundry/MySoundChanges.test.tsx` - sound trim/gain badge lane render test (3 tests)

## Decisions Made

- **Toast assertion via store state, not a spy on the named `showToast` import (Task 1):** the plan's must_have offered either approach. Reading `useToastStore.getState().toasts` (reset to `[]` in `beforeEach`) avoids the fragility of `vi.spyOn` against an ESM named-import binding and matches how the codebase's own `Toast` type is already imported elsewhere for assertions.
- **Deferred-promise pattern for the "disabled while pending" assertion (Task 1):** `auditionSourceClip.mockImplementation(() => new Promise(...))` captures the resolver so the test can assert `button.disabled === true` synchronously after `click()` (before the promise settles), matching the component's own `setBusy(true)` call preceding its first `await`.
- **"No badges" case implemented as a pure-function assertion, not a DOM render (Task 2):** proven exhaustively that `soundTuningBadges(describeSoundTuning(mod))` cannot return `[]` for any real `Mod` - an unrecorded change always yields `legacy`, a recorded one always yields `untouched` or a trim/gain/loop badge, because `untouched` is defined as exactly `!trimmed && !gained` when recorded. The pre-existing `soundTuning.test.ts` independently confirms this: it has no test exercising an empty-badges outcome either. Rather than construct a DOM assertion for a state no Mod fixture can produce (which is exactly the "coverage it does not have" failure the phase's own prohibition names), the test calls the exported `soundTuningBadges` function directly against the one synthetic state shape that would trigger the component's `if (!badges.length) return null` guard, proving the guard's logic is correct without misrepresenting it as reachable.

## Deviations from Plan

### Documented Finding (not a bug, not a fix)

**1. [Transparency] The "no badges" state named in must_haves is unreachable through any real Mod**
- **Found during:** Task 2, while building the badge-case fixtures
- **Finding:** `soundTuningBadges` always returns at least one badge for any state `describeSoundTuning` can produce, by construction (see Decisions Made above for the exhaustive proof).
- **Resolution:** Validated the guard directly against the exported pure function with a synthetic state, documented inline with a comment explaining the proof, and recorded here rather than silently substituting a weaker or misleading DOM assertion.
- **Files affected:** `src/components/foundry/MySoundChanges.test.tsx`
- **Verification:** the substitute test passes and states its own reasoning inline; no DOM assertion in the file claims coverage of an unreachable state.
- **Committed in:** `37a0dae`

No auto-fixed bugs, blocking issues, or architectural changes this plan. Both source components (`AlternativesGallery.tsx`, `MySoundChanges.tsx`) worked exactly as documented; every deviation above is a test-construction finding, not a code change.

**Total deviations:** 1 documented finding (no code fix, no bug)
**Impact on plan:** No scope creep, no source file touched outside the two named test files.

## Issues Encountered

None beyond the documented finding above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Four of the six `REQ-renderer-test-harness` lanes now have interaction-depth render tests (pool cards, audition preview from 01-01; alternatives gallery, sound trim/gain badges from this plan)
- The harness shape (pragma, i18n init, electronAPI stub, act lifecycle) remains unchanged and is directly reusable by plan 01-03 (seeded `SoundImportEditor`, portrait editor with a canvas stub)
- No blockers for 01-03

## Self-Check: PASSED

- FOUND: `src/components/foundry/AlternativesGallery.test.tsx`
- FOUND: `src/components/foundry/MySoundChanges.test.tsx`
- FOUND commit: `171d4bc`
- FOUND commit: `37a0dae`

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
