---
title: Launching modded or vanilla
description: Start Deadlock with your mods on, or start a clean session without uninstalling anything.
slug: launching
order: 5
updated: 2026-07-29
---

# Launching modded or vanilla

Use the two buttons at the bottom of the sidebar. **Launch Modded** starts Deadlock with your enabled mods active. **Launch Vanilla** starts it clean, without touching your setup.

Both launch through Steam, so Steam needs to be running.

If the buttons say to configure your Deadlock path first, go to [first-time setup](./first-run.md).

## Launch Vanilla

Vanilla is for when you want an unmodified game for one session: a scrim, a bug you want to confirm is not a mod, or a clean look at something.

Here is what actually happens:

1. Grimoire moves your enabled mods out of the addons folder and holds them.
2. Deadlock launches.
3. Once the game is up, Grimoire moves them back automatically.

Your mods, your load order, and your profiles are untouched. Nothing is uninstalled and nothing is renumbered.

Because the restore happens after the game starts, the running session stays vanilla for its whole lifetime. You do not have to close the game to get your mods back.

## If a vanilla session gets stuck

If Grimoire closed or crashed between stashing and restoring, your mods are still stashed and the sidebar will say a vanilla session is already active.

Click **Launch Modded**. It restores the stashed mods first, then launches. You can also just switch back to modded to restore them without launching.

## Stop Game

**Stop Game** ends the running Deadlock process from inside Grimoire. Useful when the game has stopped responding.

## Mods are enabled, but the game is unmodded

That is almost always `gameinfo.gi` rather than anything about launching. See [fixing mods that do not load](./troubleshooting.md).
