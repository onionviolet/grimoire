# Absorbing upstream v1.28.0

How this fork takes Slush97/grimoire's thirty-one commits through v1.28.0,
where the duplicated intent sits, and what gets taken, kept, or ported. Read
this before running the merge.

Status: planned, not started. Measured 2026-08-24 at `54a609f` (ours, v1.27.2)
and `5cc6e33` (upstream, v1.28.0).

## Position

- `upstream/main` is at `5cc6e33` (v1.28.0). We are at `54a609f` (v1.27.2),
  working on branch `absorb/upstream-v1.28`.
- Divergence: **31 behind, 505 ahead.** Merge base `0ceab21`.
- Since the base, upstream touches 139 files and we touch 682. Both sides
  touch **42** of the same files. A trial merge (`git merge-tree`, no working
  tree involved) conflicts in **28** files, **82** hunks by conflict-marker
  count.
- The heavy ones: `src/pages/Locker.tsx` (18 hunks),
  `electron/main/services/performanceConfigData.ts` (8),
  `src/components/locker/HeroSkinsPanel.tsx` (6); then four apiece in
  `src/stores/appStore.ts`, both locale files, `src/lib/lockerRandomizer.ts`,
  and `.github/workflows/release.yml`; three apiece in
  `src/types/electron.ts`, `electron/main/services/updater.ts`, and
  `electron/main/ipc/mods.ts`. Everything else is one or two hunks.

## What is coming in

| Commits | What it is | Cost to us |
|---|---|---|
| `c7eb8e7` + `877e2f1` | General-section shuffle, user categories, centered empty states | **port**, see below |
| `00a1ee4` | local mods managed as variants | **port**, adjacent to the Locker work |
| `ecc327e`, `11cc86f`, `980f692`, `c65dba2`, `4fc6bf9` | the performance lane: latest-release tracking, browse and pin old versions, hardening, settings promotion | **port** on the card, **take** underneath |
| `2abc333` | profiles over local mods, inline profiles menu, modal stacking | **port** at the Modal, take everywhere else |
| `43ada4b`, `287f9b3`, `0aa9961`, `614c62d`, `3fa90ce` | merged-mods update detection, Global placement preservation, metadata safety, live download state, card tag taxonomy | take, mechanical |
| `4d09210` + `ae3e2df` + `4955f90` | macOS (CrossOver bottles, CI builds, auto-update) and flatpak publishing | **port** in release plumbing |
| `e84d128`, `58eae41` | release version commits | version line only |
| `cb28891` + `3585a9f` + `16bf56c` | ru catalog and manifest regenerations | generated or not shared |
| `d438c7e`, `71e032c` | flatpak metainfo repackages | not shared |
| `5c760c0` | Windows replay folder links and recovery | not shared |
| `17dba2e`, `29b7153`, `4b7d352` | nix flake, hash, and CI guard | not shared |

Every verdict below is decided at the level of the commit, never hunk by hunk.
Where both sides built the same thing, both implementations were read before
choosing.

## Decision 1: the Locker shuffle is the real work

At the merge base, `src/lib/lockerRandomizer.ts` already carried the skin
shuffle (pool keys, `VariantChoice`, `planRandomization`,
`planLaunchShuffle`). Each side then grew a different half of it:

- Ours added two more pools and their persistence: sound packs
  (`shuffleSoundKey`, `SOUND_SHUFFLE_INCLUDED_KEY`) and hero card sources
  (`shuffleCardKey`, `CARD_SHUFFLE_INCLUDED_KEY`, `planCardShuffle`), plus the
  include-vanilla switch. The matching UI is the Sound Locker shelves and the
  card shuffle controls in `HeroSkinsPanel.tsx`.
