import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const h = vi.hoisted(() => ({ root: '', fingerprint: 'build1', index: vi.fn(), run: vi.fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: () => join(h.root, 'game') }));
vi.mock('./foundryCatalog', () => ({ thumbsRoot: () => join(h.root, 'thumbs') }));
vi.mock('./vpk', () => ({ parseVpkEntryIndex: h.index }));
vi.mock('./modMerger', () => ({ runVpkmerge: h.run }));
const { listFoundryModels, prepareFoundryModel, validModelEntryPath } = await import('./foundryModels');
const entry = 'models/heroes/example/body.vmdl_c';
const validGlb = () => {
    const bytes = Buffer.alloc(24);
    bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
    return bytes;
};

beforeEach(async () => {
    h.root = await fs.mkdtemp(join(tmpdir(), 'foundry-model-test-'));
    await fs.mkdir(join(h.root, 'game'));
    await fs.writeFile(join(h.root, 'game', 'pak01_dir.vpk'), 'fake pak');
    h.fingerprint = 'build1';
    h.index.mockReturnValue([{ path: entry, size: 42 }, { path: 'materials/body.vmat_c', size: 17 }]);
    h.run.mockReset().mockImplementation(async (args: string[]) => { await fs.writeFile(args[args.indexOf('--out') + 1], validGlb()); });
});
afterEach(async () => { await fs.rm(h.root, { recursive: true, force: true }); });

describe('Foundry base-game model browse', () => {
    it('lists only exact model entries without invoking the exporter', () => {
        expect(listFoundryModels('game')).toEqual([{ path: entry, label: 'body', size: 42 }]);
        expect(h.run).not.toHaveBeenCalled();
    });
    it('rejects traversal, Windows separators and non-model requests', async () => {
        for (const path of ['../body.vmdl_c', 'models/../body.vmdl_c', 'models//body.vmdl_c', 'models/a\\body.vmdl_c', 'models/body.vtex_c', 'models/a\0.vmdl_c']) {
            expect(validModelEntryPath(path)).toBe(false);
            await expect(prepareFoundryModel('game', path)).rejects.toThrow();
        }
        expect(h.run).not.toHaveBeenCalled();
    });
    it('refuses a model absent from the actual catalog', async () => {
        await expect(prepareFoundryModel('game', 'models/missing.vmdl_c')).rejects.toThrow('no longer present');
        expect(h.run).not.toHaveBeenCalled();
    });
    it('exports one static GLB for concurrent requests and reuses the validated cache', async () => {
        const [a, b] = await Promise.all([prepareFoundryModel('game', entry), prepareFoundryModel('game', entry)]);
        expect(a).toEqual(b);
        expect(a.preview).toMatchObject({ bytes: 24 });
        expect(a.preview.url).toMatch(/^grimoire-foundry:\/\/t\/[0-9-]+\/model-assets\/[a-f0-9]{64}\.glb$/);
        expect(h.run).toHaveBeenCalledTimes(1);
        expect(h.run.mock.calls[0][0]).toEqual(['model', 'export', '--vpk', join(h.root, 'game', 'pak01_dir.vpk'), '--entry', entry, '--no-anim', '--out', expect.any(String)]);
        await prepareFoundryModel('game', entry);
        expect(h.run).toHaveBeenCalledTimes(1);
    });
    it('rejects malformed exporter output and removes its temporary file', async () => {
        h.run.mockImplementation(async (args: string[]) => { await fs.writeFile(args[args.indexOf('--out') + 1], Buffer.alloc(24)); });
        await expect(prepareFoundryModel('game', entry)).rejects.toThrow('valid GLB');
        const builds = await fs.readdir(join(h.root, 'thumbs'));
        expect(await fs.readdir(join(h.root, 'thumbs', builds[0], 'model-assets'))).toEqual([]);
    });
    it('does not publish an output if the game build changes during export', async () => {
        h.run.mockImplementation(async (args: string[]) => { await fs.writeFile(args[args.indexOf('--out') + 1], validGlb()); await fs.appendFile(join(h.root, 'game', 'pak01_dir.vpk'), 'new build'); });
        await expect(prepareFoundryModel('game', entry)).rejects.toThrow('changed during');
        const builds = await fs.readdir(join(h.root, 'thumbs'));
        expect(await fs.readdir(join(h.root, 'thumbs', builds[0], 'model-assets'))).toEqual([]);
    });
    it('surfaces unreadable catalogs instead of claiming an empty model inventory', () => {
        h.index.mockReturnValue(null);
        expect(() => listFoundryModels('game')).toThrow('Could not read');
    });
});
