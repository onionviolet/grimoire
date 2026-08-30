---
title: What the Locker is
description: The Locker organizes your cosmetics by hero, and applies a second kind of cosmetic that sits outside your normal mod list entirely.
slug: locker
order: 8
updated: 2026-07-29
---

# What the Locker is

The Locker is your installed cosmetics, sorted by hero instead of by install date. It also applies a second kind of cosmetic that does not live in your mod list at all.

That second part is the bit worth understanding, because it explains most of the Locker's behavior.

## Two kinds of thing in one tab

**Skins are ordinary mods.** A skin in the Locker is the same file as on **Installed**, just filed under the hero it changes. Enabling it here enables it there. It takes a load-order slot, it can conflict with other mods, and it counts toward your mod limit.

**Cards, ability sounds, ability colors, and trippy skins are Locker overrides.** These are not mods you installed. Grimoire builds them for you out of parts, and manages them in a separate place. They do not take load-order slots, they do not count toward your limit, and they always win.

Once you know which of the two you are looking at, the rest of the Locker makes sense.

## How overrides actually work

Grimoire keeps a folder called `grimoire` next to your addons folder, and lists it **first** in the game's search paths. Four files live there, one per override type: hero cards, ability sounds, ability colors, and trippy skins.

Two consequences you will notice:

- **They always win.** Being first in the search order means a Locker override beats every mod in your addons folder, whatever your load order says. If you applied a hero card and a skin mod also ships card art, you get the Locker one.
- **They are free.** They sit outside the 99-slot addons budget, so applying a card to all fifty heroes costs you nothing from your mod limit.

Applying an override needs `gameinfo.gi` set up, the same thing first-time setup configures. If **Fix Configuration** has not been run, the Locker will not apply anything. See [first-time setup](./first-run.md).

## Restart to see changes

Mods mount when the game starts. Nothing you apply in the Locker shows up in a running session.

Grimoire says so on each surface: applied changes take effect the next time you **Launch Modded**.

## Finding your way around

The main Locker page is a grid of heroes. **Gallery** shows portraits, **List** is denser. **Hide empty** drops heroes you have nothing for, and the star favorites a hero to pin it to the top.

Two piles sit outside the hero grid:

- **Global** holds cosmetics that are not tied to a hero: soul containers, urns, HUDs, icon packs, and more. See [global cosmetics](./locker-global.md).
- **Unassigned** holds mods Grimoire could not match to a hero. Use **Tag as hero** to file one, and it moves into that hero's pile. You can also tag from **Installed** with multi-select.

## Inside a hero

Clicking a hero opens four sections:

| Section | What it holds |
|---|---|
| **Skins** | Your installed skin mods for this hero. See [skins](./locker-skins.md) |
| **Sounds** | Your tagged sound mods, grouped by ability. See [ability sounds](./locker-sounds.md) |
| **Cards** | Card art, from mods or your own images. See [hero cards](./locker-cards.md) |
| **Effects** | Ability colors and body paint. See [ability effects](./locker-effects.md) |

Cards, Sounds, and Effects are labelled **Experimental** in the app. They work, but expect rough edges.

## Undoing all of it

Everything the Locker applied is listed in one place, so you never have to hunt. **Installed > Locker overrides** lists every applied card, sound, color, and trippy skin, and can remove them one at a time or all at once. See [reviewing and removing overrides](./locker-overrides.md).
