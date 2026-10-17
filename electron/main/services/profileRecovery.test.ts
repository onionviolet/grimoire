import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';

const state = vi.hoisted(() => ({ root: '', active: 'original' as string | null, slotIds: false }));
vi.mock('../utils/paths', () => ({ getUserDataPath: () => join(state.root, 'data') }));
vi.mock('./settings', () => ({ loadSettings: () => ({ activeProfileId: state.active }), saveSettings: (s: { activeProfileId: string | null }) => { state.active = s.activeProfileId; } }));
vi.mock('./metadata', () => ({ getModMetadata: () => ({}), migrateModMetadata: vi.fn(), setModMetadata: vi.fn(), removeModMetadata: vi.fn() }));
vi.mock('./gameSessionMods', () => ({ syncRunningGameModSnapshotFromMods: vi.fn(), assertCanMoveLoadedGameMods: vi.fn() }));
vi.mock('./modSafety', () => ({ moveSafetySnapshot: vi.fn(), assertVpkSafety: vi.fn() }));
vi.mock('./autoexec', () => ({ getAutoexecPath: () => join(state.root, 'game', 'autoexec.cfg') }));
vi.mock('./deadlock', () => ({ getGameinfoPath: () => join(state.root, 'game', 'gameinfo.gi'),
  getModScanRootPaths: () => [join(state.root, 'game', 'addons')], isReservedPriorityVpkArtifact: () => false, getDisabledPath: () => join(state.root, 'game', '.disabled'), metaKeyFor: (path: string) => basename(path) }));
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
import { captureProfileRecoveryUnlocked, listProfileRecoveryPoints, previewProfileRecovery, restoreProfileRecovery, getInterruptedProfileRecovery, recoverInterruptedProfileRecovery } from './profileRecovery';
import { beginRecoveryMutation, createRecoveryJournal, journalRecoveryPaths } from './recoveryJournal';
import { assertVpkSafety } from './modSafety';
import { fingerprintFile } from './fileMatch';
import { startModIsolation, getModIsolationSession, applyModIsolationTrial, recordModIsolationResult, finishModIsolation } from './modIsolation';
const asset = (folder: string, name: string) => join(state.root, 'game', folder, name);
async function capturePoint() {
  await captureProfileRecoveryUnlocked(join(state.root, 'game'), 'Next profile');
  return (await listProfileRecoveryPoints())[0];
}
beforeEach(async () => {
  state.root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'grimoire-recovery-')));
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
    const extras = (await fs.readdir(asset('.disabled', ''))).filter(name => name.includes('pak02'));
    expect(await fs.readFile(asset('.disabled', extras[0]), 'utf8')).toBe('new:c');
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
    expect(preview.issues.map(issue => issue.reason)).toEqual(['ambiguous']);
    expect(preview.recoverCount).toBe(1);
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


