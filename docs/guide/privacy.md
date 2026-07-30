---
title: Privacy and what leaves your machine
description: Grimoire has no telemetry. Here is every network request it can make, what triggers each one, and how to verify a download.
slug: privacy
order: 25
updated: 2026-07-29
---

# Privacy and what leaves your machine

**Grimoire has no telemetry.** No usage tracking, no heartbeat, no analytics. A fresh install phones home for nothing, and there is no server anywhere that counts you.

This page lists every outbound request the app can make, so you can check that claim rather than take it on trust.

## Out of the box

A default install talks to exactly one place: **GameBanana**, and only when you ask it to.

- **Browsing and searching** queries GameBanana's API. Grimoire keeps a local copy of the catalog so most searching is offline, and refreshes it in the background.
- **Installing a mod** downloads the file from GameBanana.

That is the whole list. No account, no identifier, nothing about your machine or your mods.

## Update checks

Grimoire checks GitHub for a new release shortly after launch, and when you press the button. It asks for the release list and nothing else.

On Linux installs from a package manager (apt, AUR, snap, flatpak), the in-app updater is disabled entirely and no check happens, because your package manager owns updates.

## Language packs

Only English ships with the app. Choosing another language downloads it from Grimoire's public GitHub repository, once, and caches it so it works offline afterward.

These are plain requests for public files. No account, no identifier.

## Everything else is opt-in

The features that talk to anything beyond the above are all off by default, behind **Settings > Experimental Features**. None of them turns on by itself.

### Stats

Sends the **numeric Steam account ID** of any player you choose to track to `deadlock-api.com`, a community-run service, to look up their rank and match history. Also asks Steam for that account's public display name and avatar.

Nothing about your mods is involved. See [player stats](./stats.md).

### Discover

Signing in uses Steam's own login page. **Grimoire never sees your Steam password.**

Publishing a profile uploads its title, description, and the list of GameBanana mods it references, plus any console commands and crosshair the profile carries.

One thing to know that the app does not spell out: **while Discover is enabled, Grimoire checks for new published profiles every couple of minutes for as long as it is open**, whether or not you have the tab open. That drives the sidebar badge. Turn the toggle off if you would rather it did not.

If you have ever signed in, Grimoire also checks your session at startup even with the toggle off, because the saved session still exists. **Sign out** to stop that. See [Discover](./discover.md).

### Deadworks Servers

The server list comes from a third-party registry. To show you a ping, **your machine sends a packet directly to every server in the list**, which means those operators can see your IP before you join anything. See [servers](./servers.md).

### Contributing match data

**Settings > Privacy & Content > Contribute match data to deadlock-api.com.** Off by default.

Uploads four numbers per match: the match id, the server cluster, and two replay download keys that Steam already cached on your machine. **No account id, no username, nothing about you or your mods.**

### Discord Rich Presence

**Settings > Preferences.** Off by default.

Shows what you are doing in Grimoire on your Discord profile. It talks only to the Discord app on your own machine, over a local socket. Nothing goes to Grimoire.

## Things worth being precise about

**Images load from third parties.** Mod thumbnails come from GameBanana and avatars from Steam, so those services see your IP whenever a page showing them renders. That is unavoidable for any app that displays remote images.

**Grimoire cannot speak for anyone else's logging.** GameBanana, GitHub, Steam, and deadlock-api.com receive your IP address as part of any normal web request, and what they retain is their business, not something this project can promise anything about. What Grimoire can say is what it sends, and that is what this page lists.

## Bug reports are sanitized

The report generator in **Settings > Support** strips home directory paths, Steam IDs, tokens, and email addresses before anything is shown to you.

**Nothing is sent automatically.** You generate it, read it, and paste it yourself.

## Verifying what you downloaded

Grimoire is open source, so you can read the code or build it yourself.

Every release ships a `SHA256SUMS` file. Check your download against it with `sha256sum -c SHA256SUMS` on Linux or `Get-FileHash <file>` in PowerShell.

Releases also publish build provenance attestations that tie each installer back to the exact commit and workflow run that produced it:

```
gh attestation verify <file> --owner Slush97
```

Windows installers are not yet code-signed, so Windows will warn about an unknown publisher on first run. Click **More info** then **Run anyway**. Free signing through an open source program is being pursued.
