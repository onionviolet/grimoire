# Prompt: hand the upstream v1.28.0 absorption to Ox Alpha, on the Mac

Written 2026-08-24. Modeled on `itembank/.planning/PROMPT-ox-17A-overnight-2026-08-22.md`.
Run it with `scripts/ox_absorb.sh`, which supplies the text below as the task.

---

You are absorbing upstream into `grimoire`, a TypeScript / Electron / React
project at `/Users/weiwei/Documents/Dev/grimoire`. You are on macOS, not
Windows. You are already on branch `absorb/upstream-v1.28`, the working tree is
clean, dependencies are installed, and `upstream` is fetched.

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

### Step 2: merge

    git merge --no-ff upstream/main

Resolve all 28 files according to the verdicts you just wrote. If resolving one
teaches you the verdict was wrong, change the doc and say why. The doc is the
record of the decision, not a prediction to be defended.

Two specific calls that are already made for you:

- `package.json` version: set it to `1.28.0`. This fork's numbering tracks
  upstream's and adds patch increments on top, which is how `1.27.2` came from
  upstream's `1.27.1`. Do not invent a different number, and do not cut a
  release.
- `src/locales/*/translation.json` and `src/locales/manifest.json`: take both
  sides' keys, never drop one to end a conflict. Regenerate the manifest with
  `node scripts/gen-locale-manifest.mjs` rather than hand-merging it, then run
  `node scripts/check-i18n.mjs`.

Commit the merge. Then land any follow-up repairs as separate, small commits
after it, so the merge commit stays readable.

### Step 3: verify

Run these from the repo root. Use the binaries directly. Do NOT run
`pnpm test`, `pnpm typecheck`, or `pnpm lint`: the local pnpm is v11, this
repo is pinned to v10 in CI, and v11's pre-command dependency check fails the
run before your command ever executes.

    ./node_modules/.bin/tsc -b
    ./node_modules/.bin/vitest run
    ./node_modules/.bin/eslint .
    node scripts/check-i18n.mjs
    node scripts/check-encoding.mjs
    node scripts/check-upstream-refs.mjs

Exit code 0 is pass.

**The pre-existing failures, measured on this branch at `54a609f` BEFORE the
merge. Nine test files, 26 tests. Do not chase them, and do not count them as
your regressions:**

    electron/main/services/browserContentFilter.permissionFloor.test.ts
    electron/main/services/browserContentFilter.test.ts
    electron/main/services/browserDownloadCapture.test.ts
    electron/main/services/foundryNonStandard.test.ts
    electron/main/services/foundryTextureReplace.test.ts
    electron/main/services/modinfoFormat.test.ts
    electron/main/services/vpkIdentity.test.ts
    src/components/locker/heroStageMode.test.ts
    src/lib/uiPrefs.test.ts

Baseline totals: `Test Files 9 failed | 175 passed | 2 skipped`, `Tests 26
failed | 1956 passed | 16 skipped`. `tsc -b` exits 0 at baseline, so a type
error after the merge IS yours. Any test failure outside those nine files is
yours. Any new failure inside them beyond the 26 is yours.

Upstream adds new test files. Those must pass. If an upstream test fails
because you kept the fork's implementation, that is a verdict you have to
defend in the doc or reverse, not a test to delete.

### Step 4: finish the doc

Update `docs/upstream-absorption-1.28.md` with what actually happened: verdicts
that changed and why, the final verification numbers, and follow-ups you
deliberately left out. Then update `docs/fork-maintenance.md` only if the
absorption taught it something new.

Do not update `.planning/STATE.md`; it tracks milestone v1.27.5 phase work,
which this is not.

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

`git log --oneline` shows the plan commit, the merge commit, and any repair
commits. `tsc -b` exits 0. `vitest run` shows no failure outside the nine
baseline files. `docs/upstream-absorption-1.28.md` records a verdict, with a
reason, for every upstream commit that touched a shared surface.