describe('retained bytes and interrupted recovery', () => {
  it('restores a deleted VPK and its chunks from retained copies', async () => {
    await fs.writeFile(asset('addons', 'pak01_000.vpk'), 'retained chunk');
    const point = await capturePoint();
    await fs.unlink(asset('addons', 'pak01_dir.vpk'));
    await fs.unlink(asset('addons', 'pak01_000.vpk'));
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.canRestore).toBe(true);
    expect(preview.recoverCount).toBe(1);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await fs.readFile(asset('addons', 'pak01_000.vpk'), 'utf8')).toBe('retained chunk');
  });
  it('restores a deleted directory while retaining its matching orphan chunk', async () => {
    await fs.writeFile(asset('addons', 'pak01_000.vpk'), 'retained chunk');
    const point = await capturePoint();
    await fs.unlink(asset('addons', 'pak01_dir.vpk'));
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(asset('addons', 'pak01_000.vpk'), 'utf8')).toBe('retained chunk');
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
  });
  it('fills a missing chunk while preserving a matching directory', async () => {
    await fs.writeFile(asset('addons', 'pak01_000.vpk'), 'retained chunk');
    const point = await capturePoint();
    await fs.unlink(asset('addons', 'pak01_000.vpk'));
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    expect(preview.canRestore).toBe(true);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(asset('addons', 'pak01_000.vpk'), 'utf8')).toBe('retained chunk');
  });
  it('keeps legacy v1 points readable with their original missing-file gate', async () => {
    const point = await capturePoint();
    const path = join(state.root, 'data', 'profile-recovery', `${point.id}.json`);
    const saved = JSON.parse(await fs.readFile(path, 'utf8'));
    saved.version = 1;
    await fs.writeFile(path, JSON.stringify(saved));
    expect((await listProfileRecoveryPoints())[0].retainedBytes).toBe(false);
    await fs.unlink(asset('addons', 'pak01_dir.vpk'));
    expect((await previewProfileRecovery(join(state.root, 'game'), point.id)).canRestore).toBe(false);
  });
  it('blocks corrupted retained content instead of placing it', async () => {
    const point = await capturePoint();
    const hash = (await fingerprintFile(asset('addons', 'pak01_dir.vpk'))).sha256;
    await fs.writeFile(join(state.root, 'data', 'profile-recovery', 'blobs', hash), 'corrupt');
    await fs.unlink(asset('addons', 'pak01_dir.vpk'));
    expect((await previewProfileRecovery(join(state.root, 'game'), point.id)).canRestore).toBe(false);
  });
  it('rejects symlinked VPKs and roots', async () => {
    await fs.rename(asset('addons', 'pak01_dir.vpk'), join(state.root, 'outside.vpk'));
    await fs.symlink(join(state.root, 'outside.vpk'), asset('addons', 'pak01_dir.vpk'));
    await expect(capturePoint()).rejects.toThrow('symbolic link');
  });
  it('offers persistent explicit rollback after a process interruption', async () => {
    const source = asset('addons', 'pak01_dir.vpk');
    const target = asset('.disabled', 'moved_dir.vpk');
    const hash = (await fingerprintFile(source)).sha256;
    const journal = await createRecoveryJournal(join(state.root, 'game'), state.active);
    await journalRecoveryPaths(journal, [{ path: source, hash }, { path: target, hash }]);
    await beginRecoveryMutation(journal);
    await fs.rename(source, target);
    const preview = await getInterruptedProfileRecovery(join(state.root, 'game'));
    expect(preview?.canRecover).toBe(true);
    await recoverInterruptedProfileRecovery(join(state.root, 'game'), preview!.reviewToken);
    expect(await fs.readFile(source, 'utf8')).toBe('local:a');
    await expect(fs.access(target)).rejects.toThrow();
    expect(await getInterruptedProfileRecovery(join(state.root, 'game'))).toBe(null);
  });
  it('rejects outside edits and stale interruption reviews', async () => {
    const path = asset('addons', 'pak01_dir.vpk');
    const journal = await createRecoveryJournal(join(state.root, 'game'), state.active);
    await journalRecoveryPaths(journal, [{ path }]);
    const preview = await getInterruptedProfileRecovery(join(state.root, 'game'));
    await fs.writeFile(path, 'outside edit');
    expect((await getInterruptedProfileRecovery(join(state.root, 'game')))?.canRecover).toBe(false);
    await expect(recoverInterruptedProfileRecovery(join(state.root, 'game'), preview!.reviewToken)).rejects.toThrow('stale');
    expect(await fs.readFile(path, 'utf8')).toBe('outside edit');
  });
  it('rejects an in-game journal path outside the mod/config allowlist', async () => {
    const journal = await createRecoveryJournal(join(state.root, 'game'), state.active);
    journal.files.push({ path: join(state.root, 'game', 'valuable.txt'), before: null, allowed: [] });
    await fs.writeFile(join(state.root, 'data', 'profile-recovery', 'interrupted.json'), JSON.stringify(journal));
    await expect(getInterruptedProfileRecovery(join(state.root, 'game'))).rejects.toThrow('Invalid recovery journal path');
  });
});

