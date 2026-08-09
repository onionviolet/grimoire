---
phase: 05-one-inventory-one-journey
plan: 04
subsystem: ui
tags: [react, typescript, locker, vpk, d19, requirement-traceability]

# Dependency graph
requires:
  - phase: 05-01
    provides: widened three-value LockerMode, hide-empty rail projection, and the locker.global.unnamedPak* catalog keys
  - phase: 04-locker-and-foundry-as-one-object
    provides: shared LockerGlobalView shell and GlobalSoundShelf, sound inventory read model, list-unknown-mod-files IPC
provides:
  - Pure unnamed-pak detection and path-derived description module (isUnnamedPakName, derivePakDescription)
  - Memoized per-mod VPK entry read hook for unnamed paks (useUnnamedPakEntries)
  - Global card label that leads with what an unnamed pak writes, retaining the raw pak name as secondary identity
  - Recorded resolution of REQ-sound-locker-surface and closure notes for REQ-global-inventory-coherence in REQUIREMENTS.md
affects: [05-05, 05-06, verify-work, Weblate re-translation]

# Actuals (#2632) - pairs with the plan's estimate (55000 tokens)
actuals:
  tokens: 5750   # chars/4 over the realized diff (23001 diff chars)
  tasks: 3       # tasks completed
  commits: 5     # 4 task commits + 1 final metadata commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation module beside the sibling lib modules: detection and description are testable with no React or IPC, matching the globalInventory/lockerMode pattern"
    - "Memoized per-mod VPK read hook mirroring useDiscoveredSoundPaths: one call per mod id recorded in a ref, silent per-mod failures"
    - "Requirement traceability citing evidence: the resolution note names the decision, the component, the route helpers and the test file that proves the claim"

key-files:
  created:
    - src/lib/derivedPakName.ts
    - src/lib/derivedPakName.test.ts
    - src/components/locker/useUnnamedPakEntries.ts
  modified:
    - src/pages/Locker.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Unnamed-pak detection matches the exact extractModName output shape (the word pak followed by digits), so a real mod named Pak Rat stays untouched"
  - "The derived entry list caps at three leaf names plus a remainder count, with the cap a parameter the render site never hardcodes"
  - "Unreadable and empty VPKs produce the same unknown label per D-19, because the user can act on neither differently"
  - "REQ-sound-locker-surface recorded as resolved by D-01/D-02 with the evidence cited: GlobalSoundShelf carries the preserved capabilities, legacySoundTarget/resolveLockerRoute keep the shipped URLs alive, lockerMode.test.ts proves it"

patterns-established:
  - "The mod's own VPK directory is the identity source for an unnamed pak, the same move the Announcer-shelf classification fix made for the sound rail"

requirements-completed: [REQ-global-inventory-coherence, REQ-sound-locker-surface]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Pure isUnnamedPakName detection and derivePakDescription over exact VPK entry paths, with the three-entry cap, distinct-leaf remainder and unknown fallback"
    requirement: REQ-global-inventory-coherence
    verification:
      - kind: unit
        ref: "src/lib/derivedPakName.test.ts#describe(isUnnamedPakName)"
        status: pass
      - kind: unit
        ref: "src/lib/derivedPakName.test.ts#describe(derivePakDescription)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useUnnamedPakEntries reads each unnamed pak's entries once per mod, memoized for the life of the page, with silent per-mod failures"
    requirement: REQ-global-inventory-coherence
    verification: []
    human_judgment: true
    rationale: "The hook is renderer behavior over IPC; this repo has no DOM test harness for hooks, so its one-call-per-mod and failure-silence bounds need a human in the running app."
  - id: D3
    description: "A Global card for a mod named only after its pak slot leads with what it writes, keeps the raw pak name on a secondary line, and shows the unknown label when nothing can be read"
    requirement: REQ-global-inventory-coherence
    verification:
      - kind: unit
        ref: "pnpm exec vitest run src/lib/derivedPakName.test.ts (unknown/derived variants)"
        status: pass
    human_judgment: true
    rationale: "The label derivation is unit-proven, but the rendered card (loading state, secondary identity line, unknown label, truncate/title behavior) has no DOM-level test in this repo and needs a human in the running app."
  - id: D4
    description: "REQ-sound-locker-surface recorded as answered by D-01/D-02, and REQ-global-inventory-coherence amended with what closed each named layout defect"
    requirement: REQ-sound-locker-surface
    verification:
      - kind: other
        ref: "node -e requirement assertion: REQ-sound-locker-surface, REQ-global-inventory-coherence, GlobalSoundShelf, legacySoundTarget, lockerMode.test.ts all present"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run src/lib/lockerMode.test.ts (13 tests, legacy rewrites and widened default)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-09