- Upstream (`c7eb8e7`) made the whole General section shuffleable and added
  user categories: a bucket axis keyed off a mod's effective global type
  (`shufflePoolKey`, `ShuffleGroupKind` of hero/bucket/priority,
  `summarizeShufflePool`, `prunePoolKeysForMod`,
  `writeStoredShuffleIncluded`), category management
  (`src/lib/lockerCategories.ts`, `ManageCategoriesModal.tsx`,
  `CategoryModPicker.tsx`, `ShuffleControls.tsx`), and, riding in through
  `00a1ee4`, local variant groups whose id now leads `shuffleSkinKey`.

These are not competing designs of one feature. They are disjoint extensions
of one file, which is why the conflict is four hunks deep rather than a
rewrite. That settles the resolution: **upstream's planner becomes the base,
and our two extra pools re-apply on top as the additive exports they already
are** (names upstream never defines). Taking their key order also fixes local
imports for us: leading `shuffleSkinKey` with `localGroupId` gives persisted
opt-ins a stable identity for non-GameBanana mods, something our chain does
not have.

The genuine adaptation: both sides rewrote `RandomizePlanOptions`,
`planRandomization`, and `planLaunchShuffle`. Our options must re-express
their grouping against upstream's `shuffleGroupKind` helper instead of keeping
our own derivation, otherwise the two axes drift apart on the next edit.

In `Locker.tsx` and `HeroSkinsPanel.tsx`, take upstream's category and
General-shuffle structure and re-apply our surfaces on top: the sound shelves,
card shuffle controls, broken-pose disclosure, derived pak descriptions, bulk
undo, and the consistency floor (real tablist wiring, the Escape contract,
result counts through `ResultSummary`, remembered view state through
`uiPrefs`). Most of the floor lives in its own modules already, so this is
call-site work, not algorithm work. `disabledModPrefs.ts` resolves to
upstream's side: their change adds the `localGroupId` key branch, ours was a
comment correction, and their comment supersedes it.

## Decision 2: performance config, same split as v1.26, one notch further out

Upstream spent the whole lane making the data side self-maintaining:
`ecc327e` tracks the latest upstream releases (`performanceLatest*.ts`,
`performancePresetGen.ts`), `11cc86f` lets the user browse and pin any
historical version (`VersionPicker.tsx`, `VersionHistoryModal.tsx`,
`src/lib/performanceHistory.ts`), `980f692` hardens the remote history fetch
and regenerates the data, and `4fc6bf9` promotes the configs into the
categorized Settings navigation. `performanceConfigData.ts` is still marked
GENERATED, and its eight conflicting hunks are pure regeneration drift between
two runs of the generator.

Rule 3 of the divergence policy already owns this split: preset data and the
applier's data model are upstream's, the card's surface is ours. So: **take
the entire service side, generator, pins schema, and version-history
components wholesale, then regenerate; keep the fork card surface** (staged
edits, per-value origin badges, HUD and advanced rows from
`performanceUserControls.ts` and the HUD ConVar paths in
`performanceConfig.ts`) **re-applied onto their card**, which now carries
`PresetSummary` credits, the track-latest toggle, and the pickers.

One adaptation has a decision inside it. Our pins file deliberately excludes
`citadel_unit_status_use_new` because the fork ships a real HUD toggle for it
(both values plus an origin badge) instead of a binary opt-in. Upstream has
since moved the whole `citadel_unit_status_` family behind a pattern
exclusion with per-key opt-ins in `GameplayOptIns`. Take upstream's
pattern-based pins schema, then re-route `use_new` and `use_v2` to the fork's
HUD toggle. Both sides agree on the rationale (a frame-rate preset must not
silently restyle health bars); only the control differs, and the control is
the differentiator. Likewise, `GameConvarsSection.tsx` stays in
`components/settings/sections/` as a fork-only sibling of whatever upstream's
promotion installs: upstream owns that tree's navigation, the section file is
a module they never define.

## Decision 3: the Escape contract absorbs upstream's modal stack

`2abc333` rewrote `src/components/common/Modal.tsx` on both sides. Upstream
kept inline key handling but added a module-level stack of open modals and an
`isTopmost()` guard applied to Escape and to the Tab trap, fixing two real
stacked-dialog bugs: one Escape press closing both layers, and the lower
dialog's Tab trap yanking focus out of the upper one. We routed the same
file's Escape through `useEscapeKey` during the consistency pass.

