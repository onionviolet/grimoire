---
title: Player stats
description: Track ranked score, match history, and hero performance for any Steam account, and understand exactly what gets sent where.
slug: stats
order: 15
updated: 2026-07-29
---

# Player stats

**Stats** shows Deadlock ranked data for Steam accounts you choose to track. Turn it on in **Settings > Experimental Features > Stats Dashboard**, then add a player.

There is no login. You never give Grimoire a password, and there is no account to make.

## Adding a player

1. Enable **Stats Dashboard**. A **Stats** item appears in the sidebar.
2. Open it and click the player dropdown, top right.
3. Pick an account under **Detected Steam users**, or paste an ID into **Steam ID or Account ID...** and press Enter.

Grimoire reads your local Steam login file to suggest accounts, which is why yours probably appears without you typing anything. That check is entirely local.

Pasting works with an account ID, a SteamID64, or a `steamcommunity.com/profiles/<digits>` URL. **Vanity URLs do not work.** If your profile is `steamcommunity.com/id/yourname`, open it and grab the numeric ID instead.

You can track more than one account. Star one to make it primary, and it gets selected automatically when you open the tab.

## The four tabs

| Tab | What it shows |
|---|---|
| **Overview** | Ranked score with your rank badge, a ranked trajectory chart, recent matches, and lifetime per-hero performance |
| **Matches** | Match history grouped by day, with hero, result, K/D/A, and souls |
| **Social** | Best teammates and frequent opponents, by win rate together |
| **Leaderboard** | The regional top 50, for NA, EU, Asia, SA, and OCE |

**Leaderboard** works without tracking anyone. The other three need a player selected.

## Refreshing

Nothing polls in the background. Data loads when you open the tab and when you press **Refresh**.

**Refresh** pulls new matches since the last one it saw, so it gets faster over time rather than slower.

## Two numbers that will not agree

This trips people up, so it is worth knowing up front.

The **Overview** tiles for Matches, Win Rate, KDA, and best streak are built from **matches Grimoire has recorded locally**. It starts with your most recent 20 when you add the account, then grows forward from there.

**Hero Performance** on the same page is **lifetime data** from the API.

So your tile might say 40 matches while Hero Performance reflects hundreds. Both are correct, they are just counting different things. Older history does not backfill, so the tiles catch up only by playing.

## Where the data comes from

`deadlock-api.com`, a community-run service. It is not Valve and not affiliated with Grimoire.

A match appears only once that service has ingested it. If it never ingests a match, that match never shows up here, and there is nothing Grimoire can do about it.

The **Social** tab needs at least 3 shared matches with someone before they appear.

## What leaves your machine

Grimoire has no telemetry, and Stats does not change that. It is off by default and sends nothing until you turn it on and add an account. Once you do, these requests happen:

- **api.deadlock-api.com** receives the **numeric account ID** of any player you track, to look up their profile, rank, match history, and hero stats. On the Social tab it also receives the IDs of teammates and opponents it is resolving names for.
- **steamcommunity.com** receives the SteamID64 of each tracked player, to fetch the current display name and avatar.
- **assets.deadlock-api.com** is asked for hero and rank artwork. No account ID is involved.
- **statlocker.gg** is only contacted when you click a Statlocker link, which opens in your browser.

Every request carries your IP address and Grimoire's version, as any web request does. No API key, no cookies, no login token, and nothing about your mods.

What those third parties log on their end is their business and not something Grimoire can speak to.

## Contributing match data

Separately, **Settings > Privacy & Content** has **Contribute match data to deadlock-api.com**. It is **off by default** and works whether or not Stats is enabled.

Switched on, it reads replay keys that Steam has already cached for matches you viewed in game, and uploads them so the community service can fetch those replays.

It sends **four numbers per match**: the match id, the server cluster, and two download keys. No account ID, no username, nothing about you or your mods.

## Stored on your machine

Everything fetched is cached in a `stats.db` file in Grimoire's app data folder.

**Remove player** in the dropdown deletes that account and all of its recorded matches, snapshots, and aggregates. There is no single button that wipes the whole stats database, so to clear everything, remove each player, or delete the file.
