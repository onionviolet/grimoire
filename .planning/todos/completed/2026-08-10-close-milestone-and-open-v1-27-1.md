---
created: 2026-08-10T18:39:48.970Z
title: Close milestone and open v1.27.1
area: planning
severity: major
files:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
---

## Problem

The current milestone is fully executed (6/6 phases, 32/32 plans) but the lifecycle was never run: no audit, no archive, no cleanup, no next milestone. Three things gate a clean close:

1. **Version drift.** STATE.md/HANDOFF.json say the milestone is v1.26.20, but ROADMAP.md's overview names it v1.27 ("verified, supported, coherent"). A v1.26.20 git tag and a v1.26.20 CHANGELOG release already exist, so completing under v1.26.20 collides with history. Complete it as v1.27: fix `milestone_version` in STATE.md (and HANDOFF.json) to v1.27 first so the archive and tag match the roadmap.
2. **Deferred human verification (user decision).** Phases 3/4/5 are `human_needed` (13/14, 7/10, 3/6 must-haves verified). The user's position: Grimoire is an out-of-game tool; work done correctly at the VPK level translates deterministically in-game, so in-game verification can be deferred. The audit will aggregate these as gaps/tech debt; accept them at the audit gate rather than blocking.
3. **Unfixed Phase 5 review findings.** `.planning/phases/05-one-inventory-one-journey/05-REVIEW.md` (status issues_found) proves CR-01: bulk undo is non-functional (snapshot diffed against the same pre-batch array; the Undo toast never appears on a full success and restores nothing on a partial batch). WR-01/WR-02 are real aria/blocker-line defects; four info items are polish. CR-01 is a proven bug, not an unverified behavior, so it must either be fixed before the audit or explicitly carried as the first task of v1.27.1.

After closing, the next milestone is v1.27.1: absorb upstream v1.27 verbatim (see the sibling absorb todo), add fork work, and ship the fork's own GitHub release.

## Solution

Exact sequence:

1. **Fix or carry the Phase 5 findings first.** Recommended: fix CR-01 + WR-01 + WR-02 (small, known fixes in `src/pages/Installed.tsx` and `src/pages/Conflicts.tsx`) and commit, so the milestone is not archived with a known-critical flagship bug. If deferring, record all findings as the first v1.27.1 phase with ownership.
2. **Correct the version drift**: set STATE.md (and HANDOFF.json) `milestone_version` to v1.27 before any lifecycle command.
3. **`$gsd-audit-milestone`** — reads the phase VERIFICATION.md files, aggregates deferred human verification + tech debt, runs the cross-phase integration check, writes `.planning/v1.27-MILESTONE-AUDIT.md`. Accept the deferred-verification gaps per the user's decision (continue anyway / continue with tech debt).
4. **`$gsd-complete-milestone v1.27`** — archives ROADMAP + REQUIREMENTS to `.planning/milestones/v1.27-*`, updates PROJECT.md, commits, creates the archive tag. Caution: do NOT push the v1.27 archive tag to origin; release.yml triggers on any `v*` tag push and would build/pre-release the pre-absorb tree. The real release tag is v1.27.1, created at the end of the next milestone.
5. **`$gsd-cleanup`** — dry-run, then archive the six phase directories into `.planning/milestones/v1.27-phases/` (user approval required; it moves files).
6. **`$gsd-new-milestone v1.27.1`** — SEED-001 (generic local-install protocol) auto-surfaces here. Scope the milestone: absorb upstream v1.27 verbatim (todo), carried Phase 5 fixes if deferred, any fork additions, UI review of the shipped frontend phases (zero UI-REVIEW files exist), and release engineering (version bump to 1.27.1, CHANGELOG, tag v1.27.1, GitHub Release via release.yml).
7. Plan + execute the v1.27.1 milestone (autonomous is appropriate here: discuss → plan → execute per phase), then tag and release.

Repository-boundary rules apply throughout: push only to origin (onionviolet/grimoire); upstream stays read-only; commit messages must not carry bare upstream PR numbers.
