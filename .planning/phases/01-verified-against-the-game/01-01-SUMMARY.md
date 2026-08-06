---
phase: 01-verified-against-the-game
plan: 01
subsystem: testing
tags: [vitest, jsdom, react-dom, foundry, render-testing, ipc-stub]

# Dependency graph
requires: []
provides:
  - "jsdom pinned as an explicit devDependency at exactly 24.1.3 (was previously only a hoisted transitive copy via gltfjsx's optionalDependencies)"
  - "The proven render-test harness shape: per-file `// @vitest-environment jsdom` pragma, `../../i18n` side-effect import, `IS_REACT_ACT_ENVIRONMENT` + `createRoot`/`act` lifecycle, a plain `window.electronAPI.foundry` stub object, real DOM interaction assertions"
  - "src/components/foundry/ChangePools.test.tsx: pool-cards lane render + interaction coverage"
  - "src/components/foundry/AssetSourcesPanel.test.tsx: audition-preview lane render + interaction coverage"
affects: [01-02, 01-03]

# Actuals (#2632)
actuals:
  tokens: 5034
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: ["jsdom@24.1.3 (devDependency, exact pin)"]
  patterns:
    - "Render-test harness: `// @vitest-environment jsdom` + `IS_REACT_ACT_ENVIRONMENT` + `createRoot`/`act`, no testing-library"
    - "`window.electronAPI.foundry` stub: a plain object assigned in `beforeEach`, covering only the methods the lane under test actually reaches (including mount-time useEffect calls)"
    - "Interaction-depth assertions: DOM click + `act()` + await the mocked IPC promise, then assert on rendered text/aria state, never just mount-without-throwing"

key-files:
  created:
    - src/components/foundry/ChangePools.test.tsx
    - src/components/foundry/AssetSourcesPanel.test.tsx
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "jsdom pinned to the exact already-resolved 24.1.3, not the flagged 30.0.1 release, per the phase's package-legitimacy audit (D-02, T-01-SC)"
  - "No testing-library, no vitest.config.ts edit: harness follows the existing HeroSelect.test.tsx precedent exactly (D-01, D-03)"
  - "Worktree-local pnpm-workspace.yaml added (gitignored, matches the main checkout's own gitignored convention) so pnpm resolves `@grimoire/social-types: workspace:*` against this worktree instead of discovering a stray local pnpm-workspace.yaml several directories up in the main checkout"

patterns-established:
  - "Pattern for all remaining Foundry render lanes (01-02, 01-03): jsdom pragma + i18n side-effect import + electronAPI stub + act lifecycle, proven end-to-end on two lanes"

requirements-completed: [REQ-renderer-test-harness]

