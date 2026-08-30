---
title: Hero cards
description: Apply card art from an installed mod, or build your own from your images, one portrait variant at a time.
slug: locker-cards
order: 10
updated: 2026-07-29
---

# Hero cards

The **Cards** section of a hero swaps their card art: the portraits the game shows in menus and the HUD. Click a card to apply it, click the applied one again to revert.

Cards are labelled **Experimental** in the app.

## Applying card art from a mod

Grimoire scans your installed mods for card art and shows what it finds for this hero. You do not need the mod enabled, and you do not need it to be a card mod. If a skin happens to ship portraits, they show up here.

Cards are grouped by the mod they came from, because **a card is applied as a full set**. One mod usually ships several portrait variants, and clicking any card from that mod applies all of its portraits together. That keeps the hero looking consistent instead of mixing art from three sources.

If nothing appears, none of your installed mods carry art for this hero.

## Building your own

**Upload your own** lets you supply the images yourself.

1. Click a slot. Each slot is one portrait variant, at a fixed size.
2. Choose a PNG or JPG.
3. Crop it. The frame is locked to that variant's shape so the result is never stretched. Drag to move, scroll or use the slider to zoom.
4. Repeat for any other slots you want to change.
5. Click **Apply custom card**.

**You only have to fill the slots you care about.** Any variant you leave empty stays at the game default, so changing one portrait does not mean sourcing six images.

If your source image is smaller than the target, Grimoire warns you that it will be upscaled and may look soft. It still works, it just will not be crisp.

**Update custom card** re-applies after edits, and **Revert** removes it.

## Exporting instead of applying

**Export VPK** saves the card as a standalone `.vpk` file rather than applying it. Use this to share a card with someone or keep a copy outside Grimoire.

Exporting does not apply it. If you want both, apply it and export it.

## What applying actually does

Applied cards go into the Locker's managed override file, not into your mod list.

They cost nothing from your 99-slot mod limit, and they beat any mod that ships competing card art regardless of your load order. See [what the Locker is](./locker.md) for the mechanism.

Restart Deadlock to see the change. Applied cards mount the next time you **Launch Modded**.

To remove cards later, use the card itself or **Installed > Locker overrides**, which lists every applied card in one place.
