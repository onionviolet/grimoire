---
title: Fixing mods that do not load
description: The first thing to try, what a Deadlock update breaks, and how to handle the common failures.
slug: troubleshooting
order: 7
updated: 2026-07-29
---

# Fixing mods that do not load

Go to **Settings > Game Configuration** and click **Fix Configuration**. That resolves most cases. Then restart Deadlock fully.

Grimoire also shows a banner with a **Fix now** button when it spots the problem on its own.

## Why this is almost always the answer

Mods live in your addons folder, but the game only looks there because of a block Grimoire writes into `game/citadel/gameinfo.gi`. Installing a mod puts the file in place. It does nothing until `gameinfo.gi` says to load it.

Anything that rewrites or replaces that file breaks mod loading while leaving every mod looking perfectly installed in Grimoire. **Fix Configuration** writes the block back.

## After a Deadlock update

Game updates regularly overwrite `gameinfo.gi`. If mods vanished right after patch day, that is why. Run **Fix Configuration**.

Note that a patch can also genuinely break a mod, especially a hero skin, if Valve changed that hero's model. If **Fix Configuration** brings back every mod except one, the mod itself needs an update from its author.

## After verifying game files in Steam

Same cause. Verifying restores `gameinfo.gi` to Valve's version. Run **Fix Configuration** afterward.

## If gameinfo.gi is missing entirely

Grimoire will say so, and will list any similarly named files it found nearby (a `.bak`, for instance). Rename one back to `gameinfo.gi` to restore it.

If there is nothing to restore: in Steam, right-click Deadlock > **Properties** > **Installed Files** > **Verify integrity of game files**, then run **Fix Configuration**.

## If you also use another mod manager

Two managers editing `gameinfo.gi` will overwrite each other's block, and whichever ran last wins. Running **Fix Configuration** restores Grimoire's.

Pick one manager for a given install rather than alternating.

## "GameBanana is rate-limiting Grimoire"

Too many requests in a short window, usually from queueing a lot of downloads at once. Wait a minute and retry. Nothing is broken and nothing is lost.

## Leftover files in the addons folder

**Settings > Maintenance > Cleanup Addons Folder** removes leftover archive downloads (`.zip`, `.7z`) that were unpacked but not cleaned up. It does not touch your mods.

## Something else

Open an issue at [github.com/Slush97/grimoire/issues](https://github.com/Slush97/grimoire/issues) or ask in [Discord](https://discord.gg/KgYGHEMq2P). Include your OS and what you were doing when it broke.