Their fix is better than anything we have; our rule is that there be exactly
one implementation. Resolution: **take upstream's `Modal.tsx` wholesale, then
move the stack guard into the shared contract**: `useEscapeKey` learns the
topmost test (or gains it from a sibling in the same module) so the dismissal
contract stays single. Do not ship two Escape implementations, one in the hook
and one inline in the component.

## The mechanical work

None of this needs judgment beyond patience.

- **Release plumbing** (`4d09210`, `ae3e2df`, `4955f90` in
  `.github/workflows/release.yml` and `electron-builder.yml`): take upstream's
  macOS matrix entries, CrossOver bottle support, and flatpak publish job;
  keep our fork pipeline steps on top (the pinned forked vpkmerge sidecar
  build, `GRIMOIRE_FORK_BUILD`, `verify-release-version`, filter-list
  refresh, optional mac signing environment).
- **Updater surfaces** (`updater.ts`, `UpdateModal.tsx`,
  `UpdatesSection.tsx`): take macOS auto-update support; keep the fork channel
  guard (`fc289ea`), stale-download pruning (`0d58441`), and the fork support
  link (`62ced59`). Without the guard, a packaged fork build updates itself
  into stock Grimoire.
- **`electron.vite.config.ts`**: the one outright keep. Upstream hardcodes
  port 5173 and adds `watch.ignored` for flatpak's chokidar ELOOP crash. The
  hardcoded port is exactly what our dev-slot configuration exists to prevent
  (slot-derived ports, `strictPort`), so ours stays and their ignore list
  folds in.
- **IPC surface** (`electron/preload/index.ts`, `src/types/electron.ts`,
  `src/lib/api.ts`): additive on both sides. Keep both, watch for duplicate
  channel names.
- **Main-process mods lane** (`ipc/mods.ts`, `services/metadata.ts`,
  `services/modMerger.ts`, `services/mods.ts`): upstream's fixes land; our
  Foundry identity gate and browser capture regions sit elsewhere in the same
  files and re-apply mechanically.
- **`src/stores/appStore.ts`**: both sides added state in different regions
  (ours: typed uiPrefs, shuffle state, path claims; theirs: categories,
  variant groups, download activity). Keep both sets.
- **`src/locales/en/translation.json`**: key by key, keep both sides.
- **Generated files** (`src/locales/manifest.json`,
  `electron/main/services/performanceConfigData.ts`,
  `scripts/performance-presets.json`): never hand-resolve. Regenerate
  (`pnpm i18n:manifest`, `pnpm perf:presets` after the pins re-entry).
- **`package.json`, `pnpm-lock.yaml`**: version line plus upstream's script
  entries; the lockfile is regenerated by `pnpm install`, never hand-merged.

## Sequence

1. Branch `absorb/upstream-v1.28` already exists and is checked out. The merge
   runs here, never on `main`.
2. `git merge upstream/main`. Resolve the mechanical files first: generated
   files by regenerating, prose, additive IPC surface, `translation.json`
   last. Leave the contested areas conflicted: the Locker pair, the
   performance lane, the Modal/settings promotion, release plumbing.
3. Second pass: the three decisions above, resolved at the level of the
   verdict, not the hunk.
