---
gsd_state_version: 1.0
milestone: v1.26.20
milestone_name: milestone
current_phase: 5
current_phase_name: one-inventory-one-journey
current_plan: 6
status: executing
stopped_at: Completed 05-05-PLAN.md
last_updated: "2026-08-09T08:40:37.357Z"
last_activity: 2026-08-09
last_activity_desc: Phase 4 execution started
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 32
  completed_plans: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Phase 5 — one-inventory-one-journey

## Current Position

Phase: 5 (one-inventory-one-journey) — EXECUTING
Current Plan: 6
Total Plans in Phase: 6
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-08-09 — Phase 5 execution started

Progress: [██████████] 97%

## Performance Metrics

**Velocity:**

- Total plans completed: 21
- Average duration: n/a
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 8 | - | - |
| 02 | 6 | - | - |
| 06 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: n/a
- Trend: n/a

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P04 | 40min | 3 tasks | 36 files |
| Phase 02 P05 | 20min | 2 tasks | 1 files |
| Phase 03 P01 | 10 | 2 tasks | 22 files |
| Phase 03 P02 | 7 | 3 tasks | 6 files |
| Phase 03 P03 | 5 | 3 tasks | 7 files |
| Phase 04 P01 | 12 | 3 tasks | 10 files |
| Phase 04 P02 | 12 | 3 tasks | 18 files |
| Phase 05 P01 | 8 | 2 tasks | 9 files |
| Phase 05 P02 | 10 min | 3 tasks | 6 files |
| Phase 05-one-inventory-one-journey P03 | 12min | 3 tasks | 3 files |
| Phase 05 P04 | 8min | 3 tasks | 5 files |
| Phase 05-one-inventory-one-journey P05 | 20 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Full log in PROJECT.md (Locked Decisions, Standing Policy, Key Decisions).
Recent decisions affecting current work:

