import { app, BrowserWindow, shell, session, protocol, nativeTheme, screen } from 'electron';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { devSlotConfig } from './devSlot';
import { seedDevSlotUserData, type SeedOutcome } from './devSlotSeed';
import { SOUL_MODEL_SCHEME, registerSoulModelProtocol } from './services/soulContainerModels';
import { HERO_POSE_SCHEME, registerHeroPoseProtocol, sweepHeroPoseCache } from './services/heroPoseModels';
import { FOUNDRY_THUMB_SCHEME, registerFoundryThumbnailProtocol } from './services/foundryCatalog';

// The `grimoire-soul:` and `grimoire-hero:` schemes serve GLBs (soul-container
// models and posed hero stills) out of the user's library to the renderer's 3D
// viewers. Must be declared privileged before app-ready so fetch/streaming work
// under the renderer's file:// origin.
protocol.registerSchemesAsPrivileged([
    {
        scheme: SOUL_MODEL_SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
    {
        scheme: HERO_POSE_SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
    {
        // Serves Foundry's cached texture/icon thumbnails (PNG) to the browse grid.
        scheme: FOUNDRY_THUMB_SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
]);

// The app is dark-only, so pin Chromium and the OS chrome to dark regardless
// of the system theme. On Windows this stops the native frame/menus rendering
// light, and it makes prefers-color-scheme report dark in the renderer.
nativeTheme.themeSource = 'dark';

import { initLogger } from './services/diagnostics';
import { initEventLoopMonitor } from './services/eventLoopMonitor';

import {
    GRIMOIRE_PROTOCOL,
    findGrimoireUrlInArgv,
    handleOneClickInstall,
    parseGrimoireUrl,
} from './services/oneClickInstall';
import {
    handleProtocolAuthCallback,
    hydrateOnBoot as hydrateSocialSession,
    isGrimoireAuthUrl,
} from './services/socialAuth';

// Stop Electron from registering with the Windows media session / hardware
// media key stack. We never use transport controls, but opting in makes Win11
// play the audio-focus chime every time an <audio> element initializes — very
// noticeable now that sound-mod cards each mount their own player.
app.commandLine.appendSwitch(
    'disable-features',
    'HardwareMediaKeyHandling,MediaSessionService'
);

const dev = devSlotConfig();

// Each non-default slot gets independent SQLite databases, settings, and
// caches. Set this before Electron creates any of its per-user state.
let devSlotSeeding: SeedOutcome | undefined;
if (dev.slot !== undefined && dev.slot !== 0) {
    const base = app.getPath('userData');
    const slotDir = `${base}-dev${dev.slot}`;
    // On creation only, so the slot starts with real mods, settings and caches
    // instead of looking like a fresh install. Must happen before setPath: after
    // it, `base` is no longer resolvable. Set GRIMOIRE_DEV_SEED=0 for a blank
    // slot (onboarding, first-run, and migration work want that).
    devSlotSeeding = seedDevSlotUserData(base, slotDir);
    app.setPath('userData', slotDir);
}

// Initialize runtime services only after a slot has selected its user-data
// directory, so their logs and persistent state are isolated too.
initLogger();
initEventLoopMonitor();

if (devSlotSeeding) {
    console.log(`[dev] slot ${dev.slot} user data: ${devSlotSeeding}`);
}

// Opt-in renderer debugging port, for driving the app from a script during
// development (see scripts/dev-driver.mjs). Deliberately env-gated rather than
// keyed off `is.dev`: an always-open port in dev is an always-open port on any
// developer's machine, and this one accepts arbitrary code in the renderer.
// Never set in a packaged build.
const devCdpPort = process.env.GRIMOIRE_DEV_CDP_PORT ?? dev.cdpPort?.toString();
if (devCdpPort) {
    app.commandLine.appendSwitch('remote-debugging-port', devCdpPort);
    // Bind to loopback only. Without this Chromium may accept connections from
    // the local network, which would expose renderer eval to anything on it.
    app.commandLine.appendSwitch('remote-allow-origins', 'http://127.0.0.1');
}

// Chromium suspends requestAnimationFrame and throttles timers to roughly 1Hz
// for a window it considers hidden, and on Windows "hidden" includes a window
// merely covered by other windows. That makes any dev-driver measurement of
// animation or per-frame cost silently read zero on an unattended machine,
// while Page.captureScreenshot still returns a perfectly good picture of a
// rendered scene. A screenshot therefore cannot tell you the renderer is
// running, which is how a measurement gate ends up green having measured
// nothing.
//
// Opt-in and env-gated for the same reason the debugging port above is: it
// changes how the browser schedules work, so it must never be the default and
// never reach a packaged build. It does not change what is rendered, only
// whether Chromium keeps rendering while the window is not on top.
if (process.env.GRIMOIRE_DEV_NO_BACKGROUNDING === '1') {
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');
    app.commandLine.appendSwitch('disable-background-timer-throttling');
}

// Import IPC handlers
import './ipc/settings';
import './ipc/mods';
import './ipc/chatWheel';
import './ipc/gamebanana';
import './ipc/system';
import './ipc/conflicts';
import './ipc/profiles';
import './ipc/snapshots';
import './ipc/modDatabase';
import './ipc/crosshairPresets';
import './ipc/stats';
import './ipc/updater';
import './ipc/launch';
import './ipc/social';
import './ipc/locales';
import './ipc/diagnostics';
import './ipc/portraits';
import './ipc/abilitySounds';
import './ipc/abilityColors';
import './ipc/trippyEffects';
import './ipc/locker';
import './ipc/lockerModImages';
import './ipc/appearanceImages';
import './ipc/previewCache';
import './ipc/discord';
import './ipc/saltIngest';
import './ipc/servers';
import './ipc/browser';
import './ipc/foundry';
import './ipc/performanceConfig';
import './ipc/dmmMigrate';

import { initUpdater, checkForUpdates, getInstallSource } from './services/updater';
import { runStartupRecovery } from './ipc/launch';
import { loadSettings, saveSettings } from './services/settings';
import { attachBrowserFilter, configureFilter } from './services/browserContentFilter';
import { attachBrowserDownloadCapture, sweepToolDownloadTempRoot, toolDownloadTempRoot } from './services/browserDownloadCapture';
import { hardenGuestWebPreferences } from './services/webviewHardening';
import { backfillMissingMetadataHashes } from './services/metadata';
import { backfillImprintedFlags } from './services/imprintMods';
import { destroyDiscordRpc } from './services/discordRpc';
import { releaseAllPreviewVpks } from './services/previewVpkRegistry';
import { startSaltIngest } from './services/saltIngest';

let mainWindow: BrowserWindow | null = null;

/** Schemes we'll hand to shell.openExternal. Restricted to web/email links
 *  so a mod description (or any other untrusted content rendered in the
 *  renderer) can't smuggle in file://, custom protocol handlers, or UNC
 *  paths that would otherwise be opened by the user's default OS handler. */
const SAFE_OPEN_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export function openExternalSafe(rawUrl: string): void {
    try {
        const u = new URL(rawUrl);
        if (SAFE_OPEN_SCHEMES.has(u.protocol)) {
            void shell.openExternal(rawUrl);
            return;
        }
        console.warn('[Main] blocked openExternal for scheme:', u.protocol);
    } catch {
        console.warn('[Main] blocked openExternal for malformed URL');
    }
}

function getConfiguredDeadlockPath(): string | null {
    const settings = loadSettings();
    if (settings.devMode && settings.devDeadlockPath) {
        return settings.devDeadlockPath;
    }
    return settings.deadlockPath;
}

async function backfillStartupMetadataHashes(): Promise<void> {
    const deadlockPath = getConfiguredDeadlockPath();
    if (!deadlockPath) return;

    try {
        const updated = await backfillMissingMetadataHashes(deadlockPath);
        if (updated > 0) {
            console.log(`[Metadata] Backfilled SHA-256 for ${updated} mod metadata entr${updated === 1 ? 'y' : 'ies'}`);
        }
    } catch (error) {
        console.warn('[Metadata] Startup SHA-256 backfill failed:', error);
    }

    try {
        // Reconcile the imprinted hint flag with the embed truth (files imprinted
        // by builds that never persisted the flag would otherwise read as
        // un-imprinted forever; see backfillImprintedFlags).
        const stamped = await backfillImprintedFlags(deadlockPath);
        if (stamped > 0) {
            console.log(`[Metadata] Backfilled imprinted flag for ${stamped} mod${stamped === 1 ? '' : 's'}`);
        }
    } catch (error) {
        console.warn('[Metadata] Startup imprint-flag backfill failed:', error);
    }
}

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 600;

/**
 * Resolve the saved window rectangle into safe constructor bounds. We only
 * honour a saved position when it still lands on a connected display: on some
 * multi-monitor Linux/Wayland setups the OS otherwise placed the window on the
 * wrong screen at the wrong size, and a stale x/y from an unplugged monitor
 * would strand the window offscreen. When the saved spot is gone (or nothing
 * was saved yet) we omit x/y so Electron centers on the primary display.
 */
function resolveInitialBounds(): {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
} {
    const saved = loadSettings().windowBounds;
    if (!saved) {
        return { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT, isMaximized: false };
    }

    const width = Math.max(MIN_WINDOW_WIDTH, Math.round(saved.width) || DEFAULT_WINDOW_WIDTH);
    const height = Math.max(MIN_WINDOW_HEIGHT, Math.round(saved.height) || DEFAULT_WINDOW_HEIGHT);

    // Only restore the position if the saved rectangle visibly overlaps some
    // display's work area; otherwise the monitor it was on is gone.
    let x: number | undefined;
    let y: number | undefined;
    if (typeof saved.x === 'number' && typeof saved.y === 'number') {
        const onScreen = screen.getAllDisplays().some((display) => {
            const wa = display.workArea;
            return (
                saved.x! < wa.x + wa.width &&
                saved.x! + width > wa.x &&
                saved.y! < wa.y + wa.height &&
                saved.y! + height > wa.y
            );
        });
        if (onScreen) {
            x = Math.round(saved.x);
            y = Math.round(saved.y);
        }
    }

    return { width, height, x, y, isMaximized: !!saved.isMaximized };
}

function createWindow(): void {
    const initial = resolveInitialBounds();
    mainWindow = new BrowserWindow({
        width: initial.width,
        height: initial.height,
        ...(initial.x !== undefined && initial.y !== undefined
            ? { x: initial.x, y: initial.y }
            : {}),
        minWidth: MIN_WINDOW_WIDTH,
        minHeight: MIN_WINDOW_HEIGHT,
        title: dev.slot === undefined ? 'Grimoire' : `Grimoire [dev slot ${dev.slot}]`,
        show: false, // Don't show until ready to prevent white flash
        backgroundColor: '#0f0f0f', // Dark background matching app theme
        autoHideMenuBar: true,
        // Standard native frame on every platform. themeSource is forced to
        // 'dark' above, so Windows draws its title bar dark; the previous
        // hidden-titleBar + overlay approach put the OS window controls on
        // top of the renderer, where they collided with in-app controls and
        // page-level overlays.
        webPreferences: {
            preload: join(__dirname, '../preload/index.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            additionalArguments: dev.slot === undefined ? [] : [`--grimoire-dev-slot=${dev.slot}`],
            // Enables the <webview> element used by the in-app Browser page.
            // Turning this on means the renderer can ASK to embed arbitrary web
            // content, so the attach handler below re-asserts the guest's
            // security settings in the main process rather than trusting the
            // attributes the renderer supplied.
            webviewTag: true,
        },
    });

    // Show window when ready to prevent white screen flash
    mainWindow.once('ready-to-show', () => {
        if (initial.isMaximized) mainWindow?.maximize();
        mainWindow?.show();
    });

    // Persist position and size so the app reopens where the user left it.
    // We record the *normal* (non-maximized) bounds via getNormalBounds so a
    // maximized session still restores to a sensible windowed rectangle, plus
    // the maximized flag itself. Debounced because move/resize fire rapidly
    // during a drag.
    let saveBoundsTimer: NodeJS.Timeout | null = null;
    const writeBounds = () => {
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
        try {
            const bounds = mainWindow.getNormalBounds();
            saveSettings({
                ...loadSettings(),
                windowBounds: {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                    isMaximized: mainWindow.isMaximized(),
                },
            });
        } catch (err) {
            console.warn('[Main] Failed to persist window bounds:', err);
        }
    };
    const persistBounds = () => {
        if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
        saveBoundsTimer = setTimeout(() => {
            saveBoundsTimer = null;
            writeBounds();
        }, 400);
    };
    mainWindow.on('resize', persistBounds);
    mainWindow.on('move', persistBounds);
    mainWindow.on('maximize', persistBounds);
    mainWindow.on('unmaximize', persistBounds);
    // Flush the final rectangle synchronously: a move/resize immediately before
    // quitting would otherwise be swallowed by the debounce.
    mainWindow.on('close', () => {
        if (saveBoundsTimer) {
            clearTimeout(saveBoundsTimer);
            saveBoundsTimer = null;
        }
        writeBounds();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        openExternalSafe(details.url);
        return { action: 'deny' };
    });

    // --- <webview> hardening (the Browser page) ------------------------------
    // The renderer sets a guest's attributes, so a compromised or buggy
    // renderer could otherwise ask for a privileged guest. This handler is the
    // authority: it runs in the main process and overrides what was requested.
    mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
        hardenGuestWebPreferences(webPreferences, params);
    });

    // Popups from inside the browser go to the user's real browser rather than
    // opening an unmanaged, unhardened Electron window.
    mainWindow.webContents.on('did-attach-webview', (_event, guest) => {
        // Ad/tracker blocking and the permission floor live on the guest's
        // session, so they cover every page it loads (and only that partition,
        // never the app's own session). Idempotent enough to run per attach:
        // the handlers are setters, not listeners that stack.
        const settings = loadSettings();
        configureFilter({
            enabled: settings.browserBlockTrackers !== false,
            userListPath: settings.browserBlockListPath,
        });
        attachBrowserFilter(guest.session);

        guest.setWindowOpenHandler((details) => {
            openExternalSafe(details.url);
            return { action: 'deny' };
        });
        // Downloads inside an embedded browser have no UI to manage them and
        // would write to disk unattended, so hand them off to the system
        // browser by default. The one exception is a catalog `kind: 'tool'`
        // destination (D-11), whose download is redirected into Grimoire's
        // own temp directory instead; see browserDownloadCapture.ts.
        attachBrowserDownloadCapture(guest.session);
    });

    // Catch in-place navigations (bare `<a href="https://...">` clicks in
    // user content like mod descriptions and comments). Without this, those
    // links replace the React app with a webpage and the user has no back
    // button to recover. setWindowOpenHandler only covers target="_blank".
    // We restrict the allowlist to the renderer's own directory (the dev
    // server origin or the packaged renderer folder); anything else,
    // including any other file:// URL a malicious mod description might
    // smuggle in, ships out to the user's default browser via
    // shell.openExternal. HashRouter routes change the URL fragment via
    // history.pushState and don't trigger will-navigate, so the renderer's
    // own SPA navigation is unaffected by this filter.
    const rendererSourceUrl = is.dev && process.env['ELECTRON_RENDERER_URL']
        ? process.env['ELECTRON_RENDERER_URL']
        : pathToFileURL(join(__dirname, '../renderer/index.html')).href;
    const rendererBase = (() => {
        const parsed = new URL(rendererSourceUrl);
        parsed.search = '';
        parsed.hash = '';
        parsed.pathname = parsed.pathname.replace(/[^/]*$/, '');
        return parsed.href;
    })();
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(rendererBase)) return;
        event.preventDefault();
        openExternalSafe(url);
    });

    // Debug: log renderer errors
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[Main] Renderer failed to load:', errorCode, errorDescription);
    });

    // --- UI zoom (Ctrl +/-/0), persisted across launches. The renderer is dense
    // and on hi-DPI laptops everything renders tiny, so let the user scale the
    // whole UI. Driven through webContents.setZoomFactor via before-input-event
    // (the menu bar is auto-hidden, so there's no View > Zoom to lean on).
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 3.0;
    const ZOOM_STEP = 0.1;
    const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
    const persistZoom = (z: number) => {
        try {
            saveSettings({ ...loadSettings(), zoomFactor: z });
        } catch (err) {
            console.warn('[Main] Failed to persist zoom factor:', err);
        }
    };
    // Zoom factor resets to 1 on every load, so re-apply the saved value each time.
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow?.webContents.setZoomFactor(clampZoom(loadSettings().zoomFactor ?? 1));
    });
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown' || !input.control || input.alt || input.meta || !mainWindow) return;
        const wc = mainWindow.webContents;
        let next: number | null = null;
        if (input.key === '=' || input.key === '+' || input.key === 'Add') next = clampZoom(wc.getZoomFactor() + ZOOM_STEP);
        else if (input.key === '-' || input.key === 'Subtract') next = clampZoom(wc.getZoomFactor() - ZOOM_STEP);
        else if (input.key === '0') next = 1;
        if (next === null) return;
        event.preventDefault();
        wc.setZoomFactor(next);
        persistZoom(next);
    });

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        const rendererPath = join(__dirname, '../renderer/index.html');
        console.log('[Main] Loading renderer from:', rendererPath);
        mainWindow.loadFile(rendererPath);
    }

    // Open DevTools in development only
    if (is.dev) {
        mainWindow.webContents.openDevTools();
    }
}

