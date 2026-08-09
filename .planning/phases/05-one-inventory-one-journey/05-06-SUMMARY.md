---
phase: 05-one-inventory-one-journey
plan: 06
subsystem: ui
tags: [provenance, i18n, a11y, blocker-copy, conflicts, profiles, foundry]

requires:
  - phase: 05-01
    provides: the single provenance phrase key (common.provenance.openInInstalled / openInInstalledHint), the blocker keys (profiles.actions.busyBlocker, conflicts.actions.busyBlocker, conflicts.rescanning, foundry.buildTray.blockedEmpty, foundry.buildTray.blockedBusy), and the whole phase catalog change
  - phase: 05-03
    provides: the installed-page blocker half of REQ-ui-consequence-and-vocabulary and ownership of src/pages/Installed.tsx, which stays the untouched consumer of the focusMod parameter
provides:
  - focusModPath: the one producer of the Installed focus target across all four Lane 9 provenance surfaces
  - common.provenance.openInInstalled as the one provenance phrase key across all four surfaces
  - Stated blockers beside disabled controls on Profiles apply/update, Conflicts resolve, and the Foundry forge/install path, each with an aria-describedby to rendered text
  - A conflict recheck that keeps the prior answer on screen and labels it as previous-check results while the scan runs
affects: [REQ-ui-consequence-and-vocabulary traceability, future catalog cleanup of the four superseded provenance keys, verify-work UAT routing]

actuals:
  tokens: 2981
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One producer per route contract: every destination built by focusModPath, every label read from one catalog key (D-17)"
    - "Stated blocker pattern: disabled control paired with an inline aria-live line that names the reason, tied together with aria-describedby (AssetSourcesPanel precedent)"
    - "Pending work preserves the prior answer: a hasLoaded first-load flag splits the initial skeleton from later rescans (useAssetClaims precedent)"

key-files:
  created:
    - src/lib/provenance.ts
    - src/lib/provenance.test.ts
  modified:
    - src/pages/Conflicts.tsx
    - src/pages/Profiles.tsx
    - src/components/foundry/FoundryBuildTray.tsx
    - src/components/locker/HeroCardPicker.tsx
    - src/components/locker/SoundEntryRow.tsx
    - src/components/locker/GlobalSoundShelf.tsx
    - src/components/locker/HeroSoundShelf.tsx
    - src/components/foundry/ChangePools.tsx
    - src/components/foundry/MyChanges.tsx
    - src/components/foundry/AssetSourcesPanel.tsx

key-decisions:
  - "Per-site blocker-line ids in Conflicts.tsx: each id is still derived from the pair key, file path or mod identity as the plan directed, but prefixed per site (conflicts-card-, conflicts-ignored-pair-, conflicts-ignored-files-, conflicts-ignored-global-, conflicts-ignored-mod-) so a pending pair that appears in more than one panel cannot duplicate an HTML id or leave an aria-describedby dangling"
  - "hasLoaded is set only on a successful scan, so a failed first scan's retry still shows the skeleton: a failure produced no prior answer to preserve"
  - "The rescanning line renders in the main list return only; the empty and error branches stay byte-identical per the plan, so an empty-state refresh keeps its state without a recheck label and a failed recheck keeps its own retry"
  - "Four provenance label keys (and the openInInstalledHint key) are now unread and recorded as a follow-up for deliberate removal; this plan did not write the catalog because 05-01 owns it"

patterns-established:
  - "One producer per route contract: every destination built by focusModPath, every label read from one catalog key (D-17)"
  - "Stated blocker pattern: disabled control paired with an inline aria-live line that names the reason, tied together with aria-describedby (AssetSourcesPanel precedent)"
  - "Pending work preserves the prior answer: a hasLoaded first-load flag splits the initial skeleton from later rescans (useAssetClaims precedent)"

requirements-completed: [REQ-ui-consequence-and-vocabulary]

