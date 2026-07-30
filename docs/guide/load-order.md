---
title: Load order and the mod limit
description: Lower numbers win. How to reorder mods, and what to do when you have a lot of them.
slug: load-order
order: 3
updated: 2026-07-29
---

# Load order and the mod limit

**Lower numbers load first and win.** When two enabled mods change the same game file, the one higher up your **Installed** list is the one you see in game.

## Reordering

On **Installed**, drag an enabled mod to move it. Or click its load-order number and type a new one.

Only enabled mods have a load order. Disabled ones sit in their own section and keep their old number so re-enabling puts them back where they were.

If your numbers have gone gappy after a lot of adding and removing, **Fix order** renumbers everything to 1, 2, 3 and up. It does not change the actual order, just tidies the slots.

## When order matters

Most of the time it does not, because most mods touch different files. It matters when two mods overlap, which is exactly what the **Conflicts** tab is for. See [when two mods conflict](./conflicts.md).

Put the mod you want to win higher in the list.

## How many mods you can have

Each addon folder holds 99 mods. Past that, Grimoire automatically overflows into extra folders (`addons1`, `addons2`, and so on) and wires each one into the game. You do not have to do anything, and nothing about your existing mods changes.

Mods in the base folder still outrank mods in the overflow folders, so the ordering rule holds across all of them: further up the list wins.

## Merging mods together

You can combine several mods into one VPK. Select them on **Installed** and choose merge.

Worth doing when you have many small mods you always run together, or you want one file to hand to a friend.

Things to know before you do:

- **Strict mode** stops the merge if two of the sources touch the same file. With it off, the higher-priority mod wins and the merge goes through.
- The originals stay in your disabled folder, so you can unmerge later.
- Local mods (ones you imported from disk rather than GameBanana) merge fine, but they are not included in the share code an unmerge would rebuild from. If you delete the disabled originals, they cannot be recovered.

## Deleting

Select one or more mods on **Installed** and delete. Use **Select multiple mods** for bulk enable, disable, or delete.

Deleting removes the file. If you only want a mod out of the way, disable it instead.
