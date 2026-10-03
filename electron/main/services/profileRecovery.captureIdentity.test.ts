import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import type { Mod } from './mods';
import { safetyVpk } from './modSafetyFixtures';
const h = vi.hoisted(() => ({ userData: '', mods: [] as Mod[] }));
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }));
vi.mock('./mods', () => ({ scanMods: async () => h.mods, runExclusiveModMutation: async (fn: () => Promise<unknown>) => fn(),
  enableModUnlocked: vi.fn(), disableModUnlocked: vi.fn(), reorderModsUnlocked: vi.fn() }));
vi.mock('./lockerVpk', () => ({ isLockerManaged: () => false }));
vi.mock('./gameSessionMods', () => ({ assertCanMoveLoadedGameMods: vi.fn(), syncRunningGameModSnapshotFromMods: vi.fn() }));
vi.mock('./modSafety', () => ({ assertVpkSafety: vi.fn() }));
vi.mock('./profileRecovery', () => ({ captureProfileRecoveryUnlocked: vi.fn() }));
vi.mock('./autoexec', () => ({ readAutoexec: () => ({ commands: [] }), writeAutoexec: vi.fn() }));
import { createProfile, previewProfile, updateProfile } from './profiles';
import { getModMetadata, migrateModMetadata } from './metadata';
import { resolveVpkIdentity } from './vpkIdentity';
function installed(name: string, bytes: Buffer): Mod {
  const path = join(h.userData, 'mods', name);
  writeFileSync(path, bytes);
  return { id: name, fileName: name, metaKey: name, name, path, enabled: true, priority: 2, size: bytes.length, installedAt: '2026-10-03' };
}
beforeEach(() => { h.userData = mkdtempSync(join(tmpdir(), 'grimoire-profile-hash-')); mkdirSync(join(h.userData, 'mods')); h.mods = []; });
afterEach(() => rmSync(h.userData, { recursive: true, force: true }));
describe('local profile capture content identity', () => {
  it('captures a real local VPK hash and resolves its renamed bytes without name fallback', async () => {
    const bytes = safetyVpk([{ path: 'materials/local.txt', bytes: Buffer.from('local skin') }]);
    const mod = installed('pak02_dir.vpk', bytes);
    h.mods = [mod];
    expect(getModMetadata(mod.metaKey)).toBeUndefined();
    const saved = await createProfile('/game', 'Local');
    expect(saved.mods[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const renamed = join(h.userData, 'mods', 'mod_16cf_dir.vpk');
    renameSync(mod.path, renamed);
    migrateModMetadata([{ from: mod.metaKey, to: 'mod_16cf_dir.vpk' }]);
    h.mods = [{ ...mod, id: 'renamed-local', metaKey: 'mod_16cf_dir.vpk', fileName: 'mod_16cf_dir.vpk', path: renamed, enabled: false }];
    const preview = await previewProfile('/game', saved.id);
    expect(preview.issues).toEqual([]);
    expect(preview.entries[0].modId).toBe('renamed-local');
    expect(preview.enableCount).toBe(1);
  });
  it('captures canonical original identity for an imprinted Foundry VPK when updating a profile', async () => {
    const originalHash = 'a'.repeat(64);
    const bytes = safetyVpk([{ path: 'addoninfo.txt', bytes: Buffer.from(`"AddonInfo"\n{\n"originalSha256" "${originalHash}"\n"modinfoVersion" "1"\n}\n`) }]);
    const mod = installed('pak01_dir.vpk', bytes);
    const identity = await resolveVpkIdentity(mod.path);
    expect(identity.source).toBe('embed');
    expect(identity.sha256).toBe(originalHash);
    const saved = await createProfile('/game', 'Empty');
    h.mods = [mod];
    const updated = await updateProfile('/game', saved.id);
    expect(updated.mods[0].sha256).toBe(originalHash);
    expect(getModMetadata(mod.metaKey)?.sha256).toBe(originalHash);
  });
});
