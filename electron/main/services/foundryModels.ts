import { promises as fs } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { join } from 'path';
import { getCitadelPath } from './deadlock';
import { thumbsRoot } from './foundryCatalog';
import { parseVpkEntryIndex } from './vpk';
import { runVpkmerge } from './modMerger';
import type { FoundryModelEntry, FoundryModelPreview } from '../../../src/types/foundryModels';

const CACHE_LIMIT = 256 * 1024 * 1024;
const exportsInFlight = new Map<string, Promise<{ path: string; preview: FoundryModelPreview }>>();

/** Same size/time key as the texture cache, without warming unrelated catalogs. */
async function modelFingerprint(deadlockPath: string): Promise<string> {
    const stat = await fs.stat(join(getCitadelPath(deadlockPath), 'pak01_dir.vpk'), { bigint: true });
    return `${stat.size}-${stat.mtimeNs / 1_000_000_000n}-${stat.mtimeNs % 1_000_000_000n}`;
}

export function validModelEntryPath(path: unknown): path is string {
    return typeof path === 'string' && path.startsWith('models/') && path.endsWith('.vmdl_c')
        && !path.includes('\\') && ![...path].some(char => char.charCodeAt(0) < 32)
        && path.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

/** Index only: no model/texture decode and no writes to the game. */
export function listFoundryModels(deadlockPath: string): FoundryModelEntry[] {
    const entries = parseVpkEntryIndex(join(getCitadelPath(deadlockPath), 'pak01_dir.vpk'));
    if (!entries) throw new Error('Could not read the base-game model catalog.');
    return entries.filter((entry) => validModelEntryPath(entry.path)).map((entry) => ({
        path: entry.path,
        label: entry.path.split('/').pop()!.replace(/\.vmdl_c$/, ''),
        size: entry.size,
    })).sort((a, b) => a.path.localeCompare(b.path));
}

async function validateGlb(path: string): Promise<number> {
    const stat = await fs.stat(path);
    if (stat.size < 20 || stat.size > CACHE_LIMIT) throw new Error('The model preview is empty or exceeds the preview size limit.');
    const file = await fs.open(path, 'r');
    try {
        const header = Buffer.alloc(12);
        await file.read(header, 0, header.length, 0);
        if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2
            || header.readUInt32LE(8) !== stat.size) throw new Error('The model exporter did not produce a valid GLB.');
    } finally {
        await file.close();
    }
    return stat.size;
}

/** Limit model caches across game builds; never prune texture or source caches. */
async function pruneModelCaches(keep: string): Promise<void> {
    const files: Array<{ path: string; size: number; time: number }> = [];
    for (const build of await fs.readdir(thumbsRoot(), { withFileTypes: true })) {
        if (!build.isDirectory() || build.isSymbolicLink()) continue;
        const dir = join(thumbsRoot(), build.name, 'model-assets');
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (!entry.isFile() || !/^[a-f0-9]{64}\.glb$/.test(entry.name)) continue;
            const path = join(dir, entry.name);
            const stat = await fs.stat(path);
            files.push({ path, size: stat.size, time: stat.mtimeMs });
        }
    }
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((a, b) => a.time - b.time)) {
        if (total <= CACHE_LIMIT) break;
        if (file.path === keep) continue;
        await fs.unlink(file.path).catch(() => {});
        total -= file.size;
    }
}

export async function prepareFoundryModel(deadlockPath: string, entryPath: string): Promise<{ path: string; preview: FoundryModelPreview }> {
    if (!validModelEntryPath(entryPath)) throw new Error('Select an exact model path from the catalog.');
    if (!listFoundryModels(deadlockPath).some((entry) => entry.path === entryPath)) {
        throw new Error('This model is no longer present in the base-game catalog. Refresh the catalog.');
    }
    const key = await modelFingerprint(deadlockPath);
    const hash = createHash('sha256').update(`static-v1\0${deadlockPath}\0${entryPath}`).digest('hex');
    const dir = join(thumbsRoot(), key, 'model-assets');
    const path = join(dir, `${hash}.glb`);
    const existing = exportsInFlight.get(path);
    if (existing) return existing;
    const work = (async () => {
        await fs.mkdir(dir, { recursive: true });
        let bytes: number;
        try {
            bytes = await validateGlb(path);
            const now = new Date();
            await fs.utimes(path, now, now);
        } catch {
            const temporary = join(dir, `${hash}.${randomUUID()}.tmp.glb`);
            try {
                const pak = join(getCitadelPath(deadlockPath), 'pak01_dir.vpk');
                // Static export keeps this browse separate from Locker animation
                // selection and bounds the output for non-hero world models.
                await runVpkmerge(['model', 'export', '--vpk', pak, '--entry', entryPath, '--no-anim', '--out', temporary]);
                bytes = await validateGlb(temporary);
                if (key !== await modelFingerprint(deadlockPath)) {
                    throw new Error('The game files changed during model export. Refresh and try again.');
                }
                await fs.rename(temporary, path);
            } finally {
                await fs.unlink(temporary).catch(() => {});
            }
        }
        await pruneModelCaches(path);
        return { path, preview: { url: `grimoire-foundry://t/${key}/model-assets/${hash}.glb`, bytes } };
    })();
    exportsInFlight.set(path, work);
    try { return await work; } finally { exportsInFlight.delete(path); }
}
