# Codebase Structure

**Analysis Date:** 2026-08-05

## Directory Layout

```
grimoire/
├── electron/                    # Electron main & preload processes
│   ├── main/
│   │   ├── index.ts             # Entry point, window creation, protocol handlers
│   │   ├── ipc/                 # IPC channel handlers (30+ files)
│   │   ├── services/            # Business logic layer (150+ files)
│   │   └── utils/               # Main process utilities
│   ├── preload/
│   │   └── index.ts             # Context bridge, exposes electronAPI to renderer
│   └── stubs/
│
├── src/                         # React renderer application
│   ├── App.tsx                  # Root component with React Router
│   ├── pages/                   # Route pages (17 pages)
│   ├── components/              # React components (organized by feature)
│   ├── stores/                  # Zustand state management
│   ├── lib/                     # Utilities & libraries
│   ├── types/                   # TypeScript type definitions
│   ├── locales/                 # i18n translation files
│   └── assets/                  # Non-public static assets
│
├── public/                      # Static assets (served by Vite, bundled in app)
│   ├── fonts/
│   ├── heroes/                  # Hero icons, chip icons
│   ├── locker/                  # Locker UI assets
│   ├── sidebar/                 # Sidebar icons
│   ├── sounds/                  # Audio files (Easter eggs, etc.)
│   └── ibl/                     # Image-based lighting for 3D
│
├── docs/                        # Project documentation
│   ├── profile-spec.md          # Portable profile format (mp1:, .modprofile.json)
│   ├── gamebanana_api_reference.md
│   ├── deadlock-api-architecture.md
│   ├── design-overhaul-brief.md # UI design language
│   ├── social-architecture.md   # grimoire-social companion service
│   ├── ability-vfx-recolor.md   # Hero VFX recoloring tech
│   ├── locker-global-mods.md    # Global mod priority system
│   └── deadworks-servers.md     # Deadworks server browser
│
├── scripts/                     # Build, dev, and utility scripts
│   ├── dev-driver.mjs           # Remote-debug the running dev build via CDP
│   ├── check-i18n.mjs           # Validate i18n keys
│   ├── gen-locale-manifest.mjs  # Generate locale download manifest
│   └── [14 other scripts]       # Hero icons, encoding check, etc.
│
├── resources/                   # App resources (icons, tray, etc.)
│   ├── chatlane/
│   └── icons/
│
├── nix/                         # Nix flake & packaging (Linux)
├── flatpak/                     # Flatpak manifest (Linux)
├── aur/                         # AUR package (Linux)
│
├── tools/                       # Development helper tools
├── .github/workflows/           # CI/CD (GitHub Actions)
├── .husky/                      # Git hooks (pre-push, etc.)
├── .planning/
│   └── codebase/                # This directory (generated codebase analysis)
│
├── electron-builder.yml         # Packaging config (Windows NSIS/portable, Linux, macOS)
├── electron.vite.config.ts      # Vite build config (3 builds: main, preload, renderer)
├── vitest.config.ts             # Test runner config
├── tsconfig.json                # TypeScript base config
├── tsconfig.app.json            # App TypeScript config (strict mode, path aliases)
├── tsconfig.node.json           # Build tools TypeScript config
├── eslint.config.js             # ESLint 9 flat config
├── package.json                 # Dependencies, scripts
├── pnpm-lock.yaml               # Lockfile
└── CLAUDE.md                    # Project instructions
```

## Directory Purposes

**electron/ - Electron Multi-Process Code**

