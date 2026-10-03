import { ipcMain } from 'electron';
import { getActiveDeadlockPath } from '../services/settings';
import { scanInstallationHealth } from '../services/installationHealth';

let pending: ReturnType<typeof scanInstallationHealth> | null = null;
ipcMain.handle('recovery:scan', () => {
  // Repeated clicks share one read so a large library cannot flood the main process.
  if (!pending) pending = scanInstallationHealth(getActiveDeadlockPath()).finally(() => { pending = null; });
  return pending;
});
