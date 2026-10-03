import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { getCitadelPath } from './deadlock';
import { parseVpkDirectory } from './vpk';
import { scanMods, runExclusiveModMutation } from './mods';
import { assertRecoveryPath } from './recoveryBackup';
import type { CompatibilityReview, CompatibilityModEvidence } from '../../../src/types/recovery';

/** Patch-sensitive replacement classes. Additive paths in these classes are still valid mods. */
export function isPatchSensitivePath(path: string): boolean {
  return /^(?:models|materials|particles|scripts|resource|panorama)\//i.test(path) && /\.(?:vmdl_c|vmat_c|vpcf_c|vdata_c|vxml_c|vjs_c|vcss_c|txt)$/i.test(path);
}
export function reviewReplacementPaths(paths: string[] | null, base: Set<string>): Omit<CompatibilityModEvidence, 'id' | 'name' | 'enabled'> {
  if (!paths) return { status: 'unreadable', sensitiveCount: 0, missingCount: 0, missingPaths: [] };
  const sensitive = [...new Set(paths.map(path => path.toLowerCase()).filter(isPatchSensitivePath))];
  const missing = sensitive.filter(path => !base.has(path));
  return { status: missing.length ? 'review' : 'no-missing-paths', sensitiveCount: sensitive.length, missingCount: missing.length, missingPaths: missing.slice(0, 30) };
}
/** Explicit local review only. An absent base path is evidence to review, never a crash diagnosis. */
export function reviewModCompatibility(gamePath: string): Promise<CompatibilityReview> {
  return runExclusiveModMutation(async () => {
    const path = join(getCitadelPath(gamePath), 'pak01_dir.vpk');
    await assertRecoveryPath(path);
    const before = await fs.stat(path, { bigint: true });
    const paths = parseVpkDirectory(path);
    if (!paths) throw new Error('Base game index is unreadable');
    const base = new Set(paths.map(path => path.toLowerCase()));
    const result: CompatibilityReview['mods'] = [];
    for (const mod of await scanMods(gamePath)) {
      await assertRecoveryPath(mod.path);
      result.push({ id: mod.id, name: mod.name, enabled: mod.enabled, ...reviewReplacementPaths(parseVpkDirectory(mod.path), base) });
    }
    const after = await fs.stat(path, { bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs) throw new Error('Base game changed during compatibility review');
    return { reviewedAt: new Date().toISOString(), baseFingerprint: createHash('sha256').update(`${before.size}:${before.mtimeNs}`).digest('hex'), mods: result };
  });
}
