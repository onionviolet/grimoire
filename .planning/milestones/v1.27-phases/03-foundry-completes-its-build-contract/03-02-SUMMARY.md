---
phase: 03-foundry-completes-its-build-contract
plan: 02
subsystem: ui
tags: [react, zustand, i18n, lucide, foundry, locker, launch-shuffle]

requires:
  - phase: 03-foundry-completes-its-build-contract
    provides: "HeroSkinsPanel inline shuffle toggles (extraction source), appStore soundShuffleIncluded + toggleSoundShuffleIncluded, shuffleSoundKey identity, /locker/sounds?hero= route contract"
provides:
  - Shared ShuffleToggleButton used by Locker skin cards and Foundry sound rows
  - heroSoundShuffleRows / soundLockerHref pure helpers with unit tests
  - Foundry hero-scoped launch-shuffle pool editing with a Locker deep link
  - REQUIREMENTS.md traceability correction for REQ-foundry-pool-audition-fidelity
affects: [04-locker-and-foundry-as-one-object, Locker, Foundry, Sound Locker]

actuals:
  tokens: 5314
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One presentational control component shared by two surfaces; positioning passed via className"
    - "Pure hero-to-pool selector comparing canonical hero names (canonicalHeroName), matching changeList.ts scoping"
    - "Single store action per surface; pool identity reuses shuffleSoundKey unchanged (D-11)"

key-files:
  created:
    - src/components/foundry/ShuffleToggleButton.tsx
    - src/lib/foundrySoundShuffle.ts
    - src/lib/foundrySoundShuffle.test.ts
  modified:
    - src/components/locker/HeroSkinsPanel.tsx
    - src/components/foundry/SoundBrowse.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Extract the shuffle toggle into one component (isIncluded/onToggle/name/armed/className); each Locker call site keeps its positioning and hover-reveal group variant via className"
  - "Foundry pool membership reads/writes appStore's existing soundShuffleIncluded Set through toggleSoundShuffleIncluded; no second key or store (D-10, D-11)"
  - "The Foundry shuffle block renders only for hero-scoped views (scopedHero resolves through heroNames); zero-mod heroes render nothing, per D-11 absence"
  - "Pool rows derive from heroSoundShuffleRows: soundSwap-scoped mods only, canonical hero matching, exact shuffleSoundKey identity, stable name/id order"
  - "REQ-foundry-pool-audition-fidelity recorded as delivered before this phase, citing commit 9b01c63 and the two source files read to confirm (D-06..D-08)"
  - "Row-toggle unpressed background normalized from bg-black/55 to bg-black/65 so the component owns the colour states (plan's canonical class list)"

patterns-established:
  - "Shared control plus className positioning: Locker card overlay vs Foundry inline row"
  - "Canonical hero-name matching for cross-surface hero scoping (changeList.ts precedent)"
  - "Doc-drift corrections carry commit plus source-file evidence, not a bare status flip"

requirements-completed: [REQ-foundry-sound-shuffle-surfacing, REQ-foundry-pool-audition-fidelity]

coverage:
  - id: D1
    description: "Single ShuffleToggleButton component serves both HeroSkinsPanel call sites with unchanged aria-pressed, i18n labels, hover-reveal and stopPropagation"
    requirement: REQ-foundry-sound-shuffle-surfacing
    verification:
      - kind: other
        ref: "pnpm typecheck && pnpm lint (pass); grep: no inline aria-pressed={isIncluded} remains in HeroSkinsPanel.tsx; ShuffleToggleButton mentions >= 3"
        status: pass
    human_judgment: true
    rationale: "The shared control's rendered behavior (hover reveal, pressed fill, card-click isolation) is only verifiable in a DOM/in-app session; vitest runs in plain node with no DOM."
  - id: D2
    description: "heroSoundShuffleRows and soundLockerHref pure helpers: hero-scoped soundSwap filter, canonical alias matching, exact shuffleSoundKey reuse, stable order, encoded Locker href"
    requirement: REQ-foundry-sound-shuffle-surfacing
    verification:
      - kind: unit
        ref: "src/lib/foundrySoundShuffle.test.ts (10 cases, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Foundry SoundBrowse hero-scoped shuffle pool block: one toggle per installed sound-swap mod via toggleSoundShuffleIncluded, Open in Sound Locker link via soundLockerHref, nothing rendered for zero-mod heroes"
    requirement: REQ-foundry-sound-shuffle-surfacing
    verification:
      - kind: other
        ref: "pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check (all pass; no literal /locker/sounds?hero= in SoundBrowse; no toggleMod/deleteMod/reorderMods/setModPriorityFolder)"
        status: pass
    human_judgment: true
    rationale: "Cross-surface membership consistency (Foundry toggle vs Locker view of the same hero) needs an in-app UAT session with a hero that has installed sound-swap mods; no DOM test exists in this repo."
  - id: D4
    description: "REQUIREMENTS.md traceability for REQ-foundry-pool-audition-fidelity corrected to delivered-before-this-phase, naming commit 9b01c63 and the source files read as evidence"
    requirement: REQ-foundry-pool-audition-fidelity
    verification:
      - kind: other
        ref: "rg 'REQ-foundry-pool-audition-fidelity.*Pending' .planning/REQUIREMENTS.md (no match); rg '9b01c63|useClipPlayer' (present); useClipPlayer.test.ts 9 tests pass"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 2: Foundry Sound Shuffle Surfacing Summary