describe('manual assisted isolation', () => {
  it('rolls back the trial and old session if the phase cannot persist', async () => {
    const game = join(state.root, 'game');
    const session = await startModIsolation(game);
    const rename = fs.rename.bind(fs);
    let failed = false;
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (!failed && String(to).endsWith('/isolation.json')) {
        failed = true;
        expect(await fs.readFile(join(state.root, 'data', 'profile-recovery', 'interrupted.json'), 'utf8')).toContain('"isolation"');
        throw new Error('session disk failure');
      }
      return rename(from, to);
    });
    await expect(applyModIsolationTrial(game, session.reviewToken)).rejects.toThrow('session disk failure');
    expect((await getModIsolationSession(game))?.phase).toBe('baseline-ready');
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(state.active).toBe('original');
    expect(await getInterruptedProfileRecovery(game)).toBe(null);
  });
  it('tests a baseline, narrows only from explicit feedback, and restores original files', async () => {
    await fs.writeFile(asset('addons', 'pak02_dir.vpk'), 'second:c');
    const game = join(state.root, 'game');
    let session = await startModIsolation(game);
    expect(session.phase).toBe('baseline-ready');
    session = await applyModIsolationTrial(game, session.reviewToken);
    expect(session.phase).toBe('baseline-testing');
    expect(state.active).toBe(null);
    expect(await fs.readdir(asset('addons', ''))).toEqual([]);
    session = await recordModIsolationResult(game, session.reviewToken, 'works');
    expect(session.phase).toBe('ready');
    expect(session.trialKind).toBe('original');
    expect(session.testIds).toHaveLength(2);
    session = await applyModIsolationTrial(game, session.reviewToken);
    session = await recordModIsolationResult(game, session.reviewToken, 'crashes');
    expect(session.phase).toBe('ready');
    expect(session.testIds).toHaveLength(1);
    session = await applyModIsolationTrial(game, session.reviewToken);
    expect(state.active).toBe(null);
    session = await recordModIsolationResult(game, session.reviewToken, 'crashes');
    expect(session.phase).toBe('complete');
    expect(session.candidates).toHaveLength(1);
    const reviewed = await getModIsolationSession(game);
    await finishModIsolation(game, reviewed!.restoreReviewToken!);
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await fs.readFile(asset('addons', 'pak02_dir.vpk'), 'utf8')).toBe('second:c');
    expect(await fs.readFile(asset('.disabled', 'foundry_dir.vpk'), 'utf8')).toBe('foundry:b');
    expect(await getModIsolationSession(game)).toBe(null);
    expect(state.active).toBe('original');
  });
  it('calls a baseline crash inconclusive and preserves the restore point', async () => {
    const game = join(state.root, 'game');
    let session = await startModIsolation(game);
    session = await applyModIsolationTrial(game, session.reviewToken);
    session = await recordModIsolationResult(game, session.reviewToken, 'crashes');
    expect(session.phase).toBe('inconclusive');
    expect((await listProfileRecoveryPoints()).some(point => point.id === session.recoveryPointId)).toBe(true);
  });
  it('rejects stale feedback and stale finish reviews without dropping the session', async () => {
    const game = join(state.root, 'game');
    let session = await startModIsolation(game);
    session = await applyModIsolationTrial(game, session.reviewToken);
    const reviewed = await getModIsolationSession(game);
    await fs.writeFile(join(state.root, 'game', 'autoexec.cfg'), 'outside edit');
    await expect(recordModIsolationResult(game, session.reviewToken, 'works')).rejects.toThrow('stale');
    await expect(finishModIsolation(game, reviewed!.restoreReviewToken!)).rejects.toThrow('stale');
    expect(await getModIsolationSession(game)).not.toBe(null);
    const refreshed = await getModIsolationSession(game);
    await finishModIsolation(game, refreshed!.restoreReviewToken!);
    expect(await fs.readFile(join(state.root, 'game', 'autoexec.cfg'), 'utf8')).toBe('original autoexec\r\n');
  });
});


