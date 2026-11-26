import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { isAbsolute, join } from 'path';
import type { StockVfxReview } from '../../../src/types/peerTools';
import { getCitadelPath } from './deadlock';
import { compiledResourceDependencies } from './modelReplacement';
import { vpkCrc32, writeNativeVpk } from './nativeVpk';
import { detectVfxLayer, extractHeroFromPath, parseVpkEntryIndex, readVpkEntryBytes, validateImportVpk } from './vpk';

const MAX_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_OVERLAY_BYTES = 128 * 1024 * 1024;

async function inspectStockVfx(gamePath: string, sourcePath: string) {
  if (typeof sourcePath !== 'string' || !isAbsolute(sourcePath) || !sourcePath.toLowerCase().endsWith('.vpk')) {
    throw new Error('Select a skin VPK');
  }
  const basePath = join(getCitadelPath(gamePath), 'pak01_dir.vpk');
  const sourceIndex = parseVpkEntryIndex(sourcePath);
  const baseIndex = parseVpkEntryIndex(basePath);
  if (!sourceIndex || !baseIndex) throw new Error('Could not read the skin or stock VPK index');
  const source = new Map(sourceIndex.map(entry => [entry.path, entry]));
  const base = new Map(baseIndex.map(entry => [entry.path, entry]));
  const models = sourceIndex.filter(entry => entry.path.startsWith('models/') && entry.path.endsWith('.vmdl_c'));
  const heroCodes = new Set(models.map(entry => extractHeroFromPath(entry.path)).filter(Boolean));
  const particles = sourceIndex.filter(entry => entry.path.endsWith('.vpcf_c'));
  const modelEffects = particles.filter(({ path }) => {
    const match = /^particles\/(?:abilities|weapon_fx)\/([^/]+)\//.exec(path);
    return match && heroCodes.has(match[1]);
  });
  // Some skins ship shared melee alongside their hero layer. Use the model
  // paths to disambiguate those archives and leave unrelated overrides alone.
  const layer = detectVfxLayer((modelEffects.length ? modelEffects : particles).map(entry => entry.path));
  if (!layer || !models.length) {
    throw new Error('Select a skin VPK with a single hero particle layer');
  }
  const particlePaths = layer.paths.filter(path => path.endsWith('.vpcf_c') && layer.prefixes.some(prefix => path.startsWith(prefix)));
  const layerPaths = new Set(particlePaths);
  const changed = (path: string) => base.get(path)?.crc !== source.get(path)?.crc;
  const missingStock = particlePaths.filter(path => !base.has(path));
  const stockEntries = particlePaths.filter(path => base.has(path) && changed(path));
  const outsideLayer = particles.map(entry => entry.path).filter(path => !layerPaths.has(path) && changed(path)).sort();
  if (!stockEntries.length && !missingStock.length) throw new Error('The skin contains no changed stock particles in the supported paths');
  if (stockEntries.reduce((total, path) => total + base.get(path)!.size, 0) > MAX_OVERLAY_BYTES) {
    throw new Error('The stock particle overlay exceeds 128 MiB');
  }
  const data = new Map<string, Buffer>();
  const missingDependencies = new Set<string>();
  const affectedDependencies = new Set<string>();
  const digest = createHash('sha256').update(JSON.stringify({ sourcePath, sourceIndex, missingStock }));
  const replacing = new Set(stockEntries);
  for (const path of stockEntries) {
    const entry = base.get(path)!;
    if (entry.size > MAX_ASSET_BYTES) throw new Error('A single stock particle exceeds 64 MiB');
    const bytes = readVpkEntryBytes(basePath, path);
    if (!bytes || bytes.length !== entry.size || vpkCrc32(bytes) !== entry.crc) {
      throw new Error(`Could not verify stock particle: ${path}`);
    }
    data.set(path, bytes);
    digest.update(bytes);
    for (const dependency of compiledResourceDependencies(bytes)) {
      const stock = base.get(dependency);
      const override = source.get(dependency);
      if (!stock) missingDependencies.add(dependency);
      if (override && stock?.crc !== override.crc && !replacing.has(dependency)) affectedDependencies.add(dependency);
    }
  }
  const review: StockVfxReview = {
    sourcePath, codename: layer.codename, entries: stockEntries, missingStock, outsideLayer,
    affectedDependencies: [...affectedDependencies].sort(),
    missingDependencies: [...missingDependencies].sort(),
    reviewToken: digest.update(JSON.stringify([[...affectedDependencies].sort(), [...missingDependencies].sort()])).digest('hex'),
  };
  return { data, review };
}

export async function reviewStockVfx(gamePath: string, sourcePath: string): Promise<StockVfxReview> {
  return (await inspectStockVfx(gamePath, sourcePath)).review;
}

export async function buildStockVfx(gamePath: string, sourcePath: string, reviewToken: string) {
  const { data, review } = await inspectStockVfx(gamePath, sourcePath);
  if (review.reviewToken !== reviewToken) throw new Error('Review the current skin and stock files again');
  if (!data.size) {
    throw new Error('No stock particle overlay can be built from this review');
  }
  const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-stock-vfx-'));
  const vpkPath = join(dir, 'stock_vfx_dir.vpk');
  const cleanup = () => fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
    .catch(error => console.warn('[stockVfx] Could not remove temporary overlay', error));
  try {
    await fs.writeFile(vpkPath, writeNativeVpk(data));
    validateImportVpk(vpkPath);
    const actual = parseVpkEntryIndex(vpkPath);
    if (!actual || actual.length !== data.size || actual.some(entry => {
      const bytes = data.get(entry.path);
      return !bytes || bytes.length !== entry.size || vpkCrc32(bytes) !== entry.crc;
    })) throw new Error('The exported overlay did not match the reviewed stock particles');
    return { vpkPath, codename: review.codename, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
