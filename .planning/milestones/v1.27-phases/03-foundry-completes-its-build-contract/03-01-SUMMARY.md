---
phase: 03-foundry-completes-its-build-contract
plan: 01
subsystem: foundry
tags: [foundry, recolor, build-tray, vpk, electron-ipc, react, i18n]

# Dependency graph
requires:
  - phase: 06-community-tools-land-inside-grimoire
    provides: Foundry combined build tray, sound/texture staged edits, visualEdits inspection pattern
provides:
  - RecolorForgeRequest and the recolor member of FoundryForgeEdit
  - buildRecolorVpk/discoverRecolorEntries over the shared per-hero bake cache
  - foundry:prepareRecolorStage IPC resolving entries only
  - prepareRecolorStagedEdit renderer staging module and isStagedRecolorEdit tray guard
  - Stage-instead-of-apply interaction in Foundry's Recolor sub-tool, Locker immediate-apply untouched
affects: [03-foundry-completes-its-build-contract plans 02 and 03, 04-locker-and-foundry-as-one-object]

actuals:
  tokens: 9276
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - kind-keyed if/else-if chains with a never-typed exhaustive guard in every kind-branching function
    - staging-time real-bake entry discovery so the tray write set cannot drift from the forge output
    - no-op cleanup for builders that return a shared cache path instead of a temp dir

key-files:
  created:
    - electron/main/services/foundryRecolor.ts
    - src/components/foundry/recolorStagedEdit.ts
    - src/components/foundry/recolorStagedEdit.test.ts
  modified:
    - src/types/foundry.ts
    - src/types/mod.ts
    - src/types/electron.ts
    - src/lib/api.ts
    - src/components/foundry/buildTray.ts
    - src/components/foundry/changeList.ts
    - src/components/foundry/MyChanges.tsx
    - src/components/foundry/RecolorTool.tsx
    - src/components/locker/HeroEffectsPanel.tsx
    - src/components/locker/HeroColorPicker.tsx
    - src/pages/Foundry.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json
    - electron/main/services/foundryForge.ts
    - electron/main/ipc/foundry.ts
    - electron/preload/index.ts
    - electron/main/services/foundryForge.test.ts
    - src/components/foundry/buildTray.test.ts

key-decisions:
  - "Recolor staged-edit id is recolor:<canonical hero name>, so re-staging replaces in place through Foundry.tsx's existing id filter"
  - "buildRecolorVpk returns a no-op cleanup: the bake path is the shared userData ability-colors cache the Locker Apply and Export also read"
  - "Staging-time entry discovery reuses the same cached bake as the forge (one bake, not two), keeping the tray write set honest"
  - "FoundryForgeEdit stays a plain discriminated-union member for recolor; no kind-to-builder registry (add-alongside plus never guards)"
  - "Stage labels use the panel's American spelling and title casing (Stage Color / Stage Rainbow / Stage Gradient / Stage Trippy), documented planner deviation from UI-SPEC copy"

patterns-established:
  - "never-guard exhaustive kind chains: every kind-branching function ends with a never-typed else that throws, so a fourth kind fails pnpm typecheck"
  - "no-op cleanup contract: builders returning a shared cache path hand back a cleanup that resolves without filesystem access"

requirements-completed: [REQ-foundry-forge-edit-kinds]

coverage:
  - id: D1
    description: "FoundryForgeEdit widens to sound | texture | recolor with RecolorForgeRequest carrying the exact bake entries"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: unit
        ref: "electron/main/services/foundryForge.test.ts#keeps built aligned with the request across every edit kind"
        status: pass
      - kind: other
        ref: "pnpm typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildRecolorVpk and discoverRecolorEntries reuse the shared per-hero bake cache; the forge cleanup never deletes the cache file"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: unit
        ref: "electron/main/services/foundryForge.test.ts#invokes the recolor part cleanup and leaves the shared bake cache file in place"
        status: pass
    human_judgment: false
  - id: D3
    description: "foundry:prepareRecolorStage IPC resolves only { entries: string[] }, never a filesystem path"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: other
        ref: "electron/main/ipc/foundry.ts handler return type plus pnpm typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "prepareRecolorStagedEdit stages real bake entries with refusals for unreadable mods, empty bakes, and declined acknowledgement; isStagedRecolorEdit guards the tray"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: unit
        ref: "src/components/foundry/recolorStagedEdit.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/foundry/buildTray.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Foundry Recolor sub-tool Apply becomes Stage (spinner, staged/not-staged status line, caption) while the Locker keeps immediate apply"
    requirement: REQ-foundry-forge-edit-kinds
    verification: []
    human_judgment: true
    rationale: "Component interaction (label swap, status line, caption, no reflow) has no automated DOM test; requires in-app UAT with a Deadlock install."

