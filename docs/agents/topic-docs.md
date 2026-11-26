<!-- Source for Codex. Claude Code loads the twin .claude/rules/topic-docs.md by paths: frontmatter. Keep the text below identical in both files. -->
# Feature topic docs

## Read before touching

| Area | Doc |
|---|---|
| Manager-neutral mod transfer | `docs/mod-interchange.md` |
| Portable profiles (`mp1:` codes, `.modprofile.json`) | `docs/profile-spec.md` |
| Social layer, ADRs (append-only, never edit a shipped ADR) | `docs/social-architecture.md`, `docs/social-architecture-decisions.md` |
| `gameinfo.gi` handling, Deadworks servers | `docs/deadworks-servers.md` |
| `citadel/grimoire` priority root, load order | `docs/locker-global-mods.md` |
| macOS / CrossOver, `steamRoots.ts`, `bottleLaunch.ts` | `docs/macos.md` |
| Ability VFX recolor (`detectVfxLayer`/`extractVfxLayer`) | `docs/ability-vfx-recolor.md` |
| Performance config presets | `docs/performance-config-integration.md` |
| Crosshair math | `docs/crosshair-geometry.md` |
| Foundry ("Door Stuck") | `docs/foundry-tab-design.md` |
| VPK embedded metadata | `docs/vpk-modinfo-spec.md`, `docs/vpk-metadata-embed-integration.md` |
| GameBanana API | `docs/gamebanana_api_reference.md`, `docs/gamebanana_categories_reference.md` |
| deadlock-api.com (stats) | `docs/deadlock-api-architecture.md`, `docs/DEADLOCK_STATS_API.md` |

## Doc details

Design docs and references live in `docs/`:

- `profile-spec.md` - The portable profile format (`mp1:` share codes, `.modprofile.json`). Read this before touching `electron/main/services/portableProfile.ts` or the import/export UI.
- `gamebanana_api_reference.md` + `gamebanana_categories_reference.md` - GameBanana API contract notes
- `deadlock-api-architecture.md` + `DEADLOCK_STATS_API.md` - deadlock-api.com integration
- `design-overhaul-brief.md` - UI design language reference
- `social-architecture.md` + `social-architecture-decisions.md` - Architecture and ADRs for the planned `grimoire-social` companion service (see below)
- `ability-vfx-recolor.md` - Hero ability VFX layer extraction + in app recoloring. Read before touching `detectVfxLayer`/`extractVfxLayer` (in `vpk.ts`/`modMerger.ts`) or building the recolor/Locker surface. Covers why particle recolor must use an in place scalar patch, not a KV3 re-encode.
- `locker-global-mods.md` - "Global" mods: the `citadel/grimoire` priority root that outranks every other mod. Read before touching grimoire-folder handling, the `modLoadOrder` helpers, or the shuffle planner. Covers the deliberate split between `globalType` (classification, labelled "General") and `priorityMod` (placement, labelled "Global").
- `macos.md` - Why macOS needs a CrossOver bottle, how Steam roots are discovered there, and how launching differs. Read before touching `steamRoots.ts`, `bottleLaunch.ts`, or any per-platform Steam path list. Covers why the three old hardcoded path lists were collapsed into one module, and why the shipped mac build is arm64-only and cannot auto-update.
- `deadworks-servers.md` - The Deadworks server browser: relay data flow, content provisioning, and (critically) how the deadworks content path is woven into grimoire's canonical `gameinfo.gi` block so Fix Configuration never erases it. Read before touching `deadworksServers.ts`, `ipc/servers.ts`, or the gameinfo handling in `system.ts`/`deadlock.ts`.

## Feature notes

- **Portable Profile Export/Import** - share profiles via `mp1:` share codes or `.modprofile.json` files (Grimoire-only format; see `docs/profile-spec.md`)
- **Deadworks Server Browser** - browse/join community dedicated servers; auto-downloads required map/addon content before connecting (gated behind `experimentalDeadworksServers`; see `docs/deadworks-servers.md`)
- **The portable profile format is Grimoire-only.** Don't claim compatibility with other mod managers in copy.