describe('performance preset owner state', () => {
  it('restores the performance sidecar with the captured raw gameinfo', async () => {
    const sidecar = join(state.root, 'game', 'grimoire-performance.json');
    await fs.writeFile(sidecar, '{"preset":"original","overrides":{"fps_max":"144"}}');
    const point = await capturePoint();
    await fs.writeFile(sidecar, '{"preset":"later"}');
    await fs.writeFile(join(state.root, 'game', 'gameinfo.gi'), 'later gameinfo');
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(sidecar, 'utf8')).toBe('{"preset":"original","overrides":{"fps_max":"144"}}');
    expect(await fs.readFile(join(state.root, 'game', 'gameinfo.gi'), 'utf8')).toBe('original gameinfo');
  });
  it('rejects a sidecar edit after review', async () => {
    const point = await capturePoint();
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    await fs.writeFile(join(state.root, 'game', 'grimoire-performance.json'), '{}');
    await expect(restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken)).rejects.toThrow('stale');
  });
  it.each([1, 2])('does not touch omitted sidecar state in legacy version %s', async version => {
    const point = await capturePoint();
    const pointFile = join(state.root, 'data', 'profile-recovery', `${point.id}.json`);
    const saved = JSON.parse(await fs.readFile(pointFile, 'utf8'));
    saved.version = version; delete saved.performanceState;
    await fs.writeFile(pointFile, JSON.stringify(saved));
    const sidecar = join(state.root, 'game', 'grimoire-performance.json');
    await fs.writeFile(sidecar, '{"keep":"existing"}');
    const preview = await previewProfileRecovery(join(state.root, 'game'), point.id);
    await restoreProfileRecovery(join(state.root, 'game'), point.id, preview.reviewToken);
    expect(await fs.readFile(sidecar, 'utf8')).toBe('{"keep":"existing"}');
  });
});


describe('conservative recovery cleanup', () => {
  it('preserves an unreadable actual point and its unique blobs during later captures', async () => {
    const first = await capturePoint();
    const hash = (await fingerprintFile(asset('addons', 'pak01_dir.vpk'))).sha256;
    const pointFile = join(state.root, 'data', 'profile-recovery', `${first.id}.json`);
    const blobFile = join(state.root, 'data', 'profile-recovery', 'blobs', hash);
    await fs.writeFile(asset('addons', 'pak01_dir.vpk'), 'new:unique');
    const realRead = fs.readFile.bind(fs);
    const read = vi.spyOn(fs, 'readFile').mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      if (String(args[0]) === pointFile) throw Object.assign(new Error('Temporarily unreadable'), { code: 'EACCES' });
      return realRead(...args);
    });
    for (let index = 0; index < 11; index++) await captureProfileRecoveryUnlocked(join(state.root, 'game'), `Later ${index}`);
    expect((await fs.readdir(join(state.root, 'data', 'profile-recovery'))).filter(name => /^[0-9a-f-]{36}\.json$/.test(name))).toHaveLength(12);
    expect(await fs.readFile(blobFile, 'utf8')).toBe('local:a');
    read.mockRestore();
    expect((await listProfileRecoveryPoints()).some(point => point.id === first.id)).toBe(true);
    await fs.unlink(asset('addons', 'pak01_dir.vpk'));
    const preview = await previewProfileRecovery(join(state.root, 'game'), first.id);
    expect(preview.canRestore).toBe(true);
  });
  it('keeps ownership when a protected isolation input is malformed', async () => {
    const first = await capturePoint();
    const hash = (await fingerprintFile(asset('addons', 'pak01_dir.vpk'))).sha256;
    await fs.writeFile(asset('addons', 'pak01_dir.vpk'), 'new:unique');
    await fs.writeFile(join(state.root, 'data', 'profile-recovery', 'isolation.json'), '{');
    await captureProfileRecoveryUnlocked(join(state.root, 'game'), 'Later');
    expect(await fs.readFile(join(state.root, 'data', 'profile-recovery', 'blobs', hash), 'utf8')).toBe('local:a');
    expect((await listProfileRecoveryPoints()).some(point => point.id === first.id)).toBe(true);
  });
});


