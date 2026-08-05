<!-- refreshed: 2026-08-05 -->
# Architecture

**Analysis Date:** 2026-08-05

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer (React UI)                         │
│  App.tsx → HashRouter → Pages (Installed, Browse, Locker...)    │
│  Components, Zustand Stores, React Router 7                     │
│  `src/` (React 19, TypeScript, TailwindCSS 4, Lucide icons)     │
└────────────┬──────────────────────────────────────────┬─────────┘
             │ IPC: window.electronAPI.*()              │
             │ (typed via ElectronAPI interface)        │
             ▼                                           ▼
┌────────────────────────────┐         ┌──────────────────────────┐
│  Preload Bridge            │         │  Context: Three.js 3D    │
│  `electron/preload/`       │         │  Hero models, cosmetics  │
│  contextBridge.exposeIn    │         │  `src/lib/source2Preview/`
│  MainWorld('electronAPI')  │         └──────────────────────────┘
└────────────┬───────────────┘
             │ ipcRenderer.invoke()
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Main Process (Node.js)                      │
│                      `electron/main/`                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  IPC Handlers (30+ channels)                            │   │
│  │  `electron/main/ipc/*.ts`                               │   │
│  │  mods, gamebanana, conflicts, profiles, stats,          │   │
│  │  crosshair, locker, foundry, launch, social, etc.      │   │
│  └──────────────────────────────────┬─────────────────────┘   │
│                                      │                          │
│  ┌──────────────────────────────────▼─────────────────────┐   │
│  │  Services Layer (150+ files)                           │   │
│  │  `electron/main/services/*.ts`                         │   │
│  │  Mod operations, VPK parsing, downloads, merging,      │   │
│  │  cosmetics, Locker, Foundry, external APIs            │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────▼──────────────────┐                       │
│  │  Persistence                        │                       │
│  │  • File system (VPKs in game dir)   │                       │
│  │  • SQLite: mods-cache.db (FTS5)     │                       │
│  │  • SQLite: stats.db                 │                       │
│  │  • Settings (JSON)                  │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  External Integrations                                 │   │
│  │  • GameBanana API (rate-limited 10 req/sec)            │   │
│  │  • deadlock-api.com (rate-limited 5 req/sec)           │   │
│  │  • grimoire-social Cloudflare Worker (planned)         │   │
│  │  • Discord RPC (local client only)                     │   │
│  │  • Steam OpenID (social auth)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Renderer** | UI rendering, user interactions, state display | `src/App.tsx`, `src/pages/`, `src/components/` |
| **Preload Bridge** | Context-isolated IPC interface, API exposure | `electron/preload/index.ts` |
| **IPC Handlers** | Route IPC calls, validate args, call services | `electron/main/ipc/*.ts` |
| **Services** | Business logic, file I/O, API calls, databases | `electron/main/services/*.ts` |
| **File System** | VPKs in game directory, user data | `~/.deadlock/addons`, userData dir |
| **SQLite Databases** | Mod catalog cache (FTS5), player stats | `userData/mods-cache.db`, `userData/stats.db` |
| **External APIs** | GameBanana mods, deadlock-api stats, social | Rate-limited, auth-handled in main process |

## Pattern Overview

**Overall:** Electron multi-process architecture with typed IPC boundary.

**Key Characteristics:**
- **Process Isolation**: Renderer (React) ↔ Main (Node.js) via contextBridge IPC
- **Type Safety**: `ElectronAPI` interface in `src/types/electron.d.ts` checked against preload via `satisfies`
- **Async State Flow**: User action → API call → Service execution → Store update → Re-render
- **Generation Guards**: Monotonic counters prevent race conditions during async mod lists
- **Secret Compartmentalization**: Main process owns API keys, session tokens; renderer has no access

## Layers

**API Layer:**
- Purpose: Type-safe IPC call wrapper
- Location: `src/lib/api.ts`
- Contains: Async functions wrapping `window.electronAPI.*()` methods
- Depends on: `window.electronAPI` (preload bridge), types in `src/types/`
- Used by: Zustand stores, React components

**State Management Layer:**
- Purpose: Application state, derived state, UI persistence
- Location: `src/stores/` (appStore.ts, socialStore.ts, statsStore.ts, toastStore.ts)
- Contains: Zustand stores with actions, persistence helpers
- Depends on: `api.*`, localStorage (uiPrefs), SQLite via IPC
- Used by: React components via hooks

