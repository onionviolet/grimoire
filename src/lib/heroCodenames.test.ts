import { describe, expect, it } from 'vitest';
import {
  HERO_CODENAMES,
  HERO_CODENAME_COLLISIONS,
  divergentBodyModelForHero,
  heroCodenames,
  heroForAnyCodename,
  particleCodenameForHero,
  translateHeroCodename,
} from './heroCodenames';
import { allHeroIdentities } from './heroIdentity';
import { HERO_SOUND_CODENAMES } from '../../electron/main/services/heroSoundCodenames';
import { HERO_ABILITY_SLOTS } from '../../electron/main/services/heroAbilitySlots';

/**
 * The join is data, so the tests are the only thing standing between it and a
 * silent wrong answer. They fall into three groups:
 *
 * 1. **Agreement with the tables it joins.** Every existing namespace table is
 *    checked in both directions, so a hero added to one and not the other fails
 *    here rather than in the game.
 * 2. **The divergences it exists for.** Six heroes disagree across the four
 *    columns; those exact rows are pinned, because a refactor that "simplified"
 *    them into one codename would still pass every other test in this file.
 * 3. **Refusal to guess.** A null column stays null.
 */

describe('the hero codename join', () => {
  it('has no codename claimed by two heroes in any namespace', () => {
    // A collision would make the reverse lookup pick one hero silently, which
    // is the exact failure mode this module exists to prevent.
    expect(HERO_CODENAME_COLLISIONS).toEqual([]);
  });

  it('has one row per hero and no duplicate display names', () => {
    const names = HERO_CODENAMES.map((hero) => hero.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('agrees with the panorama identity map in both directions', () => {
    // The alias data itself now lives in heroIdentity.ts (S5); read the roster
    // from there rather than from a table heroPortraitIdentity.ts no longer owns.
    // Unreleased heroes own no panorama folder (empty panoramaCodenames) and are
    // out of scope here, same as the old portrait-only table never listed them.
    const withPanorama = allHeroIdentities().filter((hero) => hero.panoramaCodenames.length > 0);
    const panoramaByHero = new Map(
      withPanorama.map((hero) => [hero.displayName, hero.panoramaCodenames[0]]),
    );
    for (const [displayName, panorama] of panoramaByHero) {
      expect(heroCodenames(displayName)?.panorama).toBe(panorama);
    }
    // And nothing in the join claims a panorama codename the identity map does
    // not own, which would mean two answers to "where is this hero's card art".
    const known = new Set(withPanorama.flatMap((hero) => hero.panoramaCodenames));
    for (const hero of HERO_CODENAMES) {
      if (hero.panorama) expect(known).toContain(hero.panorama);
    }
  });

  it('agrees with the sound codename table in both directions', () => {
    for (const [codename, displayName] of Object.entries(HERO_SOUND_CODENAMES)) {
      expect(heroCodenames(displayName)?.sound).toBe(codename);
    }
    const soundRows = HERO_CODENAMES.filter((hero) => hero.sound);
    expect(soundRows).toHaveLength(Object.keys(HERO_SOUND_CODENAMES).length);
  });

  it('joins every sound codename to an ability slot table, or to nothing at all', () => {
    // The join's whole purpose downstream is "given this hero, which ability
    // did they cast". That resolves through HERO_ABILITY_SLOTS, which is keyed
    // on the sound codename, so a sound codename with no slots is a hero whose
    // ability rail cannot be built and must not be offered one.
    const withoutSlots = HERO_CODENAMES.filter(
      (hero) => hero.sound && !HERO_ABILITY_SLOTS[hero.sound],
    ).map((hero) => hero.displayName);
    expect(withoutSlots).toEqual([]);
  });

  it('pins the six heroes whose namespaces genuinely diverge', () => {
    const divergent = HERO_CODENAMES.filter(
      (hero) =>
        new Set([hero.panorama, hero.sound, hero.particle, hero.bodyModel].filter(Boolean)).size > 1,
    ).map((hero) => [hero.displayName, hero.panorama, hero.sound, hero.particle, hero.bodyModel]);

    expect(divergent).toEqual([
      ['Abrams', 'atlas', 'abrams', 'abrams', 'atlas_detective'],
      ['Grey Talon', 'orion', 'orion', 'archer', 'archer'],
      ['McGinnis', 'forge', 'forge', 'mcginnis', 'engineer'],
      ['Mo & Krill', 'krill', 'mokrill', 'digger', 'digger'],
      ['Pocket', 'synth', 'synth', 'pocket', 'synth'],
      ['Seven', 'gigawatt', 'gigawatt', 'gigawatt', 'gigawatt_prisoner'],
    ]);
  });

  it('translates between namespaces without guessing', () => {
    // The cases that make the join necessary at all.
    expect(translateHeroCodename('krill', 'panorama', 'sound')).toBe('mokrill');
    expect(translateHeroCodename('mokrill', 'sound', 'particle')).toBe('digger');
    expect(translateHeroCodename('synth', 'sound', 'particle')).toBe('pocket');
    expect(translateHeroCodename('gigawatt', 'sound', 'bodyModel')).toBe('gigawatt_prisoner');
    expect(translateHeroCodename('atlas', 'panorama', 'sound')).toBe('abrams');
    expect(translateHeroCodename('forge', 'sound', 'particle')).toBe('mcginnis');
  });

  it('returns null rather than the input when the target namespace is unknown', () => {
    // Fathom ships sounds and nothing else. Falling back to the input here is
    // what would make the app look for `particles/abilities/fathom/`.
    expect(heroCodenames('Fathom')?.sound).toBe('fathom');
    expect(translateHeroCodename('fathom', 'sound', 'particle')).toBeNull();
    expect(translateHeroCodename('fathom', 'sound', 'panorama')).toBeNull();
    expect(translateHeroCodename('not-a-hero', 'sound', 'panorama')).toBeNull();
    expect(translateHeroCodename(null, 'sound', 'panorama')).toBeNull();
  });

  it('does not read a source column that is null as a wildcard', () => {
    // Fathom's `particle` is null. Asking "which hero has particle codename X"
    // must not match every hero whose particle column is also null.
    expect(translateHeroCodename('', 'particle', 'sound')).toBeNull();
  });

  it('refuses to assume a background codename equals the panorama one', () => {
    // Paige is the counterexample: card and model are `bookworm`, background is
    // `patience`. Everyone else is null until upstream f91b9a1 is adopted.
    expect(heroCodenames('Paige')?.background).toBe('patience');
    expect(heroCodenames('Paige')?.panorama).toBe('bookworm');
    const guessed = HERO_CODENAMES.filter(
      (hero) => hero.background !== null && hero.background === hero.panorama,
    );
    expect(guessed).toEqual([]);
  });

  it('resolves a codename from any namespace back to its hero', () => {
    expect(heroForAnyCodename('digger')?.displayName).toBe('Mo & Krill');
    expect(heroForAnyCodename('mokrill')?.displayName).toBe('Mo & Krill');
    expect(heroForAnyCodename('krill')?.displayName).toBe('Mo & Krill');
    expect(heroForAnyCodename('patience')?.displayName).toBe('Paige');
    expect(heroForAnyCodename('ATLAS_DETECTIVE')?.displayName).toBe('Abrams');
    expect(heroForAnyCodename('genericperson')).toBeNull();
  });

  it('is case and whitespace insensitive on display names', () => {
    expect(heroCodenames('  mo & krill ')?.particle).toBe('digger');
    expect(heroCodenames('MINA')?.panorama).toBe('vampirebat');
    expect(heroCodenames('Not A Hero')).toBeNull();
  });
});

describe('the accessors the main process derives its tables from', () => {
  it('gives a recolor recipe key only for heroes that have one', () => {
    expect(particleCodenameForHero('Pocket')).toBe('pocket');
    expect(particleCodenameForHero('Mo & Krill')).toBe('digger');
    // Sound-only heroes have no pinned recipe, so recolor must not be offered.
    expect(particleCodenameForHero('Fathom')).toBeNull();
    expect(particleCodenameForHero('Not A Hero')).toBeNull();
    const withRecipe = HERO_CODENAMES.filter((hero) => hero.particle);
    expect(withRecipe).toHaveLength(38);
  });

  it('reports a body model only when it diverges from the panorama codename', () => {
    // Exactly the five entries `MODEL_CODENAME_OVERRIDES` listed by hand.
    const overrides = Object.fromEntries(
      HERO_CODENAMES.map((hero) => [hero.displayName, divergentBodyModelForHero(hero.displayName)])
        .filter(([, names]) => (names as string[]).length > 0),
    );
    expect(overrides).toEqual({
      Abrams: ['atlas_detective'],
      'Grey Talon': ['archer'],
      McGinnis: ['engineer'],
      'Mo & Krill': ['digger'],
      Seven: ['gigawatt_prisoner'],
    });
    // Pocket diverges on `particle` but not on `bodyModel`, so it must not
    // appear: an override equal to the panorama codename is discovery work
    // done twice for nothing.
    expect(divergentBodyModelForHero('Pocket')).toEqual([]);
  });
});
