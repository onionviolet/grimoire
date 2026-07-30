<div align="center">
 <img width="684" height="214" alt="image" src="https://github.com/user-attachments/assets/fc1917ed-b8a0-4671-ad2c-9389e8b830d9" />
  <h1>Grimoire</h1>
  <p>A mod manager for Deadlock, with a personal customization workshop.</p>

  [![Website](https://img.shields.io/badge/grimoiremods.com-f97316)](https://grimoiremods.com)
  [![Release](https://img.shields.io/github/v/release/onionviolet/grimoire?label=release)](../../releases/latest)
  [![GitHub downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fgrimoiremods.com%2Fapi%2Fdownloads-badge.json)](../../releases)
  [![GameBanana downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fgrimoiremods.com%2Fapi%2Fgamebanana-badge.json)](https://gamebanana.com/tools/22583)
  [![apt installs](https://img.shields.io/endpoint?url=https%3A%2F%2Fgrimoiremods.com%2Fapi%2Fapt-badge.json)](https://apt.grimoiremods.com)
  [![AUR](https://img.shields.io/aur/version/grimoire-bin?label=aur)](https://aur.archlinux.org/packages/grimoire-bin)
  [![CI](https://img.shields.io/github/actions/workflow/status/onionviolet/grimoire/ci.yml?branch=main&label=ci)](../../actions/workflows/ci.yml)
  [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
</div>

> **Personal independent fork.** This is maintained primarily for its author's own Deadlock setup and experimentation, but anyone is welcome to use, inspect, adapt, or contribute to it under the MIT license. It remains built on the work of the original Grimoire project; please support its creator through [GitHub](https://github.com/Slush97/grimoire), [grimoiremods.com](https://grimoiremods.com), or its [Discord community](https://discord.gg/KgYGHEMq2P).

## About this fork

This fork keeps the upstream mod-manager experience as its foundation, while
exploring a local, player-focused customization workshop. The aim is to make
common setup and cosmetic workflows easier to understand, change, recover, and
share without trying to replace specialist creation tools.

The upstream project remains the best reference for the core Grimoire
experience. Fork-specific work is called out below so players can distinguish
the established baseline from features still being refined here.

## Install

[Latest release →](../../releases/latest)

- Windows: `Grimoire-Setup-x.y.z.exe`
- Linux: `.AppImage` or `.deb`
- Arch Linux: `yay -S grimoire-bin` ([AUR](https://aur.archlinux.org/packages/grimoire-bin))

### Debian / Ubuntu (apt)

Install and stay updated through apt:

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://apt.grimoiremods.com/grimoire.gpg | sudo tee /etc/apt/keyrings/grimoire.gpg >/dev/null
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/grimoire.gpg] https://apt.grimoiremods.com stable main" | sudo tee /etc/apt/sources.list.d/grimoire.list >/dev/null
sudo apt update && sudo apt install grimoire
```

Afterwards `sudo apt upgrade` keeps it current. More detail: [docs/apt-repo.md](docs/apt-repo.md).

Requires Deadlock installed via Steam.

## Features

**Mods**

- Browse and install from GameBanana: download queue, automatic ZIP/7Z/RAR extraction, one-click `gb1click://` installs, and collection import by URL
- Enable, disable, reorder, bulk-select, and delete, backed by an offline catalog with full-text search
- Conflict detection for mods that overwrite the same game files
- Merge several mods into one VPK (and pull individual sources back out)
- Repair model-mod load order when compatibility requires one mod to win over another

**Play**

- Launch Modded or Launch Vanilla straight from the sidebar. Vanilla temporarily stashes your mods and auto-restores them once the game starts

**Locker**

- Organize cosmetic skins per hero with 2D and live 3D pose previews
- Recolor a hero's ability VFX (solid, gradient, or rainbow)
- Per-ability sound picker, plus a Global axis for soul containers and other non-hero cosmetics

**Autoexec & Profiles**

- Autoexec manager for console commands that run at game launch
- Save and swap sets of enabled mods, and share them as short `mp1:` codes or `.modprofile.json` files (Grimoire-only format)

**Experimental** (opt in under Settings)

- Discover: sign in with Steam to publish your profiles and browse uploads from other players
- Stats: MMR, match history, and hero stats from deadlock-api.com
- Crosshair designer with live preview

Offline-first and no telemetry: a fresh install phones home for nothing.

## Fork additions and current progress

This fork is actively developing the following player workflows:

- Saved GameBanana mods: save, organize, preview, update, import, export, and swap saved-mod profiles without downloading every mod first
- Game engine selection for installations with more than one usable engine or build
- Advanced `gameinfo.gi` HUD controls and a ChatLane chat-wheel editor
- Locker and Foundry workflows for launch-time visual, hero-sound, and hero-card shuffle pools, including locally imported assets

These additions have not yet had the same breadth of real-world testing as the
core mod manager. Keep backups of important profiles and game configuration,
try new workflows with a small mod set first, and report reproducible problems
through [Issues](../../issues). See [CHANGELOG.md](CHANGELOG.md) for the
detailed release history.

## Screenshots

|  |  |
| :---: | :---: |
| ![Installed mods](docs/screenshots/installed.png)<br>**Installed**: enable, disable, reorder, bulk-select | ![Browse GameBanana](docs/screenshots/browse.png)<br>**Browse**: GameBanana media cards and filters |
| ![Hero Locker](docs/screenshots/locker.png)<br>**Locker**: cosmetic skins organized by hero | ![Skin with 3D preview](docs/screenshots/locker-3d-celeste.png)<br>**Skins**: per-hero, with a live 3D pose preview |
| ![Ability recolor](docs/screenshots/locker-recolor.png)<br>**Recolor**: shift a hero's ability VFX to any color | ![Per-ability sounds](docs/screenshots/locker-sounds.png)<br>**Sounds**: per-ability sound picker |
| ![Global cosmetics](docs/screenshots/global-soul-containers.png)<br>**Global**: soul containers and other non-hero cosmetics, in 3D | ![Profiles](docs/screenshots/profiles.png)<br>**Profiles**: save, swap, and share mod sets |

## Development

Grimoire shares wire-format types with its companion service,
[grimoire-social](https://github.com/Slush97/grimoire-social), through a
workspace package resolved from `../grimoire-social`. Clone both side by side,
or `pnpm install` fails with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. Needs Node 20+
and pnpm 10+.

```bash
git clone https://github.com/onionviolet/grimoire.git
git clone https://github.com/Slush97/grimoire-social.git

cd grimoire-social
pnpm install

cd ../grimoire
pnpm install
pnpm exec electron-rebuild -f -w better-sqlite3
pnpm dev
```

Package builds: `pnpm package:win` or `pnpm package:linux` (both require
`GRIMOIRE_SOCIAL_BASE_URL` set to an https URL).

More detail in [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Grimoire is open source. Users are encouraged to read the code, build
from source, or audit any release artifact themselves before running
it. Reports of security or trust concerns are welcome via
[Issues](../../issues).

Each release ships a `SHA256SUMS` file listing the hash of every
installer. Verify a download with `sha256sum -c SHA256SUMS` (Linux) or
`Get-FileHash <file>` (PowerShell) and compare against the listing.
Releases also publish [build provenance attestations](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
that tie each artifact back to the exact commit and workflow run that
produced it; verify with `gh attestation verify <file> --owner onionviolet`.

Windows installers are not yet code-signed, so SmartScreen will show an
"Unknown Publisher" warning on first run: click **More info → Run
anyway** to proceed. Free Authenticode signing through the SignPath
Foundation OSS program is being pursued.

## License

MIT
