import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { scanInstallationHealth } from '../services/installationHealth';
import { getSetupTestHistory, recordSetupTest } from '../services/setupTestHistory';
import { previewDownloadCache, cleanDownloadCache } from '../services/downloadCacheManagement';

const pendingScans = new Map<ReturnType<typeof getActiveDeadlockPath>, ReturnType<typeof scanInstallationHealth>>();
ipcMain.handle('recovery:scan', () => {
  const path = getActiveDeadlockPath();
  const running = pendingScans.get(path);
  if (running) return running;
  // A scan for the previous game path may still be running after a settings change.
  const scan = scanInstallationHealth(path).finally(() => { pendingScans.delete(path); });
  pendingScans.set(path, scan);
  return scan;
});

import { getInterruptedProfileRecovery, recoverInterruptedProfileRecovery } from '../services/profileRecovery';
import { reviewModCompatibility } from '../services/compatibility';
import { getModIsolationSession, startModIsolation, applyModIsolationTrial, recordModIsolationResult, finishModIsolation } from '../services/modIsolation';

function activePath(): string {
  const path = getActiveDeadlockPath();
  if (!path) throw new Error('Game installation is not configured');
  return path;
}
ipcMain.handle('recovery:interrupted', () => getInterruptedProfileRecovery(activePath()));
ipcMain.handle('recovery:recover-interrupted', (_event, token: string) => recoverInterruptedProfileRecovery(activePath(), token));
ipcMain.handle('recovery:compatibility', () => reviewModCompatibility(activePath()));
ipcMain.handle('recovery:isolation-session', () => getModIsolationSession(activePath()));
ipcMain.handle('recovery:isolation-start', () => startModIsolation(activePath()));
ipcMain.handle('recovery:isolation-apply', (_event, token: string) => applyModIsolationTrial(activePath(), token));
ipcMain.handle('recovery:isolation-result', (_event, token: string, result: 'works' | 'crashes') => recordModIsolationResult(activePath(), token, result));
ipcMain.handle('recovery:isolation-finish', (_event, token: string) => finishModIsolation(activePath(), token));
ipcMain.handle('recovery:setup-tests', () => getSetupTestHistory(activePath()));
ipcMain.handle('recovery:record-setup-test', (_event, token: string, result: 'works' | 'crashes', note: string) => recordSetupTest(activePath(), token, result, note));
ipcMain.handle('recovery:download-cache', () => previewDownloadCache());
ipcMain.handle('recovery:clean-download-cache', (_event, token: string) => cleanDownloadCache(token));