**UI/Component Layer:**
- Purpose: Render data, handle user interactions, display modals
- Location: `src/pages/` (17 pages), `src/components/` (feature-organized)
- Contains: React components using React Router 7, TailwindCSS, Lucide icons
- Depends on: Stores, i18n, api functions
- Used by: React Router in `src/App.tsx`

**Preload/Bridge Layer:**
- Purpose: Context-isolated exposure of main-process APIs to renderer
- Location: `electron/preload/index.ts`
- Contains: `contextBridge.exposeInMainWorld('electronAPI', {...})` mapping
- Depends on: Type definitions in `src/types/electron.d.ts`
- Used by: Renderer (window.electronAPI)

**IPC Handler Layer:**
- Purpose: Receive renderer requests, validate args, dispatch to services
- Location: `electron/main/ipc/*.ts` (30+ handler files)
- Contains: `ipcMain.handle()` and `ipcMain.on()` channel handlers
- Depends on: Service layer
- Used by: Preload/renderer via IPC channels

**Service Layer:**
- Purpose: Core business logic, file operations, external APIs, database queries
- Location: `electron/main/services/*.ts` (150+ files)
- Contains: Mod scanning, VPK parsing, downloads, merging, external API wrappers
- Depends on: File system, SQLite, better-sqlite3, external HTTP APIs
- Used by: IPC handlers, other services

**Persistence Layer:**
- Purpose: Data storage at rest
- Location: File system, SQLite databases, settings JSON
- Contains: VPK files (game dir), mods-cache.db (FTS5 mod index), stats.db (MMR/matches)
- Depends on: better-sqlite3 (Node.js binding), file system
- Used by: Service layer (database queries, file I/O)

## Data Flow

### Primary Request Path: Enable a Mod

1. User clicks enable toggle in Installed page (`src/pages/Installed.tsx`)
2. Component calls `useAppStore.getState().enableMod(modId)`
3. Store action calls `api.enableMod(modId)` from `src/lib/api.ts`
4. API function calls `window.electronAPI.enableMod(modId)` (preload bridge)
5. Preload routes to `ipcRenderer.invoke('enable-mod', modId)` → Main process
6. IPC handler in `electron/main/ipc/mods.ts` receives `'enable-mod'` channel
7. Handler calls `enableMod(modId)` from `electron/main/services/mods.ts`
8. Service renames VPK file on disk (filename change is the enable action)
9. Service calls `scanMods()` to refresh full mod list
10. IPC handler returns refreshed `Mod[]` to renderer
11. Store updates `mods` array via reconciliation logic
12. React re-renders Installed page with updated mod state

### Secondary Flow: Merge Mods

1. User selects multiple mods and clicks "Merge"
2. Component calls `api.analyzeMerge(modIds)`
3. IPC handler routes to `analyzeMerge()` in `electron/main/services/modMerger.ts`
4. Service reads VPK contents via `parseVpkDirectoriesAsync()`
5. Service detects file conflicts and builds analysis report
6. Handler returns `MergeAnalysisResult` to renderer
7. User confirms merge in modal
8. Component calls `api.mergeMods(mergeArgs)`
9. Service calls `mergeMods()` → runs external `vpkmerge` tool → outputs merged VPK
10. Service disables source mods, scans to get updated list
11. Renderer receives new mod list, displays merged VPK

### State Management: Browse Mod Search

1. User types in Browse page search box
2. Component updates local state and debounces
3. Debounced callback calls `useAppStore.getState().setBrowseSearch(query)`
4. Store updates `browseUiState.search`
5. Store effect calls `api.browseGameBananaMods(filters)`
6. IPC handler routes to `browseGameBananaMods()` in `electron/main/ipc/gamebanana.ts`
7. Service calls rate-limited GameBanana API wrapper
8. Handler returns `GameBananaModsResponse` (paginated mod list)
9. Store updates `browseModsCache`
10. Component re-renders grid with new mods

### Background Flow: Catalog Sync

1. App startup or periodic timer triggers `startSyncService()`
2. Service begins background download of full GameBanana mod index
3. Service inserts/updates records into `mods-cache.db` (FTS5 indexed)
4. Sync progress posted as event to renderer (optional UI indicator)
5. On completion, store updates `syncState` if needed
6. UI enables "Browse" tab if it was waiting for sync

### Locker VPK Rebuild: Apply Hero Card

