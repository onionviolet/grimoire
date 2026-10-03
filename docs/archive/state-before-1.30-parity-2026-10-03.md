---
gsd_state_version: 1.0
milestone: v1.27.5
milestone_name: Chat Wheel parity
current_phase: 12
current_phase_name: Release Engineering
status: milestone-complete
stopped_at: "v1.28.2 released 2026-09-05; milestone complete; next milestone not yet chosen (see BACKLOG.md)"
last_updated: "2026-09-05T00:00:00.000Z"
last_activity: "2026-09-05: phases 10 and 11 executed by parallel agents and merged, phase 12 rescoped to v1.28.2 and prepared up to the tag"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 7
  completed_plans: 7
last_activity_desc: "Phase 10 (disclosures, ring navigation, drag-and-drop) and Phase 11 (unbind warning, dressing spike) landed as f4dfa85, 27797c7, 6538da7. Static gates green. Local vitest: 2496 passed, 2 failed, both pre-existing and outside this work (forgeBridge concurrency, ledger 6; downloadTransfer load flake). Phase 12 rescoped from v1.27.5 to v1.28.2 because package.json and the tag line already moved with the v1.28 absorption; CHANGELOG entry written and verify-release-version passes."
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Milestone v1.27.5 "Chat Wheel parity"

## Current Position

Milestone v1.28.2 "Chat Wheel parity" is shipped (2026-09-05). Release:
https://github.com/onionviolet/grimoire/releases/tag/v1.28.2. CI and Nix are
green on `main` at cbdd674. No phase is in progress. The next milestone has
not been chosen; candidates are B-01..B-07 in BACKLOG.md, and the three
waived verification-debt entries in WINDOWS.md still need a Deadlock install
or a Windows machine.

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

(none). Ledger clear: 0 open, 4 waived, 2 fixed.

## Session

**Last session:** 2026-09-05
**Stopped at:** milestone shipped and closed out. Next step is choosing the
next milestone from BACKLOG.md.
**Resume file:** .planning/BACKLOG.md
