# Prompt: plan the upstream v1.28.0 absorption with Ox Alpha (step 1 of 2)

Written 2026-08-24. This is the judgment half, split out of
`PROMPT-ox-absorb-v1.28-2026-08-24.md` so Weibao can read and correct the
verdicts before a single conflict is resolved. Run it with:

    OX_PROMPT=.planning/PROMPT-ox-absorb-v1.28-plan.md scripts/ox_absorb.sh


You are absorbing upstream into `grimoire`, a TypeScript / Electron / React
project at `/Users/weiwei/Documents/Dev/grimoire`. You are on macOS, not
Windows. You are already on branch `absorb/upstream-v1.28`, the working tree is
clean, dependencies are installed, and `upstream` is fetched.

---

## Position, measured before you started. Do not re-measure it.

- `origin/main` (this fork, `onionviolet/grimoire`) is at `54a609f`, version `1.27.2`.
- `upstream/main` (`Slush97/grimoire`, read-only) is at `5cc6e33`, version `1.28.0`.
- Merge base is `0ceab21`. Divergence: **31 behind, 505 ahead.**
- Upstream touches 139 files. A trial merge conflicts in **28 files, 79 hunks**.
  The heavy ones are `src/pages/Locker.tsx` (17), `src/components/locker/HeroSkinsPanel.tsx` (6),
  `electron/main/services/performanceConfigData.ts` (6), `src/stores/appStore.ts` (4),
  `src/lib/lockerRandomizer.ts` (4), `src/locales/en/translation.json` (4),
  `src/locales/manifest.json` (4), `.github/workflows/release.yml` (4).

## Read exactly these files first, and no others

1. `docs/fork-divergence-policy.md` (the decision rules, all of them)
2. `docs/upstream-absorption-1.26.md` (the shape of the doc you will write)
3. `AGENTS.md` (the GitHub boundary rules)

Do NOT read `.planning/INGEST-CONFLICTS.md`, `.planning/intel/**`,
`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `docs/feature-status.md`,
or the Foundry plan chain. That stack is enormous and none of it decides a
merge conflict.

## Act first

Run `git log --oneline HEAD..upstream/main` in your first turn. Do not restate
this prompt, do not produce an analysis section before touching the repo.

## The job, in order


### Step 1: write the verdict table BEFORE you merge

Create `docs/upstream-absorption-1.28.md`, following the structure of
`docs/upstream-absorption-1.26.md`: Position, What is coming in, the real
decisions, then the per-file plan.

For every upstream commit that touches a surface this fork also touches, record
one of three verdicts with a reason, per the "Per-absorption habit" section of
`docs/fork-divergence-policy.md`:

- **take** upstream's wholesale, drop ours
- **keep** ours, and say what makes it a differentiator
- **port**, meaning take upstream's structure and re-apply our surface on top

The one rule you cannot break here: **resolve at the level of the verdict,
never hunk by hunk.** Hunk-level resolution of two independent implementations
produces code neither side reviewed, and that is the worst outcome available.
Where both sides built the same feature, read both implementations in full
before choosing.

Rule 3 of the policy is your default: on shared surfaces, upstream wins unless
this fork has a differentiator it can name. The fork owns the consistency floor
(one Escape contract, real tablist wiring, one result-count convention, one
confirmation dialog, one preference store), the Foundry forge path and staged
edits, and the performance card's surface (staged edits, per-value origin
badges, HUD/advanced rows). Upstream owns `src/pages/Settings.tsx` and
`src/components/settings/**`, preset data and the applier's data model, and
release plumbing and auto-update config.

Commit this doc on its own before merging:
`docs(absorb): plan the upstream v1.28.0 absorption`

`scripts/ox_absorb.sh` and the three `.planning/PROMPT-ox-absorb-v1.28*.md`
files are untracked when you start: the launcher that started you and the
prompts, including the one you are reading. Commit those four first, on their
own, with `chore(absorb): add the Ox Alpha launcher and prompts for this
absorption`. Nothing else in the tree should be untracked; if something else
is, list it in your final report and leave it alone.


### Stop here

Do NOT run `git merge`. Do not resolve a conflict, do not edit a source file,
do not change `package.json`. This run ends when the verdict doc is committed.

You may inspect the conflicts to inform a verdict, with
`git merge-tree $(git merge-base HEAD upstream/main) HEAD upstream/main`, which
touches no working tree and needs no cleanup. If you ever do start a real merge
by accident, `git merge --abort` and say so in your final report.

Your final report is the verdict summary: every upstream commit that touched a
shared surface, its verdict, and the one-line reason. A human reads that next.

## Rules you cannot break

1. **`upstream` is read-only.** Never push to it, never open, comment on, or
   modify any upstream issue, pull request, discussion, or release. Every
   mutating GitHub command names `--repo onionviolet/grimoire` explicitly.
2. **No upstream backlinks in commit messages.** A bare `#369`, a
   `Slush97/grimoire#369`, or a `github.com` upstream URL in a commit message
   creates a permanent backlink in upstream's timeline. Backticks are inert and
   `redirect.github.com` URLs are safe. `scripts/check-upstream-refs.mjs` runs
   as a commit-msg hook and will reject you; do not use `--no-verify` to get
   past it.
3. **Do not push, and do not touch `main`.** Everything stays local on
   `absorb/upstream-v1.28`. Weibao reviews before anything lands.
4. **Do not rewrite published history.** No rebase of existing commits, no
   force anything, no amending commits that already existed when you started.
5. **No em dash characters anywhere:** not in code, comments, UI strings, docs,
   or commit messages. Use commas, colons, parentheses, or two sentences. This
   is a stated project convention (`CLAUDE.md`), not a preference.
6. **Never delete a test to make the suite green.** Never weaken an assertion
   for the same reason.
7. **Commit as you go.** One commit per coherent step. A run that does the work
   and commits nothing is a run that produced nothing.


## What done looks like

`git log --oneline` shows two new commits, the tool files and the plan doc.
`git status` is clean. `docs/upstream-absorption-1.28.md` records a verdict,
with a reason, for every upstream commit that touched a shared surface. No
source file has changed.
