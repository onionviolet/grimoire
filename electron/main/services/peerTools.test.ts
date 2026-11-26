import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { writeNativeVpk } from './nativeVpk';

const scan = vi.hoisted(() => vi.fn());
vi.mock('./mods', () => ({ scanModsReadOnly: scan }));
vi.mock('./assetInspection', () => ({}));
vi.mock('./foundryModels', () => ({}));
vi.mock('./modMerger', () => ({}));
import { reviewModPackage } from './modPackageReview';
import { buildStockVfx, reviewStockVfx } from './stockVfx';
import { parseVpkDirectory, readVpkEntryBytes } from './vpk';

const model = 'models/paige.vmdl_c';
const particle = 'particles/abilities/bookworm/attack.vpcf_c';
const sound = 'sounds/paige.vsnd_c';
const material = 'materials/paige.vmat_c';
let root: string;
let base: string;

beforeEach(async () => {
  scan.mockResolvedValue([]);
  root = await fs.mkdtemp(join(tmpdir(), 'grimoire-peer-tools-test-'));
  const citadel = join(root, 'game', 'citadel');
  await fs.mkdir(citadel, { recursive: true });
  base = join(citadel, 'pak01_dir.vpk');
  await fs.writeFile(base, writeNativeVpk(new Map([[model, resource()], [particle, resource()]])));
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

function resource(dependency?: string): Buffer {
  const name = Buffer.from(dependency ? `${dependency}\0` : '');
  const bytes = Buffer.alloc(dependency ? 68 + name.length : 32);
  bytes.writeUInt32LE(bytes.length);
  bytes.writeUInt16LE(12, 4);
  bytes.writeUInt32LE(8, 8);
  bytes.writeUInt32LE(dependency ? 2 : 1, 12);
  bytes.write('DATA', 16);
  bytes.writeUInt32LE(dependency ? 20 : 8, 20);
  bytes.writeUInt32LE(4, 24);
  if (dependency) {
    bytes.write('RERL', 28);
    bytes.writeUInt32LE(12, 32);
    bytes.writeUInt32LE(24 + name.length, 36);
    bytes.writeUInt32LE(8, 44);
    bytes.writeUInt32LE(1, 48);
    bytes.writeInt32LE(8, 60);
    name.copy(bytes, 68);
  }
  return bytes;
}

it('builds only the changed stock particle and rejects a stale review', async () => {
  const source = join(root, 'paige_dir.vpk');
  const original = writeNativeVpk(new Map([[model, resource()], [particle, Buffer.from('custom')], [sound, Buffer.from('custom sound')]]));
  await fs.writeFile(source, original);
  const review = await reviewStockVfx(root, source);
  expect(review.entries).toEqual([particle]);
  const built = await buildStockVfx(root, source, review.reviewToken);
  try {
    expect(parseVpkDirectory(built.vpkPath)).toEqual([particle]);
    expect(readVpkEntryBytes(built.vpkPath, particle)).toEqual(resource());
    expect(await fs.readFile(source)).toEqual(original);
  } finally { await built.cleanup(); }
  await fs.writeFile(source, writeNativeVpk(new Map([[model, resource()], [particle, Buffer.from('another effect')]])));
  await expect(buildStockVfx(root, source, review.reviewToken)).rejects.toThrow('again');
});

it('flags a skin-only particle that cannot be restored by an overlay', async () => {
  const source = join(root, 'paige_dir.vpk');
  const additive = 'particles/abilities/bookworm/custom.vpcf_c';
  await fs.writeFile(source, writeNativeVpk(new Map([[model, resource()], [additive, Buffer.from('custom')]])));
  const review = await reviewStockVfx(root, source);
  expect(review.missingStock).toEqual([additive]);
  await expect(buildStockVfx(root, source, review.reviewToken)).rejects.toThrow('No stock particle overlay');
});

it('restores the modeled hero from a mixed pack with shared melee and additive particles', async () => {
  const source = join(root, 'paige_dir.vpk');
  const shared = 'particles/abilities/melee/shared.vpcf_c';
  const additive = 'particles/abilities/bookworm/custom.vpcf_c';
  const paige = 'models/heroes_wip/bookworm/bookworm.vmdl_c';
  const original = writeNativeVpk(new Map([
    [paige, resource()], [sound, Buffer.from('custom sound')], [particle, Buffer.from('custom Paige particle')],
    [shared, Buffer.from('custom melee')], [additive, Buffer.from('extra Paige particle')],
  ]));
  await fs.writeFile(source, original);
  const review = await reviewStockVfx(root, source);
  expect(review).toMatchObject({ codename: 'bookworm', entries: [particle], missingStock: [additive], outsideLayer: [shared] });
  const built = await buildStockVfx(root, source, review.reviewToken);
  try {
    expect(parseVpkDirectory(built.vpkPath)).toEqual([particle]);
    expect(await fs.readFile(source)).toEqual(original);
  } finally { await built.cleanup(); }
});

it('reports a reference outside the indexed VPK without blocking verified stock bytes', async () => {
  const source = join(root, 'paige_dir.vpk');
  const stock = resource('materials/unindexed.vmat');
  await fs.writeFile(base, writeNativeVpk(new Map([[particle, stock]])));
  await fs.writeFile(source, writeNativeVpk(new Map([[model, resource()], [particle, Buffer.from('custom')]])));
  const review = await reviewStockVfx(root, source);
  expect(review.missingDependencies).toEqual(['materials/unindexed.vmat_c']);
  const built = await buildStockVfx(root, source, review.reviewToken);
  try {
    expect(readVpkEntryBytes(built.vpkPath, particle)).toEqual(stock);
  } finally { await built.cleanup(); }
});

it('reports a missing model reference, a currently enabled overlap and a false VPK without modifying the ZIP', async () => {
  const installed = join(root, 'enabled_dir.vpk');
  await fs.writeFile(installed, writeNativeVpk(new Map([[model, resource()]])));
  scan.mockResolvedValue([{ name: 'Current skin', enabled: true, path: installed }]);
  const zip = new AdmZip();
  zip.addFile('Skin/paige_dir.vpk', writeNativeVpk(new Map([[model, resource(material)]])));
  zip.addFile('Pretender_dir.vpk', Buffer.from('This is not a VPK'));
  const path = join(root, 'release.zip');
  const original = zip.toBuffer();
  await fs.writeFile(path, original);
  const review = await reviewModPackage(root, path);
  expect(review.packages).toEqual(['Skin/paige_dir.vpk']);
  expect(review.modelsChecked).toBe(1);
  expect(review.findings).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'invalidVpk', file: 'Pretender_dir.vpk' }),
    expect.objectContaining({ kind: 'missingDependency', entry: model, detail: material }),
    expect.objectContaining({ kind: 'overlap', entry: model, detail: 'Current skin' }),
  ]));
  expect(await fs.readFile(path)).toEqual(original);
});

it('accepts stock references and identifies references that require a separate ZIP member', async () => {
  await fs.writeFile(base, writeNativeVpk(new Map([[material, resource()]])));
  const path = join(root, 'release.zip');
  const zip = new AdmZip();
  zip.addFile('skin_dir.vpk', writeNativeVpk(new Map([[model, resource(material)]])));
  await fs.writeFile(path, zip.toBuffer());
  expect(await reviewModPackage(root, path)).toMatchObject({ packages: ['skin_dir.vpk'], modelsChecked: 1, findings: [] });

  await fs.writeFile(base, writeNativeVpk(new Map([[particle, resource()]])));
  zip.addFile('materials_dir.vpk', writeNativeVpk(new Map([[material, resource()]])));
  await fs.writeFile(path, zip.toBuffer());
  expect((await reviewModPackage(root, path)).findings).toEqual([
    { kind: 'siblingDependency', file: 'skin_dir.vpk', entry: model, detail: material },
  ]);
});
