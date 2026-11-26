import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import type { ModPackageFinding, ModPackageReview } from '../../../src/types/peerTools';
import { getCitadelPath } from './deadlock';
import { detectArchiveFormat, extractArchive, type RejectedVpk } from './extract';
import { compiledResourceDependencies } from './modelReplacement';
import { scanModsReadOnly } from './mods';
import { vpkCrc32 } from './nativeVpk';
import { isUnpackableArchiveFormat, parseVpkEntryIndex, readVpkEntryBytes, validateImportVpk, type VpkEntryIndex } from './vpk';

const ZIP_LIMIT = 512 * 1024 * 1024;
const RESOURCE_LIMIT = 64 * 1024 * 1024;
const MAX_FINDINGS = 200;
const SUPPORTS_REFS = /\.(?:vmdl|vmesh|vmat|vagrp|vanim|vskeleton|vphys)_c$/;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const keyFor = (path: string) => path.toLowerCase();

interface PackageIndex {
  name: string;
  path: string;
  entries: Map<string, VpkEntryIndex>;
}

/** The archive uses the import extractor and VPK structure gate. A dependency
 * in another archive member is reported separately because users may install
 * only one member. Installed conflicts are checked independently of that choice. */
export async function reviewModPackage(gamePath: string, path: string): Promise<ModPackageReview> {
  const basePath = join(getCitadelPath(gamePath), 'pak01_dir.vpk');
  const stamp = (file: string) => fs.stat(file, { bigint: true })
    .then(stat => `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`);
  const baseStamp = await stamp(basePath);
  const base = parseVpkEntryIndex(basePath);
  if (!base?.length) throw new Error('Could not read the installed game VPK');
  const baseFingerprint = createHash('sha256');
  const stock = new Set<string>();
  for (const { path: entryPath, crc, size } of base) {
    stock.add(keyFor(entryPath));
    baseFingerprint.update(JSON.stringify([entryPath, crc, size]));
  }
  const review: ModPackageReview = { archive: basename(path), baseFingerprint: baseFingerprint.digest('hex'), packages: [], modelsChecked: 0, findings: [] };
  const note = (finding: ModPackageFinding) => {
    if (review.findings.length < MAX_FINDINGS) review.findings.push(finding);
    else if (review.findings.length === MAX_FINDINGS) review.findings.push({ kind: 'incomplete' });
  };
  const dir = await fs.mkdtemp(join(tmpdir(), 'grimoire-package-review-'));
  try {
    const rejected: RejectedVpk[] = [];
    const archives: PackageIndex[] = [];
    try {
      const stat = await fs.stat(path);
      if (!stat.isFile() || stat.size > ZIP_LIMIT || detectArchiveFormat(path) !== 'zip') {
        throw new Error('Select a ZIP file up to 512 MiB');
      }
      const sourceStamp = await stamp(path);
      const extracted = await extractArchive(path, dir, { format: 'zip', depth: 1, maxZipVpkBytes: ZIP_LIMIT, rejected });
      if (sourceStamp !== await stamp(path)) throw new Error('The ZIP changed during review');
      for (const source of extracted) {
        const name = source.archivePath ?? source.fileName;
        try {
          validateImportVpk(source.path);
          const index = parseVpkEntryIndex(source.path);
          if (!index?.length) throw new Error('Could not index VPK entries');
          archives.push({ name, path: source.path, entries: new Map(index.map(entry => [keyFor(entry.path), entry])) });
          review.packages.push(name);
        } catch (error) {
          note({ kind: 'invalidVpk', file: name, detail: message(error) });
        }
      }
    } catch (error) {
      note({ kind: 'archive', detail: message(error) });
      return review;
    }
    for (const entry of rejected) {
      note({ kind: isUnpackableArchiveFormat(entry.format) ? 'unsupportedWrapper' : 'invalidVpk', file: entry.fileName, detail: entry.reason });
    }
    if (!archives.length) {
      note({ kind: 'noVpk' });
      return review;
    }
    const included = new Set(archives.flatMap(archive => [...archive.entries.keys()]));
    let remainingBytes = ZIP_LIMIT;
    for (const archive of archives) {
      const pending = [...archive.entries.keys()].filter(entry => entry.endsWith('.vmdl_c'));
      const seen = new Set(pending);
      for (const key of pending) {
        const entry = archive.entries.get(key)!;
        try {
          if (entry.size > RESOURCE_LIMIT || entry.size > remainingBytes) throw new Error('The model dependency scan reached its size limit');
          remainingBytes -= entry.size;
          const bytes = readVpkEntryBytes(archive.path, entry.path);
          if (!bytes || bytes.length !== entry.size || vpkCrc32(bytes) !== entry.crc) throw new Error('VPK entry size or CRC did not match');
          const dependencies = compiledResourceDependencies(bytes);
          if (key.endsWith('.vmdl_c')) review.modelsChecked++;
          for (const dependency of dependencies) {
            if (archive.entries.has(dependency)) {
              if (SUPPORTS_REFS.test(dependency) && !seen.has(dependency)) {
                seen.add(dependency);
                pending.push(dependency);
              }
            } else if (!stock.has(dependency)) {
              note({ kind: included.has(dependency) ? 'siblingDependency' : 'missingDependency', file: archive.name, entry: key, detail: dependency });
            }
          }
        } catch (error) {
          note({ kind: 'unreadable', file: archive.name, entry: key, detail: message(error) });
        }
      }
    }
    const firstEnabled = new Map<string, { name: string; crc: number }>();
    for (const mod of await scanModsReadOnly(gamePath)) {
      if (!mod.enabled) continue;
      const index = parseVpkEntryIndex(mod.path);
      if (!index) note({ kind: 'unreadable', file: mod.name });
      for (const entry of index ?? []) {
        const key = keyFor(entry.path);
        if (included.has(key) && !firstEnabled.has(key)) firstEnabled.set(key, { name: mod.name, crc: entry.crc });
      }
    }
    for (const archive of archives) {
      for (const [key, entry] of archive.entries) {
        const installed = firstEnabled.get(key);
        if (installed && installed.crc !== entry.crc) {
          note({ kind: 'overlap', file: archive.name, entry: key, detail: installed.name });
        }
      }
    }
    if (baseStamp !== await stamp(basePath)) throw new Error('The installed game changed during review');
    return review;
  } finally {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}
