import { promises as fs } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { join, basename, dirname } from 'path';
import { getCitadelPath } from './deadlock';
import { parseVpkEntryIndex } from './vpk';
import { ensureFullImage, thumbsRoot, foundryBuildFingerprintKey } from './foundryCatalog';
import { retainFoundryFingerprint } from './foundryCacheRetention';
import { runVpkmergeStdout } from './modMerger';
import { exportNativeParticleBundle } from './particleBundle';
import type { AssetInspectionEntry, AssetInspectionKind, AssetInspectionResult } from '../../../src/types/assetInspection';
import type { FxDescriptor } from '../../../src/components/locker/fxDescriptor';

export function assetKind(path: unknown): AssetInspectionKind | null {
    if (typeof path !== 'string' || path.includes('\\') || [...path].some(char => char.charCodeAt(0) < 32)
        || path.split('/').some(part => !part || part === '.' || part === '..')) return null;
    if (path.endsWith('.vtex_c')) return 'texture';
    if (path.endsWith('.vmat_c')) return 'material';
    if (path.endsWith('.vpcf_c')) return 'particle';
    return null;
}
export function listInspectionAssets(deadlockPath: string): AssetInspectionEntry[] {
    const entries = parseVpkEntryIndex(join(getCitadelPath(deadlockPath), 'pak01_dir.vpk'));
    if (!entries) throw new Error('Could not read the base-game asset catalog.');
    return entries.flatMap(entry => {
        const kind = assetKind(entry.path);
        return kind ? [{ path: entry.path, label: entry.path.split('/').pop()!, kind, size: entry.size }] : [];
    }).sort((a, b) => a.path.localeCompare(b.path));
}
export async function inspectionCache(deadlockPath: string, identity: string) {
    const pak = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
    const key = await foundryBuildFingerprintKey(deadlockPath);
    const hash = createHash('sha256').update(`${deadlockPath}\0${identity}`).digest('hex');
    const category = `inspect-${hash}`;
    const dir = join(thumbsRoot(), key, category);
    const url = `grimoire-foundry://t/${key}/${category}/`;
    await fs.mkdir(dir, { recursive: true });
    return { pak, dir, url, key };
}
const activeCaches = new Map<string, number>();
export function retainInspectionCache(dir: string): () => void {
    activeCaches.set(dir, (activeCaches.get(dir) ?? 0) + 1);
    const releaseBuild = retainFoundryFingerprint(basename(dirname(dir)));
    let released = false;
    return () => {
        if (released) return;
        released = true;
        releaseBuild();
        const count = (activeCaches.get(dir) ?? 1) - 1;
        if (count > 0) activeCaches.set(dir, count); else activeCaches.delete(dir);
    };
}
/** Bound these inspection outputs only; other Foundry caches have their own
 * lifetime and cannot be pruned while an inspection export is in progress. */
export async function pruneInspectionCaches(keep: string): Promise<void> {
    const directories: Array<{ path: string; bytes: number; time: number }> = [];
    for (const build of await fs.readdir(thumbsRoot(), { withFileTypes: true }).catch(() => [])) {
        if (!build.isDirectory() || build.isSymbolicLink()) continue;
        const root = join(thumbsRoot(), build.name);
        for (const entry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
            if (!entry.isDirectory() || entry.isSymbolicLink() || !/^inspect-[a-f0-9]{64}$/.test(entry.name)) continue;
            const path = join(root, entry.name);
            let bytes = 0, time = 0;
            for (const file of await fs.readdir(path, { withFileTypes: true }).catch(() => [])) {
                if (!file.isFile() || file.isSymbolicLink()) continue;
                const stat = await fs.stat(join(path, file.name)); bytes += stat.size; time = Math.max(time, stat.mtimeMs);
            }
            directories.push({ path, bytes, time });
        }
    }
    let total = directories.reduce((sum, dir) => sum + dir.bytes, 0);
    for (const dir of directories.sort((a, b) => a.time - b.time)) {
        if (total <= 256 * 1024 * 1024) break;
        if (dir.path === keep || activeCaches.has(dir.path)) continue;
        await fs.rm(dir.path, { recursive: true, force: true }); total -= dir.bytes;
    }
}
const pending = new Map<string, Promise<AssetInspectionResult>>();
/** Read-only base-pak inspection. Only authored exact paths reach the engine. */
export async function inspectAsset(deadlockPath: string, path: string): Promise<AssetInspectionResult> {
    if (!assetKind(path)) throw new Error('Select an exact texture, material or particle path from the catalog.');
    const entry = listInspectionAssets(deadlockPath).find(entry => entry.path === path);
    if (!entry) throw new Error('This asset is no longer in the base-game catalog. Refresh the catalog.');
    const cache = await inspectionCache(deadlockPath, path);
    const pendingKey = `${cache.dir}/${path}`;
    const current = pending.get(pendingKey);
    if (current) return current;
    const release = retainInspectionCache(cache.dir);
    const inspect = async (): Promise<AssetInspectionResult> => {
        if (entry.kind === 'texture') return { entry, imageUrl: await ensureFullImage(deadlockPath, 'other', path) };
        if (entry.kind === 'material') return { entry, details: (await runVpkmergeStdout(['vmat', '--vpk', cache.pak, '--entry', path, '--list'])).slice(0, 128_000) };
        // The read-only soundevents command exposes the generic KV3 decoder.
        // Adapt only authored particle nodes; unsupported decodes stay explicit.
        const descriptorPath = join(cache.dir, 'effect.json');
        try {
            const temporary = join(cache.dir, `${randomUUID()}.json`);
            try {
                await exportNativeParticleBundle(cache.pak, path, temporary, cache.dir);
                const stat = await fs.stat(temporary);
                if (stat.size > 4 * 1024 * 1024) throw new Error('Particle descriptor exceeds the inspection limit.');
                const descriptor = JSON.parse(await fs.readFile(temporary, 'utf8')) as FxDescriptor;
                if (!Array.isArray(descriptor.renderers) || !Array.isArray(descriptor.children)) throw new Error('Invalid particle descriptor.');
                if (cache.key !== await foundryBuildFingerprintKey(deadlockPath)) throw new Error('The game files changed during inspection. Refresh the catalog.');
                await fs.rename(temporary, descriptorPath);
                return { entry, descriptor, textureBaseUrl: cache.url };
            } finally { await fs.rm(temporary, { force: true }); }
        } catch (error) { return { entry, unavailable: error instanceof Error ? error.message : String(error) }; }
    };
    const work = (async () => {
        const result = await inspect();
        if (cache.key !== await foundryBuildFingerprintKey(deadlockPath)) throw new Error('The game files changed during inspection. Refresh the catalog.');
        return result;
    })();
    pending.set(pendingKey, work);
    try { return await work; } finally { pending.delete(pendingKey); release(); await pruneInspectionCaches(cache.dir).catch(() => {}); }
}
