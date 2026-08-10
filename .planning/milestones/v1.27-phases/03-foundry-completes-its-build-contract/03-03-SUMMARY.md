---
phase: 03-foundry-completes-its-build-contract
plan: 03
subsystem: ui
tags: [react, i18n, lucide, foundry, locker, recolor, change-list]

requires:
  - phase: 03-foundry-completes-its-build-contract
    provides: "Recolor staged-edit module (prepareRecolorStagedEdit/isStagedRecolorEdit, per-hero id), HeroEffectsPanel onStageRecolor prop, FoundryChangeKind 'recolor' widening, foundry.subtools.recolor + foundry.buildTray.kind.recolor keys"
provides:
  - "Exhaustive change-list kind mapping with a recolor row (Palette icon, accent Recolor tag, neutral Change fallback)"
  - "Workshop Appearance mount staging recolors into the same per-hero build tray row as the Recolor sub-tool"
  - "Caption contract distinguishing the two effect slots (Abilities stages, Body + Gun applies immediately) on Foundry mounts only"
  - "changeList.test.ts coverage for mixed sound/texture/recolor builds and recolor filter shelfing"
affects: [04-locker-and-foundry-as-one-object, Locker, Foundry, verify-work UAT]

actuals:
  tokens: 1534
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Exhaustive Record/switch mapping for user-facing kind labels with a neutral fallback so a forged or future kind cannot impersonate another row type (T-03-09)"
    - "Optional onStageRecolor prop gates Foundry-specific staging UI on mounts that stage, leaving Locker mounts on the unchanged immediate-apply path"
    - "One per-hero staged-edit id shared by both staging entry points, so tray dedupe collapses both surfaces into a single row"

key-files:
  created: []
  modified:
    - src/components/foundry/MyChanges.tsx
    - src/components/foundry/changeList.ts
    - src/components/foundry/changeList.test.ts
    - src/components/foundry/HeroWorkshop.tsx
    - src/components/locker/HeroEffectsPanel.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json

key-decisions:
  - "My changes kinds map exhaustively: sound keeps Volume2, texture keeps ImageIcon, recolor gets the lucide Palette icon plus an accent-toned Recolor tag (foundry.subtools.recolor), and an unrecognised kind falls back to a neutral FileQuestion icon and the new foundry.myChanges.kind.other label instead of borrowing the texture row"
  - "changeFilterOf branches sound/texture/recolor explicitly with a never-typed default, so a fourth kind fails typecheck rather than shelfing under a texture category it was never assigned"
  - "The workshop Appearance mount passes the existing stage callback as onStageRecolor; because prepareRecolorStagedEdit ids by hero and Foundry dedupes staged edits by id, both entry points produce exactly one tray row per hero"
  - "Both effect-surface captions live in HeroEffectsPanel gated on onStageRecolor (abilitiesStageNote for Abilities, appliesImmediately for Body + Gun); TrippySkinPanel behaviour and the Locker hero page mount are untouched and uncaptioned"

patterns-established:
  - "Kind-to-label/icon mapping as an exhaustive typed Record plus switch, with a neutral fallback for unknown runtime values"
  - "Prop-gated behavioural captions: the mount that stages declares it; mounts that apply immediately stay silent"
  - "Cross-surface staging identity via a stable per-hero edit id reused by every staging entry point"

requirements-completed: [REQ-foundry-forge-edit-kinds]