- 2026-07-28: The packaged Windows smoke record does not block a release; it is post-release verification, fix forward
- 2026-07-29: This fork relies on the upstream social deployment, so the wave 3 cron and view counter do not run; revisit in Phase 2
- 2026-07-28: Serial waves, not eight parallel lanes, because nearly every lane appends to the same four shared files
- [Phase ?]: 2026-08-07: assetClaims collision resolved as combine — shared pure core for both processes, renderer IPC cache layered on top in its own file (inspectedAssetClaims.ts)
- [Phase ?]: 2026-08-07: structural-refactor-7 merged into main via real merge commit c0571a2; branch deletion and merge-plan doc retirement deferred to plan 02-05 per REQ-upstream-merge-aug-2026's Phase B/C split
- [Phase ?]: 2026-08-07: push-then-delete-all authorized for branch consolidation: main pushed to origin, twelve fully merged branches deleted with git branch -d, five remote branches deleted, merge-plan doc retired
- [Phase ?]: 2026-08-07: codex/foundry-build-diff's git branch -d refusal (stale own-remote tracking ref) resolved by deleting the remote branch first and retrying -d, never forcing with -D
- [Phase ?]: Recolor staged-edit id is recolor:<canonical hero name> so re-staging replaces in place through Foundry.tsx's id filter (03-01)
- [Phase ?]: Recolor forge cleanup is a no-op: the bake path is the shared per-hero ability-colors cache the Locker Apply and Export also read (03-01)
- [Phase ?]: Staging-time entry discovery and the forge share one cached bake, so the tray write set cannot drift from the merged VPK (03-01)
- [Phase ?]: Extract the shuffle toggle into one component (isIncluded/onToggle/name/armed/className); each Locker call site keeps its positioning and hover-reveal group variant via className
- [Phase ?]: Foundry pool membership reads/writes appStore existing soundShuffleIncluded Set through toggleSoundShuffleIncluded; no second key or store (D-10, D-11)
- [Phase ?]: The Foundry shuffle block renders only for hero-scoped views (scopedHero resolves through heroNames); zero-mod heroes render nothing (D-11 absence)
- [Phase ?]: REQ-foundry-pool-audition-fidelity recorded as delivered before this phase, citing commit 9b01c63 and the source files read to confirm (D-06..D-08)
- [Phase ?]: Row-toggle unpressed background normalized from bg-black/55 to bg-black/65 so the shared component owns the colour states
- [Phase ?]: My changes kinds map exhaustively: sound keeps Volume2, texture keeps ImageIcon, recolor gets the lucide Palette icon plus an accent-toned Recolor tag, and an unrecognised kind falls back to a neutral FileQuestion icon and the neutral Change label instead of borrowing the texture row (T-03-09)
- [Phase ?]: changeFilterOf branches sound/texture/recolor explicitly with a never-typed default, so a fourth kind fails typecheck rather than shelfing under a texture category it was never assigned
- [Phase ?]: The workshop Appearance mount passes the existing stage callback as onStageRecolor; because prepareRecolorStagedEdit ids by hero and Foundry dedupes staged edits by id, both entry points produce exactly one tray row per hero
- [Phase ?]: Both effect-surface captions live in HeroEffectsPanel gated on onStageRecolor (abilitiesStageNote / appliesImmediately); TrippySkinPanel behaviour and the Locker hero page mount are untouched and uncaptioned
- [Phase ?]: Stage-mode persistence uses a new per-surface key grimoire.{surface}.heroStage.mode; the panel-open boolean keeps its original meaning and becomes the pop-out state
- [Phase ?]: Locker defaults optimistically to Model per D-02; a definitive pose failure flips only the displayed mode for that mount and is never persisted
- [Phase ?]: Foundry gets no auto-fallback banner: an opted-in preview keeps the model and shows HeroPoseViewer's own failure state
- [Phase ?]: Four obsolete 3D-toggle i18n keys removed once i18n:check proved no references remained
- [Phase ?]: lockerManaged is a separate boolean, never a provenance reclassification: a user-forged mod is also Forged and SHOULD contest, so the two concepts cannot share a classifier
- [Phase ?]: The recolor disclosure is keyed to the exact serialized export request it described; a confirmation granted for one write set cannot be replayed after any parameter change (T-04-10)
- [Phase ?]: An unreadable VPK blocks only that one ambiguous recolor apply and mutates nothing (D-08)
- [Phase ?]: The uncontested recolor disclosure is deliberately not a warning: routine applies keep one-press speed with the disclosure inline, never behind a modal (D-07)
- [Phase 05]: The third LockerMode member is named 'all'; bare /locker/global defaults to All content and the canonical URL for the default carries no query (D-05)
- [Phase 05]: Hide-empty is a fixed always-on rule with no preference control (D-04, planner assumption settled)
- [Phase 05]: Active source consolidation is a value edit at existing key names, excluding the build-time collision family and the three excluded keys
- [Phase 05]: Task 2 updated two renderer tests asserting the old winner wording; the full-suite-green acceptance criterion took precedence over the catalog-only diff guardrail (Rule 1)
- [Phase ?]: The two randomization views keep one pool identity and gain scope labels only; ChangePools.tsx is untouched and captions live at the call sites that choose the scope
- [Phase ?]: PortraitBrowse adopts buildHeroFilterOptions without scopedHero: the surface hides its filter when hero-pinned, so every option value stays a plain codename
- [Phase ?]: The unresolved disclosure derives from the visible set and only renders after a completed read, so a failed catalog routes to the failed state, never to the unresolved label
- [Phase ?]: A partial portrait-family read is treated as failed (the conservative, honest reading) rather than as a partial success
- [Phase ?]: Leg A proves the two live alias tables agree wherever both have an opinion; completeness against the shipped build remains Legs B and C
- [Phase ?]: Undo replays a live diff, not the whole snapshot: an operation is emitted only where the current value still differs, so a field the user changed by hand between batch and undo is preserved
- [Phase ?]: A partial failure produces one toast (counts + Undo action, warning tone, dismissable) rather than stacking a second toast for the failure
- [Phase ?]: The blocker line lives in the action bar's existing in-flight span with a stable id; the undo case wins when both a batch and a restore could apply, so exactly one reason shows at a time
- [Phase ?]: Bulk delete keeps its confirmation and gains no undo: a deleted VPK is not recoverable from a snapshot of store state
- [Phase ?]: Restore counts distinct mods actually restored, not operations applied, matching bulkChangedCount's user-facing semantics
- [Phase 05]: Unnamed-pak detection matches the exact extractModName output shape (the word pak followed by digits), so a real mod named Pak Rat stays untouched
- [Phase 05]: The derived entry list caps at three leaf names plus a remainder count, with the cap a parameter the render site never hardcodes
- [Phase 05]: Unreadable and empty VPKs produce the same unknown label per D-19, because the user can act on neither differently
- [Phase 05]: REQ-sound-locker-surface recorded as resolved by D-01/D-02 with the evidence cited: GlobalSoundShelf carries the preserved capabilities, legacySoundTarget/resolveLockerRoute keep the shipped URLs alive, lockerMode.test.ts proves it
- [Phase ?]: 2026-08-09 (05-05): Committed the pre-existing auto-advance config change as housekeeping so the alias sweep ran on a clean tree; git stash is prohibited in this environment
- [Phase ?]: 2026-08-09 (05-05): The portrait alias sweep verdict record uses 'family present' as the documented healthy case the four-way table has no defect row for
- [Phase ?]: 2026-08-09 (05-05): Rendered family counts and Locker hero-id rewrites are stability-checked because a raw first DOM match can catch the previous route's stale line

