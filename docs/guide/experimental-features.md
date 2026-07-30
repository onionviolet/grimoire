---
title: Experimental features
description: The eight optional features hidden behind toggles, what each one unlocks, and which are safe to turn on.
slug: experimental-features
order: 22
updated: 2026-07-29
---

# Experimental features

A lot of Grimoire is switched off by default. If you have read about a feature and cannot find it, it is almost certainly here: **Settings > Experimental Features**.

Experimental means still in development and possibly rough. None of these will damage your install, and every one can be turned back off.

## What each toggle unlocks

| Toggle | What you get |
|---|---|
| **Stats Dashboard** | A **Stats** tab with ranked score, match history, and hero performance. See [player stats](./stats.md) |
| **Crosshair Designer** | A **Crosshair** tab for building custom crosshairs. See [designing a crosshair](./crosshair.md) |
| **Grimoire Social** | A **Discover** tab for publishing profiles and browsing other players' uploads, plus Steam sign-in in Settings |
| **Deadworks Servers** | A **Servers** tab for browsing and joining community servers |
| **Performance Config** | Community fps presets. The controls appear under **Game setup**, not here. See [performance presets](./performance-presets.md) |
| **Fix Unknown Mods** | Matches unknown local VPKs against GameBanana to recover their names and thumbnails |
| **Imprint installed mods** | Embeds a small identity marker in your mods so an orphaned file can be recognized later |
| **Door Stuck** | An asset workshop for browsing the game's files and swapping hero sounds. See [replacing a hero's sound](./door-stuck-sounds.md) |

Most of these add a tab to the sidebar. Turn one on and the tab appears immediately.

## Which to turn on

**Safe and genuinely useful.** Crosshair Designer and Performance Config are both well worn and do something most players want.

**Useful with a caveat.** Stats and Grimoire Social both talk to services over the internet. Grimoire has no telemetry and neither of these changes that, but they are the only parts of the app that make network requests about you, so they stay off unless you ask.

**Situational.** Fix Unknown Mods is worth turning on once if you have a pile of mystery VPKs from another manager, then turning off. It queries GameBanana for each unknown mod, so a large library can hit rate limits.

Imprint installed mods only matters if you expect to move VPK files between machines or lose your Grimoire database.

Deadworks Servers is only useful if you want to play on community servers.

**Rough.** Door Stuck is an asset browser with one real feature (swapping a hero's sound for your own audio). Most of it is look-only.

## Two confusing bits

**Performance Config puts its controls somewhere else.** The toggle is here, the card is under **Game setup**. Toggling it looks like it did nothing until you follow the link.

**Door Stuck has no description**, and the tab it adds is also called Door Stuck. It is an asset workshop. There is no explanation of it in the app at all.

## Developer Mode

Below the feature toggles. It points Grimoire at a dummy folder instead of your real Deadlock install, for testing without game files.

**You almost certainly do not want this.** It disables the real game path, so everything looks broken while it is on. If Grimoire has stopped seeing your game, check whether this got switched on.
