---
title: "Tutorial: a custom soul container from Sketchfab"
description: Take a free 3D model off Sketchfab and turn it into a working soul container or spirit urn, start to finish.
slug: locker-glb-tutorial
order: 14
updated: 2026-07-29
---

# Tutorial: a custom soul container from Sketchfab

Grimoire turns any `.glb` file into a soul container or spirit urn. Sketchfab is the easiest place to get one. Budget about fifteen minutes for your first, and most of that is picking a model.

The steps are identical for a spirit urn. Where they differ, it is called out.

## 1. Find a model

On [Sketchfab](https://sketchfab.com), search for what you want, then set two filters that matter:

- **Downloadable.** Most models on the site are view-only. Without this filter you will fall in love with something you cannot have.
- **License.** Every downloadable model has one. Most are Creative Commons and require crediting the author.

Keep the poly count in mind while browsing. Sketchfab shows triangle counts on the model page, and a soul orb is a small prop that is on screen constantly. Under 50,000 triangles is comfortable. Above that Grimoire will warn you.

## 2. Download it as GLB

Click **Download 3D Model** and choose the **glTF** option.

You get a `.zip`. Open it and look for a file ending in `.glb`, which is what Grimoire wants.

If the archive only has a `.gltf` alongside separate `.bin` and texture files, that is the unpacked form and Grimoire will not take it. Convert it to a single `.glb` first, then continue.

## 3. Import it

In Grimoire, open **Locker** and go to the **Global** pile.

Click **Import Soul Container (GLB)**, or **Import Spirit Urn (GLB)** for an urn. Drop your `.glb` onto the dropzone, or click to browse.

The preview appears immediately. This preview is the real thing, so trust what you see in it.

## 4. Get it facing the right way

Most Sketchfab models arrive rotated wrong. This is normal and expected.

Start with **Auto**. If that does not land it, try **Y-up** and **Z-up**, which cover most cases. For anything else, rotate each axis by hand.

**Facing yaw** turns the model in place once it is upright. **Lock in place** keeps it from tumbling.

## 5. Check the size

This is the step people skip and regret.

Switch the preview to **Hero scale**. It puts a hero next to your model with the orb floating at their back hip, exactly where it sits in game. Getting this right in the preview saves you a rebuild.

**Vanilla shell** compares against the original orb instead, which is the faster sanity check.

For an urn, set **Size** in Source units. The default of 28 is a sensible start, because an urn is meaningfully bigger than a soul orb. **Sit base on the ground** anchors it by its base rather than its center, which is usually right for something that rests on a surface.

## 6. Pick a soul glow

Soul containers ship a glow effect. Three choices:

- **Recolor** tints the glow to your model's dominant color. Usually the best-looking option.
- **Keep gold** ships the stock gold glow unchanged.
- **None** ships no particles, and the base game glow plays instead.

## 7. Build it

Name it, add notes if you want, mark it NSFW if it needs that, then click **Build & Import**.

Grimoire builds a tracked local mod. It shows up in the Locker and on **Installed**, and you can delete it like anything else.

Enable it, then **Launch Modded**. Only one soul container loads at a time, so if you already have one on, Grimoire asks whether to disable it or keep both.

Prefer a file over an install? **Export .vpk** builds it and saves it to disk instead.

## If something looks wrong

**The model has no texture in the preview.** Your GLB probably points at external texture files rather than embedding them. Re-export it with textures embedded.

**Grimoire says it has no mesh geometry.** The file loaded but contains no actual mesh, usually a scene with only lights or cameras.

**It rejects the file.** It only accepts `.glb`. A `.gltf`, `.fbx`, or `.obj` needs converting first.

**It warns about triangles.** Over 50,000 and it tells you. It will still build. A very heavy model can hurt in-game performance, so decimate the mesh if you can.

## Sharing what you made

The license on the Sketchfab model still applies to the VPK you built from it. Most Creative Commons licenses require crediting the original author, and some prohibit commercial use or redistribution entirely.

Check the license on the model page before you post your container anywhere, and credit the author.