status: complete
---

# Phase 5 Plan 4: Derived Pak Descriptions and the Recorded Global Sound Answer

**A Global card for a pak with no useful name now leads with what the mod actually writes, derived from its own VPK entries, and the contested global sound inventory variant is on the record as resolved by D-01 and D-02 with the evidence cited.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T08:11:13Z
- **Completed:** 2026-08-09T08:18:48Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `src/lib/derivedPakName.ts` adds pure, framework-free `isUnnamedPakName` (detects exactly the `PakNN` shape `extractModName` produces) and `derivePakDescription` (leaf names from exact entry paths, de-duplicated, sorted, capped at three with a remainder count, unknown fallback when nothing is readable). Ten tests cover every behavior line.
- `src/components/locker/useUnnamedPakEntries.ts` reads each unnamed pak's entries once per mod through the existing `list-unknown-mod-files` channel, memoized for the life of the page with silent per-mod failures, mirroring the Announcer-shelf sound hook.
- `LockerGlobalView` swaps the Global card's primary label for the derived description when the mod name is only a pak slot, retains the raw pak name as a `text-[11px]` secondary identity line, shows the raw name while the read is in flight, and renders the unknown label for unreadable or empty VPKs. Mods with real names render exactly as before.
- `.planning/REQUIREMENTS.md` now records REQ-sound-locker-surface as answered: D-01 makes the Locker Global drill-in the single canonical home, D-02 keeps the folded-back capabilities inside `GlobalSoundShelf`, the shipped `/locker/sounds*` URLs still resolve through `legacySoundTarget`/`resolveLockerRoute` (proven by `lockerMode.test.ts`), and the deferred route returns only if a concrete workflow needs it. REQ-global-inventory-coherence carries a dated note naming what closed each of its four layout defects.

## Task Commits

Each task was committed atomically:

1. **Task 1: The pure detection and derivation, tested before it is wired** - `4159809` (test), `1c6b8cc` (feat)
2. **Task 2: Read each unnamed pak's entries once, and lead its Global card with what it writes** - `eff62b3` (feat)
3. **Task 3: Record the answer to the contested global sound inventory variant** - `ce6935b` (docs)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `src/lib/derivedPakName.ts` - Pure `isUnnamedPakName` + `derivePakDescription` implementing D-19
- `src/lib/derivedPakName.test.ts` - Ten cases covering detection, derivation, the cap, the distinct-leaf remainder and the unknown fallback
- `src/components/locker/useUnnamedPakEntries.ts` - Memoized per-mod VPK entry reads for unnamed paks
- `src/pages/Locker.tsx` - Hook call in `LockerGlobalView`; Global card name row leads with the derived description
- `.planning/REQUIREMENTS.md` - Resolution note for REQ-sound-locker-surface; closure note for REQ-global-inventory-coherence; traceability rows updated

## Decisions Made
- All planner decisions carried as written: exact `PakNN` detection shape, three-entry cap with remainder count, unreadable and empty produce the same unknown label, and the sound inventory variant recorded as resolved rather than silently dropped.
- The only execution-time choice was amending the Task 1 commit message to fix a typo before it landed; no plan decision was re-litigated.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The RED test failed for the expected reason (module missing), GREEN passed immediately, and every repository gate stayed green throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 2 of phase 5 (plans 05-02, 05-03, 05-04) is complete; ready for wave 3, plan 05-05 (Legs B and C of the alias sweep over CDP, which needs a committed tree and a free dev slot).
- The remaining `human_judgment` items (rendered card behavior D2/D3) are queued for the phase's `$gsd-verify-work` run.

---
*Phase: 05-one-inventory-one-journey*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: derivedPakName.ts, derivedPakName.test.ts, useUnnamedPakEntries.ts, Locker.tsx, REQUIREMENTS.md, SUMMARY
- Commits verified in git log: `4159809`, `1c6b8cc`, `eff62b3`, `ce6935b`
- Stub scan clean: no TODO/FIXME/placeholder patterns in any plan file
- Full verification suite green: `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run` (1924 passed, 12 skipped), `pnpm i18n:check`, `pnpm encoding:check`
- No file under `electron/` changed by this plan (no new IPC surface)
