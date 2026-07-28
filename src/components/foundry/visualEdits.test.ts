import { describe, expect, it } from 'vitest';
import { serializeVisualReplacement, visualAssetInspectionPaths } from './visualEdits';

describe('serializeVisualReplacement', () => {
  it('creates a source-preserving, normalized one-path staged edit', () => {
    expect(serializeVisualReplacement({
      entryPath: '\\panorama\\images\\heroes\\mina.png',
      imagePath: 'C:/art/mina.png',
      name: ' Mina portrait ',
      category: 'hero-image',
    })).toEqual({
      id: 'texture:panorama/images/heroes/mina.png',
      kind: 'texture',
      title: 'Mina portrait',
      affectedFiles: ['panorama/images/heroes/mina.png'],
      precedence: 0,
      source: { entryPath: 'panorama/images/heroes/mina.png', imagePath: 'C:/art/mina.png', name: ' Mina portrait ', category: 'hero-image' },
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