duration: 10min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 1: Stage a recolor end to end into the Foundry build tray

**Recolor edits now stage into the Foundry build tray with real bake-derived entry lists, survive review, and forge into one merged VPK alongside sound and texture edits, with the built[] alignment invariant locked by never guards and a named test**

## Performance

- **Duration:** 10 min (continuation of a prior executor run that committed Task 1 on 2026-08-08)
- **Started:** 2026-08-09T05:32:33Z (this continuation session)
- **Completed:** 2026-08-09T05:42:18Z
- **Tasks:** 2
- **Files modified:** 22 (19 modified, 3 created)

## Accomplishments

- `FoundryForgeEdit` admits a `recolor` member backed by `RecolorForgeRequest` (a `HeroEffectExportRequest` plus the exact normalized bake `entries`), and `FoundryBuildPart.kind` / `FoundryChangeKind` widen in lockstep
- `buildRecolorVpk` / `discoverRecolorEntries` reuse the Locker's shared per-hero ability-colors bake cache; the forge cleanup is a deliberate no-op so the file survives for the Locker's own Apply and Export
- `reviewFoundryForge`, `describeFoundryBuild`, and `buildFoundryForgeVpk` branch on kind through explicit if/else-if chains whose final else assigns the narrowed edit to a `never` local, so a fourth kind fails `pnpm typecheck` instead of silently desyncing `built[]`
- `foundry:prepareRecolorStage` resolves only `{ entries: string[] }` to the renderer: no VPK path, userData path, or save dialog
- `prepareRecolorStagedEdit` stages real bake output (sorted normalized affected files, per-hero id for replace-in-place), refusing unreadable mods, empty bakes, and declined enabled-owner acknowledgements
- Foundry's Recolor sub-tool Apply becomes Stage (spinner, staged/not-staged status line, distinguishing caption) while the Locker mount keeps its immediate-apply path, Applied status, and revert button untouched
- 15 new test cases lock the contract: recolor review entries, cross-kind collision precedence and stage-order tie-break, recolor build part provenance, the built[] alignment invariant, no-op recolor cleanup, six staging-module cases, and four tray-guard cases

## Task Commits

Each task was committed atomically:

1. **Task 1: End to end "stage a recolor in Foundry and forge it"** - `4045d54` (feat) + `e61796c` (fix)
2. **Task 2: Lock the recolor contract with tests, including the built[] alignment invariant** - `f695c9d` (test)

**Plan metadata:** final `docs(03-01)` commit (see git log)

## Files Created/Modified

- `electron/main/services/foundryRecolor.ts` (new) - recolor forge builder over the shared bake cache with a no-op cleanup, plus staging-time entry discovery
- `src/components/foundry/recolorStagedEdit.ts` (new) - `RecolorStagedEdit` / `RecolorStageContext` / `prepareRecolorStagedEdit` staging module
- `src/components/foundry/recolorStagedEdit.test.ts` (new) - six staging-contract cases
- `src/types/foundry.ts` - `RecolorForgeRequest` and the `recolor` union member
- `src/types/mod.ts` - `FoundryBuildPart.kind` widened
- `src/types/electron.ts`, `electron/preload/index.ts`, `src/lib/api.ts` - `foundry:prepareRecolorStage` wiring
- `electron/main/services/foundryForge.ts` - recolor branches plus `never` guards in all three kind-branching functions
- `electron/main/ipc/foundry.ts` - `foundry:prepareRecolorStage` handler (entries only)
- `src/components/foundry/buildTray.ts` - `isStagedRecolorEdit`, extended `unsupportedStagedEditKind` and `toForgeRequest`
- `src/components/foundry/changeList.ts` - `FoundryChangeKind` widened, recolor rows shelf under `other`
- `src/components/foundry/MyChanges.tsx` - reforge source check handles recolor edits (see deviations)
- `src/components/foundry/RecolorTool.tsx`, `src/components/locker/HeroEffectsPanel.tsx`, `src/components/locker/HeroColorPicker.tsx`, `src/pages/Foundry.tsx` - staging interaction
- `src/locales/en/translation.json`, `src/locales/manifest.json` - eleven new `locker.colors` keys
- `electron/main/services/foundryForge.test.ts`, `src/components/foundry/buildTray.test.ts` - contract tests