1. User selects a hero card from mod source in Locker
2. Component calls `api.applyHeroCard(heroCodename, sourceModId, variants)`
3. IPC handler in `electron/main/ipc/locker.ts` receives request
4. Handler calls `applyHeroCard()` in `electron/main/services/lockerVpk.ts`
5. Service reads panorama textures from source VPK
6. Service reads/updates persistent Locker VPK (`grimoire_locker.vpk`)
7. Service writes new hero card files to Locker VPK, updates manifest
8. Service scans mods to refresh list
9. Handler returns updated `Mod` array (Locker VPK shown with updated mod count)
10. Store updates, Locker UI re-renders showing applied card

## Key Abstractions

**Mod (Identity & State):**
- Purpose: Represents a single installed VPK mod
- Examples: `src/types/mod.ts` (Mod interface), `electron/main/services/mods.ts` (scanMods, enableMod)
- Pattern: Mod.id = MD5 of filename (stable identity even when file is renamed on enable/disable)

**VPK as Versioned Archive:**
- Purpose: Container for all Deadlock content (hero models, sounds, textures)
- Examples: `electron/main/services/vpk.ts` (parseVpkDirectory), `electron/main/services/extract.ts` (archive extraction)
- Pattern: VPK structure follows game's directory tree; tools parse headers, extract/write via binary formats

**Merged Mod (Virtual Consolidation):**
- Purpose: User-facing single mod combining multiple source mods
- Examples: `src/types/mod.ts` (MergedModInfo), `electron/main/services/modMerger.ts`
- Pattern: External `vpkmerge` tool concatenates VPKs; metadata captured for unmerge

**Portable Profile (Shareable Configuration):**
- Purpose: Export/import mod configuration as text code or JSON file
- Examples: `src/types/portableProfile.ts`, `electron/main/services/portableProfile.ts`
- Pattern: mp1:... share codes (Deflate-compressed JSON), .modprofile.json files (JSON only)

**Locker VPK (Persistent Cosmetics):**
- Purpose: Single persistent VPK holding all applied hero cosmetics (cards, skins, VFX, sounds)
- Examples: `electron/main/services/lockerVpk.ts`, `src/components/locker/`
- Pattern: Rebuilt on every cosmetic apply/revert; metadata tracks sources for recovery if sources deleted

**Foundry Build (Advanced Asset Replacement):**
- Purpose: User-composed VPK from selected Foundry assets (hero sounds, textures, VFX)
- Examples: `electron/main/services/foundryForge.ts`, `src/pages/Foundry.tsx`
- Pattern: Service assembles asset set into VPK; UI allows preview before writing

## Entry Points

