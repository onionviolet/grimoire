import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { getConfigWorkspace, applyConfigWorkspace, parseConfigBundle, exportConfigBundle } from '../services/configWorkspace';
import type { ConfigWorkspaceUpdate } from '../../../src/types/configWorkspace';

ipcMain.handle('config-workspace:read', () => getConfigWorkspace(getActiveDeadlockPath()));
ipcMain.handle('config-workspace:apply', (_event, update: ConfigWorkspaceUpdate) => applyConfigWorkspace(getActiveDeadlockPath(), update));
ipcMain.handle('config-workspace:parse-bundle', (_event, text: string) => parseConfigBundle(text));
ipcMain.handle('config-workspace:export-bundle', () => exportConfigBundle(getConfigWorkspace(getActiveDeadlockPath())));