**Foundry gains inline editing of a hero's launch-shuffle sound pool through one shared toggle component, a Locker deep link, and a corrected pool-audition traceability record**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T00:45:37Z
- **Completed:** 2026-08-09T00:53:26Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extracted the shuffle-inclusion control into `ShuffleToggleButton`, now used by both `HeroSkinsPanel` call sites and the new Foundry sound rows, so the control cannot drift between the Locker and Foundry.
- Added `heroSoundShuffleRows` and `soundLockerHref` pure helpers in `src/lib/foundrySoundShuffle.ts`, covered by 10 unit tests.
- Mounted a hero-scoped "Shuffle on launch" section in `SoundBrowse.tsx`: one toggle per installed sound-swap mod, reading and writing the existing `soundShuffleIncluded` store, plus the compact "Open in Sound Locker" link reusing the documented `/locker/sounds?hero=<name>` contract.
- Corrected `REQUIREMENTS.md` so `REQ-foundry-pool-audition-fidelity` records delivery before this phase with commit `9b01c63` (2026-07-26) and the source files read to confirm it, instead of leaving Phase 3 Pending.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the shuffle toggle into one component and pure hero-pool selection** - `2b8aa24` (refactor)
2. **Task 2: Mount the shuffle pool row and the Locker link inside Foundry's sound surface** - `e5b52ca` (feat)
3. **Task 3: Cover the pool helpers with tests and correct the pool-audition traceability record** - `cffdc4b` (test)

## Files Created/Modified

- `src/components/foundry/ShuffleToggleButton.tsx` - The single shuffle-inclusion control (icon, i18n labels, aria-pressed, pressed/unpressed colour states, stopPropagation); positioning arrives via `className`.
- `src/lib/foundrySoundShuffle.ts` - `heroSoundShuffleRows` (canonical-hero filter over installed soundSwap mods, exact `shuffleSoundKey` identity, stable name/id order) and `soundLockerHref` (percent-encoded hero query or global path).
- `src/lib/foundrySoundShuffle.test.ts` - 10 cases covering selection, alias matching, lockerHero precedence, key reuse, ordering, and href encoding.
- `src/components/locker/HeroSkinsPanel.tsx` - Both inline shuffle buttons replaced with `ShuffleToggleButton`; no inline `aria-pressed={isIncluded}` copy remains.
- `src/components/foundry/SoundBrowse.tsx` - Hero-scoped shuffle section with per-row toggles and the Locker link; renders nothing when the hero has no sound-swap mods.
- `.planning/REQUIREMENTS.md` - Requirement bullet and traceability row for `REQ-foundry-pool-audition-fidelity` corrected with delivery evidence.

## Decisions Made

- One shared component instead of a Foundry re-invention (D-10), with positioning and hover-reveal group variants passed through `className` because the Locker overlays a card while Foundry lays the control inline.
- No second pool store: Foundry toggles the same `soundShuffleIncluded` Set via the same `toggleSoundShuffleIncluded` action, keyed by the unchanged `shuffleSoundKey` (D-11).
- The shuffle surface mounts only when `scopedHero` resolves through `heroNames` (workshop Abilities/Voice sections); the top-level catalog tab and zero-mod heroes render no block at all (D-11 absence, no empty-state banner).
- Pool-audition fidelity is recorded as already delivered (D-06..D-08) with the commit and source evidence, rather than left as open work.

## Deviations from Plan

No auto-fixes were required (Rules 1-3 did not fire). One deliberate, documented normalization:

**Normalization note: SkinGroupRow toggle unpressed background `bg-black/55` -> `bg-black/65`**
- **Found during:** Task 1 (`HeroSkinsPanel.tsx` row call site)
- **Issue:** The two inline copies differed in the unpressed background shade (`bg-black/65` on cards, `bg-black/55` on rows); the plan's interface block names `bg-black/65` as the component's class list, so the component owns that shade.
- **Fix:** `ShuffleToggleButton` bakes `bg-black/65`; the row passes only its positioning and `group-hover/row` reveal classes via `className`.
- **Verification:** typecheck, lint, and the full test suite pass; hover-reveal, `aria-pressed`, i18n labels, and `stopPropagation` are byte-identical.
- **Committed in:** `2b8aa24` (Task 1 commit)

---

**Total deviations:** 0 auto-fixed (one cosmetic normalization, no functional impact)
**Impact on plan:** None. All three tasks shipped as planned; the normalization only unifies the unpressed shade of the shared control.

## Issues Encountered

None. Plan-level verification is green: `pnpm typecheck`, `pnpm lint`, `pnpm test` (1860 passing), `pnpm i18n:check` (exit 0, no new key), and `pnpm encoding:check` (clean).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `REQ-foundry-sound-shuffle-surfacing` is complete: a user can add or remove a hero's sound from the launch shuffle pool inside Foundry, and the Locker reads the same membership from the same store.
- `REQ-foundry-pool-audition-fidelity` is recorded delivered with commit and source evidence.
- 03-03 (the remaining forge-edit-kinds recolor work) is still pending; `REQ-foundry-forge-edit-kinds` stays open until it summarizes.
- UI-SPEC backstops carried forward for UAT: a failed pool write reverting `aria-pressed` (E4 error) and an unmatched hero name landing on the unfiltered Sound Locker (E5 error) remain human-verify items.

---
*Phase: 03-foundry-completes-its-build-contract*
*Completed: 2026-08-09*

## Self-Check: PASSED

- All 7 planned files verified on disk (3 created, 4 modified)
- All 3 task commits verified in git history (`2b8aa24`, `e5b52ca`, `cffdc4b`)