**Application Start:**
- Location: `electron/main/index.ts` (main process), `src/App.tsx` (renderer)
- Triggers: User launches app (Windows EXE, Linux AppImage)
- Responsibilities: 
  - Main: Create BrowserWindow, setup protocol handlers (gb1click://, grimoire://), import IPC handlers
  - Renderer: Mount React Router, hydrate stores from persistence, render Layout

**One-Click Install:**
- Location: `electron/main/services/oneClickInstall.ts`
- Triggers: User clicks GameBanana `gb1click://` or `grimoire://` link
- Responsibilities: Parse URL, download mod, show confirmation modal (suspicious files check), install

**Social Authentication:**
- Location: `electron/main/services/socialAuth.ts`
- Triggers: User clicks "Publish Profile" in Profiles page
- Responsibilities: Initiate Steam OpenID flow, persist session token in main process via `safeStorage`, hydrate renderer session on boot

**Game Launch:**
- Location: `electron/main/ipc/launch.ts`, `electron/main/services/launch.ts`
- Triggers: User clicks "Launch" button or custom protocol `grimoire://launch`
- Responsibilities: Detect running game, write launch options, invoke game process, monitor for completion

**Protocol Handler (Custom Schemes):**
- Location: `electron/main/index.ts` (protocol registration), service handlers
- Triggers: OS routes `gb1click://`, `grimoire://`, `grimoire+social://` URLs
- Responsibilities: Parse URL, dispatch to appropriate handler (oneClickInstall, launch, socialAuth)

## Architectural Constraints

- **Threading:** Single-threaded event loop (Electron/Node.js). Heavy I/O (VPK parsing, archive extraction) delegated to external tools or worker patterns when needed.
- **Global state:** Main process holds singleton instances of rate limiters (`rateLimiter.ts`), database connections (better-sqlite3), and session state (socialAuth session token). No module-level mutable state in services; state is function parameter-based or class-instance-based.
- **Circular imports:** Avoided via layering (preload → no imports, services → no renderer imports, IPC handlers → services only).
- **VPK Path Identity:** Mod filename (after enable/disable renames) is the primary key; enables UI to track mods across state changes without ID collisions.
- **IPC Serialization:** All IPC args/returns are JSON-serializable (no Functions, Symbols, circular refs). Binary VPK data read/written via file system, not IPC.
- **Context Isolation:** Renderer process has no access to Node APIs (`nodeIntegration: false`, context isolation enabled). All file I/O and secrets routed through main process.

## Anti-Patterns

### Over-Serializing VPK Data Over IPC

**What happens:** Service reads entire VPK into memory, returns serialized VPK object over IPC to renderer for display.
**Why it's wrong:** VPKs can be multi-gigabyte; serialization → transmission → deserialization is wasteful. Renderer only needs summaries (mod name, thumbnail, file list).
**Do this instead:** Service reads VPK, extracts summary data, returns only needed fields. For large data (file listings), paginate over IPC. See `parseVpkDirectory()` in `electron/main/services/vpk.ts` returning `string[]` (file paths only), not full VPK objects.

### Exposing API Keys to Renderer

**What happens:** Main process passes GameBanana API key or Steam token to renderer via state, then renderer calls API directly.
**Why it's wrong:** Renderer is untrusted surface; secrets exposed there can be read by compromised mods or extensions.
**Do this instead:** Main process owns all secrets. Renderer calls API via IPC handler. Example: `electron/main/ipc/gamebanana.ts` handles API calls; renderer only calls `api.browseGameBananaMods()`, which is routed through main process.

### Blocking Mod Mutations While Game is Running

**What happens:** No check for running game; user enables/disables mods, file is locked by running game process, operation fails cryptically.
**Why it's wrong:** User gets "File is in use" error with no explanation; UX is poor.
**Do this instead:** `gameSessionMods.ts` monitors game process; IPC handlers check `isGameRunning()` before mutations. If game running, reject with user-friendly error. See `electron/main/services/gameSessionMods.ts` and usage in `electron/main/ipc/mods.ts` (enable/disable handlers).

### Modifying VPKs Without Temporary Copies

**What happens:** Service directly modifies VPK in game directory while parsing it.
**Why it's wrong:** If merge/modification fails midway, original VPK is corrupted.
**Do this instead:** Work on temporary copies in `tmpdir()`, validate output, swap into game directory on success. See `mergeMods()` in `electron/main/services/modMerger.ts` and `buildFoundryForgeVpk()` in `electron/main/services/foundryForge.ts`.

## Error Handling

**Strategy:** Layered error handling with context-specific recovery.

**Patterns:**
- **IPC Errors:** Preload handler wraps in try/catch, returns Error object (stringified), renderer's API wrapper re-throws; store catches and shows toast
- **Game Running Lock:** Special-case error message detected in `api.withGameRunningWarning()`, toast shown separately
- **Partial Failures:** Merge analyzer reports conflicting files; user decides to proceed or abort. On merge failure (mid-operation), temporary files cleaned up, original mods left intact
- **Network Timeouts:** Rate limiter and API wrappers implement retry logic with exponential backoff (see `rateLimiter.ts`)
- **VPK Parse Failures:** `vpkImpostors.ts` detects corrupted VPKs (not actually VPKs, archives renamed to .vpk); UI surfaces in diagnostic panel

## Cross-Cutting Concerns

**Logging:** `electron/main/services/diagnostics.ts` provides structured logging (debug, info, warn, error levels). Main process logs written to `userData/logs/`. Renderer errors caught by `ErrorBoundary.tsx`.

**Validation:** Input validation at IPC boundary (type checking via TypeScript + runtime Zod schemas in some handlers). Service layer assumes validated inputs.

**Authentication:** Steam OpenID flow in `socialAuth.ts` (main process only). Session token stored via `safeStorage` (Windows Credential Manager, macOS Keychain, Linux libsecret). Renderer hydrates session state on boot but never accesses token directly.

**Internationalization:** i18next + react-i18next. Source strings in `src/locales/en/translation.json`. Additional languages downloaded on-demand from GitHub raw.githubusercontent.com (ETag-cached). See `electron/main/services/localeDownload.ts`.

**Rate Limiting:** `electron/main/services/rateLimiter.ts` wraps external API calls (GameBanana 10 req/sec, deadlock-api 5 req/sec). Requests queued, delays enforced, burst protection via token bucket.

---

*Architecture analysis: 2026-08-05*
