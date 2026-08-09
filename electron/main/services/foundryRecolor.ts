/**
 * Foundry recolor builder: the `'recolor'` member of the combined forge.
 *
 * Unlike the sound and texture builders (which bake into a fresh temp
 * directory and hand back a delete-the-temp cleanup), a recolor reuses the
 * Locker's shared per-hero bake cache under the userData `ability-colors`
 * directory. The Locker's own Apply and Export buttons read the exact same
 * file, so the cleanup returned here MUST NOT delete, truncate, or invalidate
 * it: a forge that happens to include a recolor edit must leave the cache
 * intact for the next Apply or Export of the same hero and parameters. That is
 * why `buildRecolorVpk` returns a no-op cleanup instead of the sound/texture
 * builders' filesystem removal.
 */
import { buildHeroEffectVpkForExport } from './heroColors';
import { parseVpkDirectory } from './vpk';
import type { HeroEffectExportRequest, RecolorForgeRequest } from '../../../src/types/foundry';

/**
 * Bake (or reuse the cached bake for) a hero ability-VFX effect and hand the
 * forge the shared cache path. `cleanup` resolves without touching the
 * filesystem: the path is the shared per-hero bake cache, not a build scratch
 * directory (see the module comment).
 */
export async function buildRecolorVpk(
    deadlockPath: string,
    req: RecolorForgeRequest,
): Promise<{ vpkPath: string; cleanup: () => Promise<void> }> {
    const { vpkPath } = await buildHeroEffectVpkForExport(deadlockPath, req);
    return { vpkPath, cleanup: async () => {} };
}

/**
 * Discover the exact normalized VPK entries a recolor bake writes, by running
 * the same `buildHeroEffectVpkForExport` the forge will run and parsing the
 * real output. Both calls hit the same cache key, so staging-time discovery
 * and forge-time build are one bake, not two, and the tray's write set always
 * matches what the merged VPK actually contains.
 */
export async function discoverRecolorEntries(
    deadlockPath: string,
    req: HeroEffectExportRequest,
): Promise<string[]> {
    const { vpkPath } = await buildHeroEffectVpkForExport(deadlockPath, req);
    const entries = parseVpkDirectory(vpkPath);
    if (!entries) throw new Error('Could not read the recolor bake output.');
    return entries;
}
