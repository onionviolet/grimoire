# Follow-up plan (fork-only doc)

Queued work from the post-merge review of `main` @ `cfcddf6`. Ordered so each
item is independently actionable: pick by remaining budget, no item depends on
a later one.

Not intended to be upstreamed itself. Companion to [upstream-pr-queue.md](./upstream-pr-queue.md).

## Already done, no action

| Item | Commit |
|---|---|
| `gen-locale-manifest.mjs --check` failed on every Windows clone (CRLF vs LF raw string compare) | `e109b86` |
| Cold-cache double extraction in "start from the original clip" (`Promise.all` -> two `vpkmerge` writers on one path) | `cfcddf6` |

Gates green after both: typecheck, lint, 666 tests, `i18n:check`, manifest check.

## Resolved by checking, no code change

**`preinstall` hard block.** `Slush97/grimoire-social` is **public**
(`gh repo view` -> `"visibility":"PUBLIC"`). The clone command
`scripts/check-sibling-repos.mjs` prints therefore works for any outside
contributor, so the guard converts a confusing failure into a clear one rather
than an impassable one. Ship as merged.

Residual polish, optional and low value: `preinstall` also fires for people who
only want `pnpm install --ignore-scripts`-style partial setups, and for offline
CI images. If that ever bites, gate the exit on `process.env.CI !== 'true'` or
add a `GRIMOIRE_SKIP_SIBLING_CHECK` escape hatch. Not worth doing pre-emptively.

---

## 1. Route adult content through the NSFW gate the app already has

**Priority: high.** This is the item worth spending on first. It is also
smaller than it looks, because none of the machinery needs building.

### What already exists

The app has a complete, three-mode NSFW system:

- `AppSettings.browseNsfwContentMode: 'show' | 'blur' | 'hide'` ([src/types/mod.ts:1003](../../src/types/mod.ts:1003), [:1032](../../src/types/mod.ts:1032)) - Browse-specific.
- `AppSettings.installedHideNsfwPreviews` ([:1034](../../src/types/mod.ts:1034)) - the key the Settings toggle actually writes.
- `AppSettings.hideNsfwPreviews` ([:1030](../../src/types/mod.ts:1030)) - legacy, migration fallback only, no writer left.
- `shouldBlurNsfw(settings)` ([src/lib/appSettings.ts:20](../../src/lib/appSettings.ts:20)) - the shared read for non-Browse surfaces.
- Defaults are already protective: `hideNsfwPreviews: true`, `browseNsfwContentMode: 'blur'` ([electron/main/services/settings.ts:15](../../electron/main/services/settings.ts:15)).
- Honored across ~10 surfaces: Browse, Discover, Installed, Locker, LockerHero, HeroSkinsPanel, ModDetailsModal, ImportCollectionModal, ImportProfileDialog.
- GameBanana's own signal is documented: `_bIsNsfw` authoritative on Detail, `_bHasContentRatings` as the List-view proxy ([docs/gamebanana_api_reference.md:317](../gamebanana_api_reference.md:317)).

**So the defect is not a missing gate. It is that `src/pages/Browser.tsx` is the
single surface that ignores the gate the whole rest of the app respects.** A
user who set `hide` everywhere still gets `Goonlock (18+)` as a one-click chip.

### The work

**1a. Tag the shortcut entries and filter them.** `SHORTCUTS` in
[src/pages/Browser.tsx](../../src/pages/Browser.tsx) is a flat
`{ label, url }[]`. Add an optional `adult?: true`, tag `Goonlock`, and filter
the rendered list through the existing setting rather than a new one:

```ts
const SHORTCUTS: { label: string; url: string; adult?: true }[] = [ ... ];
// 'show' is the only mode that surfaces an adult shortcut. 'blur' is
// meaningless for a text chip, so it collapses to hide.
const visible = SHORTCUTS.filter(s => !s.adult || nsfwMode === 'show');
```

Reuse `browseNsfwContentMode` rather than minting a flag. A fourth NSFW key
would be the third one already in a system whose own comments record the
confusion the second one caused.

Watch out: `HOME_URL = SHORTCUTS[0].url` indexes the unfiltered array. Keep it
reading from the unfiltered constant so the home button never depends on the
filter, or the page's landing URL silently changes with the setting.

