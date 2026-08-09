---
phase: 05-one-inventory-one-journey
plan: 02
subsystem: ui
tags: [portraits, locker, foundry, hero-identity, alias-sweep, i18n, react, vitest]

# Dependency graph
requires:
  - phase: 05
    provides: The i18n keys this plan consumes (`locker.cards.shuffleScopeThisHero`, `foundry.myChanges.shuffleScopeAllForged`, `portrait.family.*`) plus the shared pool identity from plans 03-01/04 (`groupFoundryShufflePools`/`foundryShuffleKey`)
provides:
  - Scope captions distinguishing the per-hero card shuffle from the cross-hero forged-portrait pool
  - Unresolved-codename disclosure in the Foundry portrait catalog via the shared hero filter resolver
  - Four-state Locker portrait family surface (loading, failed, none, populated) with a retry action
  - Leg A of the alias sweep widened to the whole roster and both live alias tables
affects: [05-05 (records Leg A widening with Legs B/C verdicts), verify-work phase 5]

# Actuals (#2632)
actuals:
  tokens: 6454
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adopt the shared resolver (buildHeroFilterOptions + HeroSelect) instead of hand-rolling a codename fallback"
    - "reloadNonce retry pattern mirrored from PortraitBrowse into HeroCardPicker"
    - "Four-state render coverage via jsdom createRoot/act, mocking IPC-backed modules"

key-files:
  created:
    - src/components/locker/HeroPortraitFamilies.test.tsx
  modified:
    - src/components/locker/HeroCardPicker.tsx
    - src/components/locker/HeroPortraitFamilies.tsx
    - src/components/foundry/PortraitBrowse.tsx
    - src/components/foundry/MyChanges.tsx
    - src/lib/heroPortraitIdentity.test.ts

key-decisions:
  - "The two randomization views keep one pool identity and gain scope labels only; ChangePools.tsx is untouched and captions live at the call sites that choose the scope"
  - "PortraitBrowse adopts buildHeroFilterOptions without scopedHero: the surface hides its filter when hero-pinned, so every option value stays a plain codename"
  - "The unresolved disclosure derives from the visible set and only renders after a completed read, so a failed catalog routes to the failed state, never to the unresolved label"
  - "A partial portrait-family read is treated as failed (the conservative, honest reading) rather than as a partial success"
  - "Leg A proves the two live alias tables agree wherever both have an opinion; completeness against the shipped build remains Legs B and C"

patterns-established:
  - "Failed-state surfaces keep the raw diagnostic string visible as a muted secondary line while naming what is missing, why, and a retry"
  - "Whole-roster tests derive from allHeroIdentities() so a hero added later is checked automatically"

requirements-completed: [REQ-portrait-journey-consolidation-gated, REQ-portrait-alias-sweep, REQ-ui-consequence-and-vocabulary]

coverage:
  - id: D1
    description: "Randomization scope captions ('This hero' beside the per-hero card shuffle, 'All forged portraits' beside every cross-hero pool list) with the shared pool identity provably untouched"
    requirement: REQ-portrait-journey-consolidation-gated
    verification:
      - kind: unit
        ref: "pnpm exec vitest run src/lib/foundryChanges.test.ts src/components/foundry/poolView.test.ts src/components/foundry/ChangePools.test.tsx"
        status: pass
      - kind: unit
        ref: "pnpm typecheck && pnpm lint && pnpm i18n:check"
        status: pass
    human_judgment: true
    rationale: "No render test mounts HeroCardPicker or MyChanges; the captions' placement beside each control needs visual sign-off, and the label-only diff guard is a repo-level proof, not a UI assertion"
  - id: D2
    description: "Unresolved codenames in the Foundry portrait catalog keep their raw token and render as neutral Unresolved tags above the family grid, resolved through buildHeroFilterOptions"
    requirement: REQ-portrait-journey-consolidation-gated
    verification:
      - kind: unit
        ref: "src/components/foundry/heroFilterOptions.test.ts#sorts unresolved codenames below the roster and marks them, without inventing a hero"
        status: pass
      - kind: unit
        ref: "src/components/common/HeroSelect.test.tsx"
        status: pass
    human_judgment: true
    rationale: "The resolver and select are unit-tested, but PortraitBrowse has no render-level test; the one-hint-per-group placement and title-attribute behavior need functional sign-off"
  - id: D3
    description: "Locker portrait family surface distinguishes loading, failed, none and populated as four renders, with the failed state naming what is missing, why, and a working retry"
    requirement: REQ-ui-consequence-and-vocabulary
    verification:
      - kind: unit
        ref: "src/components/locker/HeroPortraitFamilies.test.tsx#loading shows only the loading copy, none of the other three states"
        status: pass
      - kind: unit
        ref: "src/components/locker/HeroPortraitFamilies.test.tsx#error shows the failed heading, the raw diagnostic and a retry that fires onRetry once"
        status: pass
      - kind: unit
        ref: "src/components/locker/HeroPortraitFamilies.test.tsx#no slots and no portraits shows the existing none copy and no retry control"
        status: pass
      - kind: unit
        ref: "src/components/locker/HeroPortraitFamilies.test.tsx#a populated family shows the families heading and neither the failed nor the none copy"
        status: pass
    human_judgment: false
  - id: D4
    description: "Leg A of the alias sweep: whole-roster collision check derived from allHeroIdentities, plus dual-table cross-check against canonicalHeroName/HERO_NAMES_SORTED"
    requirement: REQ-portrait-alias-sweep
    verification:
      - kind: unit
        ref: "src/lib/heroPortraitIdentity.test.ts#never maps one codename to two heroes across the whole roster"
        status: pass
      - kind: unit
        ref: "src/lib/heroPortraitIdentity.test.ts#collapsing a display duplicate never changes which hero the roster resolves"
        status: pass
      - kind: unit
        ref: "src/lib/heroPortraitIdentity.test.ts#resolves every sorted shared-roster name through the display-alias collapse"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-09
