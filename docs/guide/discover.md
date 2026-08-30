---
title: Discover
description: Browse mod loadouts published by other Grimoire players, import them, and publish your own.
slug: discover
order: 26
updated: 2026-07-29
---

# Discover

**Discover** is a feed of mod loadouts published by other Grimoire players. Importing one needs no account. Liking and publishing need you to sign in with Steam.

Turn it on in **Settings > Experimental Features > Grimoire Social**.

What gets shared is a **recipe, not the mods**. A published profile is a list of which GameBanana mods to fetch, so importing one downloads them from GameBanana the same way Browse does.

## Browsing and importing

**Top** and **New** sort the feed. Cards show thumbnails, title, who published it, how many mods, and likes.

Click any card to open it. Grimoire pulls the loadout, resolves each mod against GameBanana, and shows you what it found. Tick what you want and import.

This is the same import flow as a share code, including the ability to deselect mods, skip NSFW, and swap variants. See [sharing a profile](./profiles-sharing.md).

Importing reports nothing back. Nobody is told you imported their profile, and there is no view or download counter.

## Signing in

Click **Sign in with Steam**. Your browser opens to Steam's own login page.

**Grimoire never sees your password.** You authenticate on Steam's site, and Grimoire receives only a session token afterward. That token is held by Grimoire's background process and is never exposed to the part of the app that renders the interface.

What becomes public is your **Steam display name and avatar**, shown on anything you publish.

**On Linux without a keyring**, Grimoire refuses to store your session on disk rather than store it unencrypted. You will see a **Session only** badge and need to sign in again each launch. That is deliberate.

## Publishing

Click **Publish profile**, pick a local profile, add a title and optional description, and publish.

Understand what goes with it. The app's consent notice mentions the title, description, and mod list, but the upload also carries anything else the profile holds:

- Your **console commands** from `autoexec.cfg`
- Your **crosshair settings**
- The **local name** you gave the profile
- Your Grimoire version and the export timestamp

Viewers see badges for the crosshair and the command count. If your autoexec contains anything you would not post publicly, take it out of the profile first.

Local mods are dropped, since nobody else could fetch them.

Limits: 80 characters of title, 1000 of description, 100 mods, and one publish every ten minutes.

## After publishing

**Your profile** collects everything you have published.

**You cannot change the mod list of a published profile.** Only the title and description are editable. Changing the mods means unpublishing and publishing again, which resets the like count and gives it a new link.

**Unpublish** removes it from the feed. People who already imported it keep their copy.

## Reporting

Signed-in users get a **Report** button on any profile, with an optional note.

Reports go to a single maintainer who reviews them by hand. There is no automated scanning and no notification back to you. Profiles can be removed and accounts banned for community-guideline violations.

There are no comments anywhere in Discover, which removes an entire category of moderation problem.

## Background activity

Worth knowing, because it is not obvious: **while Grimoire Social is enabled, Grimoire checks for new published profiles every couple of minutes for as long as the app is open**, even if you never open the Discover tab. That is what puts the blue badge on the sidebar.

If you would rather it not, turn the **Grimoire Social** toggle off.

One related detail: if you have ever signed in, Grimoire checks your session at startup even with the toggle off, because your saved session is still there. **Sign out** to stop that.

## Deleting your account

**Settings > Grimoire Social > Delete account.**

Hard deleted: your account, your Steam link, and every like you cast.

Kept: your published profiles remain stored server-side but stop appearing anywhere, so that people who imported them keep working references. Any reports you filed are also kept.

Signing in again creates a brand new account rather than restoring the old one.

Other devices you are signed in on are not logged out immediately; those sessions expire on their own.
