---
phase: 02-a-supported-fork-release
plan: 05
subsystem: infra
tags: [git, branch-consolidation, worktree, fork-maintenance]

# Dependency graph
requires:
  - phase: 02-a-supported-fork-release (plan 02-04)
    provides: structural-refactor-7 merged into main via real merge commit c0571a2
provides:
  - main pushed to origin (fast-forward, 93 commits)
  - twelve fully merged branches deleted with git branch -d
  - three stale worktrees removed
  - five remote branches deleted on origin
  - docs/merge-plan-upstream-2026-08.md retired per its own stated condition
affects: [release-maintenance, fork-maintenance]

# Actuals (#2632)
actuals:
  tokens: 4624
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/merge-plan-upstream-2026-08.md (deleted)

key-decisions:
  - "push-then-delete-all selected: main pushed to origin first, then all 12 local branches and all 5 remote branches deleted"
  - "codex/foundry-build-diff's git branch -d refusal (merged to HEAD, not to its own stale origin remote) was resolved by deleting the remote branch first and retrying -d, not by forcing with -D"

patterns-established: []

requirements-completed: [REQ-upstream-merge-aug-2026]

coverage:
  - id: D1
    description: "main pushed to origin, twelve fully merged branches deleted locally with git branch -d, five remote branches deleted on origin, three worktrees removed first"
    requirement: "REQ-upstream-merge-aug-2026"
    verification:
      - kind: other
        ref: "git branch --no-merged main (empty, run twice); git branch --list (only main); git worktree list (one entry); git branch -r (only origin/HEAD, origin/main plus upstream/*)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/merge-plan-upstream-2026-08.md retired (deleted) per its own stated retirement condition"
    requirement: "REQ-upstream-merge-aug-2026"
    verification:
      - kind: other
        ref: "test ! -f docs/merge-plan-upstream-2026-08.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repository gate still green after consolidation: pnpm refs:check and pnpm test both exit 0"
    verification:
      - kind: unit
        ref: "pnpm test (154 files, 1716 tests, all pass)"
        status: pass
      - kind: other
        ref: "pnpm refs:check"
        status: pass
    human_judgment: false

duration: ~20min (across a checkpoint pause for user authorization)
completed: 2026-08-07
status: complete
---

# Phase 02 Plan 05: Branch Consolidation and Merge-Plan Retirement Summary

**Pushed `main` (93 commits) to `origin`, deleted all twelve fully-merged branches and their five remote counterparts with `git branch -d` (never `-D`), removed the three stale worktrees that held them, and retired `docs/merge-plan-upstream-2026-08.md` on its own stated terms.**

## Performance

- **Duration:** ~20 min of active execution, spanning one checkpoint pause for explicit user authorization
- **Completed:** 2026-08-07T16:20:02Z
- **Tasks:** 2 (checkpoint:decision + auto)
- **Files modified:** 1 (deleted)

## Accomplishments

- Measured live state (not planning-time numbers) for the checkpoint: `git branch --no-merged main` empty, `main` 93 commits ahead of `origin/main`, per-branch ahead-counts all 0 against `main`, remote and worktree membership for all 12 branches.
- User authorized `push-then-delete-all`: push `main` first, then delete all 12 local branches and all 5 remote branches.
- Pushed `main` to `origin` (normal push, pre-push hooks green: `i18n:check`, `encoding:check`, `refs:check`, `engine-pin:check`).
- Removed three worktrees before deleting their branches: `.claude/worktrees/agent-a4ad3a26969f16ebb` (`structural-refactor-7`), `C:/Users/wayba/dev/grimoire-merge` (`merge/upstream-2026-08`), `C:/Users/wayba/dev/grimoire-alias-sweep` (`portrait-alias-sweep`).
- Deleted all 12 local branches with `git branch -d`, one invocation each.
- Deleted all 5 remote branches with `git push origin --delete`, one invocation each: `codex/foundry-build-diff`, `codex/foundry-source-panels`, `dev-slot-seeding`, `foundry-forge-and-spec-audit`, `portrait-alias-sweep`.
- Retired `docs/merge-plan-upstream-2026-08.md` with `git rm`, per its own line-3 retirement condition ("Delete it once Phase C is done and pushed").
- Committed the consolidation with a message naming what was deleted and the verification result, with no bare issue reference and no upstream link (`pnpm refs:check` clean).
- Re-ran verification a second time: stable — `git branch --no-merged main` still empty, `git branch --list` still shows only `main`, `git worktree list` still shows one entry.
- Ran the full repository gate: `pnpm refs:check` and `pnpm test` (154 files, 1716 tests) both green.

## Task Commits

1. **Task 1: Authorize the deletions** - checkpoint:decision, no commit (user authorized `push-then-delete-all` via the coordinator)
2. **Task 2: Remove the worktrees, delete the authorized refs, and retire the plan document** - `5a45338` (chore)

