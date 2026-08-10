import { ipcMain } from 'electron';
import { loadSettings, saveSettings, type AppSettings } from '../services/settings';
import { detectDeadlockPath, looksLikeDeadlockPath } from '../services/deadlock';
import { ensureDevDeadlockPath } from '../services/dev';
import { configureFilter, filterStats } from '../services/browserContentFilter';
import type { BrowserFilterStats } from '../../../src/types/foundry';
import { syncForgeBridgeWithSettings } from '../services/forgeBridge';

// detect-deadlock
ipcMain.handle('detect-deadlock', (): string | null => {
    return detectDeadlockPath();
});

// validate-deadlock-path: loose check so users can configure a path even
// when gameinfo.gi is missing; the Settings page surfaces a recovery
// affordance in that state.
ipcMain.handle('validate-deadlock-path', (_, path: string): boolean => {
    return looksLikeDeadlockPath(path);
});

// create-dev-deadlock-path
ipcMain.handle('create-dev-deadlock-path', (): string => {
    return ensureDevDeadlockPath();
});

// get-settings
ipcMain.handle('get-settings', (): AppSettings => {
    return loadSettings();
});

// set-settings
ipcMain.handle('set-settings', (_, settings: AppSettings): void => {
    saveSettings(settings);
    // Rebuild the browser blocklist in the same breath as the save, so a list
    // path or toggle change takes effect without restarting the app. Cheap: a
    // file read and a Set rebuild, and it no-ops when the filter is off.
    configureFilter({
        enabled: settings.browserBlockTrackers !== false,
        userListPath: settings.browserBlockListPath,
    });
    // Bring the DeadlockForge bridge up or down to match. Toggling it off must
    // actually close the socket, not just start refusing requests on it.
    void syncForgeBridgeWithSettings();
});

// browser:filterStats
// Settings reads this to show what the filter is actually doing (entry count,
// requests blocked this session, and any error from a bad user list). Without
// it the blocking is invisible and a broken custom list would fail silently.
ipcMain.handle('browser:filterStats', (): BrowserFilterStats => {
    return filterStats();
});
