import { describe, expect, it, vi } from 'vitest';
import { prepareRecolorStagedEdit } from './recolorStagedEdit';
import type { FoundryAssetSource, FoundryAssetSourcesInspection, HeroEffectExportRequest } from '../../types/foundry';

const source = (overrides: Partial<FoundryAssetSource>): FoundryAssetSource => ({
  modId: 'mod',
  modName: 'Some mod',
  enabled: true,
  priority: 1,
  provenance: 'Downloaded',
  entries: [],
  wins: [],
  managed: false,
  auditionable: [],
  lockerManaged: false,
  ...overrides,
});

const inspection = (overrides: Partial<FoundryAssetSourcesInspection> = {}): FoundryAssetSourcesInspection => ({
  paths: [],
  sources: [],
  winners: {},
  unreadableMods: [],
  ...overrides,
});

const baseRequest: HeroEffectExportRequest = {
  heroName: 'Mina',
  mode: 'hue',
  hue: 280,
  saturation: 1,
  brightness: 1,
};

/** Entries exactly as the bake output lists them: mixed case, backslashes and
 *  a duplicate. prepareRecolorStagedEdit must normalize, dedupe and sort. */
const bakedEntries = [
  '\\PARTICLES\\hero\\ult.vpcf_c',
  'particles/hero/ult.vpcf_c',
  'Materials/Hero/Ult.VTEX_C',
];

const context = (overrides: Partial<Parameters<typeof prepareRecolorStagedEdit>[0]> = {}) => ({
  heroName: 'Mina',
  title: 'Mina recolor',
  request: baseRequest,
  discoverEntries: vi.fn().mockResolvedValue(bakedEntries),
  inspect: vi.fn().mockResolvedValue(inspection()),
  confirm: vi.fn().mockResolvedValue(true),
  unreadableMessage: 'Cannot stage this recolor while {{mods}} cannot be inspected.',
  ...overrides,
});

describe('prepareRecolorStagedEdit', () => {
  it('stages a recolor with sorted normalized affected files and the same entries on the request', async () => {
    const staged = await prepareRecolorStagedEdit(context());

    expect(staged).toMatchObject({
      id: 'recolor:Mina',
      kind: 'recolor',
      title: 'Mina recolor',
      affectedFiles: ['materials/hero/ult.vtex_c', 'particles/hero/ult.vpcf_c'],
      precedence: 0,
    });
    // The forge request carries the exact entries the tray reviewed, so the
    // write set the user confirmed cannot drift from what the bake writes.
    expect(staged!.request).toEqual({ ...baseRequest, entries: bakedEntries });
  });

  it('derives the staged edit id from the hero alone, so re-staging replaces in place', async () => {
    const hue = await prepareRecolorStagedEdit(context({ request: { ...baseRequest, mode: 'hue' } }));
    const gradient = await prepareRecolorStagedEdit(
      context({ request: { ...baseRequest, mode: 'gradient', gradient: 'sunset' } }),
    );

    expect(hue!.id).toBe(gradient!.id);
    // Foundry.tsx stages by filtering out the previous id, so two stages for
    // one hero collapse to a single edit rather than appending a second one.
    const tray = [hue!, gradient!].filter((edit) => edit.id !== hue!.id);
    expect(tray).toHaveLength(0);
  });

  it('blocks staging when a source VPK cannot be inspected, after exactly one discovery call', async () => {
    const discoverEntries = vi.fn().mockResolvedValue(bakedEntries);

    await expect(prepareRecolorStagedEdit(context({
      discoverEntries,
      inspect: async () => inspection({ unreadableMods: [{ modId: 'x', modName: 'Opaque VPK', enabled: true }] }),
    }))).rejects.toThrow('Cannot stage this recolor while Opaque VPK cannot be inspected.');

    // Discovery runs first and exactly once: the bake is cached, so a retry of
    // the failed stage would re-run discovery rather than duplicating a bake.
    expect(discoverEntries).toHaveBeenCalledTimes(1);
  });

  it('returns null when the enabled-owner acknowledgement is declined', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const staged = await prepareRecolorStagedEdit(context({
      inspect: async () => inspection({ sources: [source({ modName: 'Enabled recolor' })] }),
      confirm,
    }));

    expect(staged).toBeNull();
    expect(confirm).toHaveBeenCalledWith(['Enabled recolor']);
  });

  it('refuses to stage a bake that produced no entries', async () => {
    await expect(prepareRecolorStagedEdit(context({
      discoverEntries: vi.fn().mockResolvedValue([]),
    }))).rejects.toThrow('no VPK entries');
  });

  it('round-trips every mode onto the request unchanged, including trippy params', async () => {
    const requests: HeroEffectExportRequest[] = [
      { heroName: 'Mina', mode: 'hue', hue: 200, saturation: 1.2, brightness: 0.8 },
      { heroName: 'Mina', mode: 'prism', hue: 200, saturation: 1.2, brightness: 0.8, animated: true },
      { heroName: 'Mina', mode: 'gradient', hue: 200, saturation: 1.2, brightness: 0.8, gradient: 'sunset' },
      {
        heroName: 'Mina',
        mode: 'trippy',
        hue: 200,
        saturation: 1.2,
        brightness: 0.8,
        trippy: {
          style: 'confetti',
          intensity: 1,
          phase: 0,
          animationStyle: 'cycle',
          animationIntensity: 1,
          targets: 'all',
        },
      },
    ];

    for (const request of requests) {
      const staged = await prepareRecolorStagedEdit(context({ request }));
      expect(staged!.request).toEqual({ ...request, entries: bakedEntries });
    }
  });
});
