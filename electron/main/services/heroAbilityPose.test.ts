import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
const h = vi.hoisted(() => ({ root: '', run: vi.fn(), stdout: vi.fn(), preview: vi.fn(), events: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => h.root }, protocol: { handle: vi.fn() }, net: { fetch: vi.fn() } }));
vi.mock('./deadlock', () => ({ getCitadelPath: () => join(h.root, 'game'), getAddonsPath: () => join(h.root, 'addons'), getDisabledPath: () => join(h.root, 'disabled') }));
vi.mock('./modMerger', () => ({ runVpkmerge: h.run, runVpkmergeStdout: h.stdout, verifyVpkOutput: vi.fn() }));
vi.mock('./previewVpkRegistry', () => ({ resolvePreviewVpk: h.preview }));
vi.mock('./particleBundle', () => ({ exportNativeParticleBundle: vi.fn() }));
vi.mock('./particleAttachments', () => ({ heroParticleAttachments: vi.fn() }));
vi.mock('./abilityClipEvents', () => ({ readEmbeddedClipEvents: h.events }));
const { exportHeroAbilityPose } = await import('./heroPoseModels');
const clip = 'astro_ability_gravity_lasso_cast';
beforeEach(async () => {
  h.root = await fs.mkdtemp(join(tmpdir(), 'hero-ability-pose-test-'));
  await fs.mkdir(join(h.root, 'addons')); await fs.writeFile(join(h.root, 'addons', 'pak01_dir.vpk'), 'inert skin');
  await fs.writeFile(join(h.root, 'addons', 'pak02_dir.vpk'), 'second inert skin');
  h.stdout.mockResolvedValue(JSON.stringify([{ name: clip, frameCount: 31, durationSeconds: 0.75, fps: 40, looping: false, default: false }]));
  h.run.mockResolvedValue(undefined);
  h.events.mockResolvedValue({ status: 'unavailable', provenance: { modelEntry: 'models/heroes_wip/wraith/wraith.vmdl_c', clipName: clip, format: 'ANIM/ASEQ' }, events: [] });
});
afterEach(async () => { vi.resetAllMocks(); await fs.rm(h.root, { recursive: true, force: true }); });
describe('ability model source authority', () => {
  it('exports exact known clip from the selected outfit with base dependencies', async () => {
    expect(await exportHeroAbilityPose('game', 'Holliday', clip, '/cache/ability.glb', [{ metaKey: 'pak01_dir.vpk', priority: 0 }])).toEqual({ skinApplied: true, skinFallback: false });
    expect(h.run).toHaveBeenCalledWith(['model', 'export', '--vpk', join(h.root, 'addons', 'pak01_dir.vpk'), '--hero', 'astro', '--base', join(h.root, 'game', 'pak01_dir.vpk'), '--clip', clip, '--out', '/cache/ability.glb']);
  });
  it('refuses a missing clip rather than substituting an unrelated idle', async () => {
    h.stdout.mockResolvedValue('[]');
    await expect(exportHeroAbilityPose('game', 'Holliday', clip, '/cache/ability.glb')).rejects.toThrow('no supported');
    expect(h.run).not.toHaveBeenCalled();
  });
  it('uses only the explicitly selected fallback after a stack export fails', async () => {
    h.run.mockImplementation(async (args: string[]) => { if (args[0] !== 'model') throw new Error('inert failed merge'); });
    expect(await exportHeroAbilityPose('game', 'Holliday', clip, '/cache/ability.glb', [{ metaKey: 'pak01_dir.vpk', priority: 0 }, { metaKey: 'pak02_dir.vpk', priority: 1 }], 'pak01_dir.vpk')).toEqual({ skinApplied: true, skinFallback: true });
    expect(h.run.mock.calls.at(-1)?.[0]).toContain(join(h.root, 'addons', 'pak01_dir.vpk'));
  });
  it('inspects events only from the exact entry and selected export source', async () => {
    const result = await exportHeroAbilityPose('game', 'Wraith', clip, '/cache/ability.glb', [{ metaKey: 'pak01_dir.vpk', priority: 0 }]);
    expect(h.events).toHaveBeenCalledExactlyOnceWith(join(h.root, 'addons', 'pak01_dir.vpk'), 'models/heroes_wip/wraith/wraith.vmdl_c', clip, join(tmpdir(), 'grimoire-clip-events'), { fps: 40, frameCount: 31 });
    expect(result.clipEvents).toMatchObject({ status: 'unavailable' });
    expect(h.run).toHaveBeenCalledWith(['model', 'export', '--vpk', join(h.root, 'addons', 'pak01_dir.vpk'), '--entry', 'models/heroes_wip/wraith/wraith.vmdl_c', '--base', join(h.root, 'game', 'pak01_dir.vpk'), '--clip', clip, '--out', '/cache/ability.glb']);
  });
  it('uses base event metadata only after the selected source conclusively has no embedded clips', async () => {
    h.events.mockResolvedValueOnce({ status: 'unavailable', hasEmbeddedClips: false, events: [] })
      .mockResolvedValueOnce({ status: 'available', hasEmbeddedClips: true, events: [] });
    const result = await exportHeroAbilityPose('game', 'Wraith', clip, '/cache/ability.glb', [{ metaKey: 'pak01_dir.vpk', priority: 0 }]);
    expect(h.events).toHaveBeenCalledTimes(2);
    expect(h.events.mock.calls[1][0]).toBe(join(h.root, 'game', 'pak01_dir.vpk'));
    expect(result.clipEvents).toMatchObject({ status: 'available' });
  });
  it('keeps playback usable without substituting metadata when source event decoding is unsupported', async () => {
    h.events.mockResolvedValue({ status: 'unsupported', reason: 'event-decode-failed', events: [] });
    const result = await exportHeroAbilityPose('game', 'Wraith', clip, '/cache/ability.glb', [{ metaKey: 'pak01_dir.vpk', priority: 0 }]);
    expect(h.events).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ skinApplied: true, skinFallback: false, clipEvents: { status: 'unsupported' } });
  });
});
