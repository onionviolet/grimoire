# External Integrations

**Analysis Date:** 2026-08-05

## APIs & External Services

**GameBanana Mod Repository:**
- Service: GameBanana (https://gamebanana.com)
- What it's used for: Browse, search, download, and install Deadlock mods
  - SDK/Client: Native HTTP via fetch in `electron/main/services/gamebanana.ts`
  - Rate limit: 10 req/sec (burst 20) via `gamebananaRateLimiter`
  - Game ID: 20948
  - API endpoints:
    - `/apiv11/` - Main API base (category tree, mod details, file metadata, search)
    - `/Core/Item/Data` - Bulk file metadata fetching
  - Authentication: None (public API)
  - HTTPS required (enforced via `validateApiUrl`)

**Deadlock Stats API:**
- Service: deadlock-api.com (https://api.deadlock-api.com/v1)
- What it's used for: Player MMR tracking, match history, hero statistics, leaderboards, build analytics
  - SDK/Client: Native HTTP via fetch in `electron/main/services/stats.ts`
  - Rate limit: 5 req/sec via `statsApiRateLimiter`
  - Authentication: Optional X-API-KEY header
  - Endpoints: `/players/<account_id>`, `/matches/<account_id>`, `/leaderboard`, `/hero-analytics`
  - Data stored locally in `stats.db` for offline access and historical tracking

**Steam Community:**
- Service: steamcommunity.com
- What it's used for: Fetch player profiles and avatar URLs (for stats tracking)
  - SDK/Client: Native HTTP via fetch
  - Rate limit: 1 req/sec (burst 3) via `steamCommunityRateLimiter` - conservative due to no public API doc
  - No authentication required (public profile data only)

**Deadlock Wiki:**
- Service: deadlock.wiki
- What it's used for: Hero icon assets for Discord Rich Presence and UI
  - Endpoint: `Special:FilePath` 302 redirect to CDN PNG
  - Example: `https://deadlock.wiki/Special:FilePath/Abrams.png`
  - Referenced in: `electron/main/services/discordRpc.ts` (`heroIconUrl()`)

## Data Storage

**Databases:**
- **mods-cache.db** (location: `{userData}/mods-cache.db`)
  - Client: better-sqlite3 12.5.0
  - Purpose: GameBanana mod catalog cache + FTS5 full-text search
  - Tables: `mods`, `mods_fts` (virtual table), `sync_state`
  - WAL mode + foreign keys enabled
  - Sync strategy: Incremental page-by-page import from GameBanana; tracked per section in `sync_state`

- **stats.db** (location: `{userData}/stats.db`)
  - Client: better-sqlite3 12.5.0
  - Purpose: Player stats, MMR history snapshots, match history, hero stats
  - Tables: `players`, `mmr_snapshots`, `match_history`, `hero_stats_snapshots`, `aggregated_stats`, `stats_settings`
  - WAL mode + foreign keys enabled
  - Tracks multiple players; primary player marked via `is_primary` flag

**File Storage:**
- Local filesystem only
  - User data directory: `{Electron userData path}/`
  - Mod installation: `{Deadlock install}/addons/` (managed via symlinks/copy)
  - Download staging: `{OS temp}/grimoire-download-*` (ephemeral during install)
  - Portable profiles: `.modprofile.json` files (Grimoire-only format; see `docs/profile-spec.md`)

**Caching:**
- Browser HTTP cache via Electron network stack
- Updater cache: `{userData}/updateCache/` (pruned on startup via `pruneUpdaterCache()`)
- Language pack cache: Eagerly downloaded and cached in i18next on app start

## Authentication & Identity

**Auth Provider:**
- Steam OpenID 2.0 (for social features only)
  - Implementation: `electron/main/services/socialAuth.ts`
  - Flow: User's default browser → Steam login → grimoire://auth/done deep link callback
  - Session token: Persisted via Electron's async `safeStorage` API (OS keychain on Windows/macOS; libsecret/kwallet/Portal on Linux)
  - Persistence: Refused on Linux without a real keychain (ADR-011); session-only fallback mode
  - Token storage: Module-local in `social.ts` (never exposed to renderer)

**Two-Process Security:**
- Main process owns all secrets (social bearer tokens, API keys)
- Renderer only talks to main via IPC; never sees secrets
- Preload bridges IPC via context isolation (`contextBridge` in `electron/preload/index.ts`)

## Monitoring & Observability

**Error Tracking:**
- None (no remote error collection service)
- Local logging via `electron-log` (file + console)
- Diagnostics module for user-initiated bug reports: `electron/main/services/diagnostics.ts`

**Logs:**
- File logging: `{userData}/logs/` (electron-log default)
- Console logging in dev mode
- Rotation managed by electron-log

## CI/CD & Deployment

**Hosting & Distribution:**
- GitHub Releases (onionviolet/grimoire) - Auto-update source for installed versions
- electron-builder: Generates Windows NSIS + portable, Linux AppImage + deb, macOS dmg + zip
- Release workflow: GitHub Actions (see `.github/workflows/`)

**CI Pipeline:**
- GitHub Actions (`ci.yml` in workflows)
- Pre-push hooks (husky): i18n:check, encoding:check, refs:check
- Tests: `pnpm test` (Vitest)
- Type check: `pnpm typecheck` (tsc -b)
- Lint: `pnpm lint` (ESLint)

**Auto-Update Framework:**
- electron-updater 6.7.3
- Config: `electron-builder.yml` (GitHub provider)
- Disabled for: managed installs (apt/AUR/snap/flatpak), fork builds checking their own repo only
- Changelog: Aggregated from every release between installed and target version (fullChangelog = true)

## Environment Configuration

**Required env vars (Production Builds):**
- `GRIMOIRE_SOCIAL_BASE_URL` - Cloudflare Worker URL (e.g., `https://grimoire-social.example.workers.dev`). Build fails if missing in production mode.

**Optional env vars:**
- `GRIMOIRE_DEV_SLOT` - Slot for parallel dev builds (0-9)
- `GRIMOIRE_DEBUG_GAMEBANANA` - Verbose GameBanana API logging
- `GRIMOIRE_LOCALE_BASE_URL` - Override language pack download source
- `GRIMOIRE_FORK_BUILD` - Mark as fork (disables upstream auto-update)

**Secrets location:**
- No .env files in repo (security: source control only)
- Social session token: OS keychain via `safeStorage` (Windows DPAPI, macOS Keychain, Linux libsecret/kwallet/Portal)
- GitHub release API: No secret needed (public releases)
- Steam OpenID: Handled by Steam's OAuth flow (session token returned)

## Webhooks & Callbacks

**Incoming (Grimoire receives):**
- `grimoire://` protocol handler - GameBanana 1-Click Mod Install (registered in `electron-builder.yml`)
- `grimoire://auth/done?code=...` - Steam OpenID callback from social auth flow (custom protocol)
- Launched via `shell.openExternal()` and OS protocol dispatch

**Outgoing (Grimoire initiates):**
- None (Grimoire does not expose webhooks or push notifications)

## Companion Services

**Grimoire Social Worker:**
- Service: Cloudflare Worker + D1 + Durable Objects (separate repo: `../grimoire-social`)
- What it's used for: Profile publishing, social discovery, likes, community features
- Protocol: HTTP REST `/v1/*` endpoints (versioning locked per ADR-005)
- Auth: Steam OpenID → session bearer token (persisted on client via safeStorage)
- Rate limit: 5 req/sec client-side (defensive), stricter per-action limits server-side (publish 1/10min, like 30/min)
- Client-side wrapper: `electron/main/services/social.ts` (HTTP + Zod validation)
- Wire format: Zod schemas from `@grimoire/social-types` (shared workspace package)
- Dev mode: Defaults to `http://localhost:8787` (wrangler local dev)
- Prod mode: Set via `GRIMOIRE_SOCIAL_BASE_URL` at build time

**Weblate (Translation Management):**
- Service: Weblate (external SaaS, grimoire-translate component)
- What it's used for: Crowdsourced UI string translation
- Source of truth: `src/locales/en/translation.json` (hand-edited, contains only used strings)
- Staging file: `src/locales/unwired-en.json` (strings not yet wired; never translated)
- Workflow:
  1. English strings land on `main`
  2. Translators work on Weblate
  3. Finished translations pushed to `origin/translations/<lang>` branch (e.g., `translations/he`)
  4. Merge translation branch to `main`, run `pnpm i18n:manifest` to regenerate manifest
  5. App fetches language packs on-demand from GitHub raw content (ETag-gated)
- CI gates: `pnpm i18n:check` (keys exist) + `gen-locale-manifest.mjs --check` (manifest matches catalogs)

## Download & Archive Processing

**Download Source:**
- GameBanana file URLs: `https://gamebanana.com/dl/{fileId}` or `https://mods.gamebanana.com/mmdl/{fileId}`
- HTTPS required (enforced via `validateDownloadUrl()`)
- Allowed domains: gamebanana.com, files.gamebanana.com, mods.gamebanana.com, www.gamebanana.com
- File size validation: Minimum 1KB, optional expected size check

**Archive Extraction:**
- Formats: .zip (adm-zip), .7z (7zip-bin + node-7z), .rar (node-unrar-js), .vpk (VPK-specific parser)
- Staging location: `{OS temp}/grimoire-download-{uuid}/`
- Suspicious file detection: Absolute paths, Windows system files, path traversal attempts (see `extract.ts`)
- One-Click install gate: Optional opt-out per URL (`checkOneClickOptOut()`)

## External Tools & Sidecar Binaries

**vpkmerge:**
- Binary: Fetched via `scripts/fetch-vpkmerge.mjs` (from upstream Valve source or fork)
- Purpose: Merge VPK mod files into a virtual load order
- Invoked by: `mergeGame()` in `electron/main/services/launch.ts`
- Shipped: Outside asar in `{resourcesPath}/vpkmerge/` (OS executable directly)

**chatlane:**
- Binary: YAML ↔ VPK converter (for Chat Wheel customization)
- Shipped: In `resources/chatlane/` (see `electron-builder.yml` extraResources)

**FFmpeg:**
- Binary: ffmpeg-static 5.3.0 (bundled; unpacked from asar at runtime)
- Purpose: Audio format conversion (Discord RPC preview clips)

---

*Integration audit: 2026-08-05*
