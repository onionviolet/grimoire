import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeNativeVpk } from './nativeVpk';
vi.mock('./assetInspection', () => ({ inspectionCache: vi.fn(), retainInspectionCache: vi.fn(), pruneInspectionCaches: vi.fn() }));
vi.mock('./foundryModels', () => ({ validModelEntryPath: (path: string) => path.startsWith('models/') && path.endsWith('.vmdl_c') && !path.includes('..'), validateGlb: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmerge: vi.fn() }));
import { compiledResourceDependencies, reviewModelReplacement, buildModelReplacement } from './modelReplacement';
import { parseVpkEntryIndex } from './vpk';

function resource(dependency?: string): Buffer {
  const count = dependency ? 2 : 1, tableEnd = 16 + count * 12;
  const name = dependency ? Buffer.from(dependency + '\0') : Buffer.alloc(0);
  const bytes = Buffer.alloc(tableEnd + 4 + (dependency ? 24 + name.length : 0));
  bytes.writeUInt32LE(bytes.length); bytes.writeUInt16LE(12, 4); bytes.writeUInt32LE(8, 8); bytes.writeUInt32LE(count, 12);
  bytes.write('DATA', 16); bytes.writeUInt32LE(tableEnd - 20, 20); bytes.writeUInt32LE(4, 24);
  if (dependency) {
    const start = tableEnd + 4;
    bytes.write('RERL', 28); bytes.writeUInt32LE(start - 32, 32); bytes.writeUInt32LE(24 + name.length, 36);
    bytes.writeUInt32LE(8, start); bytes.writeUInt32LE(1, start + 4); bytes.writeInt32LE(8, start + 16); name.copy(bytes, start + 24);
  }
  return bytes;
}
let root: string, donor: string;
const model = 'models/test.vmdl_c';
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'grimoire-model-test-')); donor = join(root, 'donor_dir.vpk');
  await fs.mkdir(join(root, 'game/citadel'), { recursive: true });
  await fs.writeFile(join(root, 'game/citadel/pak01_dir.vpk'), writeNativeVpk(new Map([[model, resource()], ['materials/stock.vmat_c', resource()]])));
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
describe('compiled model bundles', () => {
  it('reads relative RERL paths and rejects truncated tables', () => {
    expect(compiledResourceDependencies(resource('materials/stock.vmat'))).toEqual(['materials/stock.vmat_c']);
    expect(() => compiledResourceDependencies(resource('materials/stock.vmat').subarray(0, 40))).toThrow();
  });
  it('reviews base dependencies and forges only the confirmed compiled write set', async () => {
    await fs.writeFile(donor, writeNativeVpk(new Map([[model, resource('materials/stock.vmat')]])));
    const review = await reviewModelReplacement(root, model, donor);
    expect(review.dependencies).toEqual([{ path: 'materials/stock.vmat_c', source: 'base' }]);
    const built = await buildModelReplacement(root, review);
    try { expect(parseVpkEntryIndex(built.vpkPath)?.map(entry => entry.path)).toEqual([model]); }
    finally { await built.cleanup(); }
    await fs.writeFile(donor, writeNativeVpk(new Map([[model, resource()]])));
    await expect(buildModelReplacement(root, review)).rejects.toThrow('stale');
  });
  it('blocks missing dependencies and unrelated scripts before staging', async () => {
    await fs.writeFile(donor, writeNativeVpk(new Map([[model, resource('materials/missing.vmat')]])));
    await expect(reviewModelReplacement(root, model, donor)).rejects.toThrow('dependency is missing');
    await fs.writeFile(donor, writeNativeVpk(new Map([[model, resource()], ['scripts/unsafe.cfg', Buffer.from('exec unsafe')]])));
    await expect(reviewModelReplacement(root, model, donor)).rejects.toThrow('only supported');
  });
});
