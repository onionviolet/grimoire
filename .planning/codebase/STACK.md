# Technology Stack

**Analysis Date:** 2026-08-05

## Languages

**Primary:**
- TypeScript 5.9 - Main codebase, strict mode enabled (src/, electron/)
- JavaScript (Node.js runtime) - Electron main process runtime

**Secondary:**
- YAML - YAML config for Chat Wheel (converted via chatlane CLI)
- VPK (Valve Pak) - Deadlock game mod format parsing via vpk.ts

## Runtime

**Environment:**
- Electron 35 - Desktop application runtime (cross-platform: Windows, Linux, macOS)
- Node.js (bundled with Electron) - Backend services in main process

**Package Manager:**
- pnpm - Workspace manager, lockfile version 6+
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- React 19.2.0 - UI rendering, renderer process
- React Router 7.11.0 - Client-side routing via HashRouter
- Electron 35.0.0 - Cross-platform desktop framework

**Styling & UI:**
- TailwindCSS 4.1.18 - Utility-first CSS via @tailwindcss/vite plugin
- Lucide React 0.562.0 - Icon component library
- Radix UI 2.x - Headless UI primitives (@radix-ui/react-context-menu, react-dropdown-menu)
- react-colorful 5.7.0 - Color picker component

**3D Graphics & Visualization:**
- Three.js 0.184.0 - 3D rendering engine (hero preview models)
- @react-three/fiber 9.6.1 - React renderer for Three.js
- @react-three/drei 10.7.7 - Useful helpers for react-three/fiber
- @react-three/postprocessing 3.0.4 - Post-processing effects for 3D
- three-custom-shader-material 6.4.0 - Custom shader material helper

**State Management:**
- Zustand 5.0.9 - Lightweight state store (appStore, statsStore, crosshairStore in `src/stores/`)

**Testing:**
- Vitest 4.1.9 - Unit test framework (config: `vitest.config.ts`)
- @react-three/test-renderer 9.1.0 - Testing utilities for react-three/fiber

**Build & Development:**
- electron-vite 5.0.0 - Vite wrapper for Electron multi-process builds (config: `electron.vite.config.ts`)
- Vite 6.3.0 - Fast build tool with HMR for development
- @vitejs/plugin-react 5.1.1 - React Fast Refresh plugin

**Linting & Type Checking:**
- ESLint 9.39.1 - JavaScript/TypeScript linter (config: `eslint.config.js` - flat config format)
- typescript-eslint 8.46.4 - TypeScript support for ESLint
- eslint-plugin-react-hooks - React hooks linting
- eslint-plugin-react-refresh - React Fast Refresh validation

**Type Validation & Schema:**
- Zod 3.23.0 - Runtime schema validation and type inference

**Internationalization:**
- i18next 26.3.0 - Internationalization framework
- react-i18next 17.0.8 - React bindings for i18next (config: `src/i18n.ts`)
- Download-on-demand language packs from GitHub raw content

## Key Dependencies

**Critical:**
- better-sqlite3 12.5.0 - Native SQLite driver for Node.js
  - Two databases: `mods-cache.db` (mod catalog + FTS5 search), `stats.db` (player stats)
  - WAL mode with foreign keys enabled
  - Unpacked from asar at runtime due to native bindings

**Archive Handling:**
- 7zip-bin 5.2.0 - Executable binaries for 7z extraction
- node-7z 3.0.0 - Wrapper for 7z CLI
- node-unrar-js 2.0.0 - Pure JS RAR extraction (polyfill for systems without unrar)
- adm-zip 0.5.16 - ZIP extraction library
- Supports: .zip, .7z, .rar, .vpk archives

**Media Processing:**
- ffmpeg-static 5.3.0 - Static FFmpeg binary for audio format conversion (Discord RPC preview clips)

**Runtime & Updates:**
- electron-updater 6.7.3 - Auto-update framework (GitHub releases source)
- electron-log 5.4.3 - Logging to file + console

