import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import type { UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { isValidSemver } from './version';

export type InstallSource = 'managed' | 'appimage' | 'standard' | 'fork';

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
    if (process.platform === 'linux') {
        if (process.env.APPIMAGE) return 'appimage';
        const exec = process.execPath;
        if (
            exec.startsWith('/opt/') ||
            exec.startsWith('/usr/') ||
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
// 'managed': in-app updates would fail (root-owned install dir).
// 'fork': safe now — publish feed targets onionviolet/grimoire, not upstream.
let updaterDisabled = installSource === 'managed';

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
    if (updaterDisabled) return;
    try {
        await autoUpdater.downloadUpdate();
    } catch (error) {
        log.error('Error downloading update:', error);
        throw error;
    }
}

export function quitAndInstall(): void {
    if (updaterDisabled) return;
    autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
    return currentStatus;
}
