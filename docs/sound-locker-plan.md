# The Sound Locker

A Locker-style home for the sounds you already have: a hero grid plus a Global
shelf, per-hero pages that list your installed sound mods grouped by
ability / voice / weapon, audition from the mod's own VPK, enable/disable, and
the same "only one mod should own an event" awareness the Foundry sound-conflict
inspector has.

**Read first:** [locker-foundry-parity-plan.md](./locker-foundry-parity-plan.md)
(the thesis: Locker manages what you have, Foundry makes more of it) and the
Pass 2 section of
[chat-wheel-radial-and-portraits-tab-plan.md](./chat-wheel-radial-and-portraits-tab-plan.md)
(items 2 and 5: sound text quality, and making installed content a first-class
browse axis).

The invariant is unchanged from every other lane: **exact normalized VPK entry
paths are the ownership key. Labels, hero names, and classification counts are
never a substitute. Installed/Locker remains the only authority for enabled
state.**

## Why a new surface rather than a bigger picker

`HeroSoundPicker` already lives on the Locker hero page and it is good at one
job: choosing, per ability slot, which installed mod supplies that ability's
clips. It is a *select*, and everything it renders is scoped to the four ability
slots the deadlock-api roster reports.

What it cannot answer:

- What sound mods do I have at all? (Anything not tied to one ability slot lands
  in a single "Other" bucket with no structure.)
- What does this mod actually change? (The write-set disclosure is per slot, not
  per mod, and only for the slot you opened.)
- What do my global sound mods do? (Announcer packs, killstreak music, UI packs
  have no home at all: they sit on the Locker's Global card as name-only rows.)
- Which of my sound mods is actually winning in game?

So the Sound Locker is the *inventory* surface and the picker stays the
*selection* surface. The Sound Locker links into the picker (the hero page's
Sounds section) rather than reimplementing it, and the picker is untouched.

## Scope

### 1. Inventory model (pure, tested)

`src/lib/soundInventory.ts`. Folds `Mod[]` into a sound inventory.

One entry per **(mod, hero)** pair, not per mod. A sound mod can carry files for
several heroes (usually a dominant hero plus a stray copy-pasted file, which is
exactly why `AbilitySoundClassification.perHero` is a list), and such a mod must
appear on every hero page it touches. A mod with no hero produces exactly one
global entry, so "one entry per mod" holds for everything that is not
multi-hero.

Each entry carries:

| field | source |
| --- | --- |
| `modId`, `metaKey`, `name`, `enabled`, `priority` | the mod |
| `hero` (canonical display name, null for global) | `abilitySounds.perHero`, `lockerHero`, `soundSwap.reforge.heroName`, `lockerSounds.sounds[].heroName` |
| `scope` (`hero` \| `global`) | derived |
| `categories` (`ability` \| `voice` \| `weapon` \| `music` \| `announcer` \| `ui` \| `other`) | slots/VO counts from the classification, event and clip-path shape for forged swaps, `getEffectiveGlobalType` for global mods |
| `slots` | `perHero.slots` |
| `events` | `soundSwap.event` where a swap recorded one |
| `paths` | `soundSwap.reforge` assignments/clipPaths, `lockerSounds.sounds[].clipPaths` |
| `fileCount` | `perHero.total`, else the recorded path count |
| `provenance` | `locker` \| `forged` \| `downloaded` \| `imported` \| `third-party`, the same ladder `foundrySoundConflicts.ts` uses |

Untagged third-party sound VPKs (no GameBanana section, no classification) are
**not** dropped: they become global entries with category `other` and provenance
`third-party`, because "I do not know what this writes" is a thing the surface
must be able to say. A mod that is neither a sound mod nor sound-adjacent
produces no entry at all.

The Locker-managed sound VPK (`lockerSounds`) is included on purpose, one entry
per hero it covers, flagged `managed`. It is the mod that actually wins in game
for every ability the picker applied, so hiding it would make the ownership
readout a lie.

Tested beside it in `soundInventory.test.ts`.

### 2. The surface

`src/pages/SoundLocker.tsx`, routed at `/locker/sounds` with
`/locker/sounds/hero/:hero` and `/locker/sounds/global` drill-ins, plus a
`?hero=` query that resolves to a hero page (the same contract `Locker.tsx` and
`Foundry.tsx` already honour for their inbound links).

Heroes are keyed by **name**, not by GameBanana category id. The Locker keys its
routes by category id because its grid is built from the GameBanana category
tree; the sound inventory has no such dependency (`HERO_NAMES_SORTED` is enough),
and every inbound link already speaks names.

- **Grid**: one card per hero with a sound-mod count and an enabled count, plus
  a Global card, mirroring the Locker grid's layout and its "hide empty" filter.
- **Hero page**: `HeroDetailFrame` (the shared chrome from parity lane 1) with
  sections `Abilities`, `Voice`, `Weapon`, `Other`. Each section lists the
  entries whose categories include it.
- **Row**: name, provenance chip, slot chips, enable/disable, and an expander
  that resolves the entry's exact write set and reports the runtime winner per
  path via `foundryInspectAssetSources`, the same call `MySoundChanges` uses.
  Write sets come from `getHeroSoundWriteSet(hero, slot, metaKey)` for
  classified ability mods and from the recorded `soundSwap.reforge` for forged
  ones. No new IPC.
- **Audition**: `useClipPlayer`, extended with an optional `sourceModId` on the
  playable clip. With it the player resolves through `foundryAuditionSourceClip`
  (the clip inside *that mod's* VPK); without it, nothing changes and it keeps
  reading the base game via `foundryVoiceclip`. That is the difference between
  "what does the game ship" and "what do I actually hear", and this surface is
  about the second one.
- **Conflict awareness**: a section-level note when two enabled entries claim
  the same path, phrased from the winner readout rather than from labels.

### 3. Cross-links

- Hero page section header links to the matching Foundry surface:
  `/foundry?hero=<name>&section=abilities` and `&section=voice` (the existing
  `?section=` deep link).
- The Global shelf links to Foundry's Global sounds tool. Foundry's catalog
  sub-tools had no deep link, so `Foundry.tsx` gains a `?tool=` query beside its
  `?hero=`/`?section=` ones.
- Foundry's `My changes` gains an "Open in Sound Locker" link beside its
  existing "Open in Locker", per hero group and for the unscoped group.
- The Locker page header gains a Sound Locker entry, and the Locker hero page's
  Sounds section links across.

### 4. Label quality

`src/lib/soundLabels.ts`, pure and tested:

- `collapseTakes(events)` folds `attack_01` / `attack_02` / `attack_03` into one
  row with a take count. Applied where events are **listed for information**
  (this surface). Deliberately *not* applied to the Foundry browse lists: a
  browse row is a swap target, and collapsing three swappable events into one
  row would make two of them unreachable. The Pass 2 note about search results
  triplicating is real, but the fix there is a search-result grouping, not a
  row merge, and it is not this lane.
- `preferredSoundLabel(annotation, fallback)` puts a personal `SoundAnnotation`
  name ahead of the catalog label. `SoundRow` adopts it too, so an annotated
  event reads by its own name in the Foundry browsers as well, instead of only
  when the Annotate toggle is on.

## What this deliberately does not do

- **It does not move or reimplement `HeroSoundPicker`.** Selection stays where
  it is; the Sound Locker links to it.
- **It does not add a sidecar service.** Every number it shows comes from data
  already on `Mod` or from an IPC call an existing surface already makes.
- **It does not infer ownership from labels.** Where a write set is unknown the
  row says so instead of guessing.
