---
gsd_state_version: 1.0
milestone: v1.27.5
milestone_name: Chat Wheel parity
current_phase: 12
current_phase_name: Release Engineering
status: in-progress
stopped_at: "Phases 10 and 11 complete and merged; 1.28.2 changelog written; tag push and GitHub Release await an explicit go"
last_updated: "2026-09-05T00:00:00.000Z"
last_activity: "2026-09-05: phases 10 and 11 executed by parallel agents and merged, phase 12 rescoped to v1.28.2 and prepared up to the tag"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 8
  completed_plans: 7
last_activity_desc: "Phase 10 (disclosures, ring navigation, drag-and-drop) and Phase 11 (unbind warning, dressing spike) landed as f4dfa85, 27797c7, 6538da7. Static gates green. Local vitest: 2496 passed, 2 failed, both pre-existing and outside this work (forgeBridge concurrency, ledger 6; downloadTransfer load flake). Phase 12 rescoped from v1.27.5 to v1.28.2 because package.json and the tag line already moved with the v1.28 absorption; CHANGELOG entry written and verify-release-version passes."
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A Deadlock player can change their game and always know exactly what changed, who owns it, and how to undo it.
**Current focus:** Milestone v1.27.5 "Chat Wheel parity"

## Current Position

Phase: 12 (Release Engineering) - in progress, rescoped to v1.28.2
Next: an explicit go for `git tag v1.28.2 && git push origin main v1.28.2`,
then the release workflow and the GitHub Release with the changelog notes
Plans: 10-01, 11-01, 11-02 complete (see the phase directories)
Status (12): CHANGELOG entry and package version ready; tag and Release not
done because they are outward-facing and irreversible under the release policy.
Status (10, 11): Complete and merged 2026-09-05; exit notes in ROADMAP.md.
Last activity: 2026-09-05: phases 10 and 11, phase 12 preparation

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

- **Phase 12 tag and Release need a go**, and push rights are unverified: the
  `gh` login on this machine is a different account from the fork's author.
- **Ledger entry 6 (open):** `forgeBridge` "serves more concurrent
  connections" fails on this machine only. Environmental and unexplained; CI
  on Node 20 is the authoritative run. No Node 20 is installed here.

## Session

**Last session:** 2026-09-05
**Stopped at:** Phase 12 prepared up to the tag. Next step is the tag push and
GitHub Release for v1.28.2 once given the go, then closing the milestone.
**Resume file:** .planning/ROADMAP.md