status: complete
---

# Phase 5 Plan 2: Honest Portrait Journey Summary

**Two randomization scopes labeled over one shared pool identity, unplaceable codenames disclosed as unresolved through the shared hero filter, a four-state Locker portrait surface with retry under render coverage, and Leg A of the alias sweep widened to the whole roster and both live alias tables**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-09T07:48:20Z
- **Completed:** 2026-08-09T07:58:19Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- The per-hero card shuffle and the cross-hero forged-portrait pool each state their scope (`This hero` / `All forged portraits`) while continuing to read and write one pool identity; `ChangePools.tsx` and the pool key derivation are untouched.
- The Foundry portrait catalog's hero filter now consults the centralized `buildHeroFilterOptions` resolver; a codename the table cannot place keeps its raw token, carries an explicit `Unresolved` neutral tag (raw name in the `title` attribute), and the hint renders once per group above the family grid.
- The Locker's portrait family surface distinguishes `loading`, `failed`, `none` and `populated` as four renders. The failed state names what is missing, why, and offers a working retry; `HeroCardPicker` now passes `error`/`onRetry` instead of blanking the surface behind a bare error string.
- Leg A of the alias sweep now spans the whole roster (derived from `allHeroIdentities()`) and both live alias tables (`heroIdentity.ts` vs `lockerUtils.ts`'s display-alias collapse); a divergence between them fails a test, proven by a temporary-corruption experiment reverted before commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Caption the two randomization scopes** - `3df6349` (feat)
2. **Task 2: Unresolved codenames and Locker failed state** - `63df481` (feat)
3. **Task 3: Close Leg A across the whole roster and both alias tables** - `dc9b081` (test)

**Plan metadata:** metadata commit follows (docs: complete plan)

## Files Created/Modified
- `src/components/locker/HeroPortraitFamilies.test.tsx` - New: four-state render coverage (loading / failed / none / populated) with IPC modules mocked
- `src/components/locker/HeroCardPicker.tsx` - Scope captions at both call sites; `reloadNonce` retry wiring; bare error block removed in favor of the family surface's failed state
- `src/components/locker/HeroPortraitFamilies.tsx` - `error`/`onRetry` props and the failed branch between loading and none
- `src/components/foundry/PortraitBrowse.tsx` - `buildHeroFilterOptions` + `HeroSelect` swap, plus the unresolved-codename disclosure above the family grid
- `src/components/foundry/MyChanges.tsx` - "All forged portraits" caption beside the pools-view `FoundryPoolList`
- `src/lib/heroPortraitIdentity.test.ts` - Whole-roster collision case and dual-table cross-check cases

## Decisions Made
- Scope captions live at the call sites, never inside `ChangePools.tsx`, because the component renders in more than one context and the caption names the scope its embedder chose (one key, one wording for the shared pool).
- `PortraitBrowse` adopts `buildHeroFilterOptions` without `scopedHero`: the surface hides its filter when hero-pinned, so every option value stays a plain codename, which `heroFilter` and the `scope` derivation already expect.
- The unresolved disclosure only renders after a completed read leaves a codename unplaced; a catalog read failure routes to the failed state, and a partial read is treated as failed (conservative and honest).
- Leg A does not merge the two alias tables: they answer different questions in different namespaces, and the new cases prove they agree wherever both have an opinion.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1's label-only diff criterion is a naive grep over `git diff`; keeping the `FoundryPoolList` block byte-identical (fragment wrapper in MyChanges, comment rewording in HeroCardPicker) left zero added/removed lines touching the guarded pool tokens. The one remaining grep hit is an unchanged context line, not a changed line.
- Task 3's behavior-proof mutation (temporarily corrupting `HERO_DISPLAY_ALIASES`) left a line-ending artifact in `src/lib/lockerUtils.ts` after revert; the file was restored byte-identical from the index and is not part of any commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for plan 05-03 (bulk undo and disabled-action vocabulary).
- Legs B and C of the alias sweep now start from a table proven self-consistent; plan 05-05 owns the driven legs and the single coherent update to `docs/portrait-alias-sweep-plan.md`.
- Full suite green (170 files, 1905 tests), typecheck/lint/i18n/encoding gates green, no i18n keys added by this plan.

## Self-Check: PASSED

All created/modified files verified on disk; task commits `3df6349`, `63df481` and `dc9b081` verified in git log.

---
*Phase: 05-one-inventory-one-journey*
*Completed: 2026-08-09*