4. Gates, all of them. Run the binaries directly, not through `pnpm`: the
   local pnpm is v11, this repo is pinned to v10 in CI, and v11's pre-command
   dependency check fails the run before the script executes.

       ./node_modules/.bin/tsc -b
       ./node_modules/.bin/vitest run
       ./node_modules/.bin/eslint .
       node scripts/check-i18n.mjs
       node scripts/check-encoding.mjs
       node scripts/check-upstream-refs.mjs

   Nine test files fail at the pre-merge baseline, 26 tests: the two
   `browserContentFilter` files, `browserDownloadCapture`, `foundryNonStandard`,
   `foundryTextureReplace`, `modinfoFormat`, `vpkIdentity`, `heroStageMode`,
   and `uiPrefs`. `tsc -b` exits 0 at baseline, so a type error after the merge
   is ours.

   > **Corrected 2026-09-01.** Do not quote this figure as a gate. A truth pass
   > on `main` measured 3 failing files / 26 failing tests, and found the number
   > is not absorbed debt at all: 25 of the 26 (`uiPrefs` 19, `heroStageMode` 6)
   > are Node 26 shadowing jsdom's `localStorage` with a native global that needs
   > `--localstorage-file`, which passes on CI's Node 20; the 26th is a genuinely
   > red `browserDownloadCapture` symlink-sweep case predating this absorption.
   > The six other files listed here already passed. **Both were fixed in Phase
   > 9.1 on 2026-09-01** and `vitest run` now exits 0 with 2436 passing; ledger
   > entries 4 and 5 in `.planning/WINDOWS.md` are closed. There is no baseline
   > of failing tests any more, so nothing here should be quoted as one.
5. Drive the real app from a numbered dev slot: Locker (user categories,
   General shuffle, sound and card pools), Installed (variants, inline
   profiles menu), Settings (promoted performance configs beside Game
   ConVars), the performance card (staged edits over the version picker), and
   dialogs stacked on dialogs. This is a human step, and per Rule 6a a missing
   smoke record means unverified, not blocked. An unattended agent records the
   surfaces it could not exercise and stops there; it does not treat the
   absence as a failure or invent the evidence.
6. Version bump as its own commit: `1.28.1`.

## Version

Upstream is `1.28.0`. We go to **`1.28.1`**, for the same reasons recorded in
the v1.26 absorption: it is valid semver and it sorts above upstream, and the
old four-digit counter stays retired, because a later `1.28.<counter>` would
sort above `1.28.2` and break update ordering.

## Verdicts

Per `docs/fork-divergence-policy.md`, each upstream commit touching a surface
we also touch gets one verdict with a reason.

| Commit | Verdict | Reason |
|---|---|---|
| `c7eb8e7` General shuffle + categories | **port** | both sides extended the same shuffle planner; their bucket axis and categories become the base, our sound and card pools re-apply on top |
| `877e2f1` centered empty states | **take** | small styling fix, agrees with our empty-state conventions |
| `00a1ee4` local mods as variants | **port** | variant-group machinery wins outright, we have no equivalent; our comment-only and shuffle-edge changes yield and re-apply |
| `ecc327e` track latest releases | **port** | services, generator, and regenerated data taken wholesale; our pins exclusion re-expressed, our card surface kept |
| `11cc86f` browse and pin versions | **port** | pickers and history modal taken wholesale; integration goes through our staged-edit flow |
| `980f692` harden remote history | **take** | service-layer hardening plus regenerated data; nothing of ours contested |
| `c65dba2` perf review findings | **port** | upstream's review fixes applied onto the merged lane without disturbing the fork card surface |
| `4fc6bf9` promote perf configs | **port** | upstream owns settings navigation and brings the promoted cards; our `GameConvarsSection` stays as a sibling fork module |
| `2abc333` profiles + local mods + modal stack | **port** | feature taken wholesale; their modal stack lands through our single Escape hook, and their vite watch fix folds into our dev-slot config |
| `43ada4b` merged mods source updates | **take** | collage-order fix and update detection we have no equivalent of; our floor edits re-home additively |
| `287f9b3` preserve Global placement | **take** | a real bug fix, no opinion of ours involved |
| `0aa9961` metadata wipe safety | **take** | a safety fix, no opinion of ours involved |
| `614c62d` live download state | **take** | ships as a new `downloadActivity` module; our prefs and floor lines coexist mechanically |
| `3fa90ce` installed card tags | **take** | upstream's taxonomy lib replaces ad-hoc labels; nothing of ours contests it |
| `4d09210` CrossOver and mac target | **port** | mac packaging and bottle-launch services taken; our release pipeline steps survive on top |
| `ae3e2df` macOS builds and auto-update | **port** | mac updater support taken; the fork channel guard, download pruning, and support link stay |
| `4955f90` flatpak from release workflow | **port** | their flatpak job taken into a workflow that keeps our fork publish pipeline |
| `3585a9f` ru manifest regen | **take** | generated file, regenerated after the merge |
| `e84d128` v1.27.1 release | **take** | version line only, superseded by our final bump |
| `58eae41` v1.28.0 release | **take** | version line only |
| `16bf56c` manifest refresh | **take** | generated file, regenerated |
| `cb28891` ru catalog | none | touches only `src/locales/ru/`, which this fork has never edited |
| `d438c7e`, `71e032c` flatpak metainfo | none | flatpak metadata only |
| `5c760c0` replay folders | none | `system.ts`, `launch.ts`, and the new replay modules are unshared |
| `17dba2e`, `29b7153`, `4b7d352` nix | none | flake and CI files this fork does not carry |
| `bf56e01`, `abf5b60`, `5cc6e33` merges | none | merge commits, no file content |

