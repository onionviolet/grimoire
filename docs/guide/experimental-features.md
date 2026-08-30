---
title: Experimental features
description: The nine optional features hidden behind toggles, what each one unlocks, and which are safe to turn on.
slug: experimental-features
order: 24
updated: 2026-08-30
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
| **Fix Unknown Mods** | Matches unknown local VPKs against GameBanana to recover their names and thumbnails |
| **Imprint installed mods** | Embeds a small identity marker in your mods so an orphaned file can be recognized later |
| **Deadworks Servers** | A **Servers** tab for browsing and joining community servers. See [Deadworks community servers](./servers.md) |
| **Door Stuck** | An asset workshop for browsing the game's files and swapping hero sounds. See [replacing a hero's sound](./door-stuck-sounds.md) |
| **In-app browser** | A **Browser** tab for mod sites. Pages run isolated from the app, and downloads and popups are handed to your real browser. See [browsing mod sites](./browser.md) |
| **Chat Wheel** | A **Chat Wheel** tab for building ChatLane chat wheels and installing them as managed add-ons. See [building a custom chat wheel](./chat-wheel.md) |

Most of these add a tab to the sidebar. Turn one on and the tab appears immediately.

Performance presets are **not** on this list. They used to be, and older writing still says so. They now have a permanent home at **Settings > Game > Performance**, with no toggle to find first. See [performance presets](./performance-presets.md).

## Which to turn on

**Safe and genuinely useful.** Crosshair Designer is well worn and does something most players want.

**Useful with a caveat.** Stats and Grimoire Social both talk to services over the internet. Grimoire has no telemetry and neither of these changes that, but they are the only parts of the app that make network requests about you, so they stay off unless you ask. Turning Grimoire Social on also starts a background check for new Discover uploads every couple of minutes; [privacy](./privacy.md) has the detail.

**Situational.** Fix Unknown Mods is worth turning on once if you have a pile of mystery VPKs from another manager, then turning off. It queries GameBanana for each unknown mod, so a large library can hit rate limits.

Imprint installed mods only matters if you expect to move VPK files between machines or lose your Grimoire database.

Deadworks Servers is only useful if you want to play on community servers.

The In-app browser is a convenience, not a feature: it saves you alt-tabbing to find a mod. It deliberately cannot install anything by itself, and hands every download to your real browser.

**Rough.** Door Stuck is an asset browser with one real feature (swapping a hero's sound for your own audio). Most of it is look-only.

Chat Wheel is the newest of these. It has a visual editor and a live preview, so you do not need to write YAML, but it does assume you know what a chat wheel is for.

## One confusing bit

**Door Stuck has no description**, and the tab it adds is also called Door Stuck. It is an asset workshop. There is no explanation of it in the app at all.

## Developer Mode

Below the feature toggles. It points Grimoire at a dummy folder instead of your real Deadlock install, for testing without game files.

**You almost certainly do not want this.** It disables the real game path, so everything looks broken while it is on. If Grimoire has stopped seeing your game, check whether this got switched on.
