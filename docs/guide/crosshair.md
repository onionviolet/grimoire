---
title: Designing a crosshair
description: Build a custom crosshair with a live preview, save it as a preset, and get it into the game.
slug: crosshair
order: 16
updated: 2026-07-29
---

# Designing a crosshair

**Adjusting the sliders does not change anything in the game.** To actually use a crosshair you have to save it as a preset, then apply that preset. This catches almost everyone, so it is worth knowing before you start.

Turn the tab on in **Settings > Experimental Features > Crosshair Designer**.

## Getting a crosshair into the game

1. Open **Crosshair** and adjust it until the preview looks right.
2. Click **Save as New Preset**, name it, click **Save**.
3. In **Saved Presets**, hover the tile you just made and click the play icon (**Apply to Game**).
4. Restart Deadlock.

Step 3 is the one people miss. The apply button only appears when you hover a saved preset, and there is no apply button anywhere else on the page.

## The controls

**Crosshair Shape** sets the four pips: **Gap**, **Height**, **Width**, and **Opacity**, plus **Outline Width**, **Outline Gap**, and **Outline Opacity**.

**Center Dot** has its own **Size**, **Opacity**, and matching outline controls.

**The dot starts invisible.** Its **Opacity** defaults to zero, so dragging **Size** appears to do nothing until you raise the opacity in the same card. If your dot will not show up, that is why.

Note that **Opacity**, **Outline Width**, **Outline Gap**, and **Outline Opacity** each appear twice, once under Crosshair Shape and once under Center Dot. Check which card you are in.

**Color** gives you six swatches, RGB sliders, and a separate **Outline color**.

**In-Game Behavior** has two toggles. **Static Gap** keeps the gap fixed instead of letting it expand with weapon spread. **Disable Hero Crosshairs** forces your crosshair onto heroes that would otherwise override it.

Every slider's number is also a text field, so you can type an exact value instead of dragging.

## Tuning it live

Restarting the game for every tweak is miserable. Use **Copy Code** instead.

It copies the whole crosshair as one line of console commands. Open the console in game and paste, and the change is immediate. The in-app hint says to press F7.

This does not save anything. Once you like what you see, come back and save it as a preset.

## Starting from your in-game crosshair

**Import from Game** loads your current in-game crosshair into the editor.

It reads the file Deadlock writes when you change a crosshair setting **in the game's own settings menu**. If you have never touched those, the file has nothing in it and Grimoire tells you to change any crosshair setting in game once and try again.

Importing only fills the editor. You still need to save and apply it.

## Presets

Presets are stored by Grimoire, not in your game folder, so verifying or reinstalling Deadlock will not lose them.

Two limitations worth knowing:

- **Presets cannot be renamed or edited in place.** Loading one, tweaking it, and saving creates a second preset. There is also no check on duplicate names, so it is easy to end up with two tiles that look identical.
- **Deleting the preset you currently have applied also removes the crosshair from your config.** The confirmation only asks about deleting the preset, so this comes as a surprise.

**Deselect Active** removes the crosshair from your config while keeping every preset.

## What the preview cannot show you

The preview is close, not exact.

**Dynamic spread bloom is not simulated.** Turning **Static Gap** off changes real in-game behavior and changes nothing in the preview.

The resolution dropdown scales the preview to 1080p, 1440p, or 4K, and it is detected automatically on open. Preset tiles always render at 1440p regardless of that setting, so a tile will not match your preview exactly.

**Disable Hero Crosshairs** has no preview representation either.

## Where it gets written

Applying a preset writes crosshair settings into `game/citadel/cfg/autoexec.cfg`, in its own marked-off section.

The [Autoexec tab](./autoexec.md) writes to the same file in a different section, and the two do not interfere. Anything else already in that file is left alone.

One exception worth knowing: if you have hand-written `citadel_crosshair_` lines in your autoexec, Grimoire pulls them into its managed crosshair section, where the next apply or deselect will overwrite them.

Applying a profile that includes a crosshair also replaces whatever is currently applied.

**Pin Window** keeps Grimoire on top of the game for quick adjustments. It pins the whole app, not just this tab.
