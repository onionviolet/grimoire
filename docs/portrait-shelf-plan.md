# The portrait shelf: give Cards what Sounds just got

Not a new locker. The Locker hero page's **Cards** section is already the right
home for hero card / portrait art; it is simply missing the installed-content
half that the Sound Locker just gained, and one of its controls lives in the
wrong surface.

**Read first:** [sound-locker-plan.md](./sound-locker-plan.md) (the shape this
mirrors), [locker-foundry-parity-plan.md](./locker-foundry-parity-plan.md) (the
thesis), and the Pass 2 section of
[chat-wheel-radial-and-portraits-tab-plan.md](./chat-wheel-radial-and-portraits-tab-plan.md)
(items 1, 3, 4 and 5, which this closes).

Same invariant as every other lane: **exact normalized VPK entry paths are the
ownership key. Labels, hero names, and variant tokens are never a substitute.
Installed/Locker remains the only authority for enabled state.**

## Why no `/locker/portraits` route

Sounds earned a separate surface for two reasons that portraits do not share:

- A sound mod can carry files for several heroes at once, so it needs to appear
  on more than one shelf.
- A large share of sound content has **no hero at all** (announcer packs,
  killstreak music, UI sounds) and therefore had nowhere to live.

Portrait art is always hero-scoped (`panorama/images/heroes/<codename>_*`), and
the Locker already has a per-hero Cards section. A `/locker/portraits` route
would be the Cards section plus an extra click. So this plan adds to
`HeroCardPicker` rather than building beside it.

## Ground truth (read from the working tree, 2026-07-29)

- `src/components/locker/HeroCardPicker.tsx` shows the installed mods' portrait
  art via `getHeroPortraits(heroName)`, which returns `HeroPortrait[]` already
  grouped-able by `modFileName` (a folder-relative metaKey, round-tripped back
  into `applyHeroCard`). It knows the family (`card`, `vertical`,
  `card_critical`, `card_gloat`, `minimap`, `small`, `other`) and warns on
  partial coverage through `portraitFamilyCoverageGap`.
- `getCustomCardSlots` returns `CustomCardSlot[]`, each carrying `entry`: **the
  exact `.vtex_c` VPK entry path** that variant replaces. That is the ownership
  key this whole plan needs, and it already exists on the Locker side.
- The per-card launch-shuffle opt-in is already in `HeroCardPicker`
  (`cardShuffleIncluded` + `shuffleCardKey(heroName, sourceFileName)`).
- **Forged** portrait changes randomize through a different mechanism in a
  different surface: `foundryShuffleIncluded` + `foundryShuffleKey(mod)` +
  `groupFoundryShufflePools`, rendered by `ChangePools`/`FoundryPoolList` inside
  Foundry's *My changes*. That is a manage-what-you-have control living in the
  make-more-of-it surface.
- `foundryInspectAssetSources(paths)` answers "who writes these exact entries
  and who wins each" and is already used by `MySoundChanges`,
  `AssetSourcesPanel` and the new `SoundEntryRow`.
- `VARIANT_LABEL` in `HeroCardPicker` still shows `minimap` / `small` as raw
  tokens because their in-game role was never verified (Pass 2 item 1).

## Lanes

Sequential. Lane 1 is the read model the rest render.

### Lane 1 - portrait inventory model (pure, tested)

New `src/lib/portraitInventory.ts`, the visual sibling of
`src/lib/soundInventory.ts`. Folds `Mod[]` into per-hero portrait entries.

Sources, all already on `Mod`:

| signal | gives |
| --- | --- |
| `textureReplacement` (`entryPath`, `category`, `heroName`) | a one-entry forged portrait/icon replacement |
| `foundryBuild` recorded entries | a multi-part forged build's exact write set |
| `lockerCosmetics` card selections | what the Locker's managed cosmetics VPK currently applies, per hero |

