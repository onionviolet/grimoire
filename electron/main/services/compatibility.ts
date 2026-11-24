import { promises as fs } from 'fs';
import { join } from 'path';
import { getCitadelPath } from './deadlock';
import { parseVpkDirectoryCached, parseVpkEntryIndex } from './vpk';
import { foundryBuildDiff } from './foundryCatalog';
import type { FoundryBuildChange } from './foundryBuildSnapshots';
import { scanModsReadOnly, runExclusiveModMutation } from './mods';
import { assertRecoveryPath } from './recoveryBackup';
import type { CompatibilityReview, CompatibilityModEvidence } from '../../../src/types/recovery';

/** Patch-sensitive replacement classes. Additive paths in these classes are still valid mods. */
export function isPatchSensitivePath(path: string): boolean {
  return /^(?:models|materials|particles|scripts|resource|panorama)\//i.test(path) && /\.(?:vmdl_c|vmat_c|vpcf_c|vdata_c|vxml_c|vjs_c|vts_c|vcss_c|txt)$/i.test(path);
}
export function reviewReplacementPaths(paths: string[] | null, base: Set<string>): Omit<CompatibilityModEvidence, 'id' | 'name' | 'enabled'> {
  if (!paths) return { status: 'unreadable', sensitiveCount: 0, missingCount: 0, missingPaths: [] };
  const sensitive = [...new Set(paths.map(path => path.toLowerCase()).filter(isPatchSensitivePath))];
  const missing = sensitive.filter(path => !base.has(path));
  return { status: missing.length ? 'review' : 'no-missing-paths', sensitiveCount: sensitive.length, missingCount: missing.length, missingPaths: missing.slice(0, 30) };
}
function panoramaResourceFamily(path: string): string | undefined {
  return /^panorama\/(?:layout|scripts|styles)\/(.+)\.(?:vxml_c|vjs_c|vts_c|vcss_c)$/.exec(path)?.[1];
}

export function indexPatchChanges(changes: ReadonlyArray<Pick<FoundryBuildChange, 'path' | 'kind'>>): { changed: Set<string>; panorama: Map<string, string[]> } {
  const changed = new Set<string>();
  const panorama = new Map<string, string[]>();
  for (const change of changes) {
    if (change.kind === 'added') continue;
    const path = change.path.toLowerCase();
    changed.add(path);
    const family = panoramaResourceFamily(path);
    if (family) panorama.set(family, [...(panorama.get(family) ?? []), path]);
  }
  return { changed, panorama };
}

export function reviewPatchChanges(paths: string[] | null, { changed, panorama }: ReturnType<typeof indexPatchChanges>) {
  const overrides = new Set(paths?.map(path => path.toLowerCase()));
  const changedPaths = new Set<string>();
  const relatedPaths = new Set<string>();
  for (const path of overrides) {
    if (changed.has(path) && isPatchSensitivePath(path)) changedPaths.add(path);
    const family = panoramaResourceFamily(path);
    for (const sibling of (family && panorama.get(family)) || []) {
      if (!overrides.has(sibling)) relatedPaths.add(sibling);
    }
  }
  return { changedPaths: [...changedPaths].sort().slice(0, 30), relatedPaths: [...relatedPaths].sort().slice(0, 30) };
}

/** Explicit local review only. Patch changes and absent base paths are evidence, never a crash diagnosis. */
export function reviewModCompatibility(gamePath: string): Promise<CompatibilityReview> {
  return runExclusiveModMutation(async () => {
    const path = join(getCitadelPath(gamePath), 'pak01_dir.vpk');
    await assertRecoveryPath(path);
    const before = await fs.stat(path, { bigint: true });
    const entries = parseVpkEntryIndex(path);
    if (!entries) throw new Error('Base game index is unreadable');
    const base = new Set(entries.map(entry => entry.path.toLowerCase()));
    const mods = await scanModsReadOnly(gamePath);
    const modPaths = await Promise.all(mods.map(async mod => {
      await assertRecoveryPath(mod.path);
      return parseVpkDirectoryCached(mod.path);
    }));
    const patch = await foundryBuildDiff(gamePath);
    const after = await fs.stat(path, { bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs) throw new Error('Base game changed during compatibility review');
    const changes = indexPatchChanges(patch.changes);
    return { reviewedAt: new Date().toISOString(), baseFingerprint: patch.fingerprint, patchBaseline: patch.baseline,
      mods: mods.map((mod, index) => ({ id: mod.id, name: mod.name, enabled: mod.enabled,
        ...reviewReplacementPaths(modPaths[index], base), ...reviewPatchChanges(modPaths[index], changes) })) };
  });
}
