# Absorbing upstream v1.26.0

How this fork takes Slush97/grimoire's eleven commits through v1.26.0 without
losing the consistency pass, and why one of the eleven is a decision rather
than a merge. Read this before running the merge.

Status: planned, not started. Measured 2026-07-29 at `073e742`.

## Position

- `upstream/main` is at `1ebbe87` (v1.26.0). We are at `073e742`, version
  `1.25.1724`.
- Divergence: **11 behind, 142 ahead.** Merge base `1612680`.
- Upstream touches 47 files. We have also touched 24 of them. A trial merge
  (`git merge-tree`, no working tree involved) conflicts in **15**.
- Working tree is clean and `origin/main` is current, so the merge starts from
  a known point.

## What is coming in

| Commit | What it is | Cost to us |
|---|---|---|
| `8d3655f` | six pinned, selectable fps presets | **port, see below** |
| `60e36de` | categorized settings navigation | mechanical, but large |
| `869d639` | Performance Config discoverability + sync across panes | follows the decision |
| `56f4bd8` + `cb09587` | locker hero typeahead + its follow-up fix | small |
| `27ad7f8` | browse filters that did nothing on the local catalog route | small |
| `a4d3fd2` | sticky headers blended with app background | small |
| `e909c36` | sidebar scrollbar track when transparent | trivial |
| `7137432` | docs: side-by-side grimoire-social checkout | trivial |
| `79601f8`, `1ebbe87` | release commits | version line only |

## The one real decision: performance config

Both sides built the same feature independently. The evidence is that
`electron/main/services/performanceConfig.test.ts` conflicts **add/add**: each
side created that file from nothing. Conflicts follow through
`performanceConfig.ts`, `performanceConfigData.ts`, `ipc/performanceConfig.ts`,
`PerformanceConfigCard.tsx`, and `docs/performance-config-integration.md`
itself.

Upstream's `8d3655f` is substantially Phase 2 of the design recorded in
`performance-config-integration.md`: the id-keyed multi-preset applier, with
six pinned presets and a `scripts/gen-performance-presets.mjs` generator plus a
checked-in `scripts/performance-presets.json`. Our side reached a similar place
by a different route, and has HUD/advanced ConVar rows, staged edits, an
origin badge per value, and the preset-lean note from `073e742` that upstream
does not have.

**Decision: upstream's applier and data model are the base. Our work is
re-applied on top, additively.** The reason is the one the design doc already
gave: per-patch drift is only safe when someone upstream maintains the
manifest, and owning a second applier gives that up. It is also the cheaper
port, because the two sides grew in different files.

Where the value sits, by line count (shared base, then each side):

| File | base | ours | upstream |
|---|--:|--:|--:|
| `performanceConfig.ts` | 622 | 1065 | 860 |
| `performanceConfigData.ts` | 294 | 337 | **2720** |
| `PerformanceConfigCard.tsx` | 253 | **713** | 357 |

### Take from upstream, unchanged

- The data model in `performanceConfigData.ts`: `PRESETS`, `BASELINE`,
  `getPreset`, `PresetTier`, `PresetUpstream`, `DEFAULT_PRESET_ID`. This
  replaces our single-preset `PRESET_ID` / `PRESET_NAME` / `PRESET_VERSION` /
  `PRESET_SOURCE_URL` / `CONVARS` / `SECTION_OPS` constants.
- `scripts/gen-performance-presets.mjs` and `scripts/performance-presets.json`.
  The generated file is not hand-edited from here on.
- `listPerformancePresets` and the `list-performance-presets` IPC channel.
- `ApplyOptions`, so `applyPerformanceConfig` takes a preset id.
- `PresetPicker.tsx`, `GameplayOptIns.tsx`, and the `OptInControl` /
  `OptInGroup` types behind them.
- `electron/main/services/__fixtures__/stock-gameinfo.gi`.

### Re-apply on top, ours

All of these are names upstream does not define, so they collide with nothing:

- `setPerformanceHudConvars`, `setPerformanceAdvancedConvars`,
  `clearPerformanceConvars`, plus the `set-performance-hud-convars`,
  `set-performance-advanced-convars`, and `clear-performance-convars` channels.
- `HUD_CONVARS` and `ADVANCED_GAMEINFO_CONVARS`, which upstream has no
  equivalent of.
- The card's staged-edit flow, per-value origin badges, HUD toggle rows,
  advanced sliders, and the preset-lean note from `073e742`.

Both sides keep `applyPerformanceConfig`, `resetPerformanceConfigOverrides`,
`removePerformanceConfig`, `restorePerformanceConfigBackup`, and
`getPerformanceConfigStatus` under the same names, so the override/harvest and
wiped-detection layers survive either way.

