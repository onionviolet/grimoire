# Reconcile ledger, 2026-11-26

Branch `reconcile/2026-11-26`, cut from the checked-out `feat/sound-forge-install-review` (which is `main` plus one commit, so `main` is an ancestor and nothing is lost). Nothing was pushed, released, installed or launched.

## Live

- No v1.35.2 build is installed or released. The latest published fork release is v1.28.2 (2026-09-05). A draft release `internal-2026-11-24` exists on `onionviolet/grimoire`.
- `package.json` says 1.35.2 on this branch. The CHANGELOG has a v1.35.2 entry with no date.

## Pushed

- `origin/main` is at 5160f671's parent (`main` is ahead 1, unpushed).
- `origin/codex/forge-playback-audit` holds cc6fa02c.
- `origin/codex/absorb-upstream-1.33` and `origin/merge/upstream-1.35` exist. The local `merge/upstream-1.35` is ahead of its remote by 90 commits.

## Local only

Commits on `reconcile/2026-11-26` after `main` (oldest first):

| SHA | Subject |
|---|---|
| 2d873ce9 | feat(foundry): make sound installs transactional and reviewable (from the sound-forge branch, already here) |
| a2fddce9 | chore(agents): sync the portable working-agreement block in AGENTS.md and CLAUDE.md |
| 44c9da87 | feat(profiles): duplicate a saved profile over the same mod files |
| f1d13515 | feat(recovery): open assisted isolation as Find a broken mod from Installed, crash advisories and failed launches |
| 719ab325 | feat(foundry): restore stock effects from a skin VPK and review a release ZIP before publishing |
| 79fcb072 | chore(i18n): regenerate the locale manifest for the new strings |
| e9bc58cd | docs(planning): record the v1.35.2 candidate as current focus and close the v1.27.5 milestone text |
| a28cc754 | docs: update feature status, the internal release note and release maintenance; add the peer manager scout |
| f545b330 | docs(changelog): add upgrade steps, first-run tips and the November features to the v1.35.2 entry |

Branches:

- `main`: 5160f671 "chore(release)", 190 files, about 5,900 added lines, unpushed. It contains real features under a chore label.
- `feat/sound-forge-install-review`: 2d873ce9 only, now contained in the reconcile branch.
- `codex/forge-playback-audit`: cc6fa02c, NOT brought in. A cherry-pick conflicts in 13 files. A line check shows main's 5160f671 already holds nearly all of it (the two audit docs and the locker and animation code are identical or newer on main). The only content absent from main is test deadline bumps in `profileLoadOrder.test.ts` (30 s to 60 s, and new 30 s deadlines), which I left out on purpose. See Checks.
- `claude/peaceful-keller-5ab755` worktree at `.claude/worktrees/peaceful-keller-5ab755`: clean, its tip 619a03ba is already in `main`. Left in place.

Uncommitted: `.reasonix/` (four desktop-topic JSON files, local app state, not source). Left untracked, not committed.

## Checks

CHANGELOG against code (read each claim against the branch): Door Stuck, Chat Wheel and Ability previews settings, three-times ability audition, crosshair spread test, bookmarks, find in page, VPK compression and taskbar settings, localization merge and mod trial services, waveform zoom, relink audio, baked audio, removed-from-GameBanana filter, duplicate profile, Find a broken mod, stock VFX overlay and release ZIP review all exist in source or locale strings. The "Windows test of a v1.28.2 setup" sentence traces to `.planning/STATE.md` (disposable v1.28.2 profile). Not read in depth: "Config shows which settings win and previews edits" (a `configWorkspace` service and tests exist; I did not read the UI). No CHANGELOG edit was needed. Three features in the entry (duplicate profile, Find a broken mod, stock VFX and ZIP review) were uncommitted until this branch, so before it the CHANGELOG described code `main` did not hold.

Tests (`pnpm exec vitest run`, whole tree, working tree identical to the final branch source):

- Full run: 592 files passed, 10 failed, 3 skipped. 7,124 tests passed, 45 failed, 32 skipped. 5 min 27 s. The machine was heavily loaded (about 160 node processes). 35 failures were `Test timed out in 5000ms`, 2 were `timed out in 60000ms`, and the rest were assertion errors in the same files.
- Rerun of the 10 failing files with `--maxWorkers=2`: 7 files passed. 198 tests passed, 8 failed, and every one of the 8 is a timeout (4 at the 5 s default, 4 at 60 s). No assertion failure remained. The failing tests:
  - `configWorkspace.test.ts`: 2 (5 s)
  - `profileRecovery.test.ts`: 2 (5 s)
  - `profileLoadOrder.test.ts`: 4 (60 s), including "restores 199 mods after their slots change"
- Honest status: the suite is not green on this machine. No test deadline was changed on this branch. The slow 199-mod test is a real performance signal. cc6fa02c raised those deadlines to hide it, and I did not take that change. The first full run's extra failures cleared when run with fewer workers, so they are load, not logic, but that is inferred from the rerun, not proven by a quiet-machine run.
- `typecheck`, `lint`, `i18n:check` and `refs:check` were not run in this pass.

Sound install rollback test: none exists. `registerFoundryVpk` (copy, then rollback of metadata and the copied VPK on failure, with an `AggregateError`) and `parkFoundryMod` live in `electron/main/ipc/mods.ts` and no test file references them or the `foundry:forgeInstall` and `foundry:swapSound` handlers. 2d873ce9 added tests for audition and the build tray only. The owed test: make `fs.copyFile` or `setModMetadataWithHash` throw, then assert the metadata and the copied VPK are gone and the parked original is back.

Owed on the real route:

- Install the built app and open a v1.28.2 profile: one step, run the Windows installer over the existing install.
- Sound install, replace-enabled-mod and failure restore in the game: one step, rebuild an enabled sound mod in Foundry and confirm the old VPK returns when you force a failure.
- Chat Wheel swap in a private match: one step, launch Deadlock with a swapped wheel and use it.
- macOS and Linux build: the release gate is three-platform and macOS was cancelled before, so no release is cut. One step: dispatch the release workflow and require all three jobs green.

## Decision packet

1. Fast-forward `main` to `reconcile/2026-11-26`. Recommended: yes, after the sound rollback test is added or you accept its absence. It changes `main` from "release commit alone" to a branch that holds the sound work, the uncommitted features, the doc fixes and the CHANGELOG. `main` is an ancestor, so it is a clean fast-forward.
2. Push `main` and the reconcile branch to `origin`. Recommended: push the reconcile branch first, run the three-platform dispatch there, then push `main`. It makes the work visible and backed up. It does not release anything.
3. Add the missing sound-install rollback test before any release. Recommended: yes. It guards the one failure path of the transactional install that has no coverage.
4. Treat the 199-mod and recovery timeouts as a performance task, not a deadline change. Recommended: do not merge cc6fa02c's deadline bumps. Run the suite on a quiet machine to confirm they pass at the old deadlines. Then retire `origin/codex/forge-playback-audit`, whose content is already on `main`.
5. Split 5160f671 for review (optional). Recommended: skip unless you plan a PR. It is 190 files under a "chore" label, which hides about five features from `git log` and bisect. If you want it, split by feature (localization merge, mod trial, bookmarks, chat wheel IPC, motion viewers) and keep "release" for the version bump, CHANGELOG and workflow edits. This is a history rewrite of an unpushed commit, so it is safe only before step 2.
