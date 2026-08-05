# Merge plan: upstream catch-up + branch consolidation (Aug 2026)

**Status:** not started. Temporary ops doc. Delete it once Phase C is done and pushed.

**Goal, in one line:** get the 10 new `upstream/main` commits into our `main`, fold the
one branch that still holds unmerged work into `main` as well, and delete the eleven
branches that are already fully merged.

This document is written to be executed by someone (or some model) with no prior context
on this repo beyond `CLAUDE.md`. Every command is literal. Every judgment call that is
*not* mechanical is called out with a **STOP** marker.

---

## 0. State as of 2026-08-05

Measured, not assumed. Re-verify with `git fetch --all --prune` before starting, because
upstream may have moved again.

| Fact | Value |
|---|---|
| Our fork | `origin` = `github.com/onionviolet/grimoire` |
| Upstream | `upstream` = `github.com/Slush97/grimoire` |
| Last upstream commit we already have | `9d29dd8` |
| Current `upstream/main` | `14a6eb6` |
| New upstream commits | 10 (74 files, +10477 / -3731) |
| Our `main` | `8193f67`, identical to `origin/main` |
| Our lead over upstream | 225 commits, 390 files changed since `9d29dd8` |
| Our version | `1.26.20` (upstream is `1.26.0`, so **ours is newer**) |

### The 10 upstream commits

```
14a6eb6 fix(installed): unify card action menus
11d57d5 fix(stats): keep salt-contribution copy honest about the client tag
59cdbd1 feat(stats): tag ingested match salts with a "grimoire" username
7483322 feat(performance): refresh presets and preserve creator defaults
25a08c2 feat(mods): Global priority root
aab5afc fix(locker): keep card chrome above the shared 3D canvas on prop tabs
4cf0573 feat(packaging): add flatpak packaging
46a1869 fix(replays): link the addons replays folder so downloads decompress
9644a9e fix: browse update state for replaced files, and a username leak in bug reports
42b57dc feat (nix): devShell and from-source flake packaging
```

> The upstream subjects carry `(#NNN)` PR numbers. They are **deliberately stripped above.**
> See the "refs:check" gate in section 5 before writing any commit message.

### Branch inventory

Computed with `git rev-list --left-right --count origin/main...<branch>`.
"Ahead" means commits the branch has that `origin/main` does not.

| Branch | Ahead of `origin/main` | Disposition |
|---|---|---|
| `main` | 0 | **Target.** Everything lands here. |
| `dev-slot-seeding` | 7 (0 behind) | **Fast-forward into `main`.** Then delete. |
| `structural-refactor-7` | 5 (18 behind) | **Only branch with real unmerged work.** Phase B. |
| `chore/agent-dev-tooling` | 0 | Merged. Delete. |
| `codex/chat-wheel-tab` | 0 | Merged. Delete. |
| `codex/foundry-build-diff` | 0 | Merged. Delete (local + `origin`). |
| `codex/foundry-source-panels` | 0 | Merged. Delete (local + `origin`). |
| `fix/sound-taxonomy-and-claims-index` | 0 | Merged. Delete. |
| `foundry-forge-and-spec-audit` | 0 | Merged. Delete (local + `origin`). |
| `merge/upstream-1.26` | 0 | Stale abandoned merge attempt. Delete. |
| `portrait-alias-sweep` | 0 | Merged. Delete (local + `origin` + worktree). |
| `worktree-agent-a4ad3a26969f16ebb` | 0 | Merged. Delete. |

"Ahead 0" means the branch tip is an ancestor of `origin/main`, so deleting it discards
nothing. This is the whole reason the cleanup is safe.

### Worktrees

```
C:/Users/wayba/dev/grimoire                                            [dev-slot-seeding]  <- primary
C:/Users/wayba/dev/grimoire/.claude/worktrees/agent-a4ad3a26969f16ebb  [structural-refactor-7]
C:/Users/wayba/dev/grimoire-alias-sweep                                [portrait-alias-sweep]
```

---

## 1. Phase 0: prep

```bash
cd /c/Users/wayba/dev/grimoire && git fetch --all --prune && git status --porcelain
```

- **Expected exception: this document itself.** On a first run it shows as untracked
  (`?? docs/merge-plan-upstream-2026-08.md`). That is intentional, not a stray file.
  Commit it before going further, so the tree is genuinely clean and the plan is not
  sitting in a working tree that later phases reset. Commit it on `dev-slot-seeding` and
  it reaches `main` via the fast-forward in section 2:

  ```bash
  git add docs/merge-plan-upstream-2026-08.md && git commit -m "docs: plan the upstream catch-up and branch consolidation"
  ```

  Its content is safe for the `refs:check` gate: that gate reads commit messages, not
  file contents. Keep the message itself free of upstream issue numbers.

