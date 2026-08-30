---
title: Performance presets
description: Apply a community fps config to Deadlock without breaking your mods, and remove it cleanly when you want.
slug: performance-presets
order: 21
updated: 2026-07-29
---

# Performance presets

Grimoire can apply community-made performance configs that raise your frame rate by turning down effects the game does not need. **Your mods keep working**, and you can remove it at any time.

Turn it on in **Settings > Experimental Features > Performance Config**, then find its controls in **Settings > Game setup**. The toggle and the card are in different panes, so if the toggle seems to have done nothing, that is why. There is a link on the toggle that takes you there.

## Applying one

1. Go to **Settings > Game setup** and find the **Performance Config** card.
2. Pick a preset from the dropdown.
3. Click **Apply Config**.
4. Restart Deadlock.

**Choosing from the dropdown does not apply it.** You have to press the button.

## The six presets

Ordered from mildest to most aggressive:

| Preset | Tier | What you are trading |
|---|---|---|
| **Sqooky's Default** | Balanced | A solid all-round gain that keeps the game looking close to normal. Start here |
| **Sqooky's Testing** | Preview | The author's in-progress tuning. Newer changes, less testing |
| **OptiLock FPS** | Competitive | Strips visual noise while keeping the game readable |
| **boot's Max FPS** | Aggressive | Noticeable visual quality for a large frame-rate gain |
| **OptiLock Max FPS** | Maximum | Pushes settings as far as they go. The game will look distinctly worse |
| **kaizuchanerus Minimum Spec** | Potato | For very low-end machines. Expect the game to look rough |

Start with **Sqooky's Default**. If it is not enough, work down the list.

These come from two community projects, and Grimoire pins each to a specific version of the original rather than tracking whatever the author pushed today. The card credits the author and links to the exact upstream version.

## Why your mods keep working

Community fps configs are usually distributed as a whole replacement `gameinfo.gi`, and dropping one in wipes the section that tells the game where your mods are. That is the classic way to lose every mod at once.

Grimoire does not replace the file. It edits only the specific settings the preset changes, and it **never touches the section that loads your mods**. Every line it changes is marked, so **Remove** can put the original values back exactly.

It also writes a one-time backup of your `gameinfo.gi` the first time you apply.

## Gameplay settings are opt-in

Some preset authors also change things that affect what you can see or how the camera is framed, not how fast the game runs. Enemy outlines, field of view, that sort of thing.

**Grimoire leaves all of these off**, so a performance preset never changes how your game plays behind your back. They are under **Gameplay settings** on the card, grouped by what they affect, and you turn on the ones you want.

Toggling them does not do anything on its own. They apply on your next **Reapply**, and the card tells you how many are waiting.

## After a game update

Deadlock updates overwrite `gameinfo.gi`, which removes the preset.

Grimoire notices and says so with **Wiped by game update**. Click **Reapply Config** to put it back. Any tweaks you had saved come back too.

## Changing or removing

**Switch to** another preset removes the current one first, so you never end up with two stacked on top of each other. Your saved tweaks for the old preset are kept in case you go back.

**Remove** reverses everything and restores your original values.

**Restore Backup** appears if your `gameinfo.gi` has been corrupted and Grimoire still has its backup. If there is no backup, verify the game files in Steam instead.

## Editing by hand

**Edit File** opens `gameinfo.gi` in a text editor of your choosing. Grimoire asks which one the first time, because `.gi` files often open in a word processor otherwise.

If you edit values by hand, Grimoire spots it and the badge changes to **(edited)**. **Reapply** then folds your edits into saved overrides and keeps them across future reapplies, so your tweaks survive game updates.

**Reset Overrides** discards those saved edits. It acts on the preset currently in the file, not whatever is selected in the dropdown.

## If the map looks too dark

A known side effect of the more aggressive presets. Set in-game shadows to Medium or Low, which usually fixes it without giving up the frame rate.
