import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';

const state = vi.hoisted(() => ({ root: '', active: 'original' as string | null, slotIds: false }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => join(state.root, 'data') }));
vi.mock('./settings', () => ({ loadSettings: () => ({ activeProfileId: state.active }), saveSettings: (s: { activeProfileId: string | null }) => { state.active = s.activeProfileId; } }));
vi.mock('./metadata', () => ({ getModMetadata: () => ({}), migrateModMetadata: vi.fn(), setModMetadata: vi.fn() }));
vi.mock('./gameSessionMods', () => ({ syncRunningGameModSnapshotFromMods: vi.fn(), assertCanMoveLoadedGameMods: vi.fn() }));
vi.mock('./modSafety', () => ({ moveSafetySnapshot: vi.fn(), assertVpkSafety: vi.fn() }));
vi.mock('./autoexec', () => ({ getAutoexecPath: () => join(state.root, 'game', 'autoexec.cfg') }));
vi.mock('./deadlock', () => ({ getGameinfoPath: () => join(state.root, 'game', 'gameinfo.gi'),
  getModScanRootPaths: () => [join(state.root, 'game', 'addons')], getDisabledPath: () => join(state.root, 'game', '.disabled'), metaKeyFor: (path: string) => basename(path) }));
vi.mock('./vpk', () => ({ findChunkSiblingNames: (name: string, names: string[]) => {
  const stem = name.replace(/_dir\.vpk$/, '');
  return names.filter(n => n.startsWith(stem + '_') && /_\d{3}\.vpk$/.test(n));
} }));
vi.mock('./mods', () => ({
  runExclusiveModMutation: (fn: () => Promise<unknown>) => fn(),
  scanMods: async () => {
    const result = [];
    for (const folder of ['addons', '.disabled']) {
      const root = join(state.root, 'game', folder);
      for (const name of await fs.readdir(root)) {
        if (!name.endsWith('_dir.vpk')) continue;
        const path = join(root, name);
        const content = await fs.readFile(path, 'utf8');
        result.push({ id: state.slotIds ? `${folder}/${name}` : content.split(':')[0], name: content.split(':')[0], fileName: name, metaKey: name, path,
          enabled: folder === 'addons', priority: Number(name.match(/pak(\d+)/)?.[1] ?? 0) });
      }
    }
    return result;
  },
  disableModUnlocked: async (_path: string, id: string) => {
    const root = join(state.root, 'game', 'addons');
    for (const name of await fs.readdir(root)) {
      if (!name.endsWith('_dir.vpk')) continue;
      if ((await fs.readFile(join(root, name), 'utf8')).split(':')[0] === id) {
        await fs.rename(join(root, name), join(state.root, 'game', '.disabled', `${id}_dir.vpk`));
      }
    }
  },
}));
import { captureProfileRecoveryUnlocked, listProfileRecoveryPoints, previewProfileRecovery, restoreProfileRecovery } from './profileRecovery';
const asset = (folder: string, name: string) => join(state.root, 'game', folder, name);
async function capturePoint() {
  await captureProfileRecoveryUnlocked(join(state.root, 'game'), 'Next profile');
  return (await listProfileRecoveryPoints())[0];
}
beforeEach(async () => {
  state.root = await fs.mkdtemp(join(tmpdir(), 'grimoire-recovery-'));
  state.active = 'original';
  state.slotIds = false;
  for (const folder of ['addons', '.disabled']) await fs.mkdir(asset(folder, ''), { recursive: true });
  await fs.writeFile(asset('addons', 'pak01_dir.vpk'), 'local:a');
  await fs.writeFile(asset('.disabled', 'foundry_dir.vpk'), 'foundry:b');
  await fs.writeFile(join(state.root, 'game', 'autoexec.cfg'), 'original autoexec\r\n');
  await fs.writeFile(join(state.root, 'game', 'gameinfo.gi'), 'original gameinfo');
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(state.root, { recursive: true, force: true }); });