describe('external save races', () => {
  it('rejects configuration drift between approved review and the second resolve', async () => {
    const game = join(state.root, 'game');
    const point = await capturePoint();
    const preview = await previewProfileRecovery(game, point.id);
    const realRename = fs.rename.bind(fs);
    let injected = false;
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      await realRename(from, to);
      if (!injected && String(to).endsWith('interrupted.json')) {
        injected = true;
        await fs.writeFile(join(game, 'autoexec.cfg'), 'external save after review');
      }
    });
    await expect(restoreProfileRecovery(game, point.id, preview.reviewToken)).rejects.toThrow('stale');
    expect(await fs.readFile(join(game, 'autoexec.cfg'), 'utf8')).toBe('external save after review');
    expect(await getInterruptedProfileRecovery(game)).toBe(null);
  });
  it('preserves a sidecar saved during the safety dialog without changing game files', async () => {
    const game = join(state.root, 'game');
    const point = await capturePoint();
    const preview = await previewProfileRecovery(game, point.id);
    vi.mocked(assertVpkSafety).mockImplementationOnce(async () => { await fs.writeFile(join(game, 'grimoire-performance.json'), '{"external":"during safety"}'); });
    await expect(restoreProfileRecovery(game, point.id, preview.reviewToken)).rejects.toThrow('changed during safety');
    expect(await fs.readFile(join(game, 'grimoire-performance.json'), 'utf8')).toBe('{"external":"during safety"}');
    expect(await fs.readFile(asset('addons', 'pak01_dir.vpk'), 'utf8')).toBe('local:a');
    expect(await getInterruptedProfileRecovery(game)).toBe(null);
  });
  it('rechecks reviewed configuration after writing the replacement temporary file', async () => {
    const game = join(state.root, 'game');
    const point = await capturePoint();
    await fs.writeFile(join(game, 'autoexec.cfg'), 'reviewed current config');
    const preview = await previewProfileRecovery(game, point.id);
    const realWrite = fs.writeFile.bind(fs);
    let injected = false;
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
      await realWrite(...args);
      if (!injected && String(args[0]).includes('autoexec.cfg.') && String(args[0]).endsWith('.tmp')) {
        injected = true;
        await realWrite(join(game, 'autoexec.cfg'), 'external save during replacement');
      }
    });
    await expect(restoreProfileRecovery(game, point.id, preview.reviewToken)).rejects.toThrow('changed before replacement');
    expect(await fs.readFile(join(game, 'autoexec.cfg'), 'utf8')).toBe('external save during replacement');
    expect((await getInterruptedProfileRecovery(game))?.canRecover).toBe(false);
  });
  it.each(['edit', 'delete'] as const)('rechecks a rollback destination after an external %s during blob copy', async action => {
    const game = join(state.root, 'game');
    const path = asset('addons', 'pak01_dir.vpk');
    const changedHash = (await fingerprintFile(asset('.disabled', 'foundry_dir.vpk'))).sha256;
    const journal = await createRecoveryJournal(game, state.active);
    await journalRecoveryPaths(journal, [{ path, hash: changedHash }]);
    await beginRecoveryMutation(journal);
    await fs.writeFile(path, 'foundry:b');
    const preview = await getInterruptedProfileRecovery(game);
    const realCopy = fs.copyFile.bind(fs);
    let injected = false;
    vi.spyOn(fs, 'copyFile').mockImplementation(async (...args: Parameters<typeof fs.copyFile>) => {
      await realCopy(...args);
      if (!injected && String(args[1]).startsWith(path + '.')) {
        injected = true;
        if (action === 'edit') await fs.writeFile(path, 'external save during rollback copy');
        else await fs.unlink(path);
      }
    });
    await expect(recoverInterruptedProfileRecovery(game, preview!.reviewToken)).rejects.toThrow('changed during rollback');
    if (action === 'edit') {
      expect(await fs.readFile(path, 'utf8')).toBe('external save during rollback copy');
      expect((await getInterruptedProfileRecovery(game))?.canRecover).toBe(false);
    } else await expect(fs.access(path)).rejects.toThrow();
  });
  it('rejects isolation sidecar drift during a trial safety check', async () => {
    const game = join(state.root, 'game');
    let session = await startModIsolation(game);
    session = await applyModIsolationTrial(game, session.reviewToken);
    session = await recordModIsolationResult(game, session.reviewToken, 'works');
    vi.mocked(assertVpkSafety).mockImplementationOnce(async () => { await fs.writeFile(join(game, 'grimoire-performance.json'), '{"external":"trial safety"}'); });
    await expect(applyModIsolationTrial(game, session.reviewToken)).rejects.toThrow('changed during safety');
    expect(await fs.readFile(join(game, 'grimoire-performance.json'), 'utf8')).toBe('{"external":"trial safety"}');
    expect(await fs.readdir(asset('addons', ''))).toEqual([]);
    expect((await getModIsolationSession(game))?.phase).toBe('ready');
    expect(await getInterruptedProfileRecovery(game)).toBe(null);
  });
});