coverage:
  - id: D1
    description: "focusModPath, the one root-relative producer of /?focusMod=<id>, encoding the id and refusing to emit a scheme, host or second query parameter"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: unit
        ref: "src/lib/provenance.test.ts#5 it cases (encoding, single parameter, root-relative, empty id)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Conflicts cards offer Open in Installed beside Disable for every side that resolved to a modsMap record, landing on the Installed focus effect; HeroCardPicker's hand-assembled hash destination now routes through the helper"
    requirement: REQ-ui-consequence-and-vocabulary
    verification: []
    human_judgment: true
    rationale: "Clicking through to Installed and seeing the named mod scrolled to and highlighted is in-app navigation behavior that only a human in the running app can sign off"
  - id: D3
    description: "All four Lane 9 surfaces read the one provenance phrase key, common.provenance.openInInstalled"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: other
        ref: "grep -rc common.provenance.openInInstalled src --include=*.tsx reports 5 files (4 repointed call sites + Conflicts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "src/lib/provenance.ts is the only remaining producer of the focusMod target; no inline template literal remains outside the helper and the Installed consumer"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: other
        ref: "grep -rn focusMod= src --include=*.tsx --include=*.ts (no matches outside src/lib/provenance.ts and src/pages/Installed.tsx)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Profiles apply/update disables every other control on the card and one visible line names the blocker, with all seven controls pointing at it via aria-describedby"
    requirement: REQ-ui-consequence-and-vocabulary
    verification: []
    human_judgment: true
    rationale: "The rendered blocker line beside disabled controls is UI behavior in the running app; grep proves the wiring exists, only a human can sign off that it reads correctly"
  - id: D6
    description: "Conflicts resolve actions name their blocker in rendered text beside every disabled control, one reason at a time"
    requirement: REQ-ui-consequence-and-vocabulary
    verification: []
    human_judgment: true
    rationale: "Visible per-site blocker lines while an ignore/unignore round-trip runs need in-app sign-off"
  - id: D7
    description: "Re-running the conflict scan keeps the prior answer on screen and states that results are from the previous check while the recheck runs; the first load still shows the skeleton"
    requirement: REQ-ui-consequence-and-vocabulary
    verification: []
    human_judgment: true
    rationale: "The retained-row-with-recheck-label behavior only exists in the running app against real conflict data"
  - id: D8
    description: "The Foundry forge and install button names which of its two blockers is in force, empty selection or a running forge, in rendered text with aria-describedby"
    requirement: REQ-ui-consequence-and-vocabulary
    verification: []
    human_judgment: true
    rationale: "The visible blocker line above the forge button is UI behavior in the running app"

duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 5 Plan 6: Provenance and Blocker Consistency Summary

**One provenance route helper and one provenance phrase key across all four Lane 9 surfaces, stated blockers with accessible descriptions on Profiles apply, Conflicts resolve and the Foundry forge path, and a conflict recheck that keeps the previous answer on screen while it runs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-09T03:40:00Z
- **Completed:** 2026-08-09T03:52:38Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `src/lib/provenance.ts` exports `focusModPath`, the single producer of the `/?focusMod=<id>` target, with five unit tests parsing the result through `URLSearchParams` (encoding, injection resistance, root-relative output, empty-id no-crash)
- The Conflicts page, the one Lane 9 surface with no provenance affordance, gained an Open in Installed control beside each resolved side's Disable button; the affordance is skipped for sides whose record is missing from `modsMap`
- The one producer that bypassed the router, `HeroCardPicker.tsx`'s hand-assembled `location.hash` assignment, now navigates through the helper
- All four surfaces read `common.provenance.openInInstalled` from the single key plan 05-01 created, and every remaining destination routes through `focusModPath`; the four superseded keys are recorded as a follow-up for deliberate removal
- Profiles apply/update disables seven controls per card and every one points via `aria-describedby` at one visible busy-blocker line in the card's action row
- Conflicts resolve actions (ignore, unignore pair, restore files, unignore global file, unignore mod) each render a visible blocker line beside the disabled control, one reason at a time
- The Foundry forge and install button names its active blocker in rendered text: the running forge wins over the empty-selection message, and the check-failure alert is untouched
- Re-running the conflict scan keeps every row on screen, adds a "Rechecking your installed mods. The results below are from the previous check." line, and only the first load (no prior answer) still shows the skeleton

## Task Commits

Each task was committed atomically:

1. **Task 1: One provenance route, proved end to end from the surface that had none** - `2e6d086` (test, RED) and `2c2b8bc` (feat, GREEN)
2. **Task 2: Every remaining provenance producer and label reads the one helper and the one key** - `2d88b84` (feat)
3. **Task 3: A stated blocker on Profiles apply, Conflicts resolve and the Foundry forge path, and a conflict recheck that keeps its answer** - `e11ef48` (feat)

