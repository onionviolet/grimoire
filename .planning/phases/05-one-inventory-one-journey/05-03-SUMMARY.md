---
phase: 05-one-inventory-one-journey
plan: 03
subsystem: ui
tags: [bulk-undo, installed, toast, accessibility, react, vitest]

# Dependency graph
requires:
  - phase: 05
    provides: The i18n keys this plan consumes (`common.bulkUndo.*`, `installed.actions.bulkBusy`, `installed.actions.bulkUndoing`) created by plan 05-01, plus the existing toast store (`showToast`/`dismissToast`) and the three mutators (`toggleMod`, `setModLockerHero`, `setModGlobalType`)
provides:
  - A pure one-shot bulk-undo module (`captureBulkSnapshot`, `bulkUndoPlan`, `bulkChangedCount`) with field-level diff restore and skip-missing behavior
  - Undo offers on all five reversible bulk handlers in Installed (enable, disable, hero tag, clear tag, global tag) that restore both data and selection
  - Toast supersession so only the newest batch is undoable, and a one-message partial-failure report that keeps the Undo action
  - An accessible blocker line every control disabled by a bulk or undo operation points at via aria-describedby
affects: [05-06 (inherits the same disabled-blocker contract on other surfaces), verify-work phase 5]

# Actuals (#2632) - pairs with the plan's estimate (65000 tokens)
actuals:
  tokens: 4087
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot local undo: a snapshot captured before the batch, diffed against the live list at restore time so hand-made changes are never stomped"
    - "Toast supersession via dismissToast on the previous offer id before showing the new one"
    - "Stable blocker-line id referenced by aria-describedby on every control the operation disables (D-16)"

key-files:
  created:
    - src/lib/bulkUndo.ts
    - src/lib/bulkUndo.test.ts
  modified:
    - src/pages/Installed.tsx

key-decisions:
  - "Undo replays a live diff, not the whole snapshot: an operation is emitted only where the current value still differs, so a field the user changed by hand between batch and undo is preserved"
  - "A partial failure produces one toast (counts + Undo action, warning tone, dismissable) rather than stacking a second toast for the failure"
  - "The blocker line lives in the action bar's existing in-flight span with a stable id; the undo case wins when both a batch and a restore could apply, so exactly one reason shows at a time"
  - "Bulk delete keeps its confirmation and gains no undo: a deleted VPK is not recoverable from a snapshot of store state"
  - "Restore counts distinct mods actually restored (restoredIds), not operations applied, matching bulkChangedCount's user-facing semantics"

patterns-established:
  - "A bulk handler captures its snapshot immediately before its loop and hands (snapshot, selection) to one shared offer helper, so every reversible handler gets identical supersession and selection-restore behavior"
  - "The toolbar select-mode button's disabled condition includes undoBusy, and its aria-describedby resolves only while an operation is actually in flight"

requirements-completed: [REQ-ui-consequence-and-vocabulary]

coverage:
  - id: D1
    description: "Pure bulk-undo module: captureBulkSnapshot normalizes optional fields and skips unknown ids; bulkUndoPlan emits a stable-ordered field-level diff (toggle, lockerHero, globalType) skipping missing mods and unchanged fields; bulkChangedCount counts distinct changed mods"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: unit
        ref: "src/lib/bulkUndo.test.ts#9 cases covering capture, empty diff, per-field ops, skip-missing, third-value restore, and distinct-mod counting"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run src/lib/bulkUndo.test.ts && pnpm typecheck && pnpm lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "All five reversible bulk handlers capture pre-batch state, offer a one-shot Undo toast that restores both data and selection, and a newer batch supersedes the previous offer"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: unit
        ref: "pnpm exec vitest run && pnpm typecheck && pnpm lint && pnpm i18n:check"
        status: pass
      - kind: other
        ref: "grep offerBulkUndo( src/pages/Installed.tsx (10 call sites, 5 handlers x 2 branches) + aria-describedby/id wiring"
        status: pass
    human_judgment: true
    rationale: "Installed.tsx has no render-level test harness; the end-to-end behavior (select three mods, bulk enable, press Undo, same three selected in select mode) and the single-toast-on-screen supersession need functional sign-off in the running app"
  - id: D3
    description: "A partial failure reports changed and failed counts in one warning toast that keeps the Undo action, and every control disabled by a bulk or undo operation is described by a rendered blocker line (never tooltip-only)"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: unit
        ref: "pnpm exec vitest run && pnpm typecheck && pnpm lint && pnpm i18n:check && pnpm encoding:check"
        status: pass
      - kind: other
        ref: "aria-describedby=installed-bulk-blocker + id=installed-bulk-blocker + disabled={!!bulkProgress || !!undoBusy} in src/pages/Installed.tsx"
        status: pass
    human_judgment: true
    rationale: "The blocker line's rendering and the single-toast-per-action behavior are visual/functional facts; no component test mounts the Installed action bar, so they need in-app sign-off"

# Metrics
duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 5 Plan 3: One-shot local undo for every reversible bulk action

