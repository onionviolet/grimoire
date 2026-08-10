---
phase: 01-verified-against-the-game
plan: 05
subsystem: performance
tags: [electron, gameinfo.gi, convars, i18n, react]

# Dependency graph
requires: []
provides:
  - "engineDefault field on HUD_CONVARS and ADVANCED_GAMEINFO_CONVARS, null until a console reading is typed in"
  - "engineDefault threaded through ConfigKeyDefinition (main and renderer), PerformanceConvarState, and computeConvarStates' origin ladder"
  - "value-state badge hint naming the engine's own default when a reading exists"
affects: [performance-convars, docs/ingame-verification-record.md]

# Actuals (#2632)
actuals:
  tokens: 4507
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new provenance field lands at every hand-synced declaration point in one pass (catalogue, both ConfigKeyDefinition copies, PerformanceConvarState) rather than the consuming function inventing its own shape"
    - "Origin/default comparisons run through the existing normalizeConvarValue helper instead of a parallel comparison, so quoting and 1-vs-true spelling stay handled in one place"

key-files:
  created: []
  modified:
    - electron/main/services/performanceUserControls.ts
    - electron/main/services/configKeyIndex.ts
    - src/types/electron.ts
    - electron/main/services/performanceConfig.ts
    - electron/main/services/performanceConfig.test.ts
    - src/components/settings/sections/GameConvarsSection.tsx
    - src/locales/en/translation.json
    - src/locales/manifest.json

key-decisions:
  - "engineDefault only participates in the origin ladder when gameDefault is null, per D-13/D-16: gameDefault (what stock gameinfo.gi writes) always wins as the known-stock source when both are known"
  - "Test cases for engineDefault stage a reading by mutating the live CONFIG_KEY_BY_NAME definition object at test time (all 16 catalogue entries ship null since no real console reading exists yet), rather than waiting on real console data or weakening assertions"

patterns-established:
  - "Staging a not-yet-populated catalogue field for tests by mutating the exported live Map entry, with an afterEach reset, when the field cannot yet be seeded from real data"

requirements-completed:
  - REQ-performance-convar-safer-experimentation

coverage:
  - id: D1
    description: "engineDefault field added to every HUD and advanced ConVar catalogue entry (7 + 9), plus both hand-synced ConfigKeyDefinition declarations and PerformanceConvarState, all null until a reading exists"
    requirement: "REQ-performance-convar-safer-experimentation"
    verification:
      - kind: unit
        ref: "pnpm exec tsc -b"
        status: pass
      - kind: unit
        ref: "electron/main/services/performanceConfig.test.ts (139 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeConvarStates' origin ladder consults engineDefault (when gameDefault is unknown) through the existing normalizeConvarValue comparison; resolvedValue falls back to it; outOfRange and matchesPreset untouched"
    requirement: "REQ-performance-convar-safer-experimentation"
    verification:
      - kind: unit
        ref: "electron/main/services/performanceConfig.test.ts > 'engine default' describe block (7 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ValueStateBadge names the engine's value in its hint when state.engineDefault is known, keeps the existing honest wording otherwise; badge label text and per-control reset behavior unchanged; new i18n key added to en catalog only, manifest regenerated"
    requirement: "REQ-performance-convar-safer-experimentation"
    verification:
      - kind: unit
        ref: "pnpm i18n:check, node scripts/gen-locale-manifest.mjs --check, pnpm lint, pnpm encoding:check, pnpm exec vitest run (1554 tests)"
        status: pass
      - kind: manual_procedural
        ref: "Hover the value-state badge in Settings > Game Configuration on a control with a recorded reading vs. one without"
        status: unknown
    human_judgment: true
    rationale: "Hover copy and the absence of a layout gap are visual; the plan's own <verify> flags this as a human-check no agent can perform, and no engineDefault reading exists yet to populate a visibly-different badge (all 16 catalogue entries still ship null pending docs/ingame-verification-record.md, which is out of this worktree's scope)"

duration: ~25min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 05: Engine Default ConVar Provenance Summary

