# Prompt: execute the upstream v1.28.0 absorption with Ox Alpha (step 2 of 2)

Written 2026-08-24. This is the execution half, split out of
`PROMPT-ox-absorb-v1.28-2026-08-24.md`. Run it only after the verdict doc from
step 1 has been read and corrected by a human:

    OX_PROMPT=.planning/PROMPT-ox-absorb-v1.28-merge.md scripts/ox_absorb.sh


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


### Step 0: read the verdicts, which are now decided

`docs/upstream-absorption-1.28.md` is committed on this branch and a human has
reviewed it. It is the decision, not a draft. Read it in full before touching
anything, and follow it. If resolving a file teaches you a verdict was wrong,
say so in the doc with the reason and change it, but treat that as the
exception it is: a human already signed off on what is written there.

### Step 2: merge

    git merge --no-ff upstream/main

Resolve all 28 files according to the verdicts you just wrote. If resolving one
teaches you the verdict was wrong, change the doc and say why. The doc is the
record of the decision, not a prediction to be defended.

Two specific calls that are already made for you:

- `package.json` version: set it to `1.28.1`, as its own commit, after the
  merge. Not `1.28.0`: that is upstream's own version, and electron-updater
  compares versions, so the fork build must sort strictly above the upstream
  build it absorbed. This is the same call the v1.26 absorption recorded, and
  `docs/upstream-absorption-1.28.md` restates the reasoning. Do not cut a
  release, and do not reintroduce the retired four-digit counter.
- `src/locales/*/translation.json` and `src/locales/manifest.json`: take both
  sides' keys, never drop one to end a conflict. Regenerate the manifest with
  `node scripts/gen-locale-manifest.mjs` rather than hand-merging it, then run
  `node scripts/check-i18n.mjs`.
- `electron/main/services/performanceConfigData.ts`: its eight conflicting
  hunks are regeneration drift between two runs of one generator, so take
  upstream's file wholesale (`git checkout --theirs`) rather than regenerating.
  `scripts/gen-performance-presets.mjs` fetches from `raw.githubusercontent.com`
  and `api.github.com`, so a regeneration can stall on an unauthenticated rate
  limit, and upstream's committed file already IS that generator's output at
  the pinned SHA. Run the generator only if the pins file itself changes, and
  if it fails on the network, keep upstream's file and say so in the doc.

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

