---
title: Replacing a hero's sound with your own
description: Swap any ability sound or voice line for your own MP3, with trimming and volume matching.
slug: door-stuck-sounds
order: 28
updated: 2026-07-29
---

# Replacing a hero's sound with your own

The **Door Stuck** tab can replace any of a hero's sounds with an audio file of yours. Pick a hero, find the sound, drop in an MP3, and it installs as a normal mod.

Turn it on in **Settings > Experimental Features > Door Stuck**. The tab is called Door Stuck in the sidebar and **Foundry** at the top of the page, which is the same thing mid-rename.

This is the one thing in the tab that creates something. The rest is browsing.

## Abilities or Voice

Two sections, and the split matters:

- **Abilities** holds gameplay sounds: abilities, weapon, movement, melee. Around thirty per hero, with ability rows showing the real ability icon and the ult marked.
- **Voice** holds spoken lines. Around sixteen hundred per hero.

Voice is far too long to scroll, so it only renders the first several hundred. **Search is how you find a line**, not scrolling.

## Doing the swap

1. Pick your hero, then open **Abilities** or **Voice**.
2. **Audition** any row to hear the original first. Worth doing, since names are not always obvious.
3. Click **Swap** on the row you want.
4. Drop in an MP3.
5. Trim it on the waveform with the start and end handles, and use **Play selection** to check.
6. Optionally tick **Match the original volume** so your clip sits at the same loudness as the sound it replaces.
7. Name it, choose looping if relevant, and click **Forge & install**.

The result is installed **and already enabled**. Find it under **Installed**, or under that hero in the Locker. Remove it like any other mod.

## MP3 only

No WAV, no OGG, no FLAC. Convert first if you have something else.

## What "replaces all clips" costs you

Many Deadlock sounds are pools that pick randomly between several clips, which is what stops abilities sounding repetitive.

A swap replaces **every clip in the pool** with your single file. The dialog tells you how many. That is usually what you want for an ability, and it is worth thinking about for anything you hear constantly.

There is no way to replace just one clip of a pool, and no undo short of removing the mod.

## The rest of the tab

Everything else in Door Stuck is look-only right now.

**Library**, **Items**, and **Icons & Textures** browse the game's ability icons, item icons, and hero images. **Texture** browses hero model textures and ability VFX textures. You can search, filter by hero, and click to see any of them full size.

**None of them can be swapped, exported, or saved.** If you came looking to replace an icon or a texture, that does not exist yet.

**Appearance** and **Recolor** are not really Door Stuck features. They are the Locker's Effects panel shown here as well, sharing the same one-per-hero slot. See [recoloring abilities and painting skins](./locker-effects.md).

## Rough edges

This tab is experimental in a stronger sense than most. It has no test coverage, and the trim and volume-matching controls were shipped without being clicked through in a running build.

Test your swap in game before assuming it worked, and keep the original file in case you need to redo it.