// Register the `grimoire:` URL scheme so Windows hands `grimoire:...` URLs to
// this app. The packaged NSIS installer also writes registry entries via the
// `protocols:` block in electron-builder.yml, but the runtime call covers
// dev/portable launches and re-asserts ownership when needed.
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(GRIMOIRE_PROTOCOL, process.execPath, [
            resolve(process.argv[1]),
        ]);
    }
} else {
    app.setAsDefaultProtocolClient(GRIMOIRE_PROTOCOL);
}

// Capture any `grimoire:` URL from the launch args. We dispatch it after the
// renderer has loaded so the UI can show the toast before extraction starts.
const initialProtocolUrl = findGrimoireUrlInArgv(process.argv);

// Single instance lock
// The normal application remains single-instance. Slots have independent
// state, so deliberately allow one Electron process per slot.
const gotTheLock = dev.slot !== undefined && dev.slot !== 0
    ? true
    : app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        // Focus the main window if a second instance is attempted
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }

        const url = findGrimoireUrlInArgv(argv);
        if (url) {
            if (isGrimoireAuthUrl(url)) {
                void handleProtocolAuthCallback(url);
            } else {
                const parsed = parseGrimoireUrl(url);
                if (parsed) {
                    void handleOneClickInstall(parsed, mainWindow);
                }
            }
        }
    });

    app.whenReady().then(() => {
        // Set app user model id for windows
        electronApp.setAppUserModelId('com.grimoire.modmanager');

        // Serve per-mod soul-container GLBs from the user's library.
        registerSoulModelProtocol();

        // Serve per-hero posed stills from the user's library.
        registerHeroPoseProtocol();

        // Serve Foundry's cached texture/icon thumbnails to the browse grid.
        registerFoundryThumbnailProtocol();

        // Reclaim disk from stale or least-recently-used pose entries; the
        // cache is also swept after each export.
        void sweepHeroPoseCache();

        // The pending tool-download map is in-memory only, so anything still
        // in this directory at startup was orphaned by a crash, a forced
        // quit, or a disclosure that was never answered, and none of it is
        // reachable from any user flow.
        void sweepToolDownloadTempRoot(toolDownloadTempRoot(app.getPath('userData')));

        // Default open or close DevTools by F12 in development
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });

        // Set Content Security Policy (production only - Vite needs inline scripts for HMR in dev)
        if (!is.dev) {
            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': [
                            "default-src 'self'; " +
                            "script-src 'self'; " +
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                            "font-src 'self' https://fonts.gstatic.com; " +
                            // `grimoire-foundry:` serves Foundry's cached texture
                            // thumbnails, rendered as <img>, so they must be allowed
                            // here or the browse grid is blank under the prod CSP.
                            "img-src 'self' data: https: blob: grimoire-foundry:; " +
                            // Foundry voice-line auditions are served as `data:audio/mpeg`
                            // URLs into an <audio> element (the clip MP3 is sliced out of
                            // the `.vsnd_c` in the main process), so `data:` must be allowed
                            // here or audition is blocked under the prod CSP (works in dev,
                            // which has no CSP).
                            "media-src 'self' https: data:; " +
                            // Social fetches happen from the main process (fetch in Node),
                            // not the renderer, so they bypass CSP. The `https://*.workers.dev`
                            // entry is here so any future renderer-side asset (e.g. avatar URL
                            // not on Steam's CDN) doesn't trip CSP unexpectedly. Update when a
                            // dedicated grimoire-social production domain is locked.
                            //
                            // The `grimoire-soul:`/`grimoire-hero:` schemes serve the
                            // Locker's 3D GLBs; GLTFLoader fetches them, so they must be
                            // allowed here or the load is blocked under the prod CSP (dev
                            // has no CSP, which is why the 3D previews work in `pnpm dev`
                            // but not in a packaged build). `blob:` is required too:
                            // three's GLTFLoader extracts each embedded GLB texture into a
                            // blob: URL and loads it via ImageBitmapLoader, which fetch()es
                            // it; without blob: here the textures fail and models render
                            // untextured (white).
                            "connect-src 'self' blob: data: grimoire-soul: grimoire-hero: https://gamebanana.com https://*.gamebanana.com https://api.deadlock-api.com https://*.workers.dev"
                        ]
                    }
                });
            });
        }

        createWindow();

        // If we were launched via a `grimoire:` URL, dispatch it once the
        // renderer is ready so the UI can navigate + show a toast before the
        // download begins. webContents.once handles both cold-launch and
        // hot-reload paths cleanly. Auth callbacks take precedence over the
        // one-click installer dispatch.
        if (initialProtocolUrl && mainWindow) {
            if (isGrimoireAuthUrl(initialProtocolUrl)) {
                void handleProtocolAuthCallback(initialProtocolUrl);
            } else {
                const parsedInitial = parseGrimoireUrl(initialProtocolUrl);
                if (parsedInitial) {
                    mainWindow.webContents.once('did-finish-load', () => {
                        void handleOneClickInstall(parsedInitial, mainWindow);
                    });
                }
            }
        }

        // Restore a previously-persisted social session (no-op if none, or if
        // we're on Linux without a real secret store — ADR-011).
        void hydrateSocialSession();

        // Resume the opt-in match-salt contributor across restarts.
        if (loadSettings().contributeMatchSalts) {
            startSaltIngest();
        }

        // Recover from any half-finished vanilla launch (app was closed mid-session,
        // or grimoire crashed while the user was playing vanilla), then fill in
        // SHA-256 metadata for older entries that were written before hashing.
        void runStartupRecovery().finally(() => {
            void backfillStartupMetadataHashes();
        });

        // Initialize auto-updater (production only). Skip the background check
        // for apt/AUR/snap installs since the package manager owns updates.
        if (!is.dev && mainWindow) {
            initUpdater(mainWindow);
            if (getInstallSource() !== 'managed') {
                setTimeout(() => {
                    checkForUpdates().catch((err) => {
                        console.log('[Updater] Auto-check failed:', err.message);
                    });
                }, 5000);
            }
        }

        app.on('activate', () => {
            // On macOS re-create window when dock icon is clicked
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // Close the Discord RPC IPC socket cleanly so the activity drops off the
    // user's profile the moment Grimoire quits (no-op if RPC was never enabled).
    app.on('before-quit', () => {
        destroyDiscordRpc();
        // Backstop for Foundry's 3D tray previews: the renderer releases each
        // build when the panel closes, but a renderer that dies without doing
        // so must not leave its temp VPKs behind.
        void releaseAllPreviewVpks();
    });
}

// Export mainWindow for IPC handlers that need to send events
export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
