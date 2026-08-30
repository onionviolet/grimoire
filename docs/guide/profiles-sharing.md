---
title: Sharing a profile
description: Send your loadout to someone as a share code or a file, and import one you were sent.
slug: profiles-sharing
order: 17
updated: 2026-07-29
---

# Sharing a profile

Click the share icon on any profile card. Grimoire gives you two ways to hand it over: **Copy share code** for a line of text you can paste into Discord, or **Save .modprofile.json file** for a file.

Both contain the same thing: a list of which GameBanana mods to get and what order to put them in. No mod files are included, so both are tiny.

## Before you share

**Local mods do not travel.** Anything you installed from your own disk rather than from GameBanana is dropped, because the recipient has no way to fetch it. Grimoire warns you and lists what it skipped.

If your loadout is built around hand-installed VPKs, the person receiving it gets an incomplete version of it.

Note that the export also carries **your console commands and your crosshair**, if the profile has them. That is usually what you want when sharing a loadout, but it is worth knowing before you post one publicly.

## Importing one

1. On **Profiles**, click **Import**.
2. Paste the share code, or use **Or load from file**.
3. Click **Parse & resolve**. Grimoire looks up every mod on GameBanana.
4. Review what it found, then click **Import**.

Grimoire downloads the mods it can get and creates a new profile from them.

**Importing does not turn anything on.** Downloads land disabled, and you still have to click **Apply** on the new profile. Importing also always creates a new profile rather than updating an existing one.

## What the resolve step is telling you

Each mod gets a status:

| Status | Meaning |
|---|---|
| **exact** | The exact file the sharer used is still available |
| **On disk** | You already have it, so it will not be re-downloaded |
| **upgraded** | The original file is gone, so a different file from the same mod will be used instead |
| **unresolvable** | The mod is gone from GameBanana. It cannot be imported and is left out |

**upgraded** is the one to watch. You are getting a different version than the sharer had, which usually is fine and occasionally is not.

Unresolvable mods cannot be ticked. There is nothing to do about them beyond finding a replacement yourself.

## Adjusting before you commit

You do not have to take the whole thing:

- Untick any mod you do not want.
- **Skip NSFW** drops adult content in one click.
- Rename it with **Save as** before importing.
- Where a mod ships several variants, pick a different one than the sharer pinned. **Show all variants** fetches the full file list for every mod so you can swap any of them.
- If the profile carries console commands, a bar offers to include them. **This is ticked by default**, so untick it if you do not want someone else's settings written into your `autoexec.cfg`.

## If the share code is too big

Share codes are capped at a size that comfortably covers most loadouts, but a very large one can exceed it. Grimoire tells you and suggests exporting to a `.modprofile.json` file instead, which has no such limit.

Roughly, a 77-mod profile makes a share code around 4 KB, which pastes into Discord without trouble.

## Publishing to Discover

If you are signed in to Grimoire Social, profile cards also get a globe icon to publish to Discover.

You supply a title and an optional description, and accept the terms once. What gets uploaded is the title, the description, and the same share code as above, which means your console commands and crosshair go public with it.

Profiles with no GameBanana mods cannot be published, since there would be nothing for anyone to install.

## The format

Share codes start with `mp1:` and files use `.modprofile.json`.

**This format is Grimoire-only.** Other mod managers do not read it, whatever the file extension suggests.
