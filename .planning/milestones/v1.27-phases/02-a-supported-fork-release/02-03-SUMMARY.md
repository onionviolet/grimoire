---
phase: 02-a-supported-fork-release
plan: 03
subsystem: ui
tags: [react, i18n, chatwheel, docs, gating]

requires:
  - phase: 02-a-supported-fork-release
    provides: "02-01's experimental-setting precedent (Browser.tsx's page-level guard shape)"
provides:
  - "Page-level experimental gate on the Chat Wheel route, closing the last unguarded experimental surface"
  - "A profile-spec.md that no longer contradicts the in-app import dialog's Grimoire-only claim"
affects: [chatwheel, i18n-catalog, docs]

actuals:
  tokens: 2707
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Page-level experimental gate: early-return EmptyState below every hook, keyed off `!settings?.experimentalChatWheel`, mirroring Browser.tsx's established shape"

key-files:
  created:
    - src/pages/ChatWheel.test.tsx
  modified:
    - src/pages/ChatWheel.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - docs/profile-spec.md

key-decisions:
  - "Used vi.hoisted() to build controllable mocks for both useAppStore and lib/api, rather than mocking the real Zustand store's setState, to match the plan's explicit instruction and keep each test case's settings state fully isolated"
  - "Renamed manager-specific to tool-specific throughout profile-spec.md (not just the three flagged lines) for terminology consistency, since the doc's own Extensions section already used both terms interchangeably"

patterns-established:
  - "Chat Wheel joins Browser.tsx as the second page using the page-level EmptyState gate pattern; any future experimental page should follow the same shape rather than relying on sidebar filtering alone"

requirements-completed: [REQ-experimental-gate-and-doc-drift]

coverage:
  - id: D1
    description: "Chat Wheel page renders a disabled EmptyState (not the editor) when experimentalChatWheel is off, on, or not yet loaded, reachable from any navigation path since the guard lives in the page component"
    requirement: "REQ-experimental-gate-and-doc-drift"
    verification:
      - kind: unit
        ref: "src/pages/ChatWheel.test.tsx#ChatWheel page gate > renders the disabled state and none of the editor controls when experimentalChatWheel is false"
        status: pass
      - kind: unit
        ref: "src/pages/ChatWheel.test.tsx#ChatWheel page gate > renders the normal editor UI and no disabled state when experimentalChatWheel is true"
        status: pass
      - kind: unit
        ref: "src/pages/ChatWheel.test.tsx#ChatWheel page gate > renders the disabled state before settings have loaded, when settings is still undefined"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/profile-spec.md no longer claims the portable profile format works across mod managers; the same Grimoire-only claim the in-app import dialog shows users now appears in the doc, while the genuine forward-compatibility design goals (new sources, new games, tool-specific state) survive unchanged"
    requirement: "REQ-experimental-gate-and-doc-drift"
    verification:
      - kind: other
        ref: "grep -cE \"between mod managers|manager agnostic|manager-agnostic\" docs/profile-spec.md (returns 0)"
        status: pass
      - kind: other
        ref: "grep -c \"Grimoire-only\" docs/profile-spec.md (returns 1) and grep -c \"new sources, new games\" docs/profile-spec.md (returns 1)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-06
status: complete
---

# Phase 02 Plan 03: Chat Wheel gate and profile-spec drift Summary

**Chat Wheel page now self-gates on `experimentalChatWheel` (matching the Browser.tsx precedent), with a three-state render test, and `docs/profile-spec.md` no longer claims cross-mod-manager compatibility.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-06T22:08:00-05:00 (approx, first file read)
- **Completed:** 2026-08-06T22:17:49-05:00
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `src/pages/ChatWheel.tsx` now reads `experimentalChatWheel` directly and renders an `EmptyState` guard below every hook when the setting is off or not yet loaded, so the setting actually gates the page regardless of how it's reached (URL bar, stale bookmark, deep link, programmatic navigate)
- `src/pages/ChatWheel.test.tsx` covers all three states of the gate (off, on, settings undefined) against a real jsdom render, and was verified to fail 2 of 3 cases when the guard is removed
- `docs/profile-spec.md` was rewritten to drop every claim that the portable profile format interoperates with other mod managers, replacing it with the same Grimoire-only claim already shown in the in-app import dialog, while preserving the legitimate forward-compatibility design goals (new sources, new games, tool-specific extensions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate the Chat Wheel page on its own setting** - `7ca285e` (feat)
2. **Task 2: Render-test all three states of the gate** - `2764464` (test)
3. **Task 3: Remove the cross-tool compatibility claims from the profile format spec** - `bfa5c33` (docs)

**Plan metadata:** committed separately by the orchestrator after wave completion (worktree mode)

## Files Created/Modified
- `src/pages/ChatWheel.tsx` - Added the `settings` selector and an early-return `EmptyState` guard below every hook, mirroring `Browser.tsx`'s established shape
- `src/pages/ChatWheel.test.tsx` - New jsdom render test covering the disabled, enabled, and not-yet-loaded states of the gate
- `src/locales/en/translation.json` - Added `chatWheel.disabled.title` and `chatWheel.disabled.description` keys
- `src/locales/manifest.json` - Regenerated via `pnpm i18n:manifest` after the catalog change
- `docs/profile-spec.md` - Removed cross-tool compatibility claims (lines 3, 5, 15 as flagged, plus consistent `manager-specific` -> `tool-specific` renaming elsewhere in the doc)

## Decisions Made
- Used `vi.hoisted()` to build controllable mocks for `useAppStore` and `lib/api` in the new test file, per the plan's explicit instruction, rather than driving the real Zustand store's `setState` (an alternative pattern seen elsewhere in the codebase) — this keeps each of the three test cases' `settings` state fully isolated and matches the plan's called-out mock shape
- Extended the `manager-specific` -> `tool-specific` rename beyond the three explicitly flagged lines (also updating the `extensions` table row, the Extensions section prose, its JSON example key, and its bullet rule) for internal terminology consistency, since the document already used both terms interchangeably before this pass

## Deviations from Plan

None - plan executed exactly as written. The additional `manager-specific` -> `tool-specific` renames beyond the three flagged lines were explicitly invited by the plan's own instruction to "scan the rest of the document for further claims of the same kind and correct any you find" and its use of "tool-specific state" when describing goal 3, so this is not treated as a deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Chat Wheel page now matches the codebase's one established precedent (`Browser.tsx`) for page-level experimental gating; any future experimental page should follow the same shape
- `docs/profile-spec.md` and the in-app import dialog now agree, closing a doc-vs-code drift flagged in `PROJECT.md`
- No blockers for subsequent phase-02 plans

---
*Phase: 02-a-supported-fork-release*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/pages/ChatWheel.test.tsx
- FOUND: docs/profile-spec.md
- FOUND: .planning/phases/02-a-supported-fork-release/02-03-SUMMARY.md
- FOUND: 7ca285e (feat: gate Chat Wheel page)
- FOUND: 2764464 (test: render-test all three states)
- FOUND: bfa5c33 (docs: remove cross-tool compatibility claims)
- FOUND: e2b502a (docs: add plan execution summary)
