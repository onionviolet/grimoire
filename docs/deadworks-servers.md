# Deadworks server browser

> **Status:** Living. Describes shipped behavior or a stable contract. Reviewed 2026-07-29.

Lets Grimoire users browse and join Deadworks community dedicated servers from a
**Servers** tab. Gated behind the `experimentalDeadworksServers` setting.

Joining is fully cross-platform: nothing here needs the Windows `deadworks.exe`.
Hosting a Deadworks *game server* still requires Windows (Valve ships no Linux
Deadlock dedicated binary), but that is out of scope for the client.

## Data flow

```
Servers.tsx ── api.ts ── IPC (ipc/servers.ts) ── services/deadworksServers.ts ── relay HTTP
                                                                              └── Steam (steam://connect)
```

1. **List**: `GET <relay>/v1/servers` (falls back to `/api/servers` for a
   deadworks-shaped relay). Each row is A2S-pinged over UDP (`pingServer`).
2. **Join** (`prepareAndConnect`):
   - `GET <relay>/v1/servers/:id/content` -> manifest of `.vpk.bz2` items
     (`kind: map | addon`, `version`, `download_url`).
   - Ensure `gameinfo.gi` mounts the deadworks content path (see below).
   - For each item not already at the manifest `version`: download the
     `.vpk.bz2`, decompress via the bundled 7-Zip (`7zip-bin`), verify the VPK
     magic (`0x55aa1234`), then atomically rename onto the canonical path. A
     `deadworks_cache/versions.json` ledger skips already-current files.
   - Open `steam://connect/<ip:port>` via `shell.openExternal`.

Maps land in `citadel/maps`; addons in `citadel/deadworks_addons/vpks`.

## gameinfo.gi integration (the load-bearing part)

Grimoire **owns and rewrites the entire `SearchPaths` block** of `gameinfo.gi`
(`system.ts`, canonical `SEARCH_PATHS_BLOCK`). A Deadworks-style `addonroot`
line added out-of-band would be erased the next time the user runs Fix
Configuration. So the Deadworks content path is a first-class, conditional line
**inside grimoire's own canonical block**, exactly like overflow folders:

- `deadlock.ts` exposes `DEADWORKS_SEARCH_PATH = 'citadel/deadworks_addons/vpks'`
  and `hasDeadworksContentRoot()`.
- `buildSearchPathsBlock(overflow, includeDeadworks)` appends
  `Game  citadel/deadworks_addons/vpks` as the **last** entry of the addon group
  (lowest precedence, so user mods always win a file collision).
- `getGameinfoStatus` / `fixGameinfo` treat the deadworks line as required
  **whenever content has been provisioned** (the vpks folder exists), so a game
  update that resets `gameinfo.gi` is flagged and repaired, and the line
  survives every canonical rewrite.
- `ensureDeadworksSearchPath()` is the connect-time guard: a no-op when the
  block is already correct, otherwise a canonical rewrite. It runs *before*
  downloading so a locked/unparseable `gameinfo.gi` fails fast with a clear
  "close Deadlock and try again" message.

Why a `Game` search path and not Deadworks' `addonroot`: loose VPKs in a Game
search path are how grimoire's whole mod system already mounts content, it
coexists cleanly with `citadel/addons` and the overflow folders, and it keeps
server content off the user's 99-slot `pakNN` budget.

## Relay

The directory is served by `grimoire-relay` (separate CF Worker, see that
repo's CLAUDE.md). Wire types mirror `grimoire-relay/src/shared/schemas.ts`;
the client copy is `src/types/deadworks.ts` (keep additive and in sync). The
relay URL is configurable (`deadworksRelayUrl` setting, no UI); any
deadworks-shaped relay works. **The shipped default is the upstream
third-party registry `https://api.deadworks.net`** (`DEFAULT_RELAY_URL`,
`electron/main/ipc/servers.ts`), not the built-in
`https://relay.grimoiremods.com`. Corrected 2026-07-29: this doc previously
claimed the Grimoire relay was the default, which it is not.

## Security / conventions

- Manifest filenames are validated as a single safe path component (mirrors the
  relay's Zod guard) before any filesystem write.
- A 4 GiB decompression ceiling bounds a bz2-bomb manifest.
- No telemetry: unlike the upstream Deadworks launcher, Grimoire sends no
  install/heartbeat pings.