coverage:
  - id: D1
    description: "jsdom pinned as an explicit, exactly-versioned devDependency (24.1.3), replacing implicit reliance on a hoisted transitive copy"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "inline node check: require('./package.json').devDependencies.jsdom === '24.1.3'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pool-cards Foundry lane (ChangePools.tsx / FoundryPoolList) renders under jsdom, resolves its mount-time IPC inspection into visible winner text, and responds to a real click on the pool-level shuffle control"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/ChangePools.test.tsx (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Audition-preview Foundry lane (AssetSourcesPanel.tsx) renders inspected sources with the resolved winner, and auditions the exact clicked source (modId, entryPath), covering both the resolved-URL and resolves-null outcomes"
    requirement: "REQ-renderer-test-harness"
    verification:
      - kind: unit
        ref: "src/components/foundry/AssetSourcesPanel.test.tsx (2 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 1: Render-Test Harness Proven on Two Foundry Lanes Summary

**jsdom pinned at exactly 24.1.3; pool-cards and audition-preview Foundry lanes now have real jsdom render + interaction tests (raw react-dom/client + act, no testing-library) against a `window.electronAPI.foundry` stub.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-06T16:24:00Z
- **Completed:** 2026-08-06T16:39:53Z
- **Tasks:** 3 (1 checkpoint, 1 tracer, 1 auto)
- **Files modified:** 4 (package.json, pnpm-lock.yaml, 2 new test files)

## Accomplishments

- `jsdom` is now an explicit, exactly-pinned `devDependency` (`24.1.3`), closing the "one passing render test works by accident of the lockfile" gap named in the phase context (D-02)
- `ChangePools.test.tsx` proves the render harness end to end on the pool-cards lane: renders `FoundryPoolList` under jsdom, resolves the mount-time `foundryInspectAssetSources` call through a stub into visible "in game now" / "enabled, overridden" winner text, and drives a real click on the pool-level shuffle control, asserting both the per-key callback fan-out and `aria-pressed` state
- `AssetSourcesPanel.test.tsx` extends the same harness to the audition-preview lane inside a `MemoryRouter`, asserts the listed sources and resolved winner text, and asserts `foundryAuditionSourceClip` is called with the exact `(modId, entryPath)` pair of the clicked row for both the resolved-URL and resolves-null outcomes
- The harness shape (pragma, i18n init, electronAPI stub, act lifecycle) is proven and reusable by plans 01-02 and 01-03 without further architectural decisions, per the plan's success criteria

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm the jsdom package before installing it** - checkpoint, resolved by the orchestrator before this executor was dispatched; user responded **"approved"**. No code changes; recorded here per the checkpoint-already-resolved instruction.
2. **Task 2: End-to-end "a Foundry lane renders and responds" - pool cards only** - `4de8ba9` (feat)
3. **Task 3: Audition-preview lane renders and auditions** - `233c6a3` (feat)

**Plan metadata:** committed separately per `<final_commit>` (worktree mode: SUMMARY.md only, STATE.md/ROADMAP.md excluded)

## Files Created/Modified

- `package.json` - added `"jsdom": "24.1.3"` to `devDependencies` (exact pin, no caret)
- `pnpm-lock.yaml` - lockfile update reflecting the new explicit devDependency (resolves to the same already-hoisted `24.1.3`, no version change)
- `src/components/foundry/ChangePools.test.tsx` - pool-cards lane render + interaction test (3 tests)
- `src/components/foundry/AssetSourcesPanel.test.tsx` - audition-preview lane render + interaction test (2 tests)

## Decisions Made

- **Fixture redesign for an unambiguous winner assertion (Task 2):** the plan's suggested two-member pool fixture (`portraitA`/`portraitB`, both winning a path) produced two simultaneous "in game now" labels, making the winner-text assertion ambiguous about *which* row won. Redesigned the inspection fixture so only `portraitA` wins the shared path and `portraitB`'s own path resolves to no owner (base game), so the winner label appears exactly once, pinned to the correct row. No functional change to what's tested — pool.entries still spans two paths and the pool is still genuinely contended.
- **`onToggleShuffleKey` assertion via first-argument extraction, not `toHaveBeenCalledWith`:** `ChangePools.tsx`'s pool-level shuffle handler calls `toggle.keys.forEach(onToggleShuffleKey)`, which per `Array#forEach` semantics also passes `(index, array)` as the 2nd/3rd arguments. `toHaveBeenCalledWith(key)` failed because it compares the full argument list. Fixed the assertion to extract `call[0]` per call rather than changing the component (the extra arguments are harmless to the real callback's `(key: string) => void` signature and not a bug).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree's nested location caused `pnpm add`/`pnpm install` to write into the main checkout instead of this worktree**
- **Found during:** Task 2, immediately after the first `pnpm add -D jsdom@24.1.3`
- **Issue:** This worktree lives at `<main-repo>/.claude/worktrees/agent-<id>`, nested inside the main checkout's own directory tree. The main checkout has a local, gitignored `pnpm-workspace.yaml` (a personal dev convenience for working on the sibling `grimoire-social` repo simultaneously; not part of the project's standard setup - `scripts/check-sibling-repos.mjs`'s own comment confirms a clean clone has none). Because pnpm searches upward from cwd for the nearest `pnpm-workspace.yaml`, running `pnpm install`/`pnpm add` from inside the worktree walked up past the worktree root and found the main checkout's file, causing pnpm to treat the **main checkout** as the workspace root. The devDependency specifier landed correctly in the worktree's own `package.json` (cwd), but the **lockfile write and node_modules mutations landed in the main checkout** instead of the worktree.
- **Fix:** Restored the main checkout's `pnpm-lock.yaml` to its exact pre-existing committed content via a plain (non-git) file copy from the worktree's own untouched checkout, and verified byte-for-byte via `git hash-object` matching the blob recorded at the shared commit (`ff97cab...`) both repos were on. Confirmed the main checkout's `package.json` was never touched (identical hash before/after). Then added a worktree-local `pnpm-workspace.yaml` (declaring `.` plus the correct relative path to the real `../grimoire-social/packages/*` sibling from the worktree's own location) so subsequent pnpm commands resolve `@grimoire/social-types: workspace:*` against the worktree itself and never discover the main checkout's file again. This file is already covered by the repo's own `.gitignore` pattern for `pnpm-workspace.yaml`, so it does not appear in `git status` and needs no cleanup.
- **Files modified:** none inside this worktree beyond the plan's own scope; the corrective action targeted `<main-repo>/pnpm-lock.yaml` (restored to its original committed state, net-zero change) and added `<worktree>/pnpm-workspace.yaml` (untracked, gitignored, local-only)
- **Verification:** `git hash-object` on the main checkout's `pnpm-lock.yaml` matches `git rev-parse HEAD:pnpm-lock.yaml` exactly; main checkout's `node_modules` and `package.json` timestamps/hashes confirmed unchanged by the corrective re-run; the re-run `pnpm add -D jsdom@24.1.3 -w` (this time scoped to the worktree) left the main checkout's lockfile and `node_modules` untouched (confirmed by timestamp diff before/after)
- **Committed in:** not applicable (environment-level fix, no worktree file changes to commit beyond the local, gitignored `pnpm-workspace.yaml`)