### The one genuine adaptation

Our HUD and advanced paths assume a single preset: `presetValue` comes from one
flat `PRESET_CONVAR_VALUES` map built off the single `CONVARS` list. Under six
presets, `presetValue` has to be resolved against the *active* preset, and the
card's preset-lean note has to re-render when the picker changes presets. Same
for the sidecar: it already records an applied preset id, so the HUD/advanced
override comparison must read the active preset's value rather than a global.

Expect this to be the only place real thought is required, and expect
`performanceConfig.test.ts` (add/add, both sides wrote one) to need both sides'
cases merged rather than one side's kept.

### Doc follow-up

`docs/performance-config-integration.md` must be rewritten to describe what
actually shipped, since it currently describes the multi-preset applier as
unbuilt Phase 2 design. The "Do nothing for QOL Lock" decision at line 21 is
re-affirmed, not reversed: QOL Lock (650634) is still a plain VPK that the
normal mod pipeline handles.

## The mechanical work

None of this needs judgment, only patience.

- **`src/pages/Settings.tsx`** is the big one. Upstream `60e36de` split the
  1946-line monolith into `src/components/settings/sections/*` (eight sections
  plus `SettingsNav.tsx`). Our +325 lines were added to the monolith and have
  to be re-homed into the matching section files. Resolve by taking upstream's
  split wholesale, then replaying our additions section by section. Do not try
  to merge the two shapes.
- **`src/locales/en/translation.json`** conflicts across ~975 of our added
  lines. Resolve key by key, keep both sides' keys, then run
  `pnpm i18n:manifest`.
- **`src/locales/manifest.json`** is generated. Never hand-resolve it: take
  either side, then regenerate.
- **`src/pages/Locker.tsx`** conflicts, but upstream's typeahead landed mostly
  as a new `src/lib/lockerHeroTypeahead.ts` with tests, so the in-file conflict
  is smaller than the line count suggests. Apply `cb09587` with `56f4bd8`, not
  separately: the follow-up exists because the first one broke on merge.
- **`electron/preload/index.ts`**, **`src/types/electron.ts`** are additive IPC
  surface on both sides. Keep both, watch for duplicate channel names.
- **`package.json`** is the version line plus upstream's new script entry.
- **`CONTRIBUTING.md`**, **`README.md`** are prose.

## Sequence

The performance-config base is now decided, so the two halves can run as
separate passes on the same branch, mechanical first.

1. Branch: `git checkout -b merge/upstream-1.26`. Do not merge on `main`.
2. `git merge upstream/main`. Resolve the ten mechanical files in this order:
   generated files (regenerate), prose, additive IPC surface, `Settings.tsx`
   re-homing, `translation.json`. Leave the five performance-config files
   conflicted.
3. Second pass: performance config, per the decision above.
4. Gates, all of them: `pnpm lint`, `pnpm exec tsc -p tsconfig.app.json
   --noEmit`, `pnpm exec vitest run`, `pnpm i18n:check`, and
   `node scripts/gen-locale-manifest.mjs --check`.
5. Drive the real app for the surfaces the merge touched, since none of the
   gates cover rendering: Settings (every new section tab), Performance Config,
   Locker typeahead, Browse local-catalog filters, sticky headers.
   `GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev` then `scripts/dev-driver.mjs`.
6. Version bump, as its own commit: `1.26.1`.
7. Merge the branch to `main`, push, regenerate the locale manifest if step 4
   changed it.

## Version

Upstream is `1.26.0`. We go to **`1.26.1`**.

`1.26.0000000000000000001` was the first choice but it is not valid semver:
leading zeros are illegal in a numeric identifier, so `semver.valid()` returns
null and npm and electron-builder both reject it. `1.26.0+onionviolet.1` and
`1.26.0-grimoire.1` are valid but neither sorts above `1.26.0`, which breaks
electron-updater's comparison. `1.26.1` is valid and sorts above `1.26.0`.

Note that this drops the four-digit counter used at `1.25.1723` and
`1.25.1724`. That is fine going forward, but it means the next patch after this
one is `1.26.2`, not a counter continuation: do not reintroduce `1.26.1725`
later, because it would sort *above* `1.26.2` and break update ordering.

The bump lands as its own commit on the merge branch (step 6), not before the
merge, so `main` never claims a version it has not absorbed.

## Why now rather than after the next lane

Upstream `60e36de` adds nine settings surfaces and `8d3655f` adds a
`PresetPicker`. Those are exactly the targets of the consistency pass's Lane 8
floor (Escape contract, real tablist wiring, one result-count convention) and
Lane 10's copy vocabulary. Absorbing after the remaining lanes means running
those lanes a second time over the newly merged surfaces. Merging first means
each sweep covers the union once.