### Pending Todos

None yet.

### Blockers/Concerns

- **Verification debt is the top risk.** Four waves landed with a green repository gate and zero in-game validation. Nobody has started Deadlock and confirmed the engine loads what the app says it will. Phase 1 exists for this.
- **No render coverage anywhere.** Vitest runs in a node environment with no DOM, so six shipped Foundry lanes have tested models and untested rendering.
- **Three product decisions are open** and must route to `/gsd-discuss-phase`: global sound inventory home (Phase 5), portrait journey (Phase 5), Locker hero page target state (Phase 4). Both sides of each are preserved in REQUIREMENTS.md; do not let an implementer pick.
- **Doc status headers drift in both directions.** Verify against the tree before planning; prefer REQUIREMENTS.md "Delivered" over any doc's own status line.
- **The ingest ran with an overridden blocker gate.** Three cross-reference cycles held nine docs out of `.planning/intel/`, including the delivery contract and the audit verdicts. They were read directly for this roadmap. Break the cycles before re-running ingest.
- **`.planning/config.json` does not exist.** Granularity defaulted to standard and phase IDs to sequential. Run `/gsd-config` if either should differ.
- **Sibling repo drift.** Three commits in `../grimoire-social` are unpushed and CI cannot see them; `pnpm typecheck` resolves the sibling from disk and stays green while CI fails.

### Roadmap Evolution

- Phase 4 edited: split success criterion 3; retained Foundry image sourcing
- Phase 5 edited: added Locker portrait-variant awareness criterion

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| 3D preview | REQ-3d-preview-retarget-and-effects | v2 | 2026-08-05 |
| Authoring | REQ-chat-wheel-base-command-catalog | v2 | 2026-08-05 |
| Tooling | REQ-agent-ui-lab | v2, pending its own framing question | 2026-08-05 |
| Merge | REQ-vpk-composition-review-and-recipes milestones 3 to 5 | v2, least important on the board | 2026-08-05 |
| Performance | REQ-performance-convar-profiles-and-recovery | v2, open review questions | 2026-08-05 |

## Deferred Verification

Real-game verification is deferred to the end of this milestone run per explicit user decision. Resume commands are recorded per phase.

| Phase | State | Resume |
|-------|-------|--------|
| 3 | verification_deferred_human | $gsd-verify-work 3 |
| 4 | verification_deferred_human | $gsd-verify-work 4 |

## Session Continuity

Last session: 2026-08-09T08:40:37.340Z
Stopped at: Completed 05-05-PLAN.md
Resume file: None
