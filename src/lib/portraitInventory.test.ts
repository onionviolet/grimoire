import { describe, expect, it } from 'vitest';
import { buildPortraitInventory, overlappingClaims } from './portraitInventory';
import type { Mod } from '../types/mod';

function mod(overrides: Partial<Mod> & { id: string }): Mod {
  return { name: overrides.id, fileName: `${overrides.id}_dir.vpk`, path: `C:/addons/${overrides.id}_dir.vpk`, metaKey: `${overrides.id}_dir.vpk`, enabled: true, priority: 1, size: 1, installedAt: '', ...overrides };
}

describe('buildPortraitInventory', () => {
  it('folds all recorded signals into one mod and hero entry', () => {
    const entry = buildPortraitInventory([mod({ id: 'forge', textureReplacement: { entryPath: 'Panorama\\Images\\Heroes\\seven_card.vtex_c', imageFileName: 'a.png', category: 'hero-image', heroName: 'Seven' }, foundryBuild: { writeSet: [], parts: [{ kind: 'texture', title: 'vertical', entries: ['panorama/images/heroes/seven_vertical.vtex_c'], category: 'hero-image', heroName: 'Seven' }] } })]).byHero.get('Seven')![0];
    expect(entry.paths).toEqual(['panorama/images/heroes/seven_card.vtex_c', 'panorama/images/heroes/seven_vertical.vtex_c']);
    expect(entry.variants).toEqual(['card', 'vertical']);
    expect(entry.provenance).toBe('forged');
  });

  it('keeps Locker selections without guessing their output paths', () => {
    const entry = buildPortraitInventory([mod({ id: 'locker', lockerCosmetics: { rebuiltAt: '', cards: [{ heroCodename: 'gigawatt', heroName: 'Seven', variants: ['card', 'minimap'], source: { fileName: 'source.vpk', sha256AtApplyTime: 'x' }, addedAt: '' }] } })]).byHero.get('Seven')![0];
    expect(entry.paths).toEqual([]);
    expect(entry.variants).toEqual(['card', 'minimap']);
    expect(entry.provenance).toBe('locker');
  });

  it('collapses hero aliases and ignores disabled claimants', () => {
    const inventory = buildPortraitInventory([
      mod({ id: 'one', textureReplacement: { entryPath: 'panorama/images/heroes/doorman_card.vtex_c', imageFileName: 'a.png', category: 'hero-image', heroName: 'The Doorman' } }),
      mod({ id: 'two', enabled: false, textureReplacement: { entryPath: 'panorama/images/heroes/doorman_card.vtex_c', imageFileName: 'b.png', category: 'hero-image', heroName: 'Doorman' } }),
    ]);
    const entries = inventory.byHero.get('Doorman')!;
    expect(entries).toHaveLength(2);
    expect(overlappingClaims(entries)).toEqual([]);
  });

  it('does not report overlap when the write set is unrecorded', () => {
    const entries = buildPortraitInventory([mod({ id: 'a', lockerCosmetics: { cards: [{ heroCodename: 'seven', heroName: 'Seven', variants: ['card'], source: { fileName: 'x', sha256AtApplyTime: 'x' }, addedAt: '' }], rebuiltAt: '' } }), mod({ id: 'b', lockerCosmetics: { cards: [{ heroCodename: 'seven', heroName: 'Seven', variants: ['card'], source: { fileName: 'y', sha256AtApplyTime: 'x' }, addedAt: '' }], rebuiltAt: '' } })]).byHero.get('Seven')!;
    expect(overlappingClaims(entries)).toEqual([]);
  });
});