Ten ports, eleven takes, one outright keep (the `electron.vite.config.ts`
hunk inside `2abc333`, where the dev-slot configuration is the
differentiator), and ten commits with no shared surface. As in v1.26, there is
almost nothing upstream ships that this fork wants to refuse; the port
verdicts mark where our surface must be re-applied deliberately, not where the
merge will hurt. The two places duplicated intent actually accumulated are the
Locker shuffle planner and the Modal dismissal path, and both were read in
full on both sides before deciding.

## Resolution note: Locker.tsx landed as upstream, port deferred

Decision 1 called for taking upstream's category and General-shuffle structure
in `src/pages/Locker.tsx` and re-applying the fork surfaces on top, and judged
that call-site work. Resolving it showed the verdict was right about the
direction and wrong about the cost. The two sides are not one structure with
different call sites: the fork drives the view from a merged rail projection
(the `all` / `looks` / `sounds` sections, `railRows`, `selectedAllKey`,
`paneIsSounds`, and the roving-arrow tablist), and upstream drives it from a
tab model (`GeneralTabId`: the seven types, then Global, then user categories).
Seven of the file's seventeen hunks are that one disagreement, 270 fork lines
against 142 upstream lines, and both sides render the same subtree from their
own answer to "which pane is showing".

Splicing those hunk by hunk is the outcome this plan calls the worst available,
so the merge commit takes **upstream's `Locker.tsx` wholesale** and the fork
surface re-applies as a follow-up repair commit, which is the shape the
sequence already allows. What is absent between the merge commit and that
repair, and what the repair owes back:

- the Sounds section and the Sound Locker shelves, including the
  `shuffleKeyFor={shuffleSoundKey}` wiring that gives the sound pool its own
  namespace (`HeroSkinsPanel.shufflePropsFor` already honours the prop, so the
  re-application is a call site, not a rewrite)
- the merged rail projection and its zero-count row hiding (D-04)
- the roving arrow-key tablist on the section tabs
- `selectedAllKey`, and the null-until-picked landing tab, which upstream
  resolves in a state initializer and therefore reopens the empty-pane freeze
  the fork's comment describes
- derived pak descriptions (D-19) and the broken-pose disclosure

Nothing here is lost: the fork's implementation is the pre-merge file, at
`git show 54a609f:src/pages/Locker.tsx`.

Open question for the repair, raised by the maintainer and deliberately not
answered here: rather than reconciling the two views into one, the fork could
carry a toggle between upstream's tab model and the fork's rail. That is a
product decision with its own design and persistence questions, so it is
recorded as a candidate and not treated as the default.

### What the repair landed

The repair is one commit, `fix(locker): re-apply the fork's Locker surfaces
over upstream's tab model`. It reconciles the two views rather than building
the toggle.