**1b. Decide `Goonlock` on its own merits, separately.** Gating is the
mechanism question; whether an adult site belongs in a shipped mod-manager
shortcut list at all is a product question. A gate makes it defensible. Dropping
it entirely is also fine and costs nothing. My recommendation: gate it, since
the same mechanism is needed for 1c regardless.

**1c. Write down the convention, so future QOL additions inherit it.** This is
the part that addresses "the same for future custom QOL mods for sussy settings."
The rule to record (in `CLAUDE.md` under Conventions, where the no-em-dash and
portable-profile rules live):

> Any surface that can put adult or otherwise sensitive content in front of the
> user reads `browseNsfwContentMode` (Browse-family) or `shouldBlurNsfw()`
> (everything else). Do not add a new NSFW setting, and do not ship an
> ungated surface. Default is protective: content is hidden or blurred unless
> the user opted in.

Cost: one paragraph. Value: the next feature does not repeat this.

**Effort: ~1 short session.** No new IPC, no new settings key, no migration.

---

## 2. i18n the Browser shortcut labels

**Priority: medium.** Bundle with item 1 - same file, same edit window.

All nine `SHORTCUTS` labels are hardcoded English while the rest of
`Browser.tsx` goes through `<Tx>`. Two of them (`Deadlock Daily (memes)`,
`Goonlock (18+)`) carry English parentheticals that are meaning-bearing, not
decoration.

Proper nouns should stay untranslated; the parentheticals should not. Cleanest
split: keep `label` as the untranslated site name, add an optional
`noteKey?: string` for the parenthetical, and render
`{label}{note && ` (${t(noteKey)})`}`. Then add the keys to
`src/locales/en/translation.json` and run `pnpm i18n:manifest`.

Do not skip the manifest regen - `pnpm i18n:check` and the manifest check are
both CI gates and both husky pre-push gates.

---

## 3. Finish the README fork notice (DONE)

Lines 7, 12, 96, and 117 now point at `onionviolet/grimoire`. Line 16 was left
alone, as planned. Original writeup kept below for context.

**Priority: medium.** Cheap, visible, and currently self-contradictory.

`chore: fork notice in README and more Browser shortcuts` (`fa64480`) added an
"Independent fork" notice whose stated purpose was that fork users were being
"sent to the wrong place for fork bugs." Four upstream pointers survived it:

| Line | Problem |
|---|---|
| [README.md:7](../../README.md:7) | Release badge reads `Slush97/grimoire` - shows upstream's latest release, not this fork's |
| [README.md:12](../../README.md:12) | CI badge reads `Slush97/grimoire/ci.yml` - **the fork's README reports upstream's build status** |
| [README.md:96](../../README.md:96) | `git clone https://github.com/Slush97/grimoire.git` in the build instructions |
| [README.md:117](../../README.md:117) | `gh attestation verify <file> --owner Slush97` - will not verify a fork-built artifact |

The CI badge is the one that actually misleads: a red fork build can display
green. Line 117 is the one that actively fails if followed.