**Plan metadata:** (this document + STATE.md/ROADMAP.md/REQUIREMENTS.md update, committed separately below)

## Files Created/Modified

- `docs/merge-plan-upstream-2026-08.md` - deleted (retired per its own stated condition)

## Decisions Made

- **`push-then-delete-all`** was the user's authorized choice at the Task 1 checkpoint: push `main` to `origin` first (so no remote deletion could discard the only server-side copy of anything), then delete all 12 local branches and all 5 remote branches. No branches were kept as named exceptions.
- **`codex/foundry-build-diff` local delete order:** `git branch -d codex/foundry-build-diff` initially refused, not because the branch was unmerged into `main` (it was 0 ahead, confirmed), but because git's default safety check also compares against the branch's own tracked remote (`origin/codex/foundry-build-diff`), which was 4 commits behind the local branch (a known, plan-flagged fact: "the remote is a stale subset, nothing is at risk locally"). Rather than forcing with `-D`, the already-authorized remote branch deletion was performed first, `git fetch --all --prune` cleared the stale tracking ref, and the retry of `git branch -d` succeeded cleanly with no force flag used anywhere.
- **Leftover worktree directory:** `git worktree remove .claude/worktrees/agent-a4ad3a26969f16ebb` logically succeeded (unregistered from git's `.git/worktrees` metadata, confirmed via `git worktree prune -v` finding nothing to prune) but the OS-level directory deletion partially failed with "Filename too long" (a Windows long-path limitation hitting a deeply nested `node_modules`). Since the working tree was already confirmed clean (`git status --porcelain` empty) before removal and git no longer considered the path a checked-out worktree, the leftover directory was cleaned up with `rm -rf` (via the Bash tool's POSIX layer, which handles the long paths git's native Windows binary could not) rather than left behind or treated as a blocker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `codex/foundry-build-diff` local branch delete refused on first attempt**
- **Found during:** Task 2 (branch deletion loop)
- **Issue:** `git branch -d codex/foundry-build-diff` refused with "not yet merged to 'refs/remotes/origin/codex/foundry-build-diff', even though it is merged to HEAD" — a git safety check against the branch's stale remote tracking ref, not an actual unmerged-into-main condition. The plan's own objective text had already flagged this exact scenario ("codex/foundry-build-diff is 4 commits ahead of its own remote... nothing at risk locally").
- **Fix:** Completed the already-authorized remote branch deletion (`git push origin --delete codex/foundry-build-diff`, part of the same `push-then-delete-all` authorization), ran `git fetch --all --prune` to clear the now-stale local tracking ref, then retried `git branch -d codex/foundry-build-diff`, which succeeded with no force flag.
- **Files modified:** None (git ref operations only)
- **Verification:** `git branch --list` shows only `main` afterward; `git branch --no-merged main` stayed empty throughout.
- **Committed in:** `5a45338` (part of Task 2's overall consolidation commit; the branch/remote deletions themselves are ref operations, not file changes, so they carry no separate commit)

**2. [Rule 1 - Bug] `git worktree remove` left a stray directory on disk despite succeeding logically**
- **Found during:** Task 2 (worktree removal)
- **Issue:** `git worktree remove .claude/worktrees/agent-a4ad3a26969f16ebb` reported "error: failed to delete ... Filename too long" (Windows `MAX_PATH` limitation on a nested `node_modules` tree), even though git's own worktree registration was fully removed.
- **Fix:** Verified via `git worktree list` and `git worktree prune -v` that git considered the worktree gone, then cleaned the leftover filesystem directory with `rm -rf` (which handles long paths that the native git-for-windows binary could not).
- **Files modified:** None tracked (removed only untracked worktree scaffolding: `node_modules`, `README.md` copy, etc.)
- **Verification:** `ls .claude/worktrees/` no longer lists `agent-a4ad3a26969f16ebb`; `git worktree list` shows only the primary worktree.
- **Committed in:** N/A (filesystem cleanup only, not a git-tracked change)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), both resolved without forcing any git safety check and without deleting anything the plan did not authorize.
**Impact on plan:** Neither deviation changed the ref list authorized in Task 1. No scope creep.

## Issues Encountered

None beyond the two deviations documented above, both resolved cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `git branch` shows only `main`. `git worktree list` shows one entry. `docs/merge-plan-upstream-2026-08.md` is gone. `REQ-upstream-merge-aug-2026`'s Phase C (branch consolidation) is complete, closing out the split from plan 02-04's Phase B.
- Repository gate is green: `pnpm refs:check` and `pnpm test` (1716 tests) both pass.
- `main` is now in sync with `origin/main` (no longer 93 commits ahead) — future work can push incrementally rather than accumulating a large unpushed backlog.
- Plan 06 (if any) or the next phase can proceed without any stale-branch or stale-worktree cleanup debt.

---
*Phase: 02-a-supported-fork-release*
*Completed: 2026-08-07*
