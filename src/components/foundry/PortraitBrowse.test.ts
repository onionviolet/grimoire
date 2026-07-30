import { describe, expect, it } from 'vitest';
import { portraitHeroDefinitions } from '../../lib/heroPortraitIdentity';
import { portraitFamiliesForHero } from './portraitFamilyLookup';

describe('portraitFamiliesForHero', () => {
  it('finds a family under every panorama alias in the portrait identity mapping', () => {
    const families = portraitHeroDefinitions.flatMap((hero) =>
      hero.panoramaCodenames.map((codename) => ({ hero: codename, codename })),
    );

    for (const hero of portraitHeroDefinitions) {
      expect(portraitFamiliesForHero(families, hero.displayName).map((family) => family.codename))
        .toEqual(hero.panoramaCodenames);
    }
  });
});
