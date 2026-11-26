<!-- Source for Codex. Claude Code loads the twin .claude/rules/main-process.md by paths: frontmatter. Keep the text below identical in both files. -->
# Main process, IPC and services

## Architecture

Electron multi-process with context isolation on and `nodeIntegration` off.

- `electron/main/`: Node side. `ipc/*` registers `ipcMain.handle` channels; `services/*` holds the logic (file I/O, SQLite, VPK work, external APIs, archive extraction).
- `electron/preload/index.ts`: the `contextBridge` API. Pure pass-through, no logic.
- `src/`: React renderer. `pages/` (routes, HashRouter), `components/` (feature folders + `common/` primitives), `stores/` (Zustand), `lib/` (pure helpers, most of the unit tests), `types/`, `locales/`.

**Adding an IPC method:** declare it once in the `ElectronAPI` interface in `src/types/electron.ts`, add the one-line bridge in `electron/preload/index.ts` (checked with `satisfies ElectronAPI`), then the handler in `electron/main/ipc/*`. **Adding a setting:** field in `AppSettings` (`src/types/mod.ts`) plus its default in `electron/main/services/settings.ts`.

Runtime data lives in the Electron `userData` dir: `mods-cache.db` (GameBanana catalog mirror + FTS5), `stats.db` (player stats), `unknown-crc-cache.db`, `settings.json`, `mod-metadata.json`, `profiles.json`, `interchange-ledger.json`, plus asset caches.

Heavy VPK/model/texture/sound work shells out to the bundled `vpkmerge` CLI (`resources/vpkmerge/`, version + sha256 pinned in `scripts/fetch-vpkmerge.mjs`).

## Rules

- **No telemetry.** No analytics, usage pings or heartbeats. On its own the app only talks to services the user chose: GitHub for the app update check (which has a setting) and GameBanana for the catalog refresh, the Installed mod update check and mod thumbnails. Everything else waits for a click or an opt-in. Every request is listed on the privacy guide page (`src/content/docs/privacy.md` in `../grimoire-site`, published at grimoiremods.com/docs/privacy), so a new one needs an entry there. One that sends user data somewhere the user didn't choose also needs an off switch.
- **Main process owns secrets.** API keys and the social session token (stored via `safeStorage`) never reach the renderer. The main process attaches auth headers itself.
- **External APIs go through a rate limiter** in `electron/main/services/rateLimiter.ts` (GameBanana, deadlock-api, Steam community, GitHub). New integrations reuse that pattern.
- **Rate limiters in `electron/main/services/rateLimiter.ts`** wrap external API calls (GameBanana 10 req/sec, deadlock-api 5 req/sec). New external integrations should reuse this pattern.

## Gotchas that have shipped bugs

- **The CSP only applies to packaged builds.** `pnpm dev` has none, so "works in dev, broken packaged" bugs (especially 3D previews over `grimoire-hero:`/`grimoire-soul:`/`blob:`) usually mean the `connect-src` in `electron/main/index.ts` needs updating.
- **vpkmerge version coupling.** A feature that needs a new vpkmerge flag or subcommand requires a vpkmerge release first, then a bump of the version + 3 sha256s in `scripts/fetch-vpkmerge.mjs`. `pnpm dev` hides the break when a locally built binary sits in `resources/vpkmerge/`.
- **Mod mutations are serialized.** Enable/disable/reorder share an in-process lock (`withModMutationLock` / `runExclusiveModMutation` in `electron/main/services/mods.ts`) because racing `pakNN` slot writes clobbered VPKs. Route new mutating operations through it.

## Conventions

- Mod transfer uses the interchange format. DMM input is converted through the reader in `electron/main/services/modInterchange/`, and new source managers are registered in `electron/main/ipc/modInterchange.ts`.

## Databases (runtime, in app userData dir)

- **mods-cache.db** - GameBanana mod catalog cache with FTS5 search. Tables: `mods`, `mods_fts`, `sync_state`
- **stats.db** - Player stats. Tables: `players`, `mmr_snapshots`, `match_history`, `hero_stats_snapshots`, `aggregated_stats`, `stats_settings`

Both use WAL mode with foreign keys enabled.
