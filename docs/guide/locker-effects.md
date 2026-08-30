---
title: Recoloring abilities and painting skins
description: Repaint a hero's ability effects in any color, rainbow, or gradient, and paint a flowing pattern onto their body and gun.
slug: locker-effects
order: 12
updated: 2026-07-29
---

# Recoloring abilities and painting skins

The **Effects** section of a hero has two tabs. **Abilities** repaints their ability effects. **Body + Gun** paints a pattern onto the hero themselves.

Effects are labelled **Experimental** in the app.

Not every hero is supported yet. If a hero has no recipe in the bundled tooling, Effects says so rather than half-working. More heroes get added over time.

## Abilities: four ways to repaint

The Abilities tab covers particles, projectiles, and the ult body. Pick one of four modes:

- **Single Color** repaints everything to one hue. Nine presets, or set it yourself.
- **Rainbow** spreads the hero's existing ability colors across the full spectrum instead of collapsing them to one hue.
- **Gradient** does the same over a ramp you choose, rather than the whole spectrum.
- **Trippy** paints the particles with a flowing procedural pattern.

**Only one is active at a time.** They share a single slot per hero, so applying a gradient replaces a color, and applying Trippy replaces either.

## Tuning

All four modes share three sliders: **Hue**, **Saturation**, and **Brightness**.

Saturation and brightness matter more than they look. A hue-only recolor of a pale source effect comes out washed out, and these are what get you to a clean pastel or a deep saturated look.

**Animation** adds a moving sweep to the showy effects (glow, beams, trails) so the color travels over each effect's lifetime instead of sitting still. On Trippy, Animation also sets how the particles move, and turning it off bakes a still paint.

The preview swatch is a real ability texture run through the recolor, not an approximation. It cannot show the in-game motion, though, so sweep and loop modes look the same in the swatch and differ in game.

## Targets

Trippy can aim at **All VFX**, **Abilities** only, or **Gun FX** only.

Gun FX means the weapon's effect particles: muzzle flash, tracers, impacts. It does not mean the gun's appearance. That is the Body + Gun tab.

## Body + Gun

This tab paints a flowing pattern onto the hero's body and gun textures. The paint scrolls in game.

Target the **Body**, the **Gun**, or both, then set **Intensity** and **Scroll speed**.

Body + Gun composes with the Abilities tab rather than replacing it. You can run a gradient on the abilities and a painted body at the same time.

## Applying takes a moment the first time

Applying re-encodes every affected texture, which can take up to a minute the first time for a given look. The same pick is instant afterward because the result is cached.

Then restart Deadlock. Applied effects mount the next time you **Launch Modded**.

## Exporting instead of applying

**Export .vpk** bakes the look into a standalone addon file and saves it to disk instead of applying it in Grimoire. Use it to keep or share a look.

## Removing them

Open **Installed > Locker overrides**, where **Ability Colors** and **Trippy Skins** each list what you have applied across every hero, removable one at a time or all at once.
