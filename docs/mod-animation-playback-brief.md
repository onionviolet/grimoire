# Animation playback for specific mods

Extend the existing Installed animation preview and Locker audition to compare
the exact selected VPK variant with stock. Installed already exports loose clips
from the selected mod, renders them on the stock model, and offers clip selection.
Start with a hero model replacement and an animation-only mod. A preview
should identify where the model, animation and sound came from, then let the
user play, pause, scrub, change speed and compare with the stock asset.

## First slice

1. Resolve the selected mod by stable ID, VPK fingerprint and exact entry path.
   Resolve missing dependencies from the local base game. Keep the selected-mod
   preview distinct from the effective load-order preview and label donor assets.
2. Reuse the existing Locker hero scene, `AbilityPreview` and shared playback
   controller. First wire a compatible embedded clip and independently resolved
   sound. Display unsupported rigs and ambiguous animation aliases explicitly.
3. Build test fixtures for a stock hero, an exact-rig skin replacement and a
   loose animation override. Include competing overrides and a missing donor.
   Check play, seek, replay, stop, failure, and preview disposal without an install.

## Source 2 Viewer 21.1

Use Source 2 Viewer as an independent reference for model dependencies, selected
clip export, and visual comparison. Its 21.1 desktop viewer can play AnimGraph 2
with parameters, step controls, IK and root motion. Its CLI can export chosen
clips to glTF or GLB and compose additive clips. Animation-graph playback in the
desktop viewer is separate from selective CLI export. Test both on the same
exact mod and base inputs before deciding whether an optional exporter is useful.
[21.1 release](https://s2v.app/release/21.1/) · [CLI](https://s2v.app/ValveResourceFormat/guides/command-line.html) · [Model export](https://s2v.app/ValveResourceFormat/guides/exporting-models.html)

The Windows 21.1 CLI exported Vindicta from Deadlock build `26875936` to GLB
with one skin, three meshes, and exactly the two requested clips,
`RopeClimb_Idle` and `ability_generic_cast`. The exporter also reported a
missing `ui_hero_reveal.vnmclip_c`. That reference did not stop the selected
clips from exporting.

For the first mod comparison, use the local `addons/pak29_dir.vpk` if its
`ability_crow_cast.vnmclip_c` still matches CRC `b46d84c8`. Source 2 Viewer
reported the stock entry as CRC `c9fecff8`. The pinned Grimoire engine exported
the mod entry onto the Vindicta rig with the base VPK as a dependency source.
Identify the candidate by its content, because installed pak slots can move.

## Installed comparison

Pin an animation or mixed skin and animation mod in Installed. Choose a clip,
then switch between Modded animation and Stock animation while keeping the
same model. The model menu offers the stock body and compatible candidates
from the installed library, including disabled skins. Pinning a skin-only mod
offers its animated model preview and the stock model preview. Both pinned
views have pause, replay, speed and scrubbing. Switching sources keeps the
viewport, camera and current time when a single clip is selected. If the clips
have different lengths, the preview clamps the time to the clip being viewed.

The first stock comparison uses the exact compiled path from the selected
animation mod and resolves it using only game assets. A missing or unsupported
stock match is displayed as unavailable. If the model is missing bones, the
preview plays the tracks it can bind and labels the result as partial. Loose
clips are detected from the VPK even when its category is unknown. The preview
currently picks the dominant hero in a multi-hero animation pack and exports
up to eight full-body clips. Live animation graph simulation and arbitrary
retargeting remain separate work.

In the unpacked Windows build, the packaged interface exported both versions
of Vindicta's Crow cast and served their GLBs through the app's asset protocol.
Both were about 0.40 seconds. Comparing shared GLB channels at a tolerance of
0.0001 found 27 changed channels, including rotations along the hair braid.
The pinned viewer played both clips on the same installed Catgirl Vindicta
body. Switching sources kept the skin and clip selection. Scrubbing paused
the motion, and the speed control accepted half speed.

Start with the existing pinned `vpkmerge` engine and use Viewer outputs as
comparison evidence. Record Viewer version, clip IDs, rig, frame count, duration,
mesh selection, and where each dependency resolved. Treat graph state transitions,
cloth, VFX event timing, and retargeting as separate capabilities that need their
own comparison fixtures. Keep test exports local and use a bounded cache keyed
by the selected files and exporter version.

Existing implementation and verification boundaries are in
[ability playback](ability-playback-implementation-2026-10-09.md).