- Beyond that, the working tree must be clean. If anything else is dirty, stop and ask.
- Confirm `upstream/main` is still `14a6eb6`. If it moved, the conflict table in section 4
  is stale: re-run the trial merge in section 2 and re-derive it. Do not proceed on the
  old table.

Do the merge in a scratch worktree so the primary tree stays usable:

```bash
git worktree add /c/Users/wayba/dev/grimoire-merge -b merge/upstream-2026-08 main
```

All Phase A work happens in `/c/Users/wayba/dev/grimoire-merge`.

---

## 2. Phase A step 1: bring `main` up to `dev-slot-seeding` first

`dev-slot-seeding` is 7 ahead and 0 behind `main`, so this is a fast-forward with no
merge commit and no conflict risk. Doing it *before* the upstream merge means the upstream
merge only has to reason about one head.

```bash
git checkout main && git merge --ff-only dev-slot-seeding
```

If that is not a clean fast-forward, something changed since this doc was written. Stop
and ask.

Then reset the merge worktree onto the new `main`:

```bash
git -C /c/Users/wayba/dev/grimoire-merge reset --hard main
```

## 3. Phase A step 2: the upstream merge

Preview the damage before committing to it:

```bash
git merge-tree --write-tree main upstream/main
```

Then:

```bash
git -C /c/Users/wayba/dev/grimoire-merge merge upstream/main --no-commit --no-ff
```

Expect **8 conflicted files**. Resolve in the order below: cheap first, so that by the
time the hard three are reached they are the only thing left in the working tree.

---

## 4. The conflict table

`Ours` and `Upstream` are `+/-` line counts measured against the common base `9d29dd8`.
They are the honest signal for how much each side reworked the file.

### Tier 1: generated files. Do NOT hand-merge these.

| File | Ours | Upstream |
|---|---|---|
| `electron/main/services/performanceConfigData.ts` | 0/6 | 5406/2561 |
| `src/locales/manifest.json` | 6/6 | 6/6 |

Both are build artifacts. Resolving them by hand is wasted work and will produce a file
that the regenerator immediately overwrites anyway.

```bash
git checkout --theirs electron/main/services/performanceConfigData.ts src/locales/manifest.json
git add electron/main/services/performanceConfigData.ts src/locales/manifest.json
```

They get regenerated in section 5 (`pnpm perf:presets`, `pnpm i18n:manifest`). The
regenerated output is what actually ships, so a diff against upstream's version here is
expected and fine.

### Tier 2: mechanical. Both sides are essentially additive.

| File | Ours | Upstream | Note |
|---|---|---|---|
| `electron/preload/index.ts` | 110/1 | 9/4 | Keep both blocks. Ours adds IPC surface, upstream adds a few methods. |
| `electron/main/services/modMerger.ts` | 166/7 | 6/3 | Ours is the VFX-layer extraction work (see `docs/ability-vfx-recolor.md`). Upstream's touch is 6 lines. Keep both. |
| `src/lib/lockerRandomizer.ts` | 96/11 | 19/2 | Additive on both sides. |
| `docs/performance-config-integration.md` | 24/9 | 15/8 | Prose. Merge both sets of notes, drop nothing. |

### Tier 3: hard. Both sides rewrote the same code. **STOP and read before editing.**

For each of these, read both diffs against the base before touching the file:

```bash
git diff 9d29dd8 main -- <file>            # what we changed
git diff 9d29dd8 upstream/main -- <file>   # what upstream changed
```

| File | Ours | Upstream | Approach |
|---|---|---|---|
| `src/pages/Installed.tsx` | 200/186 | 369/431 | Upstream unified the card action menus onto a new shared `src/components/common/menu.tsx`. Our edits are independent. Take upstream's menu refactor as the base and re-apply our behavior on top. This is the single largest resolution. |
| `src/components/performance/PerformanceConfigCard.tsx` | 105/171 | 329/135 | Upstream restructured this component and split out two new children, `PresetSummary.tsx` and `VersionPicker.tsx` (both arrive clean, no conflict). Take upstream's shape, then re-apply our deltas. Do not try to preserve our old structure. |
| `src/pages/Locker.tsx` | 505/183 | 175/23 | Inverse case: we rewrote this heavily for Foundry, upstream's change is small and additive (a `GlobalModPicker` mount plus a z-index fix so card chrome sits above the shared 3D canvas on prop tabs). Keep our version as the base and graft upstream's two additions in. |