coverage:
  - id: D1
    description: "changeFilterOf/filterFoundryChanges handle recolor: recolor shelves under the other filter, the sound filter excludes it, and a fourth kind fails typecheck via a never default instead of a bare else"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: unit
        ref: "src/components/foundry/changeList.test.ts#shelves a recolor row under other and keeps it out of the sound filter"
        status: pass
    human_judgment: false
  - id: D2
    description: "collectFoundryChanges gives a mixed build one row per part including a recolor part, each with its own entries and partOfBuild true"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: unit
        ref: "src/components/foundry/changeList.test.ts#gives a mixed build one row per part, including a recolor part"
        status: pass
    human_judgment: false
  - id: D3
    description: "MyChanges renders a recolor row as complete: Palette icon, accent Recolor tag, subtitle-only line with no empty source-file slot, same row height as sound/texture rows, and an unrecognised kind falls back to the neutral Change label"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: other
        ref: "grep MyChanges.tsx: Palette + foundry.subtools.recolor present; two-way ternary absent; pnpm typecheck && pnpm lint && pnpm i18n:check && pnpm encoding:check (all pass)"
        status: pass
    human_judgment: true
    rationale: "No DOM test infrastructure exists in this repo (vitest runs in node); the visual completeness of a Recolor row next to Sound and Texture rows is UI-SPEC backstop E3 and needs an in-app look."
  - id: D4
    description: "The workshop Appearance section stages a recolor into the same single build tray row as the Recolor sub-tool, via the same per-hero staged-edit id so re-staging replaces rather than duplicates"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: other
        ref: "grep HeroWorkshop.tsx onStageRecolor={stage}; pnpm typecheck && pnpm lint && pnpm test (all pass)"
        status: pass
    human_judgment: true
    rationale: "Replace-in-place staging across two entry points is an interactive flow only observable in the running app; no DOM tests exist."
  - id: D5
    description: "The two effect slots are captioned only on Foundry mounts: Abilities reads abilitiesStageNote (stages into the build tray), Body + Gun reads appliesImmediately, and the Locker hero page renders neither caption"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: other
        ref: "grep HeroEffectsPanel.tsx onStageRecolor gate + both keys; git diff TrippySkinPanel.tsx (no handleApply/applyTrippySkin change); pnpm test (all pass)"
        status: pass
    human_judgment: true
    rationale: "The Abilities-stages / Body+Gun-applies-immediately distinction inside one mounted panel is a manual-only row in 03-VALIDATION.md and needs an in-app session; no DOM tests exist."
  - id: D6
    description: "i18n keys foundry.myChanges.kind.other, locker.effects.abilitiesStageNote, locker.trippy.appliesImmediately exist in the en catalog and the locale manifest regenerates idempotently"
    requirement: REQ-foundry-forge-edit-kinds
    verification:
      - kind: other
        ref: "pnpm i18n:check (exit 0, all 2604 referenced keys exist); second pnpm i18n:manifest leaves manifest.json byte-identical"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 3: Recolor Reads Honestly Everywhere Summary

**A recolor is now a first-class Foundry change: its own labelled, complete row in My changes with an exhaustive kind mapping, a second staging entry point in the workshop Appearance section that shares one per-hero tray row, and captions that tell the user which effect slot writes bytes immediately**

## Performance

- **Duration:** 5 min (continuation session; Tasks 1-2 were committed in a prior session at 01:01-01:03 -0500 and verified here)
- **Started:** 2026-08-09T06:03:00Z
- **Completed:** 2026-08-09T06:08:33Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- My changes renders a recolor part of a forged build as its own row: Palette icon, accent-toned Recolor tag, subtitle-only line with no empty source-file slot, and the part-of-build badge. An unrecognised future or forged kind falls back to a neutral FileQuestion icon plus the neutral "Change" label instead of impersonating a texture row (T-03-09).
- `changeFilterOf` is exhaustive over the widened `FoundryChangeKind`: sound returns the sound filter, texture returns its catalog category, recolor shelves under `other`, and a fourth kind fails typecheck via a `never` default instead of silently shelfing under a texture category.
- The workshop Appearance section passes the component's existing `stage` callback into `HeroEffectsPanel` as `onStageRecolor`, so a recolor authored there lands in the same single per-hero build-tray row as one from the Recolor sub-tool (same per-hero staged-edit id, tray dedupe by id).
- The Effects panel captions its two slots only on Foundry mounts: Abilities reads "This stages into the Foundry build tray. It will not take effect until you forge.", Body + Gun reads "This applies immediately and does not go through the build tray." The Locker hero page stays uncaptioned and `TrippySkinPanel` behaviour is untouched.
- Tests: `changeList.test.ts` extended to 19 passing cases (mixed sound/texture/recolor build, partOfBuild, filter shelfing); full suite 1862 passed; typecheck, lint, i18n:check, and encoding:check all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give a recolor its own labelled row in the change list** - `a774b54` (feat) - committed in a prior execution session, verified here
2. **Task 2: Wire the workshop Appearance mount and caption both effect surfaces** - `0215a6e` (feat) - committed in a prior execution session, verified here
3. **Task 3: Confirm the recolor forge and the shuffle surface against the real game install** - no commit (checkpoint:human-verify, gate=blocking, auto-approved under auto mode; see Verification)

**Plan metadata:** `docs(03-03): complete recolor-reads-honestly plan` (final commit)

## Files Created/Modified

