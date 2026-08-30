---
title: Seeing your resolved game settings
description: The Config tab shows the value your game will actually use for every setting Grimoire manages, and which file set it.
slug: config
order: 23
updated: 2026-08-30
---

# Seeing your resolved game settings

The **Config** tab answers one question: for any setting Grimoire manages, what value will Deadlock actually use, and what put it there. It is read-only. Nothing here changes your game.

Reach for it when a performance preset or an autoexec command does not seem to be doing anything.

## Why a setting can lie to you

Grimoire writes settings in two places, and **Deadlock reads `autoexec.cfg` after `gameinfo.gi`**. When both set the same key, autoexec wins, and the value you carefully chose in a performance preset is quietly discarded.

That is the whole reason this tab exists. The **Resolved value** column is the one that decides your game.

## Reading a row

| Column | Means |
|---|---|
| **Resolved value** | What the game will use |
| **Game default** | The stock value, before anything Grimoire did |
| **gameinfo.gi value** | What is written in that file, whether or not it wins |

Each row also names where its value came from: **Game default**, **Performance preset**, **Your override**, or **Unrecognized value**.

A row marked **Autoexec wins** is one of the collisions above. It tells you which line of `autoexec.cfg` is responsible, so you can go delete it.

## Finding the interesting rows

Four filters, and the last three are the point:

- **All settings**
- **Changed from stock**, for what Grimoire has actually altered
- **Overridden by autoexec**, the collisions
- **gameinfo.gi**, for what is written to that file

Start with **Overridden by autoexec**. If it is empty, your preset is intact and the problem is elsewhere.

## Changing something you find here

You cannot, not from this tab. Go to the surface that owns it:

- Preset values: **Settings > Game > Performance**. See [performance presets](./performance-presets.md).
- Autoexec lines: the **Autoexec** tab. See [console commands](./autoexec.md).
- **Open editor** on a row opens the underlying file directly, if you would rather edit by hand.

## Unrecognized value

Grimoire read the setting but does not know what the value means, usually because something outside Grimoire wrote it. It is reported rather than corrected, because guessing at a hand-edited config is how people lose their settings.