**2. [Rule 1 - Bug] `vi.fn()` without explicit generics failed `tsc -b`**
- **Found during:** Task 3's verification step (`pnpm exec tsc -b`)
- **Issue:** `ChangePools.test.tsx`'s `onToggleShuffleKey`/`onToggleMod`/`onOpenInInstalled` mocks were declared as plain `vi.fn()`, inferring the default `Mock<Procedure>` type, which is not structurally assignable to the component's typed callback props (`(key: string) => void`, `(modId: string) => void`).
- **Fix:** Typed each mock with its real call signature: `vi.fn<(key: string) => void>()` etc., and updated the corresponding `let` declarations to match.
- **Files modified:** `src/components/foundry/ChangePools.test.tsx`
- **Verification:** `pnpm exec tsc -b` exits 0; `pnpm exec vitest run` (full suite, 142 files / 1553 tests) still green
- **Committed in:** `233c6a3` (part of Task 3's commit, since it was found during Task 3's verification pass)

---

**Total deviations:** 2 auto-fixed (1 blocking environment fix, 1 bug fix)
**Impact on plan:** Both fixes were necessary to safely execute the plan inside this worktree and to satisfy the plan's own `tsc -b` verification gate. No scope creep: no plan file content changed as a result, and the corrective pnpm-workspace.yaml is local-only and gitignored.

## Issues Encountered

Covered above under Deviations (Rule 3 environment fix). No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The render-test harness (pragma, i18n init, electronAPI stub, act lifecycle) is proven on two lanes and directly reusable by plan 01-02 (alternatives gallery, sound trim/gain badges) and 01-03 (seeded SoundImportEditor, portrait editor with a canvas stub) without further architectural decisions
- `jsdom` is now an explicit devDependency; no further pinning work needed
- No blockers for 01-02/01-03

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
