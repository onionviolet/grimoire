# Prompt: finish the upstream v1.28.0 absorption (continuation)

Written 2026-08-24, after the merge commit landed. Run it with
`OX_PROMPT=.planning/PROMPT-ox-absorb-v1.28-continue-2026-08-24.md scripts/ox_absorb.sh`.

---

You are finishing an absorption of upstream into `grimoire`, a TypeScript /
Electron / React project at `/Users/weiwei/Documents/Dev/grimoire`. You are on
macOS, not Windows. You are on branch `absorb/upstream-v1.28`, the working tree
is clean, and dependencies are installed.

## Position, measured before you started. Do not re-measure it.

- The merge is DONE and committed as `7cd4686`, a real merge commit whose
  parents are `aba3d01` (this fork) and `5cc6e33` (upstream v1.28.0).
- Steps 1 and 2 of the original plan are complete. Do NOT run `git merge`
  again, and do not re-write the verdict table.
- All six gates pass right now: `tsc -b`, `eslint .`, `check-i18n`,
  `check-encoding`, `check-upstream-refs` all exit 0, and `vitest run` sits at
  the documented pre-merge baseline of 9 failing files and 26 failing tests
  (the two `browserContentFilter` files, `browserDownloadCapture`,
  `foundryNonStandard`, `foundryTextureReplace`, `modinfoFormat`,
  `vpkIdentity`, `heroStageMode`, `uiPrefs`). Those 9 are pre-existing. Any
  new failure is yours.
- `package.json` is at `1.28.0`.

## Read exactly these files first, and no others

1. `docs/upstream-absorption-1.28.md`, especially the closing section
   "Resolution note: Locker.tsx landed as upstream, port deferred"
2. `docs/fork-divergence-policy.md`
3. `AGENTS.md`

Do NOT read `.planning/INGEST-CONFLICTS.md`, `.planning/intel/**`,
`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `docs/feature-status.md`,
or the Foundry plan chain.

## Act first

Run `git log --oneline -5` and `git show --stat 7cd4686 | head -40` in your
first turn. Do not restate this prompt.

## The job, in order

### Step A: the Locker.tsx repair, as its own commit

`src/pages/Locker.tsx` in the merge commit is upstream's file wholesale. The
fork's rail projection was NOT ported, because the two sides are independent
implementations of the same view and hunk-level splicing was refused on
purpose. The resolution note in `docs/upstream-absorption-1.28.md` lists
exactly what the repair owes back. The fork's implementation is the pre-merge
file, at `git show 54a609f:src/pages/Locker.tsx`.

Read BOTH implementations in full before writing anything. Upstream owns the
tab model (`GeneralTabId`: the seven classification types, then Global, then
the user's categories). The fork owns the Sounds section and its shelves, the
merged rail projection with zero-count rows hidden (D-04), the roving
arrow-key tablist, `selectedAllKey`, the null-until-picked landing tab, the
derived pak descriptions (D-19), and the broken-pose disclosure.

Rule 3 of the divergence policy still governs: upstream wins on the shared
surface unless the fork has a differentiator it can name. The sound shelves,
the tablist wiring and the null-until-picked landing tab are named
differentiators; the rail's visual arrangement, taken on its own, is not.

`HeroSkinsPanel.shufflePropsFor` already reads the caller's `shuffleKeyFor`
prop, so restoring the sound pool's namespace is a call site
(`shuffleKeyFor={activeSection === 'sounds' ? shuffleSoundKey : undefined}`)
and not a rewrite.

There is an open product question recorded in the resolution note: whether the
fork should carry a runtime toggle between upstream's tab model and the fork's
rail, rather than reconciling them into one view. Do NOT build that toggle.
If your reading suggests it is the right answer, say so in your final report
and in the doc, and stop short of implementing it.

If a full reconciliation is not achievable at the quality bar, land the part
that is (the Sounds section and its shelves are the highest value and the most
separable), and record precisely what remains. A smaller correct repair beats
a large speculative one.

### Step B: version bump, its own commit

Set `package.json` to `1.28.1` and commit it alone. Do not cut a release.

### Step C: gates

Run these from the repo root, binaries directly, never through `pnpm` (the
local pnpm is v11, this repo is pinned to v10 in CI, and v11's pre-command
dependency check fails the run before your command executes):

    ./node_modules/.bin/tsc -b
    ./node_modules/.bin/vitest run
    ./node_modules/.bin/eslint .
    node scripts/check-i18n.mjs
    node scripts/check-encoding.mjs
    node scripts/check-upstream-refs.mjs

Exit code 0 is pass. `vitest` must not exceed the 9-file / 26-test baseline
above.

### Step D: the smoke record

Driving the real app is a human step. Per Rule 6a a missing smoke record means
unverified, not blocked. Record the surfaces you could not exercise and stop
there. Do not invent the evidence and do not treat its absence as a failure.
The surfaces that need a human pass: Locker (user categories, General shuffle,
sound and card pools), Installed (variants, inline profiles menu), Settings
(promoted performance configs beside Game ConVars), the performance card
(staged edits over the version picker), and dialogs stacked on dialogs.

### Housekeeping

This prompt file is untracked when you start. Commit it on its own first, with
`chore(absorb): add the continuation prompt for the v1.28 absorption`.
Nothing else should be untracked; if something is, list it in your final
report and leave it alone.
