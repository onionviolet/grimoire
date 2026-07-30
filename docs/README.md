# Grimoire documentation

Two audiences live here. Pick your tree.

- **[`guide/`](./guide/)** is for people who use Grimoire. Task pages, one screen each. These publish to `grimoiremods.com/docs`.
- Everything else is for people who work on Grimoire: contracts, integration specs, and the research behind them.

Ops that span the whole workspace (deploy targets, secrets, release sequence) live one level up in [`../../OPERATIONS.md`](../../OPERATIONS.md).

## Status vocabulary

Every doc carries a status banner under its title. It tells you how much to trust it.

| Status | Means |
|---|---|
| **Living** | Describes shipped behavior or a stable contract. Kept current. Fix it when you change the thing it describes. |
| **Research** | A dated investigation. The findings stood when written and live code may cite them, but nobody maintains the file. |
| **Design** | Intent captured before or during the build. The code has since shipped and is now the truth. Read for the why. |
| **Archived** | Superseded or ephemeral. History only. Lives in [`archive/`](./archive/). |

If you write a new doc, give it a banner. If you notice a Living doc has drifted, either fix it or downgrade it. A wrong Living doc costs more than no doc.

## Reference: formats and contracts

Stable interfaces. Read these before changing the code behind them.

| Doc | Status | What it pins down |
|---|---|---|
| [profile-spec.md](./profile-spec.md) | Living | The portable profile format: `mp1:` share codes and `.modprofile.json` |
| [vpk-modinfo-spec.md](./vpk-modinfo-spec.md) | Living | Embedded VPK identity metadata, v1. Self-contained enough to implement from |
| [vpk-metadata-embed-integration.md](./vpk-metadata-embed-integration.md) | Living | How Grimoire imprints VPKs with that metadata |
| [social-architecture.md](./social-architecture.md) | Living | Scope and shape of the grimoire-social companion service |
| [social-architecture-decisions.md](./social-architecture-decisions.md) | Living | ADRs for the above. Append-only, never edit a shipped entry |

## Reference: external APIs

Contract notes for services Grimoire talks to. When one of these drifts, Grimoire breaks in production.

| Doc | Status | Covers |
|---|---|---|
| [gamebanana_api_reference.md](./gamebanana_api_reference.md) | Living | GameBanana endpoints, shapes, and quirks |
| [gamebanana_categories_reference.md](./gamebanana_categories_reference.md) | Living | Deadlock category taxonomy on GameBanana |
| [deadlock-api-architecture.md](./deadlock-api-architecture.md) | Living | How the Stats system integrates deadlock-api.com |
| [DEADLOCK_STATS_API.md](./DEADLOCK_STATS_API.md) | Living | Endpoint-level reference for deadlock-api.com |
| [deadworks-servers.md](./deadworks-servers.md) | Living | Deadworks relay, content provisioning, and the gameinfo weave |

## Subsystems

How a given feature actually works.

| Doc | Status | Covers |
|---|---|---|
| [multi-folder-addon-overflow.md](./multi-folder-addon-overflow.md) | Living | Overflowing past the 99-mod-per-folder ceiling into `addons1`, `addons2`, ... |
| [performance-config-integration.md](./performance-config-integration.md) | Living | The six pinned performance presets and why upstream is curated, not ingested |
| [hero-pose-locker.md](./hero-pose-locker.md) | Living | Live 3D hero poses in the Locker |
| [ability-vfx-recolor.md](./ability-vfx-recolor.md) | Living | Extracting a hero's ability particles as a layer, then recoloring them |
| [hero-sound-codenames.md](./hero-sound-codenames.md) | Living | The two hero codename namespaces and where they disagree |
| [per-ability-sound-map.md](./per-ability-sound-map.md) | Living | Generated map of every hero's four ability slots to sound files |
| [discord-rpc-setup.md](./discord-rpc-setup.md) | Living | Opt-in Discord Rich Presence |
| [apt-repo.md](./apt-repo.md) | Living | The Debian/Ubuntu apt repo, and why the in-app updater cannot handle `.deb` |

## Process and conventions

| Doc | Status | Covers |
|---|---|---|
| [ui-conventions.md](./ui-conventions.md) | Living | House rules for renderer UI: primitives first, tokens not raw values |
| [design-overhaul-brief.md](./design-overhaul-brief.md) | Living | Source of truth for the dark theme tokens |
| [localization.md](./localization.md) | Living | The Weblate round trip, for maintainer, developer, and translator |

## Research and design history

Not maintained. Useful for the reasoning, not the current state.

| Doc | Status | Covers |
|---|---|---|
| [3d-preview-fidelity-plan.md](./3d-preview-fidelity-plan.md) | Research, 2026-06-16 | Four axes for closing the gap between the 3D preview and in-game |
| [3d-preview-effects-feasibility.md](./3d-preview-effects-feasibility.md) | Research, 2026-06-16 | Whether particle FX can run in the Locker preview |
| [foundry-tab-design.md](./foundry-tab-design.md) | Design, 2026-06-20 | The original Foundry vision, now shipped as Door Stuck |
| [locker-hero-card-apply.md](./locker-hero-card-apply.md) | Design, 2026-05-27 | The Locker hero card apply pipeline, since built |
| [archive/foundry-handoff.md](./archive/foundry-handoff.md) | Archived | Point-in-time branch state from the Foundry build |

## Other directories

- `database/` has its own [README](./database/README.md): schema, IPC, and internal mappings.
- `screenshots/` holds the images the root README and the guide use.
- `tauri-export/` is exported reference material from the vpkmerge GUI prototype.
