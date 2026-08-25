import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import type { UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { isValidSemver } from './version';
import { pruneUpdaterCache } from './updaterCache';

export type InstallSource = 'managed' | 'appimage' | 'standard' | 'fork' | 'manual';

// Detect installs owned by a system package manager (apt/AUR/snap/flatpak).
// In-app updates would fail on these because /opt and /usr are root-owned, so
// we route those users to their package manager instead.
//
// 'fork' used to be disabled because the publish feed pointed at upstream
// (Slush97/grimoire) and accepting an update would silently overwrite every
// patch in this build. Now that electron-builder.yml publishes to
// onionviolet/grimoire, a fork build only sees its own releases and can safely
// self-update.
export function getInstallSource(): InstallSource {
    if (process.env.GRIMOIRE_FORK_BUILD) return 'fork';
    // The macOS build is ad-hoc signed: there is no Developer ID certificate,
    // so the bundle carries no signing identity (`TeamIdentifier=not set`).
    // Squirrel.Mac refuses to swap in an update whose identity does not match
    // the running app's, so an in-app update would download and then fail at
    // the install step. Checking still works and is worth doing, so this is a
    // separate source from 'managed': we tell the user a version exists and
    // send them to the download page. See docs/macos.md.
    if (process.platform === 'darwin') return 'manual';
    if (process.platform === 'linux') {
        if (process.env.APPIMAGE) return 'appimage';
        const exec = process.execPath;
        if (
            exec.startsWith('/opt/') ||
            exec.startsWith('/usr/') ||
            exec.startsWith('/nix/store/') ||
            exec.startsWith('/snap/') ||
            exec.startsWith('/var/lib/flatpak/') ||
            exec.startsWith('/app/')
        ) {
            return 'managed';
        }
    }
    return 'standard';
}

const installSource = getInstallSource();
// 'managed' is fully hands-off: the package manager owns the whole lifecycle,
// so we do not even check. 'manual' can still check and report a new version,
// it just cannot apply one in place.
// 'fork' is safe to check and fetch: the publish feed targets
// onionviolet/grimoire, not upstream.
// Stays `let`: an invalid app version disables the updater at runtime below.
let updaterDisabled = installSource === 'managed';
// A fork build on macOS is reported as 'fork' (the channel guard wins over
// platform detection), so the ad-hoc-signing limitation is tested directly
// here rather than inferred from the source alone.
const canInstallInPlace =
    installSource !== 'managed' && installSource !== 'manual' && process.platform !== 'darwin';

/** Whether the in-app updater can actually apply an update on this install. */
export function canSelfInstall(): boolean {
    return canInstallInPlace;
}

// Configure logging
autoUpdater.logger = log;
log.transports.file.level = 'info';

// Disable auto-download - we want to show changelog first
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
// Aggregate release notes from every GitHub release between the installed
// version and the target version. Without this, electron-updater hands the
// renderer only the latest release's body — users who skipped a few versions
// would have no idea what changed in between. With fullChangelog = true,
// releaseNotes comes back as `{ version, note }[]`; UpdateModal already
// renders that shape per-version.
autoUpdater.fullChangelog = true;

let mainWindow: BrowserWindow | null = null;

export interface UpdateStatus {
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    error: string | null;
    progress: number;
    updateInfo: UpdateInfo | null;
}

let currentStatus: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: 0,
    updateInfo: null,
};

function sendStatusToRenderer() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', currentStatus);
    }
}

export function initUpdater(window: BrowserWindow) {
    mainWindow = window;
    // Sweep stale downloads even when the updater itself is switched off: a
    // managed install may still hold installers from before it was packaged,
    // and there is no other code path that would ever clear them.
    void pruneUpdaterCache(app.name)
        .then((removed) => {
            if (removed) log.info(`[Updater] Pruned ${removed} stale download(s).`);
        })
        .catch(() => {});
    if (updaterDisabled) {
        log.info('[Updater] System package install detected; in-app updater disabled.');
        return;
    }

    const appVersion = app.getVersion();
    if (!isValidSemver(appVersion)) {
        updaterDisabled = true;
        currentStatus = {
            ...currentStatus,
            error: `Updates are disabled because this installation has an invalid version (${appVersion}). Please reinstall a current release.`,
        };
        log.error(`[Updater] Updates disabled: installed app version is not strict SemVer: ${appVersion}`);
        sendStatusToRenderer();
        return;
    }

    autoUpdater.on('checking-for-update', () => {
        currentStatus = { ...currentStatus, checking: true, error: null };
        sendStatusToRenderer();
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        currentStatus = {
            ...currentStatus,
            checking: false,
            available: true,
            updateInfo: info,
        };
        sendStatusToRenderer();
    });

    autoUpdater.on('update-not-available', () => {
        currentStatus = {
            ...currentStatus,
            checking: false,
            available: false,
            updateInfo: null,
        };
        sendStatusToRenderer();
    });

    autoUpdater.on('download-progress', (progress) => {
        currentStatus = {
            ...currentStatus,
            downloading: true,
            progress: progress.percent,
        };
        sendStatusToRenderer();
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        currentStatus = {
            ...currentStatus,
            downloading: false,
            downloaded: true,
            progress: 100,
            updateInfo: info,
        };
        sendStatusToRenderer();
    });

    autoUpdater.on('error', (error) => {
        currentStatus = {
            ...currentStatus,
            checking: false,
            downloading: false,
            error: error.message,
        };
        sendStatusToRenderer();
    });
}

export function getAppVersion(): string {
    return app.getVersion();
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
    if (updaterDisabled) return null;
    try {
        const result = await autoUpdater.checkForUpdates();
        return result?.updateInfo ?? null;
    } catch (error) {
        log.error('Error checking for updates:', error);
        throw error;
    }
}

export async function downloadUpdate(): Promise<void> {
    // Not just updaterDisabled: downloading on a 'manual' install would hand
    // Squirrel.Mac a payload it will refuse to install, so stop earlier and
    // let the UI point at the download page instead.
    if (!canInstallInPlace) return;
    try {
        await autoUpdater.downloadUpdate();
    } catch (error) {
        log.error('Error downloading update:', error);
        throw error;
    }
}

export function quitAndInstall(): void {
    if (!canInstallInPlace) return;
    autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
    return currentStatus;
}
