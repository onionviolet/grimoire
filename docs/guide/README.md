# Grimoire user guide

Player-facing documentation. These pages publish to `grimoiremods.com/docs/<slug>`, and the app links into them.

Writing one? Read [STYLE.md](./STYLE.md) first. The short version: one page, one task, one screen, answer in the first sentence.

## Pages

| Page | Slug | Answers |
|---|---|---|
| [Setting up Grimoire for the first time](./first-run.md) | `first-run` | Where is my game, and why do I have to click Fix |
| [Installing mods](./installing-mods.md) | `installing-mods` | Browse, one-click, collections, and local files |
| [Load order and the mod limit](./load-order.md) | `load-order` | Which mod wins, how to reorder, what happens past 99 |
| [When two mods conflict](./conflicts.md) | `conflicts` | What the Conflicts tab is telling me and whether to care |
| [Launching modded or vanilla](./launching.md) | `launching` | How vanilla works without uninstalling anything |
| [Saving mods for later](./saved.md) | `saved` | Bookmark a mod without installing it |
| [Fixing mods that do not load](./troubleshooting.md) | `troubleshooting` | Mods are installed but the game is unmodded |

## The Locker

Its own set, because the Locker holds two different kinds of thing and conflating them is the main source of confusion. Read [What the Locker is](./locker.md) first; the rest assume it.

| Page | Slug | Answers |
|---|---|---|
| [What the Locker is](./locker.md) | `locker` | Why some cosmetics ignore my load order and mod limit |
| [Managing skins in the Locker](./locker-skins.md) | `locker-skins` | Equip, order, preview, and shuffle a hero's skins |
| [Hero cards](./locker-cards.md) | `locker-cards` | Swap card art, or build my own from my images |
| [Per-ability sounds](./locker-sounds.md) | `locker-sounds` | One sound per ability, without mods fighting |
| [Recoloring abilities and painting skins](./locker-effects.md) | `locker-effects` | Repaint ability VFX, paint the body and gun |
| [Global cosmetics](./locker-global.md) | `locker-global` | Non-hero cosmetics, and building props from a `.glb` |
| [Tutorial: a custom soul container from Sketchfab](./locker-glb-tutorial.md) | `locker-glb-tutorial` | Walk me through one, start to finish |
| [Reviewing and removing Locker overrides](./locker-overrides.md) | `locker-overrides` | Where did everything I applied go |

## Profiles

| Page | Slug | Answers |
|---|---|---|
| [Saving and swapping mod profiles](./profiles.md) | `profiles` | Save a loadout and get it back later |
| [Sharing a profile](./profiles-sharing.md) | `profiles-sharing` | Send my setup to someone, or import theirs |
| [Snapshots and rolling back](./snapshots.md) | `snapshots` | Undo a bad update or a wrong profile |

## Tuning and customizing

| Page | Slug | Answers |
|---|---|---|
| [Designing a crosshair](./crosshair.md) | `crosshair` | Build one, and actually get it into the game |
| [Console commands and launch options](./autoexec.md) | `autoexec` | Run commands at game start |
| [Performance presets](./performance-presets.md) | `performance-presets` | More fps without breaking my mods |
| [Customizing how Grimoire looks](./appearance.md) | `appearance` | Accent, glow, sidebar art, language |
| [Seeing your resolved game settings](./config.md) | `config` | Which value my game actually uses, and what set it |

## Optional features

| Page | Slug | Answers |
|---|---|---|
| [Experimental features](./experimental-features.md) | `experimental-features` | Where is the feature I read about |
| [Player stats](./stats.md) | `stats` | Track rank and match history |
| [Discover](./discover.md) | `discover` | Share loadouts with other players |
| [Deadworks community servers](./servers.md) | `servers` | Join a community server |
| [Replacing a hero's sound](./door-stuck-sounds.md) | `door-stuck-sounds` | Swap a sound for my own audio |
| [Browsing mod sites inside Grimoire](./browser.md) | `browser` | Find mods without leaving the app |
| [Building a custom chat wheel](./chat-wheel.md) | `chat-wheel` | Make a ChatLane wheel and install it |

## Trust

| Page | Slug | Answers |
|---|---|---|
| [Privacy and what leaves your machine](./privacy.md) | `privacy` | What does this app send, and to whom |

## Still to write

Uninstalling cleanly · a Browse page (filters, hidden creators, NSFW modes) · Installed page depth beyond load order.

## Slugs are a contract

The app links to these by slug. Renaming one breaks every in-app link that points at it, so if you rename, update the links in the same change.
