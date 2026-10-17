import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ channel: 'stable', events: new Map<string, (...args: unknown[]) => void>(), beforeQuit: (() => {}) as () => void,
  updater: { on: vi.fn(), checkForUpdates: vi.fn(async () => ({ updateInfo: null })), allowPrerelease: true, allowDowngrade: true, autoInstallOnAppQuit: true } }));
vi.mock('electron-updater', () => ({ default: { autoUpdater: h.updater } }));
vi.mock('electron', () => ({ app: { getVersion: () => '1.30.1', name: 'Grimoire', on: (_event: string, fn: () => void) => { h.beforeQuit = fn; } } }));
vi.mock('electron-log', () => ({ default: { transports: { file: {} }, info: vi.fn(), error: vi.fn() } }));
vi.mock('./updaterCache', () => ({ pruneUpdaterCache: async () => 0 }));
vi.mock('./settings', () => ({ loadSettings: () => ({ updateReleaseChannel: h.channel }) }));
let updater: typeof import('./updater');
beforeEach(async () => {
  vi.resetModules(); h.channel = 'stable'; h.events.clear();
  h.updater.on.mockImplementation((name: string, fn: (...args: unknown[]) => void) => h.events.set(name, fn));
  updater = await import('./updater');
  updater.initUpdater({ isDestroyed: () => false, webContents: { send: vi.fn() } } as unknown as import('electron').BrowserWindow);
});
describe('updater release-channel boundaries', () => {
  it('distinguishes an unchecked install from a completed update check', () => {
    expect(updater.getUpdateStatus().checked).toBe(false);
    h.events.get('update-not-available')!();
    expect(updater.getUpdateStatus().checked).toBe(true);
  });
  it('sets provider prerelease policy only on an explicit check and never permits downgrade', async () => {
    h.channel = 'preview'; await updater.checkForUpdates();
    expect(h.updater.allowPrerelease).toBe(true); expect(h.updater.allowDowngrade).toBe(false);
    h.channel = 'stable'; await updater.checkForUpdates();
    expect(h.updater.allowPrerelease).toBe(false);
  });
  it('prevents a previously staged preview from installing on quit after returning to stable', () => {
    h.events.get('update-available')!({ version: '1.31.0-beta.1' });
    h.channel = 'stable'; h.updater.autoInstallOnAppQuit = true;
    h.beforeQuit(); expect(h.updater.autoInstallOnAppQuit).toBe(false);
  });
});
