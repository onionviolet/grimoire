---
title: Saving and swapping mod profiles
description: Save your current loadout as a named profile and switch between setups without reinstalling anything.
slug: profiles
order: 18
updated: 2026-07-29
---

# Saving and swapping mod profiles

A profile is a saved list of which mods you have **enabled**, in what order. Create one from your current setup, then apply it later to get that setup back.

Profiles store no mod files, only references, so they cost nothing on disk and switching is fast.

## Creating one

Type a name into **Create New Profile** and click **Create Profile**. It captures whatever is enabled right now.

The card immediately shows **Active**. That means "this is the last profile you created or applied", not "your install currently matches this". Nothing was written to your game.

## What a profile remembers

| Captured | Not captured |
|---|---|
| Which mods are enabled | Disabled mods |
| Their load order | The mod files themselves |
| Your console commands from `autoexec.cfg` | Locker cards, ability sounds, and colors |
| Your crosshair, if you tick **Include current crosshair** | Anything from Settings |

Two of those surprise people.

**Only enabled mods are recorded.** There is no "off" entry, so a disabled mod simply is not in the profile.

**Console commands are always captured**, with no checkbox. Applying an old profile writes its commands back, which can quietly revert console settings you changed since. The crosshair is the opposite: opt-in at create time only, and you cannot add one to an existing profile later.

**Locker cosmetics are invisible to profiles.** Hero cards and ability sounds are never saved and never disabled by applying one. See [what the Locker is](./locker.md).

## Applying one

Click **Apply** on the profile you want. **Re-apply** is the same button on the profile already marked active.

Applying is not additive. **Any mod you have enabled that is not in the profile gets disabled.** That is the point of a profile, but it catches people who expect it to just add things.

Grimoire takes an automatic snapshot first, so a wrong apply is recoverable. See [snapshots](./snapshots.md).

Two things can go wrong:

- **The game is running.** If Deadlock has any of the mods that need to move currently loaded, the whole apply is refused before anything changes. Close the game and retry.
- **Some mods will not budge.** Individual mods locked by another process are skipped and counted, and Grimoire tells you how many. The rest of the profile still applies.

A profile entry whose mod is no longer installed is skipped silently. Applying does not download anything, so a profile can quietly apply smaller than you expect.

## Update is not Apply

These sit next to each other and do opposite things.

- **Apply** overwrites *your install* from the saved profile.
- **Update** overwrites *the saved profile* from your install.

**Update** has no undo, which is why it asks for confirmation. You can turn that prompt off in **Settings > Preferences**.

## Renaming and deleting

The pencil icon renames in place. The trash icon deletes after a confirmation.

**Deleting a profile does not uninstall anything.** Your mods stay exactly as they are; you just lose the saved list.

## Seeing what is inside

The chevron expands a card to show every mod in the profile, its console commands, and its crosshair if it has one.

If a profile has a crosshair you no longer want, **Remove** in that expanded section drops just the crosshair and leaves everything else alone.

## Sharing

Profiles can be exported as a share code or a file, and published to Discover if you are signed in. See [sharing a profile](./profiles-sharing.md).
