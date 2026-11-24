---
title: Replace sounds in Door Stuck
description: Replace ability sounds, voice lines and global cues. Preview the generated audio before installing or exporting.
slug: door-stuck-sounds
order: 28
updated: 2026-11-24
---

# Replace sounds in Door Stuck

Enable **Door Stuck** under **Settings > Experimental Features**. Pick a hero to browse abilities and voice lines, or open the full catalog and choose **Global Sounds** for music, UI, ambience and other shared sounds.

## Build a replacement

1. Find the sound and play the stock clip. Use **Swap** to open the editor.
2. Choose a replacement audio file, or start with the original clip to adjust it. Grimoire accepts MP3, WAV, FLAC, OGG, M4A, AAC and Opus.
3. For a pool, choose all clips, selected clips, one file per selected clip, or a seeded shuffle. The assignment list shows which file replaces each clip. Clips outside the selection keep their existing sound.
4. Trim the selection, adjust gain or match the stock volume, and set looping. Name the edit and choose **Add to build tray**.
5. Select edits in the tray and choose **Review build**. Pick an output clip to hear the baked audio, compare it with stock or the current provider, and see which enabled mod is expected to win after install. If several stock events use the same path, review the event names before continuing.

**Install to Grimoire** adds an enabled local mod. **Export VPK** saves a standalone file. Edits left unchecked stay in the tray.

## Batch-replace voice clips

Use the folder picker in a hero's **Voice** section. Grimoire matches filenames to exact clip names or single-clip event names. Select the matches you want and audition their stock and replacement audio before staging. Ambiguous and unmatched files stay visible.

## Revisit a build

Open **My changes** for the installed output, the source record and rebuild actions. If a source audio file moved, locate its replacement during review. When Deadlock updates, review the current stock clip before reusing saved trim and gain. To return to the previous setup, disable or remove the new build in **My changes** or **Installed** and enable your earlier mod if needed.

Test the edited event in a private Deadlock session. The app preview plays the clip directly. Deadlock can apply event gain and other playback behavior in game.
