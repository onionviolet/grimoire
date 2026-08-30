---
title: Global cosmetics
description: Cosmetics that are not tied to a hero, including soul containers and spirit urns you can build from your own 3D models.
slug: locker-global
order: 13
updated: 2026-07-29
---

# Global cosmetics

**Global** is the pile for cosmetics that do not belong to any one hero. It sits next to the hero grid on the main Locker page.

Grimoire sorts them into seven categories by looking at what files the mod actually changes:

| Category | What it changes |
|---|---|
| **Soul Containers** | The soul orb |
| **Spirit Urns** | The carryable Idol |
| **Hideout** | The hideout space |
| **Icon Packs** | Hero icons and portraits |
| **HUD** | The in-game interface |
| **Announcer / SFX** | Announcer lines and general sound effects |
| **Killstreak Music** | Killstreak tracks |

If a mod lands in the wrong category, **Change global category** moves it. **Remove from Global** takes it out of the pile entirely.

Icon packs and portrait packs are one category on purpose, because they write the same files and separating them would be a distinction the game does not make.

## Soul containers and spirit urns

These two get special treatment, because each one replaces a single prop model. They show as live 3D tiles you can orbit, and they are **single-select**: enabling one disables the others of the same type, since only one can load.

If you try to enable a second urn while one is already on, Grimoire asks what to do with the current one rather than silently swapping it.

## Building one from your own 3D model

You can turn any `.glb` into a soul container or a spirit urn. Use **Import Soul Container (GLB)** or **Import Spirit Urn (GLB)** from the Global pile.

1. Drop in a `.glb`, or click to browse.
2. Orient it. Grimoire offers Y-up, Z-up, flip, and **Auto**, plus manual rotation on each axis if those do not land it right.
3. Check it in the preview. **Vanilla shell** shows it against the original for scale, and **Hero scale** puts a hero next to it with the orb at their back hip, where it actually sits in game. That second one is the honest test of whether your model is the right size.
4. Name it, add notes if you want, and mark it NSFW if it needs that.
5. Click **Build & Import**.

Grimoire builds a tracked local mod, so it behaves like anything else you installed: it appears in the Locker, in **Installed**, and you can delete it normally.

**Export .vpk** builds the file and saves it to disk instead of installing it.

### Sizing an urn

Urns have a **Size** field in Source units, because they are bigger than a soul orb and the right size is not obvious from the model alone. The default of 28 is a reasonable start, but confirm it in game.

**Sit base on the ground** anchors the model by its base rather than centering it, which is usually what you want for something that rests on a surface.

### If your model is heavy

Grimoire warns when a model has far more triangles than a prop of that type usually needs. It will still build. A very heavy model can hurt in-game performance, so treat the warning as a reason to decimate the mesh rather than a hard stop.

## These are ordinary mods

Unlike hero cards and ability sounds, global cosmetics are normal mods. They take a load-order slot, they count toward your mod limit, and they can conflict. See [load order and the mod limit](./load-order.md).