describe('local profile recovery', () => {
  it('restores local and Foundry state, swapped slots, exact configuration and active marker', async () => {
    const point = await capturePoint();
    await fs.rename(asset('addons', 'pak01_dir.vpk'), asset('.disabled', 'local_dir.vpk'));
    await fs.rename(asset('.disabled', 'foundry_dir.vpk'), asset('addons', 'pak01_dir.vpk'));
    await fs.writeFile(asset('addons', 'pak02_dir.vpk'), 'new:c');
    await fs.writeFile(join(state.root, 'game', 'autoexec.cfg'), 'new autoexec');
    state.active = 'next';
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.canRestore).toBe(true);
    expect(preview.disableCount).toBe(1);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await fs.readFile(asset('.disabled', 'foundry_dir.vpk'), 'utf8')).toBe('foundry:b');
    expect(await fs.readFile(asset('.disabled', 'new_dir.vpk'), 'utf8')).toBe('new:c');
    expect(await fs.readFile(join(state.root, 'game', 'autoexec.cfg'), 'utf8')).toBe('original autoexec\r\n');
    expect(state.active).toBe('original');
  });
  it('refuses changed directory bytes and chunks, without substituting a filename', async () => {
    await fs.writeFile(asset('addons', 'pak01_000.vpk'), 'chunk original');
    const point = await capturePoint();
    await fs.writeFile(asset('addons', 'pak01_000.vpk'), 'chunk changed');
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.issues).toEqual([{ name: 'local', reason: 'changed' }]);
    await expect(restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken)).rejects.toThrow('cannot be restored');
    expect(await fs.readFile(asset('addons', 'pak01_000.vpk'), 'utf8')).toBe('chunk changed');
  });
  it('refuses missing assets and duplicate identities', async () => {
    const point = await capturePoint();
    await fs.unlink(asset('.disabled', 'foundry_dir.vpk'));
    await fs.writeFile(asset('.disabled', 'copy_dir.vpk'), 'local:a');
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.canRestore).toBe(false);
    expect(preview.issues.map(issue => issue.reason)).toEqual(['ambiguous', 'missing']);
  });
  it('rejects stale preview tokens if configuration changes after review', async () => {
    const point = await capturePoint();
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    await fs.writeFile(join(state.root, 'game', 'autoexec.cfg'), 'user edit');
    await expect(restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken)).rejects.toThrow('stale');
    expect(await fs.readFile(join(state.root, 'game', 'autoexec.cfg'), 'utf8')).toBe('user edit');
  });
  it('rolls back file layout and configuration when a config write fails', async () => {
    const point = await capturePoint();
    await fs.rename(asset('addons', 'pak01_dir.vpk'), asset('.disabled', 'local_dir.vpk'));
    await fs.rename(asset('.disabled', 'foundry_dir.vpk'), asset('addons', 'pak01_dir.vpk'));
    await fs.writeFile(join(state.root, 'game', 'autoexec.cfg'), 'state before restore');
    state.active = 'next';
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    const realRename = fs.rename.bind(fs);
    let failed = false;
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (!failed && String(to).endsWith('gameinfo.gi')) { failed = true; throw new Error('disk full'); }
      return realRename(from, to);
    });
    await expect(restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken)).rejects.toThrow('previous state was restored');
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('foundry:b');
    expect(await fs.readFile(asset('.disabled', 'local_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await fs.readFile(join(state.root, 'game', 'autoexec.cfg'), 'utf8')).toBe('state before restore');
    expect(state.active).toBe('next');
  });
  it('matches original bytes when reordered pak slots have reused IDs', async () => {
    state.slotIds = true;
    const point = await capturePoint();
    await fs.rename(asset('addons', 'pak01_dir.vpk'), asset('.disabled', 'local_dir.vpk'));
    await fs.rename(asset('.disabled', 'foundry_dir.vpk'), asset('addons', 'pak01_dir.vpk'));
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.canRestore).toBe(true);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await fs.readFile(asset('.disabled', 'foundry_dir.vpk'), 'utf8')).toBe('foundry:b');
  });
  it.each([
    (point: Record<string, unknown>) => { point.autoexec = 42; },
    (point: Record<string, unknown>) => { point.gameinfo = 'not valid base64'; },
    (point: Record<string, unknown>) => { point.createdAt = 'not a date'; },
    (point: Record<string, unknown>) => { point.profileName = null; },
    (point: Record<string, unknown>) => { point.mods = [{ ...(point.mods as object[])[0], enabled: 'true' }]; point.modCount = 1; point.enabledCount = 0; },
    (point: Record<string, unknown>) => { (point.mods as Array<Record<string, unknown>>)[0].priorityMod = 1; },
    (point: Record<string, unknown>) => { (point.mods as Array<Record<string, unknown>>)[0].path = asset('addons', 'secret.txt'); },
    (point: Record<string, unknown>) => { const mods = point.mods as Array<Record<string, unknown>>; mods[1].path = mods[0].path; },
  ])('filters malformed recovery points before offering or restoring them', async mutate => {
    const point = await capturePoint();
    const path = join(state.root, 'data', 'profile-recovery', `${point.id}.json`);
    const saved = JSON.parse(await fs.readFile(path, 'utf8')) as Record<string, unknown>;
    mutate(saved);
    await fs.writeFile(path, JSON.stringify(saved));
    expect(await listProfileRecoveryPoints()).toEqual([]);
    await expect(previewProfileRecovery(join(state.root, 'game'), point.id)).rejects.toThrow('Invalid recovery');
  });
  it('retains a bounded ten-point history', async () => {
    for (let i = 0; i < 12; i++) await capturePoint();
    expect(await listProfileRecoveryPoints()).toHaveLength(10);
  });
});