- `src/components/foundry/MyChanges.tsx` - Exhaustive kind-to-icon mapping (`KIND_ICONS` with Palette for recolor, FileQuestion fallback) and kind label (accent Recolor tag, neutral Change fallback); recolor rows render complete with no empty source-file line.
- `src/components/foundry/changeList.ts` - `changeFilterOf` branches sound/texture/recolor explicitly with a `never`-typed default; recolor shelves under `other`.
- `src/components/foundry/changeList.test.ts` - Mixed sound/texture/recolor build produces three rows with per-part entries and `partOfBuild` true; recolor excluded from the sound filter; `changeFilterOf(recolor) === 'other'`.
- `src/components/foundry/HeroWorkshop.tsx` - Appearance mount passes `onStageRecolor={stage}`; nothing else in the file changed.
- `src/components/locker/HeroEffectsPanel.tsx` - Caption under the surface toggle gated on `onStageRecolor`, switching between `abilitiesStageNote` and `appliesImmediately`.
- `src/locales/en/translation.json` - Adds `foundry.myChanges.kind.other`, `locker.effects.abilitiesStageNote`, `locker.trippy.appliesImmediately` (ASCII only).
- `src/locales/manifest.json` - Regenerated (3069 keys), idempotent on a second run.

`src/components/locker/TrippySkinPanel.tsx` appears in the plan's file list but was deliberately not touched: the Body + Gun caption lives in `HeroEffectsPanel` (the plan's primary option), so `handleApply` and the `applyTrippySkin` call are byte-identical.

## Decisions Made

- Recolor rows use the existing `Tag` primitive with `tone="accent"` plus the Palette icon as their whole accent budget; title, subtitle, and hero name stay on primary/secondary text tokens per the UI-SPEC Color contract.
- The kind mapping is exhaustive at the type level too: a fourth kind fails the build rather than being silently shelfed or mislabelled.
- `TrippySkinPanel` keeps its immediate-apply slot exactly as-is; only a caption line was added (in the parent panel), because its sibling tab's behaviour changed underneath it (planner decision: caption is not scope creep).

## Deviations from Plan

None - plan executed exactly as written. Two execution notes, neither a deviation:

1. Tasks 1-2 were implemented and committed by a prior executor session that stopped before Task 3; this session verified the commits against every acceptance criterion and completed the plan.
2. Task 3's human-verify checkpoint carries `gate="blocking"` (not `blocking-human`) and auto mode is active (`workflow._auto_chain_active: true`, `workflow.auto_advance: true`), so per checkpoint protocol rule 5 it auto-approved. The ten manual-only rows remain recorded as `human_judgment: true` deliverables above so the end-of-phase UAT harvest still routes them to a human.

## Issues Encountered

None during this session. The only wrinkle was the handoff itself: the prior session left the plan without a SUMMARY or state updates, which this session produced after re-verifying everything.

## Verification

- **Task 1 automated verify:** `pnpm exec vitest run src/components/foundry/changeList.test.ts` (19 passed), `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm encoding:check` - all exit 0.
- **Task 2 automated verify:** `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm encoding:check`, `pnpm test` (164 files / 1862 tests passed) - all exit 0.
- **Task 1 acceptance greps:** `Palette` and `foundry.subtools.recolor` present in `MyChanges.tsx`; the two-way ternary `entry.kind === 'sound' ? Volume2 : ImageIcon` is gone; `foundry.myChanges.kind.other` exists in the en catalog; a second `pnpm i18n:manifest` leaves `manifest.json` unchanged.
- **Task 3 precondition:** met - Settings (`C:\Users\wayba\AppData\Roaming\grimoire\settings.json`) holds `deadlockPath: D:\Steam\steamapps\common\Deadlock`, and `D:\Steam\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk` exists.
- **Task 3 checkpoint:** auto-approved under auto mode (gate=blocking, human-verify). The 10-step in-game pass (combined forge, bake-cache integrity, two-tab behaviour, staging spinner E1, re-stage E1/E2, partial VFX detection E1, long label E1, recolor row completeness E3, shuffle write failure E4, Locker link fallback E5) is tracked via the coverage block for the end-of-phase UAT harvest.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `REQ-foundry-forge-edit-kinds` is complete: a recolor authored from either the Recolor sub-tool or the workshop Appearance section stages into one per-hero build tray row, forges into the same merged VPK as sound and texture edits, and reads as its own labelled, complete row in My changes.
- The two effect slots now state which one writes bytes immediately, and the Locker hero page mount is unchanged.
- Remaining human UAT for the phase: the manual-only rows and UI-SPEC backstops (E1/E3/E4/E5) listed in the Task 3 verification, plus in-game confirmation that the forged VPK actually recolors the hero.

---
*Phase: 03-foundry-completes-its-build-contract*
*Completed: 2026-08-09*

## Self-Check: PASSED

- All 7 changed files verified present in the working tree (MyChanges.tsx, changeList.ts, changeList.test.ts, HeroWorkshop.tsx, HeroEffectsPanel.tsx, translation.json, manifest.json).
- Task commits verified in git history: `a774b54`, `0215a6e`.
- All automated gates green: vitest (changeList 19), `pnpm test` (1862), typecheck, lint, i18n:check, encoding:check, manifest idempotence.
