import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { applyDisabledCompression, inspectDisabledCompression } from '../services/disabledCompression';
import type { DisabledCompressionMode } from '../../../src/types/disabledCompression';

function gamePath(): string {
    const path = getActiveDeadlockPath();
    if (!path) throw new Error('No Deadlock path configured');
    return path;
}

ipcMain.handle('disabled-compression:inspect', () => inspectDisabledCompression(gamePath()));
ipcMain.handle('disabled-compression:apply', (_, mode: DisabledCompressionMode) => applyDisabledCompression(gamePath(), mode));
