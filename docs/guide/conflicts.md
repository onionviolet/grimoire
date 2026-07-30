---
title: When two mods conflict
description: What a conflict means, when it actually matters, and how to resolve or dismiss one.
slug: conflicts
order: 4
updated: 2026-07-29
---

# When two mods conflict

A conflict means two enabled mods change the same game file. Only one of them can win, and the one higher in your load order does. The **Conflicts** tab lists every pair so you know which of your mods is being overridden.

A conflict is not an error. Nothing is broken and the game will still launch. It is Grimoire telling you that one of these two mods is not fully doing what you installed it for.

## When it matters

**It matters** when two mods change the same thing and you wanted both. Two skins for the same hero, for example. You will only ever see one, and the other is dead weight.

**It usually does not matter** when the overlap is a small shared file and the mods are otherwise unrelated.

If the game looks right, you can leave a conflict alone.

## Resolving one

You have three options on each pair.

**Reorder.** If you know which mod you want to win, move it higher on **Installed**. The conflict stays listed, because both mods still touch the file, but now the right one wins. See [load order and the mod limit](./load-order.md).

**Disable.** Click **Disable** on the mod you care less about. It moves to your disabled folder and stays there until you re-enable it, so nothing is lost.

**Ignore.** Click **Ignore** to stop Grimoire flagging that pair. Use this when you have looked at it and decided you are fine with the outcome.

## Ignoring in bulk

**Ignore all** moves every currently active pair to the Ignored section at once.

Reversible: **Unignore** restores any single pair, and **Clear ignored** puts all of them back under normal detection.

Ignoring only hides the report. It changes nothing about how the game loads your mods.

## If a conflict looks wrong

Grimoire skips a small set of bookkeeping files that nearly every mod carries, so those do not generate noise.

If you are seeing a conflict you do not believe, open the pair and look at which files it names. If they are files no mod should be shipping, that is worth [reporting](https://github.com/Slush97/grimoire/issues).