Entry shape mirrors `SoundInventoryEntry`: `key`, `modId`, `metaKey`, `name`,
`enabled`, `priority`, `hero`, `variants` (from the entry path's variant token),
`paths` (exact `.vtex_c` entries), `provenance`
(`locker`/`forged`/`downloaded`/`imported`/`third-party`), `managed`.

Two rules carried over verbatim, because they are what made the sound model
honest:

1. An entry whose paths are unrecorded reports `paths: []` rather than a guess.
   `getHeroPortraits` can name which mods ship art for a hero but not which
   exact entries they write; that is a lane 2 resolution step, not an inference
   here.
2. `overlappingClaims` counts only **enabled** entries with **recorded** paths,
   so it can only under-report. `foundryInspectAssetSources` stays the
   authority.

Tests beside it in `portraitInventory.test.ts`, same coverage shape as
`soundInventory.test.ts` (multi-signal fold, alias collapse, disabled claimant
ignored, no-overlap-from-unknowns).

### Lane 2 - the Cards section learns what it is competing with

**Depends on lane 1.** All inside `HeroCardPicker`.

1. Group the `HeroPortrait[]` tiles by `modFileName` (the component already has
   `PortraitFileGroup` for this) and badge each group with its provenance and
   its enabled state, joined from the inventory by metaKey.
2. Per group, an expander that answers ownership the way `SoundEntryRow` does:
   feed `foundryInspectAssetSources` the family's exact entries (from
   `getCustomCardSlots`, which already carries `entry` per variant) and show the
   winner per variant, with a jump to the winning mod. This is the reverse view
   Pass 2 item 5 asks for, on the surface that already has the entry paths.
3. A section-level note when two enabled mods claim the same card entry, from
   `overlappingClaims`. Same under-report-only contract.
4. Keep the existing coverage-gap warning exactly as it is. It answers a
   different question (did *you* fill the family) and must not be merged with
   the ownership readout (does someone *else* own it).

No new IPC. Every call in this lane is one an existing surface already makes.

### Lane 3 - one home for portrait randomization

**Depends on lane 2.** The smallest lane and the one that fixes a real
misplacement.

Today a user randomizing portraits has two unrelated controls in two surfaces:
`cardShuffleIncluded` in the Locker's Cards section, and `foundryShuffleIncluded`
in Foundry's My changes pool view.

1. Surface the forged-portrait pools **in the Cards section**, next to the card
   shuffle toggle: reuse `groupFoundryShufflePools` + `foundryShuffleKey` filtered
   to this hero's portrait entries. Reuse, not a second mechanism: the store
   field, the key function, and the launch-time roll all stay exactly as they
   are.
2. Leave the My changes pool view in place. It is the cross-hero view of the
   same data and Foundry users rely on it; this lane adds the per-hero window,
   it does not move the feature.
3. State the contract inline the way My changes already does: opting one change
   into a pool makes that whole contended-path group exclusive at launch.

Do **not** invent the "shuffle group" field Pass 2 item 4 speculated about. The
pool partition over contended paths already groups exactly the right things, and
a second grouping concept would have to be kept in sync with it forever.

### Lane 4 - variant label honesty

**Independent of the others; can be done any time.** Pass 2 item 1.

`minimap` and `small` still render as raw tokens in `VARIANT_LABEL` because
nobody verified where they appear in game. Verify empirically (build a portrait
family with a distinguishable image per variant, install it, and look), then
give each an honest label with the raw token in a `title` tooltip. If a variant
turns out not to render anywhere the user can see, say that instead of naming a
surface it does not have.

## What this deliberately does not do

- **No `/locker/portraits` route.** See above.
- **No second randomization mechanism.** Lane 3 surfaces the existing pools in a
  second place; it does not add a second concept.
- **No ownership inference from variant tokens.** A token orders the strip and
  labels a chip. The entry path decides who owns what.
- **It does not touch `prepareVisualStagedEdit` or the forge path.** There is one
  install path and this plan does not add a second.

## Running this

The ready-to-paste opening message lives in
[portrait-shelf-prompt.md](./portrait-shelf-prompt.md).

## Verification

```bash
GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev
```

```bash
node scripts/dev-driver.mjs route locker
```

Close the installed Grimoire first (single-instance lock) and relaunch it after.
Drill into a hero with more than one installed portrait mod, open Cards, and
check with `text`/`html` that the winner readout names the same mod the
Conflicts page does for the same entry. Gates: `pnpm exec vitest run`,
`pnpm lint`, `pnpm i18n:check`.