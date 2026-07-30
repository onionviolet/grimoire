---
title: Deadworks community servers
description: Browse community dedicated servers, let Grimoire fetch whatever content they need, and join through Steam.
slug: servers
order: 24
updated: 2026-07-29
---

# Deadworks community servers

The **Servers** tab lists Deadworks community dedicated servers. Pick one, click **Join**, and Grimoire downloads whatever custom content it needs before handing you to Steam.

Turn it on in **Settings > Experimental Features > Deadworks Servers**. You need your Deadlock path set first.

Joining works on Linux and Windows equally. Only *hosting* a server requires Windows.

## The list

Each row shows the server name, region, current map, players, whether it is password protected, how many custom content items it needs, and a live ping.

**That ping is measured by your own machine**, not reported by the list. Which means your computer sends a packet directly to every server shown, on load and on every refresh. **Server operators can see your IP address before you ever join one.** Nothing in the app says so, so it is worth knowing.

Filter by name or map, by region, and by whether the server has space.

## Joining

1. Click **Join**. Grimoire checks what content the server needs.
2. If it needs custom maps or addons, they download and unpack, with progress.
3. Grimoire makes sure your `gameinfo.gi` is set up to load them.
4. Steam takes over and connects you. Accept the Steam prompt.

Content is versioned, so anything you already have at the right version is skipped. Joining the same server again is usually instant.

**Deadlock has to be fully closed** while content downloads. If the game is running it holds the files open and Grimoire tells you to quit and retry.

Password protected servers are flagged with a lock, but Grimoire does not handle the password. Steam and the game deal with that after handoff.

## Where content goes

Downloaded server content lands outside your mods:

- Maps go in `game/citadel/maps`
- Addons go in `game/citadel/deadworks_addons/vpks`

**It does not touch your mod setup.** It takes no load-order slot, does not count toward your 99-mod limit, does not appear in **Installed**, and is not part of conflict detection.

It also ranks below your own mods, so if a server addon and one of your mods change the same file, yours wins.

## Fix Configuration and server content

Once you have downloaded server content, Grimoire treats the line that loads it as required. If it goes missing, the gameinfo check reports it and **Fix Configuration** puts it back.

**Fix Configuration never deletes downloaded content.** It only repairs the configuration that mounts it, which is exactly what you want after a game update wipes `gameinfo.gi`.

One warning: if you added a Deadworks path by hand, or the official Deadworks launcher added one, **Grimoire's rewrite will erase it** and use its own instead. Grimoire owns that part of the file.

## Cleaning up

There is no in-app button to remove downloaded server content. To clear it, delete the `deadworks_addons` and `deadworks_cache` folders under `game/citadel`, then run **Fix Configuration**.

## Where the list comes from

The server list comes from the Deadworks registry, a third-party service, not from Grimoire's own infrastructure.

Grimoire only reads from it. It sends no heartbeat, no install ping, and nothing about you or your mods. The upstream Deadworks launcher does some of that; Grimoire deliberately does not.

Content download links come from whichever server you are joining. Grimoire checks that the files are genuinely VPKs and that filenames are safe before using them.

If the list is empty, no servers are currently registered.