Upstream keeps the shared surface, per rule 3: the `GeneralTabId` tab model is
the rail, every tab stays selectable whether or not it holds anything, and the
`all` / `looks` / `sounds` segmented control does not come back. The rail's
visual arrangement on its own was not a differentiator the fork could name, so
it was not defended, and `selectedAllKey` went with the section it served.

Everything the list above owed is back, over that base:

- The global sound categories are a fourth rail block behind their own
  divider, and a sound row's pane is `GlobalSoundShelf` plus its Forge button.
  They stay a separate block because they are classified from what a VPK
  writes, not from `globalType`, so the retag menu can never offer one as a
  move destination. D-04 applies to that block only: an empty sound row is
  hidden, while an empty type tab keeps the real empty state upstream gives it
  (an importer, an add-mods button, or a Browse hint).
- `shuffleKeyFor` at the hero card's call site, so the sound pool keeps its own
  namespace, and the header badge counts both pools again.
- The null-until-picked landing tab, replacing upstream's state initializer.
- `resolveLockerRoute`, the legacy Sound Locker rewrites, the Foundry `?hero=`
  handoff, and the hero drill-in's `?section=`. A legacy `?mode=sounds` link
  now lands on the first populated sound row.
- The name-keyed hero favorites shared with the Foundry grid, `readPref` /
  `writePref`, `useScrollRestore`, and `useEscapeKey`.
- The gallery card's overlay button and Sounds chip, the expanded card's
  roving tablist and tabpanel, derived pak descriptions (D-19), and the
  vanilla-shuffle switch.

The Global tile and the drill-in both count over classification, placement and
the sound taxonomy, by mod id, so a click through cannot change the number.

### What remains

- `src/lib/globalInventory.ts` is now reachable only from its own test.
  `globalInventoryRailRows` and `firstGlobalRailRowKey` projected the merged
  rail for a section, and there are no sections; `countGlobalInventoryMods` and
  `countGlobalInventoryCategories` predate the Global placement axis, so
  neither is the denominator any more. Deleting the module and its test is a
  separate change, not this repair's to make.
- `GLOBAL_VISUAL_MOD_TYPE_ORDER` in `lockerUtils` now has `globalInventory` as
  its only consumer and would go the same way.
- No manual smoke record. See the section below.

## Smoke record: 2026-08-24, not collected

Step 5 of the sequence is a human step. This absorption was finished by an
unattended agent on macOS with no game install to drive, so no smoke evidence
was collected. Per Rule 6a that reads as **unverified manually**, not blocked,
and it is not a reason to strand the reviewed change.

Automated evidence that *was* collected, on commit `8c90c37` at version
`1.28.1`: all six gates pass (`tsc -b`, `eslint .`, `check-i18n`,
`check-encoding`, `check-upstream-refs` all exit 0), and `vitest run` sits on
the documented pre-merge baseline of 9 failing files and 26 failing tests (see
the 2026-09-01 correction above: that baseline is mostly a Node 26 artifact), the
same nine files listed in step 4. No new failure.

Surfaces still owed a pass on real hardware:

- **Locker**, the surface this absorption's repair rewrote, and the one most
  worth a pass: the General drill-in's rail (the seven type tabs, Global, the
  restored sound rows, and user categories in one rail), the sound rows'
  shelf and Forge button, the General shuffle including the bulk pool button
  on a category tab, and the sound and card pools.
- **Locker routing**, which no unit test covers end to end: a Foundry
  `?hero=<name>` handoff, a legacy Sound Locker URL, and a
  `/locker/global?mode=sounds` link landing on the first populated sound row.
- **Installed**: variants, and the inline profiles menu.
- **Settings**: the promoted performance configs beside Game ConVars.
- **The performance card**: staged edits over the version picker.
- **Dialogs stacked on dialogs**, which is where upstream's modal stack and
  the fork's single Escape contract meet.

A specific failed record creates a focused follow-up; it does not reopen this
absorption.
