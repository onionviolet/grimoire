import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ selection: vi.fn(), clip: vi.fn(), sources: vi.fn(), classified: vi.fn(), identity: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('./modSafety', () => ({ assertVpkSafety: vi.fn() }));
vi.mock('./deadlock', () => ({ getCitadelPath: vi.fn(), getGrimoirePath: vi.fn() }));
vi.mock('./modLibrary', () => ({ listInstalledUserVpks: h.sources }));
vi.mock('./vpk', () => ({ invalidateVpkParseCache: vi.fn() }));
vi.mock('./modMerger', () => ({ runVpkmerge: vi.fn(), runVpkmergeStdout: vi.fn(), vpkmergeBinaryPath: vi.fn(), verifyVpkOutput: vi.fn() }));
vi.mock('./lockerVpk', () => ({ LOCKER_SOUNDS_KEY: 'locker:sounds', lockerSoundsVpkPath: () => '/game/grimoire/pak02_dir.vpk', ensureGrimoireConfigured: vi.fn(), migrateManagedVpksToGrimoire: vi.fn() }));
vi.mock('./metadata', () => ({ getModMetadata: h.selection, setModMetadata: vi.fn(), removeModMetadata: vi.fn() }));
vi.mock('./vpkIdentity', () => ({ resolveVpkIdentity: h.identity }));
vi.mock('./abilitySounds', () => ({ abilitySoundClipsForSlot: h.classified, eventsForClips: vi.fn() }));
vi.mock('./foundryCatalog', () => ({ ensureModClip: h.clip }));
const { previewAppliedHeroSound } = await import('./heroSounds');
const selected = () => h.selection.mockReturnValue({ lockerSounds: { sounds: [{ heroCodename: 'astro', heroName: 'Holliday', slot: 4, source: { fileName: 'pak01_dir.vpk', sha256AtApplyTime: 'deadbeef' }, params: { pitch: 1.2, volumeDb: -3 } }] } });
describe('applied ability sound audition', () => {
  it('reads the managed artifact bytes for the applied slot', async () => {
    selected(); h.clip.mockResolvedValue('data:audio/mpeg;base64,applied');
    expect(await previewAppliedHeroSound('game', 'Holliday', 4, 'sounds/lasso.vsnd_c')).toEqual({ url: 'data:audio/mpeg;base64,applied', selected: true, params: { pitch: 1.2, volumeDb: -3 } });
    expect(h.clip).toHaveBeenCalledWith('/game/grimoire/pak02_dir.vpk', 'sounds/lasso.vsnd_c');
  });
  it('keeps an unavailable applied clip explicit instead of silently claiming base audio', async () => {
    selected(); h.clip.mockResolvedValue(null); h.sources.mockResolvedValue([]);
    expect(await previewAppliedHeroSound('game', 'Holliday', 4, 'sounds/lasso.vsnd_c')).toMatchObject({ url: null, selected: true });
  });
  it('never auditions source media from a reused slot when the applied artifact is missing', async () => {
    selected(); h.clip.mockResolvedValue(null);
    h.sources.mockResolvedValue([{ metaKey: 'pak01_dir.vpk', path: '/game/addons/pak01_dir.vpk', fileName: 'pak01_dir.vpk', enabled: true }]);
    h.identity.mockResolvedValue({ sha256: 'different-owner' });
    expect(await previewAppliedHeroSound('game', 'Holliday', 4, 'sounds/lasso.vsnd_c')).toMatchObject({ url: null, selected: true });
    expect(h.clip).toHaveBeenLastCalledWith('/game/grimoire/pak02_dir.vpk', 'sounds/lasso.vsnd_c');
  });
  it('reports no applied selection for another slot', async () => {
    selected();
    expect(await previewAppliedHeroSound('game', 'Holliday', 2, 'sounds/lasso.vsnd_c')).toEqual({ url: null, selected: false });
  });
});
