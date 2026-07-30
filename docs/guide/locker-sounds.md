---
title: Per-ability sounds
description: Assign one sound mod per ability, then tune its volume and pitch, without the mods fighting each other.
slug: locker-sounds
order: 10
updated: 2026-07-29
---

# Per-ability sounds

The **Sounds** section of a hero shows your sound mods for that hero, grouped by the ability each one changes. Pick one source per ability, and only that one plays.

Sounds are labelled **Experimental** in the app.

## Getting sound mods into the Locker first

The Sounds section only shows mods you have tagged for this hero. If it says no sound mods are tagged, nothing is wrong, Grimoire just does not know which hero the mod belongs to.

Tag from **Installed**: select the mods, then use **Tag**. They appear under that hero's Sounds section afterward.

## Picking a sound per ability

Each of the hero's four ability slots gets its own row, with the ult last. Under each, the sound mods that touch that ability.

Click **Use** on the one you want. That is the whole interaction.

To revert, click the applied source again.

## Why this exists

Sound mods routinely overlap. Two mods that both change a hero's ult will both be loaded, and which one you hear is whatever the load order happened to decide.

Picking a source here **isolates just that sound** into a Locker-managed file that outranks your normal mods. So you can take the ult from one mod and an ability from another, and the result is what you picked rather than what your load order produced.

A mod that covers several abilities shows as **also** on the others, so you can see what else it is providing before you commit to it.

## Volume and pitch

Once a source is applied, sliders appear for **Volume** (in dB) and **Pitch**.

These are real parameters on the sound, not post-processing, so they change how the game plays it rather than filtering it afterward.

Changes save on their own.

## Other sounds

Voice lines and anything not tied to a single ability go under **Other sounds**. These do not have per-ability picks, so they toggle the whole mod on or off, the same as any other mod.

## Restart to hear it

Sound changes mount when the game starts. Restart Deadlock, or launch fresh from Grimoire.

## Removing them

Click the applied source again to revert one ability, or open **Installed > Locker overrides > Ability Sounds** to see everything you have applied across every hero and remove it in bulk.
