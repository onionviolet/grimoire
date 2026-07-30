import { describe, expect, it, vi } from 'vitest';
import { prepareVisualStagedEdit, serializeVisualReplacement, visualAssetInspectionPaths } from './visualEdits';
import type { FoundryAssetSource, FoundryAssetSourcesInspection } from '../../types/foundry';

const source = (overrides: Partial<FoundryAssetSource>): FoundryAssetSource => ({
  modId: 'mod', modName: 'Some mod', enabled: true, priority: 1, provenance: 'Downloaded',
  entries: [], wins: [], managed: false, auditionable: [], ...overrides,
});

const inspection = (overrides: Partial<FoundryAssetSourcesInspection> = {}): FoundryAssetSourcesInspection => ({
  paths: [], sources: [], winners: {}, unreadableMods: [], ...overrides,
});

describe('serializeVisualReplacement', () => {
  it('creates a source-preserving, normalized one-path staged edit', () => {
    expect(serializeVisualReplacement({
      entryPath: '\\panorama\\images\\heroes\\mina.png',
      imagePath: 'C:/art/mina.png',
      imageLabel: 'mina-reference.jpg',
      name: ' Mina portrait ',
      category: 'hero-image',
    })).toEqual({
      id: 'texture:panorama/images/heroes/mina.png',
      kind: 'texture',
      title: 'Mina portrait',
      affectedFiles: ['panorama/images/heroes/mina.png'],
      precedence: 0,
      source: { entryPath: 'panorama/images/heroes/mina.png', imagePath: 'C:/art/mina.png', imageLabel: 'mina-reference.jpg', name: ' Mina portrait ', category: 'hero-image' },
    });
  });

  it('groups only exact discovered portrait-state paths into a preflight family', () => {
    const catalog = [
      { path: 'panorama/images/heroes/mina_card.png', category: 'hero-image' as const, hero: 'mina', label: 'Mina' },
      { path: 'panorama/images/heroes/mina_card_low_hp.png', category: 'hero-image' as const, hero: 'mina', label: 'Mina low HP' },
      { path: 'panorama/images/heroes/mina_card_gloat.png', category: 'hero-image' as const, hero: 'mina', label: 'Mina gloat' },
      { path: 'panorama/images/heroes/mina_ability.png', category: 'hero-image' as const, hero: 'mina', label: 'Mina ability' },
    ];
    expect(visualAssetInspectionPaths(catalog[0], catalog)).toEqual(catalog.slice(0, 3).map((entry) => entry.path));
  });
});

describe('prepareVisualStagedEdit', () => {
  const item = { path: 'panorama/images/heroes/mina_card.png', category: 'hero-image' as const, hero: 'mina', label: 'Mina' };
  const base = {
    item, catalog: [item], imagePath: 'C:/art/mina.png', name: 'Mina portrait',
    unreadableMessage: 'unreadable VPK sources',
  };

  it('stages against the exact inspected entry paths when nothing owns them', async () => {
    const inspect = vi.fn().mockResolvedValue(inspection());
    const staged = await prepareVisualStagedEdit({ ...base, inspect, confirm: () => true });

    expect(inspect).toHaveBeenCalledWith([item.path]);
    expect(staged).toMatchObject({ kind: 'texture', affectedFiles: [item.path], source: { imagePath: 'C:/art/mina.png' } });
  });

  it('blocks staging when a source VPK cannot be inspected', async () => {
    await expect(prepareVisualStagedEdit({
      ...base,
      inspect: async () => inspection({ unreadableMods: [{ modId: 'x', modName: 'Opaque', enabled: true }] }),
      confirm: () => true,
    })).rejects.toThrow('unreadable VPK sources');
  });

  it('needs an explicit acknowledgement before layering over an enabled owner', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    const declined = await prepareVisualStagedEdit({
      ...base,
      inspect: async () => inspection({ sources: [source({ modName: 'Enabled skin' })] }),
      confirm,
    });

    expect(declined).toBeNull();
    expect(confirm).toHaveBeenCalledWith(['Enabled skin']);
  });

  it('ignores a disabled owner: Installed is the only enabled-state authority', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    const staged = await prepareVisualStagedEdit({
      ...base,
      inspect: async () => inspection({ sources: [source({ modName: 'Disabled skin', enabled: false })] }),
      confirm,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(staged).not.toBeNull();
  });
});
