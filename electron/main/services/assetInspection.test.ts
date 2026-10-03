import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
const h = vi.hoisted(() => ({ root: '/fake/cache', index: vi.fn(), run: vi.fn(), fingerprint: vi.fn(), image: vi.fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: () => '/fake/game' }));
vi.mock('./vpk', () => ({ parseVpkEntryIndex: h.index }));
vi.mock('./foundryCatalog', () => ({ thumbsRoot: () => h.root, ensureFullImage: h.image, foundryBuildFingerprintKey: h.fingerprint.mockResolvedValue('42-123-456') }));
vi.mock('./modMerger', () => ({ runVpkmerge: h.run, runVpkmergeStdout: vi.fn() }));
const { assetKind, listInspectionAssets, inspectAsset, pruneInspectionCaches, retainInspectionCache } = await import('./assetInspection');
describe('exact base asset inspection', () => {
  it('lists every supported asset family, including models-path textures, without decoding', () => {
    h.index.mockReturnValue([{ path: 'models/heroes/body.vtex_c', size: 5 }, { path: 'materials/world/wall.vmat_c', size: 6 }, { path: 'particles/world/dust.vpcf_c', size: 7 }, { path: 'models/body.vmdl_c', size: 8 }]);
    expect(listInspectionAssets('game').map(entry => entry.kind).sort()).toEqual(['material', 'particle', 'texture']);
    expect(h.run).not.toHaveBeenCalled();
  });
  it('rejects traversal, nulls and non-catalog paths before exporter invocation', async () => {
    for (const path of ['../x.vtex_c', 'materials/../x.vmat_c', 'particles//x.vpcf_c', 'models/a\\x.vtex_c', 'models/a\0.vtex_c']) {
      expect(assetKind(path)).toBeNull(); await expect(inspectAsset('game', path)).rejects.toThrow();
    }
    await expect(inspectAsset('game', 'particles/missing.vpcf_c')).rejects.toThrow('no longer');
    expect(h.run).not.toHaveBeenCalled();
  });
  it('distinguishes an unreadable catalog from a genuine empty one', () => {
    h.index.mockReturnValue(null); expect(() => listInspectionAssets('game')).toThrow('Could not read');
    h.index.mockReturnValue([]); expect(listInspectionAssets('game')).toEqual([]);
  });
});

let temporaryRoot: string | null = null;
afterEach(async () => { if (temporaryRoot) { await fs.rm(temporaryRoot, { recursive: true, force: true }); temporaryRoot = null; } });
it('caps inspection output, preserves active exports and leaves other Foundry caches alone', async () => {
  temporaryRoot = await fs.mkdtemp(join(tmpdir(), 'inspection-cache-test-')); h.root = temporaryRoot;
  const old = join(h.root, 'build', `inspect-${'a'.repeat(64)}`), keep = join(h.root, 'build', `inspect-${'b'.repeat(64)}`), unrelated = join(h.root, 'build', 'model-assets');
  for (const dir of [old, keep, unrelated]) await fs.mkdir(dir, { recursive: true });
  for (const [dir, size] of [[old, 180], [keep, 150]] as const) {
    const file = await fs.open(join(dir, 'ability.glb'), 'w'); await file.truncate(size * 1024 * 1024); await file.close();
  }
  await fs.writeFile(join(unrelated, 'model.glb'), 'preserved');
  const release = retainInspectionCache(old);
  await pruneInspectionCaches(keep); expect(await fs.stat(old)).toBeTruthy();
  release(); await pruneInspectionCaches(keep);
  await expect(fs.stat(old)).rejects.toThrow(); expect(await fs.stat(keep)).toBeTruthy();
  expect(await fs.readFile(join(unrelated, 'model.glb'), 'utf8')).toBe('preserved');
});

it('rejects stale texture URLs for all concurrent inspection callers after a game build changes', async () => {
  temporaryRoot = await fs.mkdtemp(join(tmpdir(), 'inspection-stale-test-')); h.root = temporaryRoot;
  h.index.mockReturnValue([{ path: 'materials/glow.vtex_c', size: 5 }]);
  h.fingerprint.mockResolvedValueOnce('42-123-456').mockResolvedValueOnce('42-123-456').mockResolvedValue('43-124-0');
  let finish!: (value: string) => void;
  const image = new Promise<string>(resolve => { finish = resolve; });
  let started!: () => void;
  const decoding = new Promise<void>(resolve => { started = resolve; });
  // Every invocation shares this gate, including a caller whose cache mkdir
  // finishes after the first rejected export has left the in-flight registry.
  h.image.mockImplementation(() => { started(); return image; });
  const a = inspectAsset('game', 'materials/glow.vtex_c');
  const b = inspectAsset('game', 'materials/glow.vtex_c');
  const results = Promise.allSettled([a, b]);
  await decoding;
  finish('grimoire-foundry://t/42-123-456/other/glow.png');
  expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected']);
});
