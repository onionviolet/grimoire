import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DisabledCompressionMode } from '../../../src/types/disabledCompression';

const mocks = vi.hoisted(() => ({ exec: vi.fn(), lock: vi.fn(async (run: () => Promise<unknown>) => run()) }));
vi.mock('node:child_process', () => ({ execFile: mocks.exec }));
vi.mock('./mods', () => ({ runExclusiveModMutation: mocks.lock }));
const { applyDisabledCompression, inspectDisabledCompression } = await import('./disabledCompression');
let root: string;
let parking: string;

beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'grimoire-disabled-compression-test-'));
    parking = join(root, 'game/citadel/addons/.disabled');
    await fs.mkdir(parking, { recursive: true });
    mocks.exec.mockReset().mockImplementation((_file, _args, _options, callback) => callback(null));
    mocks.lock.mockClear();
});
afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });

describe.skipIf(process.platform !== 'win32')('disabled NTFS compression scope', () => {
    it('passes only immediate regular disabled VPKs as literal arguments', async () => {
        await fs.writeFile(join(parking, 'multipart_dir.vpk'), 'directory');
        await fs.writeFile(join(parking, 'multipart_000.vpk'), 'chunk');
        await fs.writeFile(join(parking, 'space & dollar $ file.vpk'), 'spaces');
        await fs.writeFile(join(parking, 'notes.txt'), 'ignored');
        await fs.mkdir(join(parking, 'nested.vpk'));
        await fs.writeFile(join(parking, 'nested.vpk/inner.vpk'), 'ignored');
        await fs.writeFile(join(root, 'game/citadel/addons/pak01_dir.vpk'), 'live');
        const result = await applyDisabledCompression(root, 'compress');
        expect(result).toEqual({ processedFiles: 3, skippedFiles: 1, failedFiles: 0 });
        expect(mocks.lock).toHaveBeenCalledOnce();
        expect(mocks.exec).toHaveBeenCalledTimes(3);
        for (const [executable, args, options] of mocks.exec.mock.calls) {
            expect(executable.toLowerCase()).toBe(join(process.env.SystemRoot!, 'System32/compact.exe').toLowerCase());
            expect(args.slice(0, -1)).toEqual(['/C', '/A', '/F', '/Q']);
            expect(args.at(-1)).toMatch(/\.disabled[\\/][^\\/]+\.vpk$/);
            expect(options.shell).toBe(false);
            expect(options.windowsHide).toBe(true);
        }
        expect(await fs.readFile(join(root, 'game/citadel/addons/pak01_dir.vpk'), 'utf8')).toBe('live');
    });

    it('skips hardlinks and refuses linked parking ancestry', async () => {
        const external = join(root, 'external.vpk');
        await fs.writeFile(external, 'preserve');
        await fs.link(external, join(parking, 'hardlink.vpk'));
        expect(await applyDisabledCompression(root, 'expand')).toEqual({ processedFiles: 0, skippedFiles: 1, failedFiles: 0 });
        expect(mocks.exec).not.toHaveBeenCalled();
        await fs.rm(parking, { recursive: true });
        const outside = join(root, 'outside');
        await fs.mkdir(outside);
        await fs.symlink(outside, parking, 'junction');
        expect((await inspectDisabledCompression(root)).supported).toBe(false);
        await expect(applyDisabledCompression(root, 'compress')).rejects.toThrow('linked');
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('reports partial native failures and uses expand without executable compression', async () => {
        await fs.writeFile(join(parking, 'one.vpk'), 'one');
        await fs.writeFile(join(parking, 'two.vpk'), 'two');
        mocks.exec.mockImplementationOnce((_file, _args, _options, callback) => callback(new Error('volume does not support compression')));
        expect(await applyDisabledCompression(root, 'expand')).toEqual({ processedFiles: 1, skippedFiles: 0, failedFiles: 1 });
        expect(mocks.exec.mock.calls.every(([, args]) => args[0] === '/U' && !args.some((arg: string) => arg.startsWith('/EXE') || arg.startsWith('/S')))).toBe(true);
    });

    it('returns unsupported for missing utility and rejects malformed mode', async () => {
        vi.stubEnv('SystemRoot', join(root, 'missing-system'));
        expect((await inspectDisabledCompression(root)).supported).toBe(false);
        await expect(applyDisabledCompression(root, 'invalid' as DisabledCompressionMode)).rejects.toThrow('Invalid');
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('does not create missing parking folders and reports logical byte totals', async () => {
        await fs.writeFile(join(parking, 'one.vpk'), '1234');
        expect(await inspectDisabledCompression(root)).toEqual({ supported: true, fileCount: 1, totalBytes: 4, skippedFiles: 0 });
        await fs.rm(parking, { recursive: true });
        expect(await inspectDisabledCompression(root)).toEqual({ supported: true, fileCount: 0, totalBytes: 0, skippedFiles: 0 });
        await expect(fs.stat(parking)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});

it.skipIf(process.platform === 'win32')('declines unsupported operating systems without invoking compression', async () => {
    expect(await inspectDisabledCompression(root)).toEqual({ supported: false, fileCount: 0, totalBytes: 0, skippedFiles: 0 });
    await expect(applyDisabledCompression(root, 'compress')).rejects.toThrow('only on Windows');
    expect(mocks.exec).not.toHaveBeenCalled();
});
