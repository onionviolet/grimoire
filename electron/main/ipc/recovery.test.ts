import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, () => Promise<unknown>>(),
  getPath: vi.fn<() => string | null>(),
  scan: vi.fn<(gamePath: string | null) => Promise<{ gamePath: string | null }>>(),
}));

vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, handler: () => Promise<unknown>) => mocks.handlers.set(channel, handler) } }));
vi.mock('../services/settings', () => ({ getActiveDeadlockPath: mocks.getPath }));
vi.mock('../services/installationHealth', () => ({ scanInstallationHealth: mocks.scan }));
vi.mock('../services/setupTestHistory', () => ({}));
vi.mock('../services/downloadCacheManagement', () => ({}));
vi.mock('../services/profileRecovery', () => ({}));
vi.mock('../services/compatibility', () => ({}));
vi.mock('../services/modIsolation', () => ({}));

import './recovery';

function deferredScan() {
  let resolve!: (result: { gamePath: string }) => void;
  const promise = new Promise<{ gamePath: string }>(done => { resolve = done; });
  return { promise, resolve };
}

it('shares a scan only with requests for the same installation', async () => {
  const normal = deferredScan();
  const developer = deferredScan();
  mocks.scan.mockReturnValueOnce(normal.promise).mockReturnValueOnce(developer.promise);
  const scan = mocks.handlers.get('recovery:scan')!;

  mocks.getPath.mockReturnValue('normal');
  const normalScan = scan();
  expect(scan()).toBe(normalScan);

  mocks.getPath.mockReturnValue('developer');
  const developerScan = scan();
  expect(developerScan).not.toBe(normalScan);
  expect(mocks.scan.mock.calls).toEqual([['normal'], ['developer']]);

  normal.resolve({ gamePath: 'normal' });
  expect(await normalScan).toEqual({ gamePath: 'normal' });
  expect(scan()).toBe(developerScan);

  developer.resolve({ gamePath: 'developer' });
  expect(await developerScan).toEqual({ gamePath: 'developer' });
  mocks.scan.mockResolvedValueOnce({ gamePath: 'developer' });
  await expect(scan()).resolves.toEqual({ gamePath: 'developer' });
  expect(mocks.scan).toHaveBeenCalledTimes(3);
});
