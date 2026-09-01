---
gsd_state_version: 1.0
milestone: v1.27.5
milestone_name: Chat Wheel parity
current_phase: 9
current_phase_name: The Base Command Catalogue
status: phase-complete
stopped_at: "Phase 9 merged to main; registers reconciled and rescoped; next phase is 9.1 (Green Suite And Honest Baseline)"
last_updated: "2026-09-01T00:00:00.000Z"
last_activity: "2026-09-01: phase 9 merged to main, planning registers reconciled against the code, milestone rescoped with an inserted phase 9.1"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
last_activity_desc: "Phase 9 merged into the fork main (0f27e6d, manifest conflict resolved by regeneration; gates green, 26 failures unchanged). A truth pass against the code found eleven docs-tracked gaps had shipped during v1.27/v1.27.1 and that the quoted 26-failure baseline is really 25 Node-26 localStorage artifacts plus 1 real red test. Retired docs/remaining-work-phases.md and docs/work-order.md to archive, created .planning/BACKLOG.md as the single home for unscheduled work, waived the three unrun-verify ledger entries per the deferral decision, opened ledger entries 4 and 5, and inserted Phase 9.1."
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Milestone v1.27.5 "Chat Wheel parity"

## Current Position

Phase: 9 (The Base Command Catalogue) - complete and merged to `main`
Next: 9.1 (Green Suite And Honest Baseline), inserted 2026-09-01
Plan: all three plans (09-01, 09-02, 09-03) complete
Status: Complete and committed (ec11e16 feature, a62949c planning). All four roadmap success criteria hold; criterion 4 was settled by a full vitest run showing 26 failing tests across 3 files, all inside the v1.28-absorption baseline, so no new failures. One carried item: the 09-02 real-binary round-trip case skips on macOS and still needs a Windows run (ledger entry 3 in WINDOWS.md).
Last activity: 2026-09-01: merge, reconciliation, rescope

## Register map

One home per kind of open item. A duplicate elsewhere is stale, not a second copy.

| Register | Holds |
|---|---|
| `.planning/ROADMAP.md` | phases of the current milestone |
| `.planning/REQUIREMENTS.md` | what this milestone must make true |
| `.planning/WINDOWS.md` | defects and unrun verification |
| `.planning/BACKLOG.md` | future work, not scheduled |
| `docs/feature-status.md` | user-facing inventory, no forward plan |

## Blockers

(none blocking). Two open ledger entries (4: the symlink-sweep test is really
red; 5: the Node 26 / jsdom `localStorage` collision) are owned by Phase 9.1 and
must clear before Phase 12 ships.

## Session

**Last session:** 2026-09-01
**Stopped at:** Phase 9 merged to `main`; registers reconciled and the milestone rescoped. Next step is planning Phase 9.1 (Green Suite And Honest Baseline), then Phase 10.
**Resume file:** .planning/ROADMAP.md
