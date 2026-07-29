import { describe, expect, it } from 'vitest';
import { matchesPortraitHero, portraitCodenamesForHero, resolvePortraitHero } from './heroPortraitIdentity';

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