**Added `engineDefault` beside `gameDefault` across the ConVar catalogue and origin computation, and the value-state badge now names the engine's own value when a reading exists.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-06T16:35:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `engineDefault` declared identically at all four hand-synced points: `HUD_CONVARS` (7 entries), `ADVANCED_GAMEINFO_CONVARS` (9 entries), `configKeyIndex.ts`'s `ConfigKeyDefinition` (both `userDefinitions` map blocks plus the preset-only fallback block), and both copies in `src/types/electron.ts` (`PerformanceConvarState`, `ConfigKeyDefinition`)
- `citadel_damage_offscreen_indicator_disabled` carries an explicit inline comment naming its inverted on/off mapping; `citadel_hud_objective_health_enabled` carries a comment marking its "unsupported" claim as pending the console reading
- `computeConvarStates`' single origin ladder now also treats a file value matching `engineDefault` as the game-default origin (only when `gameDefault` is unknown, comparisons run through the existing `normalizeConvarValue`), and `resolvedValue` falls back to `engineDefault` for an unset key while `resolvedFrom` still reports `game-default`
- `ValueStateBadge`'s hint names the engine's value when `state.engineDefault` is known; badge label text, per-control reset, and outOfRange precedence are all unchanged
- One new i18n key (`settings.gameConvars.valueStateHint.engineDefault`) added to the en catalog only; manifest regenerated

## Task Commits

Each task was committed atomically:

1. **Task 1: Add engineDefault to the catalogue and both type declarations** - `feb07f6` (feat)
2. **Task 2: computeConvarStates carries and consults the engine default** - `8678301` (feat)
3. **Task 3: The value-state badge reports what the game will do** - `7b9963f` (feat)

_Note: SUMMARY.md and this plan's metadata commit are handled per worktree rules — STATE.md/ROADMAP.md are not touched by this worktree agent._

## Files Created/Modified
- `electron/main/services/performanceUserControls.ts` - `engineDefault: null` added to all 16 catalogue entries; block comments and per-key comments updated
- `electron/main/services/configKeyIndex.ts` - `ConfigKeyDefinition.engineDefault`, threaded through both `userDefinitions` map blocks and the preset-only fallback block
- `src/types/electron.ts` - `engineDefault` added to `PerformanceConvarState` and the renderer's own `ConfigKeyDefinition`
- `electron/main/services/performanceConfig.ts` - `computeConvarStates` reads and emits `engineDefault`, extends the origin ladder and `resolvedValue` fallback
- `electron/main/services/performanceConfig.test.ts` - new `describe('engine default', ...)` block with 7 cases covering matching origin, differing user-override, unset-key resolution, quoting/1-vs-true parity, out-of-range verbatim carry, and idempotency
- `src/components/settings/sections/GameConvarsSection.tsx` - `ValueStateBadge` hint branches on `state.engineDefault`
- `src/locales/en/translation.json` - one new key under `settings.gameConvars.valueStateHint`
- `src/locales/manifest.json` - regenerated (key count changed)

## Decisions Made
- `engineDefault` only participates in the game-default arm of the origin ladder when `gameDefault` is null (D-13/D-16): `gameDefault` is what stock `gameinfo.gi` itself writes and takes precedence as the "known stock" source whenever both fields are populated for the same key.
- The six required test cases (plus one for idempotency, matching the plan's must-have list) stage an engine-default reading by mutating the live `CONFIG_KEY_BY_NAME` map entry directly at test time, with an `afterEach` reset, since all 16 real catalogue entries ship `null` (no console reading exists yet). This avoids weakening any assertion to accommodate the all-null starting state, per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written. `git diff --exit-code electron/main/services/performanceConfigData.ts` confirms the generated file was never touched.

## Issues Encountered

The plan's own `<verify>` automated check `grep -c 'engineDefault'` on the test file initially undercounted because most occurrences were inside the helper name `setEngineDefault` (capital E, not a literal-case match for the lowercase-`e` pattern). Added direct `state.engineDefault` assertions to three more test cases (which also strengthened the coverage) to clear the >=6 threshold without changing test semantics.

## User Setup Required

None - no external service configuration required. Note: the actual console readings for all 16 ConVar keys still need to be taken from a running Deadlock build and typed into `docs/ingame-verification-record.md`, per D-09/D-10 - that file is explicitly out of this worktree's scope (owned by a sibling plan/agent) and the phase does not close until every row there carries a reading or a stated reason.

## Next Phase Readiness
- `engineDefault` is fully wired end to end with one computation path; nothing here blocks other Phase 1 plans.
- Once the human types console readings into `docs/ingame-verification-record.md`, the badge and `resolvedValue` will pick them up automatically with no further code change, since every consumer already reads from the same catalogue.

---
*Phase: 01-verified-against-the-game*
*Completed: 2026-08-06*