TDD gate sequence: `test(...)` commit `2e6d086` precedes the `feat(...)` commits, so the RED/GREEN gate holds.

## Files Created/Modified

- `src/lib/provenance.ts` - The one route builder for the Installed focus target
- `src/lib/provenance.test.ts` - Five behavior cases, asserted by URLSearchParams parsing
- `src/pages/Conflicts.tsx` - Provenance affordance on conflict sides, per-site resolve blocker lines with aria-describedby, first-load flag and the rescanning line
- `src/pages/Profiles.tsx` - Per-card busy blocker line and aria-describedby on all seven disabled controls
- `src/components/foundry/FoundryBuildTray.tsx` - Forge/install blocker line (empty vs running) and aria-describedby
- `src/components/locker/HeroCardPicker.tsx` - Router-based provenance navigation replacing the hand-built hash
- `src/components/locker/SoundEntryRow.tsx`, `src/components/locker/GlobalSoundShelf.tsx`, `src/components/locker/HeroSoundShelf.tsx`, `src/components/foundry/ChangePools.tsx`, `src/components/foundry/MyChanges.tsx`, `src/components/foundry/AssetSourcesPanel.tsx` - Single-line substitutions to the shared key and helper

## Decisions Made

- Per-site blocker-line ids in Conflicts.tsx, each still derived from the pair key, file path or mod identity as the plan directed, so a pending pair visible in more than one panel cannot duplicate an HTML id or leave `aria-describedby` pointing at nothing
- `hasLoaded` is set only on a successful scan, keeping the skeleton for a failed first load's retry (a failure produced no prior answer)
- The rescanning line lives in the main list return; the empty and error branches are untouched per the plan
- The four superseded provenance keys are left in the catalog for plan 05-01's owner to remove deliberately

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Site-unique blocker-line ids in Conflicts.tsx**
- **Found during:** Task 3 (Conflicts resolve blocker lines)
- **Issue:** The plan grouped five controls under one pair-key-derived id rendered "inside the card". A pending pair can be visible in the ignored-pairs and ignored-files panels while its active card is not rendered at all (a wholly ignored pair), and a pair with individually ignored files is simultaneously an active card and an ignored-files panel entry. One shared id would either duplicate the HTML id across panels or leave `aria-describedby` pointing at a line that is not on screen.
- **Fix:** Kept every id derived from the pair key / file path / mod identity exactly as directed, but prefixed per site (`conflicts-card-`, `conflicts-ignored-pair-`, `conflicts-ignored-files-`, `conflicts-ignored-global-`, `conflicts-ignored-mod-`). Each disabled control's description now points at a blocker line rendered beside that control.
- **Files modified:** src/pages/Conflicts.tsx
- **Verification:** `pnpm exec vitest run` (1929 passed), `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm encoding:check` all green; grep counts 7 `aria-describedby` sites
- **Committed in:** e11ef48 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for correctness and accessibility. No scope creep; the fix is the same blocker-line pattern the plan specified, applied with valid ids.

## Follow-ups

- The four now-unread provenance label keys plus the hint key should be removed from `src/locales/en/translation.json` as a deliberate catalog change owned by the phase's catalog plan (05-01), not as a side effect of this plan: `soundLocker.row.openInInstalled`, `foundry.myChanges.openInInstalled`, `poolView.openInInstalled`, `foundry.sources.openInInstalled`, `foundry.sources.openInInstalledHint`. They now show up only in the informational section of `pnpm i18n:check`.

## Issues Encountered

None - all planned work behaved as specified, with the single auto-fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REQ-ui-consequence-and-vocabulary is fully closed: provenance is one phrase from one key and one target from one helper on all four Lane 9 surfaces, every disabled control named in the requirement carries rendered blocker text plus an accessible description, exactly one blocker reason renders at a time, and the conflict scan preserves the answer being read
- The surfaces that already satisfied sub-items (catalog sync, asset source inspection, AssetSourcesPanel blocker, portrait coverage) were left alone and recorded as satisfied in the plan's planner decisions
- The four superseded catalog keys are the only remaining cleanup, deliberately deferred to the catalog owner

---
*Phase: 05-one-inventory-one-journey*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files found and all four task commits (`2e6d086`, `2c2b8bc`, `2d88b84`, `e11ef48`) verified in git history.
