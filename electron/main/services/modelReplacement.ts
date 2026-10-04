import { promises as fs } from 'fs';
import { basename, dirname, isAbsolute, join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { getCitadelPath } from './deadlock';
import { parseVpkEntryIndex, readVpkEntryBytes, findChunkSiblingNames } from './vpk';
import { fingerprintFile } from './fileMatch';
import { validModelEntryPath, validateGlb } from './foundryModels';
import { inspectionCache, retainInspectionCache, pruneInspectionCaches } from './assetInspection';
import { runVpkmerge } from './modMerger';
import { writeNativeVpk, vpkCrc32 } from './nativeVpk';
import type { ModelReplacementRequest, ModelReplacementReview } from '../../../src/types/modelReplacement';

const supported = /^(?:models|materials)\/(?:[^/]+\/)*[^/]+\.(?:vmdl|vmesh|vmat|vtex|vagrp|vanim|vskeleton|vphys)_c$/;
const safePath = (path: string) => path === path.toLowerCase() && !path.includes('\\') && ![...path].some(char => char.charCodeAt(0) < 32) && path.split('/').every(part => part && part !== '.' && part !== '..');

/** Source 2 RERL: relative block offsets and 16-byte external reference records.
 * Format reference: ValveResourceFormat/Resource/Blocks/ResourceExtRefList.cs. */
export function compiledResourceDependencies(bytes: Buffer): string[] {
  if (bytes.length < 16 || bytes.readUInt32LE(0) > bytes.length || bytes.readUInt16LE(4) !== 12) throw new Error('Invalid compiled model dependency resource');
  const table = 8 + bytes.readUInt32LE(8), count = bytes.readUInt32LE(12);
  if (!count || count > 4096 || table < 16 || table + count * 12 > bytes.length) throw new Error('Invalid compiled resource blocks');
  const result: string[] = [];
  let hasData = false;
  for (let i = 0; i < count; i++) {
    const row = table + i * 12, start = row + 4 + bytes.readUInt32LE(row + 4), length = bytes.readUInt32LE(row + 8);
    if (start + length > bytes.length) throw new Error('Truncated compiled resource block');
    if (['DATA', 'MDAT'].includes(bytes.toString('ascii', row, row + 4))) hasData = true;
    if (bytes.toString('ascii', row, row + 4) !== 'RERL') continue;
    if (length < 8) throw new Error('Truncated dependency list');
    const list = start + bytes.readUInt32LE(start), refs = bytes.readUInt32LE(start + 4), end = start + length;
    if (refs > 10000 || list < start + 8 || list + refs * 16 > end) throw new Error('Invalid dependency list');
    for (let n = 0; n < refs; n++) {
      const field = list + n * 16 + 8, name = field + bytes.readInt32LE(field), nul = bytes.indexOf(0, name);
      if (name < list + refs * 16 || name >= end || nul < name || nul >= end) throw new Error('Invalid dependency path');
      const path = bytes.toString('utf8', name, nul).toLowerCase().replace(/_c$/, '') + '_c';
      if (!safePath(path)) throw new Error('Unsafe model dependency path');
      result.push(path);
    }
  }
  if (!hasData) throw new Error('Compiled resource has no data block');
  return [...new Set(result)].sort();
}

async function inspect(deadlockPath: string, entryPath: string, sourcePath: string) {
  if (!validModelEntryPath(entryPath) || !isAbsolute(sourcePath) || !sourcePath.toLowerCase().endsWith('_dir.vpk')) throw new Error('Select a compiled model bundle with a _dir.vpk filename');
  const basePath = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
  const base = parseVpkEntryIndex(basePath), index = parseVpkEntryIndex(sourcePath);
  if (!base?.some(entry => entry.path === entryPath) || !index?.some(entry => entry.path === entryPath)) throw new Error('The selected bundle must contain the exact catalog model path');
  if (index.length > 512 || index.reduce((sum, entry) => sum + entry.size, 0) > 256 * 1024 * 1024 || index.some(entry => !safePath(entry.path) || !supported.test(entry.path))) throw new Error('Model bundles may contain only supported compiled model and material assets, up to 256 MiB');
  const files = [sourcePath, ...findChunkSiblingNames(basename(sourcePath), await fs.readdir(dirname(sourcePath))).sort().map(name => join(dirname(sourcePath), name))];
  const hashes = await Promise.all(files.map(path => fingerprintFile(path).then(file => file.sha256)));
  const baseHash = (await fingerprintFile(basePath)).sha256;
  const data = new Map<string, Buffer>();
  const dependencies = new Map<string, 'bundle' | 'base'>();
  const bundled = new Set(index.map(entry => entry.path)), stock = new Set(base.map(entry => entry.path));
  for (const entry of index) {
    if (entry.size > 64 * 1024 * 1024) throw new Error('A model bundle asset exceeds 64 MiB');
    const bytes = readVpkEntryBytes(sourcePath, entry.path);
    if (!bytes || bytes.length !== entry.size || vpkCrc32(bytes) !== entry.crc) throw new Error(`Model bundle CRC or size check failed: ${entry.path}`);
    for (const dependency of compiledResourceDependencies(bytes)) {
      if (!bundled.has(dependency) && !stock.has(dependency)) throw new Error(`Model dependency is missing: ${dependency}`);
      dependencies.set(dependency, bundled.has(dependency) ? 'bundle' : 'base');
    }
    data.set(entry.path, bytes);
  }
  const current = await Promise.all(files.map(path => fingerprintFile(path).then(file => file.sha256)));
  if (JSON.stringify(current) !== JSON.stringify(hashes) || (await fingerprintFile(basePath)).sha256 !== baseHash) throw new Error('Model sources changed during review');
  const review: ModelReplacementReview = { entryPath, sourcePath, entries: [...data.keys()].sort(),
    dependencies: [...dependencies].map(([path, source]) => ({ path, source })).sort((a, b) => a.path.localeCompare(b.path)),
    reviewToken: createHash('sha256').update(JSON.stringify({ entryPath, sourcePath, hashes, baseHash })).digest('hex') };
  return { review, data };
}
export async function reviewModelReplacement(deadlockPath: string, entryPath: string, sourcePath: string): Promise<ModelReplacementReview> {
  return (await inspect(deadlockPath, entryPath, sourcePath)).review;
}
export async function buildModelReplacement(deadlockPath: string, request: ModelReplacementRequest) {
  const { review, data } = await inspect(deadlockPath, request.entryPath, request.sourcePath);
  if (request.reviewToken !== review.reviewToken || JSON.stringify(request.entries) !== JSON.stringify(review.entries)) throw new Error('Model replacement review is stale');
  const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-model-replacement-'));
  const vpkPath = join(dir, 'replacement_dir.vpk');
  try { await fs.writeFile(vpkPath, writeNativeVpk(data)); }
  catch (error) { await fs.rm(dir, { recursive: true, force: true }); throw error; }
  return { vpkPath, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}
export async function previewModelReplacement(deadlockPath: string, request: ModelReplacementRequest) {
  const built = await buildModelReplacement(deadlockPath, request);
  const cache = await inspectionCache(deadlockPath, `model-replacement:${request.reviewToken}`);
  const release = retainInspectionCache(cache.dir);
  const path = join(cache.dir, 'model.glb');
  try {
    await runVpkmerge(['model', 'export', '--vpk', built.vpkPath, '--base', cache.pak, '--entry', request.entryPath, '--no-anim', '--out', path]);
    const bytes = await validateGlb(path);
    return { url: `${cache.url}model.glb`, bytes };
  } finally { await built.cleanup(); release(); await pruneInspectionCaches(cache.dir).catch(() => {}); }
}
