---
title: Browsing mod sites inside Grimoire
description: The in-app browser, what it deliberately refuses to do, and how a download from it reaches your library.
slug: browser
order: 29
updated: 2026-08-30
---

# Browsing mod sites inside Grimoire

Turn on **Settings > Experimental Features > In-app browser** to get a **Browser** tab for mod sites, so finding a mod does not mean alt-tabbing.

It is a convenience, not a mod source. Installing still happens through [Browse](./installing-mods.md).

## Getting somewhere

Type an address in the bar, or pick from the start page, which groups known destinations as **Mod hosts**, **Tools**, **Reference**, and **Community**. **Home** returns there.

**Open in your browser** hands the current page to your real browser, which is what you want for anything involving a login.

## What it will not do

This is the part worth knowing before you trust it with anything.

**It does not install.** A download does not silently become a mod. For most sites the file is handed to your real browser and Grimoire is done with it.

**It does not run pages with any access to the app.** Pages are isolated from Grimoire, and popups go to your real browser.

**It blocks ads and trackers.** The filter lists are built into the app, so the blocking itself makes no network request. See [privacy](./privacy.md).

## Downloads from tool sites

There is one exception to the hand-off above. For sites in the **Tools** group, Grimoire recognizes a downloaded mod file and asks:

> Add this download to your mod library?

Nothing is added unless you press **Add to library**. **Discard** throws it away. If the download does not finish, nothing is added and the app says so.

Grimoire is deliberately narrow here: only tool-group sites do this. A download from a mod host or any address you typed yourself goes to your real browser like any other.

## GameBanana pages

Land on a GameBanana mod and a note appears offering **Review in Browse**. That takes you to Grimoire's own page for the same mod, where the install button and the conflict checks live. Prefer it over downloading the file by hand.

## If a page will not load

The browser says **Page failed to load** and nothing more, because it has no special insight into someone else's site. Try **Open in your browser**. If it works there and not here, the site is doing something the isolated view refuses, and your real browser is the right tool for it.