**Every reversible bulk action in Installed (enable, disable, hero tag, clear tag, global tag) now captures a pre-batch snapshot, offers a one-shot Undo toast that restores both data and selection, supersedes the previous offer, reports partial failure in one message, and explains every disabled control through a rendered blocker line**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-09T03:01:08Z
- **Completed:** 2026-08-09T03:13:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Pure `src/lib/bulkUndo.ts` module: `captureBulkSnapshot` normalizes `enabled`/`lockerHero`/`globalType` (optional fields to null) and records nothing for unknown ids; `bulkUndoPlan` builds a stable-ordered field-level diff (toggle, then lockerHero, then globalType) against the live list, skipping missing mods and already-restored fields; `bulkChangedCount` counts distinct changed mods for the toast copy
- All five reversible bulk handlers in `Installed.tsx` capture their snapshot before their loop and call the shared `offerBulkUndo` helper, which dismisses the previous offer first (D-15 supersession), skips the toast when nothing changed, and restores data through the same mutators the batch used, then `loadMods()` and re-selects the same ids with select mode on (D-14)
- Partial failure now reports "X of Y mods updated. Z could not be changed." in one warning toast that keeps the Undo action, so the changed subset is still reversible; no second toast is emitted
- The action bar's in-flight line gained a stable id (`installed-bulk-blocker`), covers both batch and undo states with the undo text winning when both apply, and the toolbar select-mode button is disabled during either and described by the line via `aria-describedby`
- Bulk delete is untouched and explicitly commented as outside the undo contract: a deleted VPK is not recoverable from a snapshot of store state

## Task Commits

Each task was committed atomically:

1. **Task 1: The pure snapshot, diff and restore-plan logic, tested before it is wired** - `5df2b45` (test, RED) + `1b46b48` (feat, GREEN)
2. **Task 2: Capture before the enable and disable batches, offer Undo after them, and supersede the previous offer** - `fdf0c99` (feat)
3. **Task 3: Extend the offer to the three retag batches, report a partial failure in one message, and give every disabled control a stated blocker** - `55f8b2e` (feat)

## Files Created/Modified
- `src/lib/bulkUndo.ts` - Pure one-shot snapshot/diff/restore module (no React, Zustand, window, or IPC; head comment states the permanent-history boundary)
- `src/lib/bulkUndo.test.ts` - Nine unit cases covering capture normalization, unknown-id skip, empty diff, per-field ops, skip-missing, third-value restore, and distinct-mod counting
- `src/pages/Installed.tsx` - `undoOffer`/`undoBusy` state, `offerBulkUndo` helper with restore closure, capture-and-offer in all five handlers, partial-failure tracking, blocker line with `id` + `aria-describedby`, and a comment at the delete handler

## Decisions Made
- Restore replays a live diff rather than the whole snapshot, so hand-made changes between the batch and the undo are never stomped (per D-14/T-05-09)
- A partial failure is one toast: both counts, warning tone, dismissable, Undo action kept (settles UI-SPEC E6 / RESEARCH Assumption A4)
- The blocker line reuses the action bar's existing in-flight span with a stable id; controls point at it via `aria-describedby`, tooltips kept as supplements (D-16)
- `undoBusy` joined `bulkProgress` in the toolbar select-mode button's disabled condition, and the restored count is distinct mods actually changed, not operations applied

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `undoBusy` was unused after Task 2, failing typecheck**
- **Found during:** Task 2 (Capture before the enable and disable batches)
- **Issue:** Task 2 declares `undoBusy` for the restore window, but its consumers (the blocker line and disabled conditions) were scoped to Task 3, so `tsc -b` failed with TS6133 and Task 2's own acceptance required a green typecheck
- **Fix:** Wired `!!undoBusy` into the toolbar select-mode button's disabled condition immediately. This is also a Rule 2 correctness fix: a restore in flight can race a user re-entering selection mode or starting another batch, so the control must be blocked while the operation is genuinely in flight
- **Files modified:** src/pages/Installed.tsx
- **Verification:** `pnpm typecheck` exits 0; full suite green (1914 passed, 0 failures)
- **Committed in:** fdf0c99 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, with a correctness rationale)
**Impact on plan:** No scope creep - the fix only moved part of Task 3's intended disable condition into Task 2 to keep the typecheck gate green, and it is required for the undo window's correctness.

## Issues Encountered
- None beyond the auto-fixed typecheck issue above. The i18n catalog already carried every key this plan consumes, so no translation.json change was needed and `pnpm i18n:check` stayed green throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05-04 can extend the Global shell / derived pak descriptions without touching the undo mechanism: the module is pure, exported, and covered, and any future bulk surface inherits `captureBulkSnapshot`/`bulkUndoPlan` rather than growing its own
- Plan 05-06 carries the same disabled-blocker contract (aria-describedby pointing at rendered text) to Profiles apply, Conflicts resolve, and the Foundry forge; this plan proves the pattern on Installed
- Functional sign-off of the undo toast flow (selection restore, supersession, partial-failure message, blocker line) is routed to verify-work phase 5; the pure logic is already proven by unit tests

---
*Phase: 05-one-inventory-one-journey*
*Completed: 2026-08-09*

## Self-Check: PASSED

All three created/modified files exist (`src/lib/bulkUndo.ts`, `src/lib/bulkUndo.test.ts`, `src/pages/Installed.tsx`) and all four plan commits are present in git history (`5df2b45`, `1b46b48`, `fdf0c99`, `55f8b2e`).