**Developer Experience:**
- Husky 9.1.7 - Git hooks (pre-push: i18n:check, encoding:check, refs:check)
- electron-builder 26.0.0 - Packaging (config: `electron-builder.yml`)
- @electron/rebuild 4.0.2 - Rebuild native modules for Electron
- asar 3.2.0 - Archive app.asar (Electron packaging)
- gltfjsx 6.5.3 - glTF -> React Three Fiber code generator

**UI & Animation:**
- @dnd-kit/core 6.3.1 - Headless drag-and-drop
- @dnd-kit/sortable 10.0.0 - Sortable list behavior
- @tanstack/react-virtual 3.13.26 - Virtual scrolling for large lists

**External Integrations:**
- @xhayper/discord-rpc 1.3.4 - Discord Rich Presence client
- @ghostery/adblocker-electron 2.18.1 - Ad/tracker blocking for BrowserView content filter

**Utilities:**
- DOMpurify 3.3.1 - HTML sanitization
- @compai/font-unifraktur-maguntia 0.0.3 - Decorative font

**Workspace:**
- @grimoire/social-types (workspace:*) - Shared Zod schemas from sibling grimoire-social repo

## Configuration

**TypeScript:**
- `tsconfig.json` - Workspace root config with references
- `tsconfig.app.json` - App-level config (strict mode)
- `tsconfig.node.json` - Build-script config

**Build:**
- `electron.vite.config.ts` - Main, preload, renderer build configs
- `vite.config.ts` (referenced via main)
- Three separate rollup entries: main (Node.js), preload (CJS), renderer (React bundle)

**Linting & Format:**
- `eslint.config.js` - ESLint 9 flat config (TypeScript + React + React Hooks)
- `.prettierrc` (if present) - Code formatting config

**Packaging & Distribution:**
- `electron-builder.yml` - Targets: Windows (NSIS + portable), Linux (AppImage + deb), macOS (dmg + zip)
- Protocol registration: `grimoire://` for 1-click installs, `grimoire://auth/done` for social auth

**Testing:**
- `vitest.config.ts` - Vitest runner config

**Dev Tooling:**
- `.nvmrc` or `.node-version` - Node version (if pinned)
- `pnpm-lock.yaml` - Dependency lock file

## Environment Variables

**Development:**
- `GRIMOIRE_DEV_SLOT` - Slot number for parallel dev builds (0-9, each uses unique ports/data dir)
- `GRIMOIRE_DEV_CDP_PORT` - Override Chrome DevTools Protocol port (auto-derived from slot)
- `GRIMOIRE_DEBUG_GAMEBANANA` - Set to "1" to log GameBanana API requests
- `GRIMOIRE_LOCALE_BASE_URL` - Override language pack download URL (defaults to GitHub raw content)

**Production Build:**
- `GRIMOIRE_SOCIAL_BASE_URL` - **Required** for production builds. Cloudflare Worker URL for social features (e.g., `https://grimoire-social.example.workers.dev`)
- `GRIMOIRE_FORK_BUILD` - Set to any value to mark as fork build (disables upstream auto-update)

**Baked at Build Time:**
- Social Worker URL injected via `process.env.GRIMOIRE_SOCIAL_BASE_URL` in main process
- Fork build marker injected via `process.env.GRIMOIRE_FORK_BUILD` (gates auto-updater feed)

## Platform Requirements

**Development:**
- Node.js 20+ (verified with pnpm)
- pnpm 8+
- Python 3.8+ (build tools)
- Git (for submodules/sibling repos)
- Windows/Linux/macOS with desktop environment

**Production (Windows):**
- Windows 7 SP1+ (via electron-builder NSIS target)
- Grimoire auto-updates via GitHub releases; fork builds update from onionviolet/grimoire only

**Production (Linux):**
- glibc 2.28+, x11-libs (for AppImage/deb)
- Managed installs (apt/AUR/snap/flatpak) detected; in-app updates disabled (package manager owns updates)

**Production (macOS):**
- macOS 11+ (Apple Silicon arm64 only, pending darwin-x64 sidecar support)

---

*Stack analysis: 2026-08-05*
