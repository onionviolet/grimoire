import { describe, expect, it } from 'vitest';
import { filterTextureGridItems } from './assetSearch';

const items = [
  { path: 'game/materials/icons/abrams_dash.vtex', label: 'Abrams Dash', hero: 'abrams' },
  { path: 'game/materials/icons/haze.vtex', label: 'Haze', hero: 'haze' },
] as never[];

describe('filterTextureGridItems', () => {
  it('matches a pasted game-path fragment case-insensitively', () => {
    expect(filterTextureGridItems(items, 'GAME/MATERIALS/ICONS/ABRAMS', 'all')).toEqual([items[0]]);
  });

  it('combines a hero scope with the label search', () => {
    expect(filterTextureGridItems(items, 'dash', 'abrams')).toEqual([items[0]]);
    expect(filterTextureGridItems(items, 'haze', 'abrams')).toEqual([]);
  });
});
