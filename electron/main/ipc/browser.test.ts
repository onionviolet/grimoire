import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `resolvePendingToolDownload` is exported from `./browser` with the install
// call and the temp-file cleanup call injectable, so those two are stubbed
// per-test rather than mocked at module level. Everything else `ipc/browser.ts`
// imports at module scope (electron's ipcMain, the real
// `../services/browserDownloadCapture` pending map, `../services/settings`,
// `../services/mods`, and `./mods`) is mocked/stubbed here so importing the
// module has no Electron side effects, matching the existing ipc test
// convention (see electron/main/ipc/foundry.buildDiff.test.ts).
const harness = vi.hoisted(() => ({ userData: '', mainWindow: null as unknown, deadlockPath: 'C:/Games/Deadlock' as string | null }));

const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const ipcOnHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    app: { getPath: () => harness.userData },
    ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => ipcHandlers.set(channel, handler),
        on: (channel: string, handler: (...args: unknown[]) => unknown) => ipcOnHandlers.set(channel, handler),
    },
}));
vi.mock('../index', () => ({
    getMainWindow: () => harness.mainWindow,
    openExternalSafe: vi.fn(),
}));
vi.mock('../services/settings', () => ({
    getActiveDeadlockPath: () => harness.deadlockPath,
}));
vi.mock('../services/mods', () => ({
    runExclusiveModMutation: (fn: () => unknown) => fn(),
}));
vi.mock('./mods', () => ({
    importCustomModSource: vi.fn(),
}));

const { resolvePendingToolDownload } = await import('./browser');
const { replacePending } = await import('../services/browserDownloadCapture');

describe('resolvePendingToolDownload', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'browser-ipc-resolve-'));
        harness.userData = dir;
        harness.deadlockPath = 'C:/Games/Deadlock';
        harness.mainWindow = null; // pushToolDownloadEvent's null-window guard is exercised implicitly
    });

    /** Seeds the shared pending map (the same module `resolvePendingToolDownload`
     *  itself reads via `takePendingToolDownload`) via the real, exported
     *  `replacePending`, so these tests exercise the actual confused-deputy
     *  contract rather than a second, parallel fake map. */
    async function seedPending(id: string, filename = `${id}.download`): Promise<string> {
        const tempPath = join(dir, filename);
        writeFileSync(tempPath, 'stub bytes');
        await replacePending({ id, tempPath, displayName: 'Test download' }, 'Test tool');
        return tempPath;
    }

    it('returns stale for an id that was never issued and imports nothing', async () => {
        const install = vi.fn();
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('never-issued', true, { install, deleteTempFile });

        expect(result).toEqual({ ok: false, stale: true });
        expect(install).not.toHaveBeenCalled();
        expect(deleteTempFile).not.toHaveBeenCalled();
    });

    it('accept calls install exactly once with the recorded vpkPath and name, then deletes the temp file', async () => {
        const tempPath = await seedPending('id-accept');
        const install = vi.fn().mockResolvedValue(undefined);
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('id-accept', true, { install, deleteTempFile });

        expect(result).toEqual({ ok: true });
        expect(install).toHaveBeenCalledTimes(1);
        expect(install).toHaveBeenCalledWith(
            { vpkPath: tempPath, name: 'Test download', nsfw: false },
            'C:/Games/Deadlock'
        );
        expect(deleteTempFile).toHaveBeenCalledWith(tempPath);
    });

    it('decline deletes the temp file, returns ok:false stale:false, and performs no import', async () => {
        const tempPath = await seedPending('id-decline');
        const install = vi.fn();
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('id-decline', false, { install, deleteTempFile });

        expect(result).toEqual({ ok: false, stale: false });
        expect(install).not.toHaveBeenCalled();
        expect(deleteTempFile).toHaveBeenCalledWith(tempPath);
    });

    it('resolving the same id twice returns stale the second time and imports exactly once in total', async () => {
        await seedPending('id-double');
        const install = vi.fn().mockResolvedValue(undefined);
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const first = await resolvePendingToolDownload('id-double', true, { install, deleteTempFile });
        const second = await resolvePendingToolDownload('id-double', true, { install, deleteTempFile });

        expect(first).toEqual({ ok: true });
        expect(second).toEqual({ ok: false, stale: true });
        expect(install).toHaveBeenCalledTimes(1);
    });

    it('resolving a pending id superseded by replacePending returns stale and imports nothing', async () => {
        await seedPending('id-old');
        // A second capture supersedes the first: replacePending evicts it.
        await seedPending('id-new');
        const install = vi.fn();
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('id-old', true, { install, deleteTempFile });

        expect(result).toEqual({ ok: false, stale: true });
        expect(install).not.toHaveBeenCalled();
        // The superseded id's temp file was already deleted by replacePending,
        // not by this resolve call, since the entry was never taken.
        expect(deleteTempFile).not.toHaveBeenCalled();
    });

    it('propagates an install throw as ok:false with the error message, and still deletes the temp file', async () => {
        const tempPath = await seedPending('id-throws');
        const install = vi.fn().mockRejectedValue(new Error('disk full'));
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('id-throws', true, { install, deleteTempFile });

        expect(result).toEqual({ ok: false, error: 'disk full' });
        expect(deleteTempFile).toHaveBeenCalledWith(tempPath);
    });

    it('returns an error when no Deadlock path is configured, without importing or deleting the temp file yet', async () => {
        harness.deadlockPath = null;
        const tempPath = await seedPending('id-no-path');
        const install = vi.fn();
        const deleteTempFile = vi.fn().mockResolvedValue(undefined);

        const result = await resolvePendingToolDownload('id-no-path', true, { install, deleteTempFile });

        expect(result).toEqual({ ok: false, error: 'No Deadlock path configured' });
        expect(install).not.toHaveBeenCalled();
        // The temp file is still cleaned up on this path (the `finally`
        // block runs regardless of which branch returned).
        expect(deleteTempFile).toHaveBeenCalledWith(tempPath);
    });
});

describe('browser:set-active-destination / browser:resolve-tool-download IPC registration', () => {
    it('registers browser:set-active-destination and browser:resolve-tool-download at import time', () => {
        expect(ipcOnHandlers.has('browser:set-active-destination')).toBe(true);
        expect(ipcHandlers.has('browser:resolve-tool-download')).toBe(true);
    });

    it('the browser:resolve-tool-download handler delegates to resolvePendingToolDownload with default deps', async () => {
        const handler = ipcHandlers.get('browser:resolve-tool-download')!;
        const result = await handler({}, 'unknown-id', true);
        expect(result).toEqual({ ok: false, stale: true });
    });
});