### Files arriving clean (no conflict) that are worth knowing about

New upstream files, all auto-merged: `src/components/locker/GlobalModPicker.tsx`,
`src/components/common/menu.tsx`, `src/components/performance/PresetSummary.tsx`,
`src/components/performance/VersionPicker.tsx`, `src/lib/updateFileMatch.ts`,
`electron/main/services/replayFolder.ts`, plus 8 new test files, plus the `nix/` +
`flake.nix` + `flatpak/` packaging trees.

**Decision already made: keep the nix and flatpak packaging.** It is dead weight for this
fork, but deleting it guarantees a conflict on every future upstream merge that touches
it. Carrying it costs nothing.

### Version number

`package.json` auto-merges, but verify the result by hand:

```bash
grep '"version"' package.json
```

It must read `1.26.20` or higher. Ours is ahead of upstream's `1.26.0`. If the merge
pulled the version backwards, fix it to `1.26.20` before committing.

---

## 5. Phase A step 3: regenerate, then run every gate

Order matters. Regenerate first, because two of the resolutions above were deliberately
left as upstream's raw content.

```bash
pnpm install
```

```bash
pnpm perf:presets && pnpm i18n:manifest
```

Then the full gate set. These mirror CI (`ci.yml`) and the husky `pre-push` hook, so
anything red here is red on push too:

```bash
pnpm i18n:check && node scripts/gen-locale-manifest.mjs --check && pnpm encoding:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

What each one is actually catching here:

- **`i18n:check`** is the real guard on the `src/locales/en/translation.json` resolution.
  Upstream added ~57 keys and that file auto-merged, meaning nobody reviewed it. This
  check fails if any key referenced by `t()` is missing from the catalog.
- **`gen-locale-manifest.mjs --check`** fails if the committed manifest does not match the
  catalogs, i.e. if `pnpm i18n:manifest` above was skipped.
- **`encoding:check`** catches cp1252 mojibake. A large merge touching translation
  catalogs is exactly the situation that introduced 77 such sequences in v1.26.1.
- **`pnpm test`** is Vitest. Upstream added 8 new test files in this range, so this run
  covers code that has never run in our tree before.

### The commit message gate: read this before writing any commit

`.husky/commit-msg` and `pnpm refs:check` block any commit message containing an upstream
issue reference (`#339`, or a `github.com/Slush97/grimoire` URL). The reason is not
cosmetic: GitHub would post a cross-reference event into upstream's timeline under this
account's name, and that event cannot be retracted afterwards.

So the merge commit message must **not** cite upstream PR numbers. Describe the content
instead:

```
merge: upstream catch-up (global priority root, performance presets, card menus)
```

Upstream's own squash subjects that already contain `(#NNN)` are exempt, because they are
reachable from `upstream/main` already. Only *new* messages are checked.

### Runtime smoke test

