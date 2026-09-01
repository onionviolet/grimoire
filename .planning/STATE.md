---
gsd_state_version: 1.0
milestone: v1.27.5
milestone_name: Chat Wheel parity
current_phase: 9.1
current_phase_name: Green Suite And Honest Baseline
status: phase-complete
stopped_at: "Phase 9.1 complete: suite green, ledger clear. Next phase is 10 (Wheel Interaction And Disclosure)"
last_updated: "2026-09-01T00:00:00.000Z"
last_activity: "2026-09-01: phase 9 merged and pushed, registers reconciled, phase 9.1 inserted and executed"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
last_activity_desc: "Phase 9.1 executed directly. vitest run now exits 0 (2436 passing, 0 failing) on Node 26, which used to fail 26 tests. 25 were Node 26 shadowing jsdom localStorage, repaired in vitest.setup.ts from the unshadowed sessionStorage instance with Storage republished from it so Storage.prototype spies do not silently stop applying; 1 was a genuinely wrong test fixture that placed a symlink target inside the swept root. .nvmrc and engines.node declare Node 20, src/lib/domStorage.test.ts guards the invariant, and a standing exit rule now forbids exiting a phase against a remembered failure count."
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Milestone v1.27.5 "Chat Wheel parity"

## Current Position

Phase: 9.1 (Green Suite And Honest Baseline) - complete
Next: 10 (Wheel Interaction And Disclosure) - not yet planned
Plan: 09-01, 09-02, 09-03 complete; 9.1 executed directly without a plan file
Status (9.1): Complete. Suite green, `vitest run` exits 0, ledger clear
(0 open, 3 waived, 2 fixed).

Status (9): Complete and committed (ec11e16 feature, a62949c planning). All four roadmap success criteria hold; criterion 4 was settled by a full vitest run showing 26 failing tests across 3 files, all inside the v1.28-absorption baseline, so no new failures. One carried item: the 09-02 real-binary round-trip case skips on macOS and still needs a Windows run (ledger entry 3 in WINDOWS.md).
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

(none). Ledger entries 4 and 5 are fixed; 1-3 are waived as deferred
verification debt. One thing is unverified rather than blocked: Node 20 is not
installed on this machine, so the setup file's no-op path there is guaranteed by
its guard rather than by execution. CI confirms it on push.

## Session

**Last session:** 2026-09-01
**Stopped at:** Phase 9.1 done and the suite green. Next step is planning Phase 10 (Wheel Interaction And Disclosure).
**Resume file:** .planning/ROADMAP.md