- `electron/main/index.ts`: Electron app initialization. Creates BrowserWindow, registers protocol handlers (gb1click://, grimoire://), imports all IPC handlers. Main entry point after build.
- `electron/main/ipc/`: 30+ IPC channel handlers. One file per domain (mods.ts, gamebanana.ts, conflicts.ts, stats.ts, etc.). Each handler: receives message from renderer, calls services, returns result.
- `electron/main/services/`: 150+ service files. Business logic layer. Mod operations (scan, enable, disable), VPK parsing, downloads, merging, external API wrappers, database queries, 3D asset processing.
- `electron/main/utils/`: Shared utility functions (date parsing, path manipulation, etc.).
- `electron/preload/index.ts`: Context-isolated bridge. Exposes window.electronAPI object to renderer. No Node APIs or secrets visible to renderer.

**src/ - React Renderer**

- `src/App.tsx`: Root component. Mounts HashRouter, defines routes, top-level error boundary and confirm dialog provider.
- `src/pages/`: 17 route pages (Installed, Browse, Locker, Foundry, Stats, Profiles, Settings, etc.). Each mounted at a route in App.tsx.
- `src/components/`: Reusable React components, organized by feature:
  - `common/`: Shared UI (ErrorBoundary, Button, Modal, confirm dialog, etc.)
  - `sidebar/`, `locker/`, `foundry/`, `installed/`, etc.: Feature-specific components
- `src/stores/`: Zustand stores (appStore, socialStore, statsStore, toastStore). Application state, async action handlers, persistence.
- `src/lib/api.ts`: Wrapper functions around window.electronAPI. All IPC calls go through here.
- `src/lib/`: Other utilities (paths, date formatting, hero utilities, i18n helpers, drag-and-drop logic).
- `src/types/`: TypeScript type definitions. electron.d.ts defines ElectronAPI interface. mod.ts, gamebanana.ts, etc. define domain types.
- `src/locales/`: i18n files. en/translation.json is source of truth. Other languages downloaded on-demand. unwired-en.json is a to-do list of hardcoded strings not yet wired.

**public/ - Static Assets**

- `public/fonts/`: Custom fonts bundled with app.
- `public/heroes/`: Hero icons, chip icons (downloaded via scripts/fetch-hero-icons.mjs from GitHub).
- `public/locker/`: Locker UI graphics.
- `public/sounds/`: Audio (Easter eggs, UI feedback).
- `public/ibl/`: Image-based lighting textures for 3D hero preview.

**docs/ - Project Documentation**

- `docs/profile-spec.md`: Portable profile format spec. Read before touching profile import/export.
- `docs/gamebanana_api_reference.md`: GameBanana API contract notes.
- `docs/deadlock-api-architecture.md`: deadlock-api.com integration architecture.
- `docs/social-architecture.md` + `social-architecture-decisions.md`: Planned grimoire-social companion service design and ADRs.
- `docs/ability-vfx-recolor.md`: Hero VFX recoloring internals (particle scalar patching, KV3 encoding).
- `docs/design-overhaul-brief.md`: UI design system reference.
- `docs/locker-global-mods.md`: Global mod priority system ("General" category, priority root outranking all other mods).
- `docs/deadworks-servers.md`: Deadworks server browser architecture and gameinfo integration.

**scripts/ - Build & Dev Scripts**

- `scripts/dev-driver.mjs`: Remote-debug the running dev build via Chrome DevTools Protocol. Ask the renderer "what text is in this element?" instead of guessing pixels. Start with `GRIMOIRE_DEV_SLOT=2 pnpm dev`, then `node scripts/dev-driver.mjs route foundry`.
- `scripts/check-i18n.mjs`: Validate all `t()` keys exist in en/translation.json. CI gate.
- `scripts/check-encoding.mjs`: Detect cp1252 encoding corruption (UTF-8 bytes re-encoded as Windows-1252). CI gate.
- `scripts/gen-locale-manifest.mjs`: Generate `src/locales/manifest.json` after language catalogs change. CI gate.
- `scripts/fetch-hero-icons.mjs`, `generate-hero-chip-icons.mjs`: Download/generate hero graphics from upstream.
- `scripts/fetch-vpkmerge.mjs`: Download pre-built vpkmerge binary (external tool for mod merging).

## Key File Locations

**Entry Points:**
- `electron/main/index.ts`: Electron main process entry (creates window, registers protocols)
- `src/App.tsx`: React renderer root (Router setup, pages)
- `electron/preload/index.ts`: IPC bridge setup

**API & IPC:**
- `src/lib/api.ts`: Renderer-facing API wrapper (async functions calling window.electronAPI)
- `src/types/electron.d.ts`: ElectronAPI interface definition (type contract between preload & renderer)
- `electron/main/ipc/*.ts`: IPC handlers (30+ files, one per domain)

**Core Logic:**
- `electron/main/services/mods.ts`: Mod scanning, enable/disable, delete, reorder
- `electron/main/services/vpk.ts`: VPK parsing and content inspection
- `electron/main/services/download.ts`: GameBanana mod downloads
- `electron/main/services/extract.ts`: Archive extraction (ZIP, 7Z, RAR)
- `electron/main/services/modMerger.ts`: Combine multiple mods into one VPK
- `electron/main/services/conflicts.ts`: Detect overlapping file paths between mods
- `electron/main/services/gamebanana.ts`: GameBanana API wrapper (rate-limited)

**Locker (Cosmetics):**
- `electron/main/services/lockerVpk.ts`: Manage persistent cosmetics VPK
- `electron/main/services/heroCards.ts`: Hero card selection and rebuild
- `electron/main/services/heroSounds.ts`: Hero sound mod integration
- `electron/main/services/heroColors.ts`: Ability VFX recoloring
- `src/pages/Locker.tsx` + `src/pages/LockerHero.tsx`: UI pages
- `src/components/locker/`: Locker UI components

**Foundry (Advanced Asset Editing):**
- `electron/main/services/foundryCatalog.ts`: Sound asset browsing and swapping
- `electron/main/services/foundryTextureReplace.ts`: Texture replacement VPK building
- `electron/main/services/foundryForge.ts`: Advanced asset merging
- `electron/main/services/foundryExport.ts`: Export Foundry builds to VPK
- `src/pages/Foundry.tsx`: Foundry UI page
- `src/components/foundry/`: Foundry UI components

**State Management:**
- `src/stores/appStore.ts`: Main app state (mods, UI preferences, browse filters, settings)
- `src/stores/socialStore.ts`: Social features (session, published profiles)
- `src/stores/statsStore.ts`: Player stats (MMR, match history)
- `src/stores/toastStore.ts`: Toast notifications

**3D Preview:**
- `src/lib/source2Preview/`: Hero model viewer (FeModel parser, cloth fitting, NPR material reconstruction)
- `src/pages/Locker.tsx`: Mounts 3D preview using Three.js + react-three-fiber

**Databases:**
- `electron/main/services/modDatabase.ts`: SQLite queries on mods-cache.db (FTS5 search)
- `electron/main/services/statsDatabase.ts`: SQLite queries on stats.db (MMR snapshots, match history)
- `electron/main/services/searchService.ts`: Full-text search wrapper (FTS5 queries)

**Game Integration:**
- `electron/main/services/deadlock.ts`: Game directory detection, gameinfo.gi reading/writing
- `electron/main/services/launch.ts` + `electron/main/ipc/launch.ts`: Game launch with mods
- `electron/main/services/gameSessionMods.ts`: Monitor running game, prevent mod mutations
- `electron/main/services/vpkImpostors.ts`: Detect corrupted VPKs (not actually VPKs)

**External Integrations:**
- `electron/main/services/gamebanana.ts`: GameBanana API (rate-limited 10 req/sec)
- `electron/main/services/stats.ts`: deadlock-api.com integration (rate-limited 5 req/sec)
- `electron/main/services/social.ts` + `socialAuth.ts`: grimoire-social companion service (Steam OpenID)
- `electron/main/services/discordRpc.ts`: Discord Rich Presence (local client only)
- `electron/main/services/saltIngest.ts`: Match salt contribution (opt-in telemetry)

**Testing:**
- `vitest.config.ts`: Test runner configuration
- `electron/main/services/**/*.test.ts`: Unit tests (150+ test files)
- `src/lib/__fixtures__/`: Test fixtures (cloth models, etc.)

## Naming Conventions

**Files:**
- PascalCase for React components: `Installed.tsx`, `Locker.tsx`, `ModCard.tsx`
- camelCase for utilities, services, stores: `api.ts`, `modDatabase.ts`, `appStore.ts`
- `.test.ts` suffix for unit tests: `mods.test.ts`, `vpk.test.ts`
- Filename matches exported class/function (e.g., `modMerger.ts` exports `mergeMods()`)

**Directories:**
- Lowercase, kebab-case for feature directories: `src/components/locker/`, `src/lib/source2Preview/`
- `services/` for business logic, `ipc/` for IPC handlers, `stores/` for state, `pages/` for routes
- Domain-specific subdirs: `src/components/settings/sections/`, `src/components/stats/tabs/`

**Functions & Variables:**
- camelCase for functions and variables: `enableMod()`, `scanMods()`, `modId`, `deadlockPath`
- UPPER_SNAKE_CASE for constants: `SAFE_OPEN_SCHEMES`, `HERO_MODEL_PATH`, `DOWNLOAD_COUNTS_TTL`
- TypeScript interfaces use PascalCase: `Mod`, `AppSettings`, `GameBananaModsResponse`

**IPC Channels:**
- kebab-case channel names: `'enable-mod'`, `'detect-deadlock'`, `'browse-mods'`, `'chat-wheel:read'`
- Group related channels with prefix: `'salt-ingest:set-enabled'`, `'salt-ingest:get-status'`

## Where to Add New Code

**New Mod Operation (e.g., "disable all mods"):**
- Primary service: `electron/main/services/mods.ts` (add function like `disableAllMods()`)
- IPC handler: `electron/main/ipc/mods.ts` (add ipcMain.handle() for new channel)
- API wrapper: `src/lib/api.ts` (add export function calling window.electronAPI)
- Store action: `src/stores/appStore.ts` (add action calling api function)
- UI: `src/pages/Installed.tsx` (add button calling store action)

**New Locker Feature (e.g., "sort cosmetics by hero"):**
- Service: `electron/main/services/heroCards.ts` or new `lockerSort.ts`
- IPC handler: `electron/main/ipc/locker.ts`
- API wrapper: `src/lib/api.ts`
- Store: `src/stores/appStore.ts` (add UI state for sort preference)
- Components: `src/components/locker/` (add LockerSortBar.tsx, etc.)
- Page: `src/pages/Locker.tsx` (integrate new components)

**New External Integration (e.g., Discord, third-party API):**
- Service layer: `electron/main/services/externalService.ts` (implement API wrapper, rate limiting)
- IPC handler: `electron/main/ipc/externalService.ts` (expose renderer-facing methods)
- API wrapper: `src/lib/api.ts` (add typed functions)
- Store: `src/stores/appStore.ts` (if UI state needed) or create new `externalStore.ts`
- Settings: `src/pages/Settings.tsx` + `src/components/settings/sections/` (add config UI if needed)

**New Page (e.g., "Workshop"):**
- Create: `src/pages/Workshop.tsx`
- Add route: `src/App.tsx` (add <Route path="workshop" element={<Workshop />} />)
- Add nav: `src/components/sidebar/Sidebar.tsx` (add nav link)
- Shared components: Create `src/components/workshop/` subdirectory
- Store state: Add to `src/stores/appStore.ts` or create `workshopStore.ts`

**New Utility/Library:**
- Shared lib: `src/lib/workshopUtils.ts` (exported as named functions)
- Complex domain: `src/lib/workshop/` subdirectory (e.g., `index.ts`, `parser.ts`, `formatter.ts`)
- Types: `src/types/workshop.ts` (if domain-specific types needed)

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated codebase analysis documents
- Generated: Yes (by /gsd-map-codebase skill)
- Committed: Yes (aids downstream commands like /gsd-plan-phase)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**`node_modules/`:**
- Purpose: npm/pnpm dependencies
- Generated: Yes (by pnpm install)
- Committed: No (.gitignored)

**`dist/`:**
- Purpose: Built bundles (electron-vite output)
- Generated: Yes (by pnpm build or electron-vite build)
- Committed: No (.gitignored)

**`release/`:**
- Purpose: Packaged app installers (Windows NSIS/portable, Linux AppImage/deb, macOS dmg)
- Generated: Yes (by pnpm package:win/linux/mac)
- Committed: No (.gitignored)

**`.git/`:**
- Purpose: Version control repository
- Generated: No (initialized by user)
- Committed: N/A

**`userData/` (runtime, not in repo):**
- Purpose: App runtime data (SQLite databases, settings, user profiles)
- Location: `~/.config/Grimoire/` (Linux), `%APPDATA%/Grimoire/` (Windows), `~/Library/Application Support/Grimoire/` (macOS)
- Contains:
  - `mods-cache.db`: GameBanana mod catalog (FTS5 indexed)
  - `stats.db`: Player stats (MMR snapshots, match history)
  - `settings.json`: App settings
  - `logs/`: Diagnostic logs

## Development Slot System

When parallel development is needed (multiple agents, testing onboarding while working on features):

```bash
# Standard dev (slot 0, ports 5173, 9223)
pnpm dev

# Isolated parallel dev (slot 2, ports 5175, 9225)
GRIMOIRE_DEV_SLOT=2 pnpm dev

# Drive slot 2 remotely (ask renderer questions via CDP)
node scripts/dev-driver.mjs route foundry
```

Each slot has:
- Independent userData directory (`-dev2`, `-dev3`, etc.)
- Copied from the real profile on first boot (real mods, settings, caches)
- Isolated Vite dev server and Chrome DevTools Protocol port
- Shared game install (two slots can toggle mods on same game)

---

*Structure analysis: 2026-08-05*