Line 16 (the fork notice pointing at upstream's GitHub/site/Discord) is correct
as written and should stay - that is deliberate credit, not a stale pointer.

**Effort: ~15 minutes.** Repoint 7, 12, 96, 117 at `onionviolet/grimoire`.

---

## 4. Prune the 141 unused catalog keys

**Priority: medium-low.** Real, but a chore, and easy to get wrong.

`pnpm i18n:check` reports `OK: all 1881 referenced keys exist` **and**
`Unused catalog keys (informational): 141`. Per
[CLAUDE.md](../../CLAUDE.md), `src/locales/en/translation.json` must contain
"*only* real, displayed strings," because it is what Weblate serves to
translators and what drives the honest completeness percentage. 141 dead keys
is 141 units of volunteer work spent on strings nobody sees.

The visible clusters are `autoexec.presets.hud.*`, `autoexec.presets.matchmaking.*`,
`autoexec.presets.minimap.*`, `settings.*`, `sync.sections.*`, `updateModal.*`.

**Do not bulk-delete.** The checker finds references statically, so any key
built by interpolation (`t(\`autoexec.presets.${cat}.name\`)`) reads as unused
while being very much live. The `autoexec.presets.*` cluster has exactly the
shape that suggests dynamic construction, and `sync.sections.Mod` /
`sync.sections.Sound` / `sync.sections.Wip` are almost certainly
`t(\`sync.sections.${section}\`)`.

Method:
1. `grep -rn "t(\`" src/` and enumerate every dynamic key template first.
2. Subtract anything a template could produce from the 141.
3. Delete only the remainder, in one commit, with the list in the message.
4. `pnpm i18n:check && pnpm i18n:manifest`, then confirm `totalKeys` dropped by
   exactly the number deleted.

Note the round-trip cost recorded in CLAUDE.md: deletions reach Weblate only
after they land on `main`, and translated catalogs come back on
`translations/<lang>` branches that must be merged and followed by
`pnpm i18n:manifest`. Deleting keys mid-translation-cycle will churn those
branches. Prefer doing this immediately after a `translations/*` merge, not
before one.

**Effort: ~1 session, mostly verification rather than deletion.**

---

## 5. Click-test the two Foundry features

**Priority: high if a release is near, otherwise low.**

Neither Foundry commit has been run in the app. Both say so in their own
messages: `d779504` ends "Not yet click-tested in the running app."

This matters more than usual here. [upstream-pr-queue.md](./upstream-pr-queue.md)
records that upstream PR #263 was **closed, not merged**, and its body also said
"Not yet click-tested in the running app." That is a documented pattern in this
project's history, not a hypothetical.

Script, once there is a Deadlock install to point at:

1. Foundry -> Sound -> pick any hero clip -> **Start from the original clip**.
   - Cold cache (delete the voiceclips dir first): confirm one extraction, one
     intact MP3. This is the path `cfcddf6` fixed - verify the fix, not just the
     absence of a crash.
   - Confirm the editor opens with the donor prefilled and the waveform drawn.
2. Drag the **Loudness** slider with "Match the original volume" **off**:
   preview audibly changes, readout tracks the slider 1:1.
3. Same with the normalizer **on**: the two sum, and the readout clamps at
   +/-18 dB while the slider keeps moving. **Expect a UX wart here** - the
   number beside the slider renders `effectiveGainDb`, so once clamped the
   readout freezes while the thumb still travels. Decide then whether to show
   both values or clamp the slider's own range against the normalizer's output.
4. Forge, enable in Installed, hear it in game.

**Known-live minor issue to fold in.** `ensureVoiceclipFile`'s doc comment
([electron/main/services/foundryCatalog.ts](../../electron/main/services/foundryCatalog.ts))
says to treat the returned path as valid for the current turn and not to store
it - but `SoundBrowse.tsx` does `setAudioPath(path)` and holds it until forge.
A game update between load and forge changes the fingerprint, prunes the
directory, and dangles the path. Low likelihood, ugly failure. Cheapest correct
fix: re-resolve via `foundryVoiceclipFile` at forge time instead of trusting
stored state. Worth doing while the feature is already open.

---

## 6. Housekeeping, whenever

- **`docs/archive/` is untracked.** Both files in it are fork-only by their own
  headers. Committing them to `main` is right; they are excluded from PR
  branches by convention, not by being unversioned. Currently one machine's
  disk is the only copy.
- **Uncommitted `src/pages/Installed.tsx`.** Model-compatibility dialog gains a
  "Choose model winner" path that routes to `/conflicts`, plus it now lists the
  unreadable VPKs by name instead of only counting them. Carried untouched
  through all four merges. Finish or stash - it has been dirty across a branch
  switch already.
- **`.claude/settings.local.json`** has an uncommitted `Bash(git fetch *)`
  permission. Local-only; commit or discard.
- **`main` is 6 ahead of `origin/main`, 1 behind `upstream/main`.** The one
  behind is `16b193d feat(installed): user lists for organizing installed mods (#306)`.
  Nothing pushed yet.
- **The two `-upstream` branches stay unmerged**, per the branch convention in
  [upstream-pr-queue.md](./upstream-pr-queue.md:17). Both features already exist
  on `main` via a different implementation, and
  `feat/gameinfo-hud-controls-upstream` would additionally drag in #306. They
  are PR-prep artifacts; leave them for the PR, and rebase them onto
  `upstream/main` when it is time to open one.

---

## Suggested order by budget

| Budget | Do |
|---|---|
| One short session | Item 1 (NSFW gate) |
| Two sessions | Add item 2 (i18n labels), fold into the same `Browser.tsx` commit |
| Have a game install | Item 5 first - it is the only item that can invalidate merged work |
| Chore time | Item 4 (unused keys), timed just after a `translations/*` merge |
| Any time | Item 6, especially committing `docs/archive/` |
