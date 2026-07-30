---
title: Setting up Grimoire for the first time
description: Point Grimoire at your Deadlock install and let it configure the game so mods will load.
slug: first-run
order: 1
updated: 2026-07-29
---

# Setting up Grimoire for the first time

Open Grimoire and work through the two steps in the welcome screen. It finds Deadlock on its own in most cases, and the only thing you have to do is click **Fix** when it asks.

Grimoire needs Deadlock installed through Steam.

## Step 1: Deadlock Location

Grimoire auto-detects your Steam library and shows **Detected** with the path.

If it shows **Not Found**, click **Select Deadlock folder** and browse to it yourself. You want the folder that contains a `game` directory, usually:

- Windows: `C:\Program Files (x86)\Steam\steamapps\common\Deadlock`
- Linux: `~/.steam/steam/steamapps/common/Deadlock`

If Deadlock is on a second drive or a non-default Steam library, that is the usual reason auto-detect misses.

## Step 2: Game Files

This step checks two files.

**gameinfo.gi** controls whether Deadlock loads mods at all. If it reads **Needs Setup**, click **Fix**. Without this, mods install correctly and then do nothing in game.

**autoexec.cfg** is optional. It holds console commands that run when the game starts, and the Crosshair and Autoexec tabs write to it. Click **Create** if you want those, or skip it. If you already have one, Grimoire leaves your settings alone.

Click **Get Started** when both are set.

## Changing any of this later

Everything above lives in **Settings > Game Configuration**. You can re-run auto-detect, pick a different folder, or click **Fix Configuration** again at any time.

If Deadlock updates and mods stop loading, coming back here and clicking **Fix Configuration** is the first thing to try. See [fixing mods that do not load](./troubleshooting.md).

## What Grimoire writes to your disk

So you know what it touched:

- Mods go in `game/citadel/addons` inside your Deadlock folder, as numbered `pak01_dir.vpk` files. Disabled mods move to a `.disabled` subfolder rather than being deleted.
- `game/citadel/gameinfo.gi` gets a Grimoire-managed block that tells the engine to load those addons.
- `game/citadel/cfg/autoexec.cfg`, only if you asked for it.

Nothing is sent anywhere. Grimoire has no telemetry and a fresh install phones home for nothing.
