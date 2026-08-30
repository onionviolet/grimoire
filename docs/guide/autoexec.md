---
title: Console commands and launch options
description: Build an autoexec.cfg of console commands that run at game start, and set Steam launch options without leaving Grimoire.
slug: autoexec
order: 20
updated: 2026-07-29
---

# Console commands and launch options

The **Autoexec** tab builds `autoexec.cfg`, the file Deadlock runs at startup. Add commands, click **Save**, restart the game.

Nothing is written until you click **Save**. Adding and removing commands only changes the list on screen, and an unsaved changes warning appears while the two differ.

## Adding commands

**Premade Commands** is a catalog of about twenty commands worth having, grouped into Performance, Network, HUD & UI, Minimap, Matchmaking, and Mouse & Sensitivity.

**It is collapsed when you open the tab**, which makes the page look emptier than it is. Expand it and click any row to add it. There is a search box once expanded.

For anything not in the catalog, type it into **Custom Command** and press Enter or click the plus button.

Your list builds up on the right under **Your Commands**. Hover any row to remove it, or use **Clear** to empty the whole thing.

## Commands you already had

If your `autoexec.cfg` already contained commands, Grimoire shows them greyed out and read-only.

It does not absorb, move, or delete them. Grimoire writes its own commands into a marked-off section of the file and leaves everything else exactly where it was, which is why those rows have no remove button.

**Clear** only clears the commands Grimoire manages. Those read-only rows still count toward the number in **Your Commands**, so the count can be higher than what **Clear** will remove.

## Grimoire does not check your commands

There is no validation. A typo gets written to the file verbatim, with no warning.

Nothing checks for contradictions either. Add both `fps_max 0` and `fps_max 240` and both get written, with the last one winning.

One quirk to know: a trailing `//` comment gets stripped when the file is read back. Type `echo hi // my note`, save, and the row comes back as `echo hi`.

## Launch options

The second card sets the arguments Steam passes to Deadlock, like `-high` or `-nojoy`.

Grimoire writes these into Steam's config **immediately before launching the game through Grimoire**. Two consequences:

- **Steam has to be closed.** If Steam is running when you launch, Grimoire skips the write rather than have Steam overwrite it, and tells you so.
- **Launching from Steam directly ignores what you set here**, because the write only happens on a Grimoire launch.

While your saved value differs from what Steam currently has, Grimoire shows both so you can see the difference.

## Sharing the file with the Crosshair tab

The [Crosshair tab](./crosshair.md) writes to the same `autoexec.cfg`.

They do not fight. Each owns its own marked-off section, and every save re-reads the file first, so neither overwrites the other even with both tabs open. Anything you wrote yourself outside those sections is preserved.

Two things to know:

- **Commands run before crosshair settings.** If you put a `citadel_crosshair_` command in this tab and also apply a crosshair preset, the preset wins.
- **Applying a profile replaces both sections at once.** A profile carries the console commands that were in your file when it was saved, so applying an old profile can quietly revert console settings you have changed since.

## Do you need +exec autoexec?

Some Source games need `+exec autoexec` in their launch options to run the file at all. Grimoire does not add it for you.

If your commands are not taking effect and the file is definitely saved, add it to **Launch Options** and see whether that fixes it.
