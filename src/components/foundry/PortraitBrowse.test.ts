import { describe, expect, it } from 'vitest';
import { allHeroIdentities } from '../../lib/heroIdentity';
import { portraitFamiliesForHero } from './portraitFamilyLookup';

describe('portraitFamiliesForHero', () => {
  it('finds a family under every panorama alias in the portrait identity mapping', () => {
    // The alias data itself now lives in heroIdentity.ts (S5); this reads the
    // roster from there rather than from a table heroPortraitIdentity.ts no
    // longer owns.
    const heroes = allHeroIdentities();
    const families = heroes.flatMap((hero) =>
      hero.panoramaCodenames.map((codename) => ({ hero: codename, codename })),
    );

    for (const hero of heroes) {
      expect(portraitFamiliesForHero(families, hero.displayName).map((family) => family.codename))
        .toEqual(hero.panoramaCodenames);
    }
  });
});
