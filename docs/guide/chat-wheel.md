---
title: Building a custom chat wheel
description: Edit a ChatLane chat wheel visually or as YAML, preview the twelve slots, and install it as a managed add-on.
slug: chat-wheel
order: 30
updated: 2026-08-30
---

# Building a custom chat wheel

Turn on **Settings > Experimental Features > Chat Wheel** to get a **Chat Wheel** tab. It builds ChatLane chat wheels and installs them as managed Deadlock add-ons, so a wheel behaves like any other mod Grimoire tracks.

You do not have to write YAML. There is a visual editor with a live preview, and the YAML sits behind **Advanced YAML** for when you want it.

## Making one

1. Click **Create new wheel** and give it a **Name**.
2. Under **Menus and commands**, click **Add menu**, name it, and pick an **Icon**.
3. **Add command** for each entry you want on that wheel.
4. Watch **Live wheel preview** as you go. Pick a menu, then a slot, to edit that slot's command.
5. Click **Save & install**.

A new wheel is a draft until step 5. The page says so: nothing reaches your game until you save.

## Twelve slots, and no more

The game draws **twelve commands per wheel**. Add a thirteenth and the preview warns you that the extras exist in the menu but will never appear.

Split them across menus rather than fighting the limit. Menus are how ChatLane gets you more than twelve commands.

## Icons

**Icon** takes a ChatLane icon name. Type something that is not one and the editor says **Not a ChatLane icon name**, and the wheel will simply render without an icon. It is a warning, not an error, and it will not block a save.

## Editing one you already have

Pick it under **Installed wheels** and click **Load selected**. **Save & install** replaces that wheel in place rather than adding a second copy.

**Open VPK...** loads a wheel from a file. **Only VPKs made by ChatLane can be opened**, and the embedded `chatlane.yml` is preserved on every save, so round-tripping a wheel does not lose the source.

Creating a new wheel with unsaved edits asks before discarding them.

## Validation happens first

**Save & install** runs your YAML through ChatLane before touching your game. If it is bad, you get told and nothing is installed. If it is good, the page says the YAML is valid and, explicitly, that nothing has been installed yet.

## If the converter is missing

Some systems have no ChatLane converter binary available. The tab then says **ChatLane converter unavailable**: you can still see your installed wheels, but building a VPK or reading one is not possible on that machine.