Three of the eight conflicts were UI pages. A green typecheck does not tell you whether
`Installed.tsx` still renders. Drive the real app (see `CLAUDE.md`, "Driving a Running
Dev Build"):

```bash
GRIMOIRE_DEV_SLOT=3 pnpm dev
```

Then, in a second shell:

```bash
GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs route installed
```

Check each of the three touched surfaces with `text`/`html` rather than screenshots, since
those say *why* something is wrong:

- `route installed`: mod cards render, the action menu opens (this is upstream's refactor).
- `route locker`: hero tiles render, prop tabs show card chrome above the 3D canvas, and
  the new Global mod picker is reachable.
- The performance config card: preset list populates and a preset can be selected.

Confirm the slot is the one being driven with:

```bash
GRIMOIRE_DEV_SLOT=3 node scripts/dev-driver.mjs eval "window.__GRIMOIRE_DEV_SLOT"
```

Note that dev slots isolate userData but **not** the game install. Do not toggle mods on
a real install you care about while testing.

### Land it

```bash
git checkout main && git merge --no-ff merge/upstream-2026-08
git push origin main
```

---

## 6. Phase B: `structural-refactor-7`

**STOP. Confirm with the repo owner before starting this phase.**

`structural-refactor-7` is checked out in a live agent worktree
(`.claude/worktrees/agent-a4ad3a26969f16ebb`). If an agent is still working there, merging
it now will fight that agent. Confirm the work is finished first.

It is the only branch carrying unmerged commits (5 commits, 32 files, +1744/-582):

```
227dbc9 fix(foundry): preserve Global inventory links after consolidation
4e82d2e refactor(foundry): require browse hero context
675a41c refactor(sounds): one vocabulary, and every answer carries its reason
eb2ff8c refactor(claims): derive path ownership once, for both surfaces
260bb0d refactor(identity): fold four hero name tables into one
```

This is a **separate merge job from Phase A**, not part of it. It overlaps the upstream
change set in only 4 files (`heroPortraits.ts`, `en/translation.json`, `manifest.json`,
`appStore.ts`), two of which are generated or catalog files. Sequence it after Phase A so
each merge is debugged independently.

Its conflicts are against *our own* Foundry work, not upstream. Trial merge shows 10
conflicted files:

```
electron/main/services/heroPoseModels.ts
src/components/foundry/GlobalSoundBrowse.tsx
src/lib/assetClaims.test.ts        (add/add)
src/lib/assetClaims.ts             (add/add)
src/lib/globalSoundSections.ts
src/lib/heroPortraitIdentity.ts
src/lib/soundInventory.ts
src/locales/en/translation.json
src/locales/manifest.json
src/pages/Foundry.tsx
```

The two `add/add` conflicts on `assetClaims.ts` mean both branches independently created
a file at that path. That is a design collision, not a text collision: someone has to
decide which claims model survives. **STOP and ask** rather than picking one.

Run the same gate set from section 5 afterward.

---

## 7. Phase C: cut the old branches

Only after Phases A and B are pushed and green.

Re-verify that each branch is still fully merged before deleting. `git branch -d` (lowercase
d) refuses to delete an unmerged branch, which is the safety net: **never use `-D` here.**

```bash
git checkout main
```

```bash
git branch -d chore/agent-dev-tooling codex/chat-wheel-tab codex/foundry-build-diff codex/foundry-source-panels fix/sound-taxonomy-and-claims-index foundry-forge-and-spec-audit merge/upstream-1.26 worktree-agent-a4ad3a26969f16ebb
```

`portrait-alias-sweep` and `structural-refactor-7` are checked out in worktrees, so their
worktrees must go first:

```bash
git worktree remove /c/Users/wayba/dev/grimoire-alias-sweep
git worktree remove /c/Users/wayba/dev/grimoire-merge
```

```bash
git branch -d portrait-alias-sweep dev-slot-seeding merge/upstream-2026-08
```

Delete `structural-refactor-7` and its worktree only if Phase B landed:

```bash
git worktree remove /c/Users/wayba/dev/grimoire/.claude/worktrees/agent-a4ad3a26969f16ebb
git branch -d structural-refactor-7
```

Then the remote branches. **STOP and confirm before this step:** remote deletion is the
one irreversible action in this document.

```bash
git push origin --delete codex/foundry-build-diff codex/foundry-source-panels foundry-forge-and-spec-audit portrait-alias-sweep dev-slot-seeding
```

Finally:

```bash
git worktree prune && git branch -a && git worktree list
```

Expected end state: `main` and (if Phase B was deferred) `structural-refactor-7`. Nothing
else. One worktree, the primary one.

---

## 8. Stop-and-ask rules

Do not improvise past any of these. Ask the repo owner.

1. `upstream/main` is not `14a6eb6` at start. The conflict table is stale.
2. `main` will not fast-forward to `dev-slot-seeding`.
3. More than 8 files conflict in Phase A, or a file conflicts that is not in the table.
4. Any gate in section 5 fails and the fix is not obviously a bad conflict resolution.
5. The `assetClaims.ts` add/add collision in Phase B.
6. Any `git branch -d` refuses, meaning the branch is not actually merged.
7. Before any `git push origin --delete`.
8. Before touching anything in `../grimoire-social`. Out of scope entirely.

## 9. Conventions to respect

- **No em-dashes** anywhere: not in code, comments, commit messages, or UI strings. Use a
  colon, a period, or parentheses.
- Bare `#NN` in *our* commit messages and docs means `onionviolet/grimoire`, never
  upstream. The `refs:check` hook enforces the distinction.
- `src/locales/en/translation.json` holds only real, displayed strings. Do not park
  to-do strings there: those go in `src/locales/unwired-en.json`.
- Delete this document once Phase C is pushed.