## Decisions Made

- Staged-edit id is `recolor:<canonical hero name>`, so re-staging a hero replaces in place via the tray's existing id filter (the UI-SPEC's open zero-one-many question, settled)
- The recolor cleanup is a no-op because the bake path is the shared per-hero cache; the Locker Apply and Export read the same file (prohibition: MUST NOT delete/truncate/invalidate)
- Discovery and forge share one cached bake, so the reviewed write set always matches the merged VPK's real contents
- Add-alongside branching with `never` guards instead of a kind-to-builder registry; the `built[]` alignment is enforced at compile time and by the named alignment test
- Stage labels use the panel's existing American spelling and title casing, per the planner's documented deviation from the UI-SPEC copy contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MyChanges reforge source check widened for the recolor kind**
- **Found during:** Task 1 (type-widening cascade)
- **Issue:** `ChangeDetails` in `src/components/foundry/MyChanges.tsx` collected reforge source files through a sound/texture ternary that read `edit.request.imagePath` off any non-sound edit. Widening `FoundryForgeEdit` with `recolor` made that line a type error (`imagePath` does not exist on the recolor request) and a latent runtime bug for a recolor reforge.
- **Fix:** Replaced the ternary with an explicit if/else-if chain; the recolor arm returns `[]` because its inputs are numeric picker parameters resolved to the shared bake cache, not user files on disk.
- **Files modified:** `src/components/foundry/MyChanges.tsx`
- **Verification:** `pnpm typecheck` and `pnpm test` green
- **Committed in:** `4045d54` (Task 1 commit)

**2. [Rule 1 - Bug] Unreadable-mod staging error now names the mods instead of showing the raw placeholder**
- **Found during:** Task 1 (post-commit fix)
- **Issue:** The plan's `stageUnreadable` copy carries a `{{mods}}` placeholder, but the initial staging implementation threw `ctx.unreadableMessage` verbatim, so the user would have seen a literal `{{mods}}` instead of the offending VPK names.
- **Fix:** `prepareRecolorStagedEdit` interpolates the inspected `unreadableMods` mod names into the message before throwing.
- **Files modified:** `src/components/foundry/recolorStagedEdit.ts`
- **Verification:** covered by the new unreadable-mods test in `recolorStagedEdit.test.ts`
- **Committed in:** `e61796c` (Task 1 fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for the widening cascade to compile and for the staging error to be truthful. No scope creep.

## Issues Encountered

- **Continuation, not a fresh start.** Task 1 was already committed by the prior executor run of this plan (`4045d54` + `e61796c`) without a SUMMARY. This session verified the committed state against every Task 1 acceptance criterion (vitest, typecheck, lint, i18n, encoding, manifest idempotence), passed the tracer feedback gate, and executed Task 2.
- **The alignment test needed a stronger assertion.** A length-only check on the sources handed to `runVpkmerge` would still pass if the recolor arm vanished (undefined would pad the array). The case now asserts the exact per-edit source list; the behavioral check was verified by temporarily deleting the recolor arm, confirming the test fails and `pnpm typecheck` fails on the `never` guard, then restoring the arm.
- **In-app behavioral verification not run in this environment.** The final Task 1 acceptance criterion (Stage button produces a tray row with non-zero affected files and installs nothing) needs a live Electron app with a configured Deadlock install, which this session could not provide. It is recorded as an unrun verify (see ledger entry) and remains a UAT item.

## Unrun Verifications

- Task 1 acceptance criterion "Behaviour: with the Foundry Recolor sub-tool open on a supported hero, pressing the Stage button produces a build tray row whose affected file count is non-zero and installs no mod" was not run (requires a Deadlock install plus the running app). Recorded in `.planning/WINDOWS.md` as `unrun-verify`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The recolor contract is locked end to end with tests; plans 03-02 and 03-03 can build on the staging module, the tray guard, and the `never`-guarded forge branching
- The remaining in-app UAT (stage a recolor, forge a mixed tray, confirm in-game) is the only outstanding item for REQ-foundry-forge-edit-kinds

## Self-Check: PASSED

All created files exist, all three commits verified in `git log`, all Task 2 acceptance criteria and the plan-level verification green (vitest 1850 passed / 0 failed, typecheck, lint, i18n:check, encoding:check, manifest idempotent).

---
*Phase: 03-foundry-completes-its-build-contract*
*Completed: 2026-08-09*
