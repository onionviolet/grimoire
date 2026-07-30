import { describe, expect, it } from 'vitest';
import {
  displayNameForHeroCodename,
  heroCodenameScope,
  matchesPortraitHero,
  portraitCodenamesForHero,
  resolvePortraitHero,
} from './heroPortraitIdentity';

describe('portrait hero identity', () => {
  it('keeps Abrams roster, current panorama, and legacy panorama names together', () => {
    expect(resolvePortraitHero('Abrams')).toEqual({ displayName: 'Abrams', panoramaCodenames: ['atlas', 'bull'] });
    expect(resolvePortraitHero('abrams')).toEqual({ displayName: 'Abrams', panoramaCodenames: ['atlas', 'bull'] });
    expect(matchesPortraitHero('Abrams', 'bull')).toBe(true);
    expect(matchesPortraitHero('Abrams', 'atlas')).toBe(true);
  });

  it('collapses the Doorman display-name alias', () => {
    expect(portraitCodenamesForHero('The Doorman')).toEqual(['doorman']);
    expect(matchesPortraitHero('Doorman', 'doorman')).toBe(true);
  });

  it('includes legacy panorama folders for renamed heroes', () => {
    expect(portraitCodenamesForHero('Grey Talon')).toEqual(['orion', 'archer']);
    expect(matchesPortraitHero('grey_talon', 'archer')).toBe(true);
  });

  it('does not guess an unknown hero mapping', () => {
    expect(resolvePortraitHero('Not a hero')).toBeNull();
    expect(matchesPortraitHero('Not a hero', 'atlas')).toBe(false);
  });
});

describe('displayNameForHeroCodename', () => {
  it('turns the engine codenames that leak into dropdowns back into hero names', () => {
    expect(displayNameForHeroCodename('archer')).toBe('Grey Talon');
    expect(displayNameForHeroCodename('punkgoat')).toBe('Billy');
    expect(displayNameForHeroCodename('nano')).toBe('Calico');
    expect(displayNameForHeroCodename('atlas')).toBe('Abrams');
    expect(displayNameForHeroCodename('abrams')).toBe('Abrams');
  });

  it('reports internal codenames as unresolved instead of inventing a hero', () => {
    expect(displayNameForHeroCodename('genericperson')).toBeNull();
    expect(displayNameForHeroCodename('duo')).toBeNull();
    expect(displayNameForHeroCodename(null)).toBeNull();
  });
});

describe('heroCodenameScope', () => {
  it('covers the roster name, display name, and every panorama alias', () => {
    expect([...heroCodenameScope('abrams')].sort()).toEqual(['abrams', 'atlas', 'bull']);
    expect([...heroCodenameScope('Abrams')].sort()).toEqual(['abrams', 'atlas', 'bull']);
    // Entering from an alias resolves the same set.
    expect([...heroCodenameScope('atlas')].sort()).toEqual(['abrams', 'atlas', 'bull']);
  });

  it('falls back to the identity alone when the hero is unknown', () => {
    expect([...heroCodenameScope('genericperson')]).toEqual(['genericperson']);
    expect([...heroCodenameScope(null)]).toEqual([]);
  });
});
