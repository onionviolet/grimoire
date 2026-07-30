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

// Leg A of the #4 alias sweep: what the table can prove about itself without a
// catalog. It cannot find a missing codename, because a table does not know what
// it omits: that needs the indexed pak (Leg B). It can prove the table is
// internally consistent, which is the half that runs with nothing else running.
// See docs/portrait-alias-sweep-plan.md.
describe('alias table consistency', () => {
  // Every hero #4 item 4 names as having a codename mismatch, with the aliases
  // the issue expects. Deliberately spelled out rather than derived from the
  // table, so a codename silently disappearing fails here.
  const MISMATCHED: readonly (readonly [string, readonly string[]])[] = [
    ['Abrams', ['atlas', 'bull']],
    ['Apollo', ['fencer']],
    ['Billy', ['punkgoat']],
    ['Calico', ['nano']],
    ['Celeste', ['unicorn']],
    ['Dynamo', ['dynamo', 'sumo']],
    ['Graves', ['necro']],
    ['Grey Talon', ['orion', 'archer']],
    ['Holliday', ['astro']],
    ['Infernus', ['inferno']],
    ['Ivy', ['tengu']],
    ['Lady Geist', ['ghost', 'spectre']],
    ['McGinnis', ['forge', 'engineer']],
    ['Mina', ['vampirebat']],
    ['Mo & Krill', ['krill', 'digger']],
  ];

  it.each(MISMATCHED)('%s owns its panorama codenames', (hero, codenames) => {
    expect(portraitCodenamesForHero(hero)).toEqual([...codenames]);
  });

  it.each(MISMATCHED)('%s resolves back from every one of its codenames', (hero, codenames) => {
    for (const code of codenames) {
      expect(displayNameForHeroCodename(code)).toBe(hero);
    }
  });

  it('round-trips every mismatched hero through name -> codenames -> name', () => {
    for (const [hero] of MISMATCHED) {
      for (const code of portraitCodenamesForHero(hero)) {
        expect(displayNameForHeroCodename(code)).toBe(hero);
      }
    }
  });

  it('never maps one codename to two heroes', () => {
    // A collision is the failure mode that silently steals a hero's assets:
    // whichever definition is later in the list wins the reverse lookup, and
    // the earlier hero resolves to families that are not its own.
    const owner = new Map<string, string>();
    for (const [hero] of MISMATCHED) {
      for (const code of [...heroCodenameScope(hero)]) {
        const existing = owner.get(code);
        expect(existing ?? hero).toBe(hero);
        owner.set(code, hero);
      }
    }
  });

  it('scopes each mismatched hero to a set that includes all of its aliases', () => {
    for (const [hero, codenames] of MISMATCHED) {
      const scope = heroCodenameScope(hero);
      for (const code of codenames) {
        expect(scope.has(code)).toBe(true);
      }
    }
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
