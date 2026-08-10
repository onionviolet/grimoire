---
phase: 01-verified-against-the-game
plan: 04
subsystem: testing
tags: [vitest, chatwheel, electron-main, integration-test]

# Dependency graph
requires: []
provides:
  - "electron/main/services/chatWheel.roundtrip.test.ts: real-binary Chat Wheel VPK round trip and rejection-path coverage, closing the Chat Wheel clause of REQ-renderer-test-harness"
affects: [testing, chatWheel]

# Actuals (#2632)
actuals:
  tokens: 1200
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() harness object for mocking electron's app.getAppPath() when the value is needed both at eager module-scope (skip guard) and inside test bodies, mirroring the existing chatWheel.test.ts pattern"
    - "eager describe.skipIf(!binaryAvailable) evaluated from a try/catch around chatLaneBinaryPath() at collection time, so CI on ubuntu-latest skips cleanly with no workflow change"
    - "asserting cleanup by diffing a tmpdir() directory listing (prefix-filtered) before/after, since the service never returns its internal temp path on a rejected call"

key-files:
  created:
    - electron/main/services/chatWheel.roundtrip.test.ts
  modified: []

key-decisions:
  - "Round-trip fidelity assertion is plain string equality after trim, not structural YAML comparison: running the round trip against the real tracked ChatLane.exe showed the starter.yml (including its two leading comments, blank lines, key order, and CRLF endings) comes back byte-for-byte identical. This resolves RESEARCH.md assumption A1 by measurement rather than carrying the assumption into the committed test (per flagged_assumptions in 01-04-PLAN.md)."
  - "Converter-failure case (Task 2, case 4) uses YAML missing the required top-level `name` key. Probed six malformed candidates against the real binary first; all six were rejected, and this one (syntactically valid YAML, semantically invalid to ChatLane) was picked as the smallest still-plausible shape, throwing a NullReferenceException that the test asserts on."

patterns-established:
  - "Real-binary integration test alongside a stubbed unit test: chatWheel.test.ts keeps its child_process stub for wiring coverage; chatWheel.roundtrip.test.ts is a separate, deliberately un-stubbed sibling for behavior coverage. Applicable to any other bundled-binary integration in this codebase."

requirements-completed: [REQ-renderer-test-harness]

coverage:
  - id: D1
    description: "The bundled starter.yml survives a real buildChatWheelVpk then readChatWheelVpk round trip through the actual ChatLane.exe, with the observed fidelity (byte-for-byte after trim) recorded in the file header."
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: integration
        ref: "electron/main/services/chatWheel.roundtrip.test.ts#survives a build -> read round trip of the starter YAML"
        status: pass
    human_judgment: false
  - id: D2
    description: "The round-trip suite skips cleanly (not fails) when chatLaneBinaryPath() throws, evaluated eagerly at collection time, so CI on ubuntu-latest stays green with no workflow change."
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: integration
        ref: "electron/main/services/chatWheel.roundtrip.test.ts (describe.skipIf(!binaryAvailable) guard, verified present via grep and by the suite running unskipped on this Windows host)"
        status: pass
    human_judgment: false
  - id: D3
    description: "readChatWheelVpk rejects a non-.vpk path and a missing .vpk path; buildChatWheelVpk rejects whitespace-only YAML and a real converter-rejected input, both against the real binary path rather than a stubbed child process, and every temp directory created is removed even on failure."
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: integration
        ref: "electron/main/services/chatWheel.roundtrip.test.ts (4 rejection/cleanup tests: non-.vpk path, missing .vpk path, whitespace-only YAML, converter-failure cleanup)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 04: Chat Wheel Real-Binary Round Trip Summary

**A new integration test drives the bundled ChatLane.exe converter directly (no stub), proving the starter YAML round-trips byte-for-byte and that the converter's own rejection and cleanup paths hold under real invocation.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-06T11:22:00-05:00 (approx)
- **Completed:** 2026-08-06T11:31:08-05:00
- **Tasks:** 2
- **Files modified:** 1 (new file)

## Accomplishments
- New file `electron/main/services/chatWheel.roundtrip.test.ts` exercises `readChatWheelStarter`, `buildChatWheelVpk`, and `readChatWheelVpk` against the real tracked `resources/chatlane/ChatLane.exe`, with an eager `describe.skipIf` guard so CI on `ubuntu-latest` stays green with no workflow change (D-06).
- Round-trip fidelity was measured, not guessed: ran the build-then-read cycle locally first, observed byte-for-byte identical output (including CRLF line endings and comment lines), and locked the assertion to that observation, resolving RESEARCH.md's flagged assumption A1.
- Four rejection/cleanup cases added on the real-binary path: non-`.vpk` extension, missing file, whitespace-only YAML, and a genuine converter rejection (missing required `name` key, found by probing six malformed candidates against the real binary), each proven to leave no temp directory behind.
- Existing stubbed test `electron/main/services/chatWheel.test.ts` is byte-for-byte unchanged, per D-05.

## Task Commits

Each task was committed atomically:

1. **Task 1: Starter YAML survives a real build-then-read round trip** - `3253ffd` (test)
2. **Task 2: Rejection paths and cleanup against the real converter** - `3d27e82` (test)

_Note: no plan-metadata commit is made by this worktree agent — the orchestrator handles STATE.md/ROADMAP.md and any final metadata commit after all wave agents complete._

## Files Created/Modified
- `electron/main/services/chatWheel.roundtrip.test.ts` - 5 tests: the real round trip, non-.vpk rejection, missing-file rejection, empty-YAML rejection, and converter-failure cleanup, all against the actual bundled `ChatLane.exe`

## Decisions Made
- Fidelity assertion locked to plain string equality after trim, based on an observed byte-for-byte round trip against the real binary (see key-decisions above).
- Task 2 case 4's invalid-YAML fixture was found by probing against the real converter (six candidates tried, all rejected); picked the smallest still-plausible one (missing required `name` field) per the plan's instruction not to assume rejection behavior.
- Temp-directory cleanup on the rejection paths is verified by diffing a `tmpdir()` listing filtered to the `grimoire-chatwheel-` prefix before and after each call, since `buildChatWheelVpk` never returns its internal directory path when it throws.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<verify>` and `<acceptance_criteria>` blocks pass as specified, and the plan-level `<verification>` block (full vitest suite, `tsc -b`, `pnpm lint`, `pnpm encoding:check`, and the diff-exit-code check on the three protected files) all pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Chat Wheel clause of `REQ-renderer-test-harness` is closed with real-binary coverage.
- No blockers for other Phase 1 plans; this plan touched only its own declared file.

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
