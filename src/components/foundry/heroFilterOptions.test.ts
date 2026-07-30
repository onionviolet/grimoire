import { describe, expect, it } from 'vitest';
import { buildHeroFilterOptions } from './heroFilterOptions';

const labels = {
  all: 'All heroes',
  scoped: (hero: string) => `${hero} & shared`,
  unresolved: 'Unreleased or internal',
};

function build(codenames: string[], extra: Partial<Parameters<typeof buildHeroFilterOptions>[0]> = {}) {
  return buildHeroFilterOptions({ codenames, heroNames: new Map(), labels, ...extra });
}

describe('buildHeroFilterOptions', () => {
  it('labels aliased codenames with the hero name and keeps the codename as the hint', () => {
    const options = build(['punkgoat', 'nano', 'archer']);
    expect(options.filter((o) => o.value !== 'all').map((o) => [o.label, o.hint])).toEqual([
      ['Billy', 'punkgoat'],
      ['Calico', 'nano'],
      ['Grey Talon', 'archer'],
    ]);
  });

  it('gives an aliased hero its icon identity, so a hint is never the only clue', () => {
    const [, talon] = build(['archer']);
    expect(talon.heroName).toBe('Grey Talon');
    expect(talon.value).toBe('archer');
  });

  it('does not repeat a codename the display name already contains', () => {
    expect(build(['bebop'])[1]).toMatchObject({ label: 'Bebop', hint: undefined });
    expect(build(['doorman'])[1]).toMatchObject({ label: 'Doorman', hint: undefined });
    expect(build(['krill'])[1]).toMatchObject({ label: 'Mo & Krill', hint: undefined });
    // Only a contained codename is redundant. A different word still shows.
    expect(build(['digger'])[1]).toMatchObject({ label: 'Mo & Krill', hint: 'digger' });
  });

  it('prefers the roster display name the shell resolved over the alias table', () => {
    const [, hero] = build(['atlas'], { heroNames: new Map([['atlas', 'Abrams (roster)']]) });
    expect(hero.label).toBe('Abrams (roster)');
    expect(hero.hint).toBe('atlas');
  });

  it('sorts unresolved codenames below the roster and marks them, without inventing a hero', () => {
    const options = build(['duo', 'archer', 'genericperson']);
    expect(options.map((o) => o.label)).toEqual(['All heroes', 'Grey Talon', 'duo', 'genericperson']);
    const internal = options.slice(2);
    expect(internal.every((o) => o.muted && o.hint === 'Unreleased or internal')).toBe(true);
    expect(internal.every((o) => o.heroName === undefined)).toBe(true);
  });

  it('leads with the embedding hero scope, named rather than coded', () => {
    const [scope, all] = build(['archer'], { scopedHero: 'archer' });
    expect(scope).toMatchObject({ value: 'scope:archer', label: 'Grey Talon & shared', hint: 'archer' });
    expect(all.value).toBe('all');
  });

  it('honours a caller-supplied display name for the scoped hero', () => {
    const [scope] = build([], { scopedHero: 'orion', scopedHeroName: 'Grey Talon' });
    expect(scope.label).toBe('Grey Talon & shared');
  });

  it('emits one option per codename however many assets carry it', () => {
    const options = build(['nano', 'nano', 'nano']);
    expect(options.filter((o) => o.value === 'nano')).toHaveLength(1);
  });

  it('offers only "all" when the catalog attributes nothing, so callers can hide the filter', () => {
    expect(build([])).toEqual([{ value: 'all', label: 'All heroes' }]);
  });
});
