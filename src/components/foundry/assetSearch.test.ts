import { describe, expect, it } from 'vitest';
import { attributedHeroCodename, filterTextureGridItems, heroScopeIdentity, HERO_SCOPE_PREFIX } from './assetSearch';

const items = [
  { path: 'game/materials/icons/abrams_dash.vtex', label: 'Abrams Dash', hero: 'abrams' },
  { path: 'game/materials/icons/haze.vtex', label: 'Haze', hero: 'haze' },
] as never[];

// Ability icons are the sparse case the `scope:` filter exists for: most carry
// no hero at all, and the ones that do use engine codenames.
const icons = [
  { path: 'game/.../icons/atlas_siphon_life.vtex', label: 'Siphon Life', hero: 'atlas' },
  { path: 'game/.../icons/archer_arrow.vtex', label: 'Charged Arrow', hero: 'archer' },
  { path: 'game/.../icons/stamina.vtex', label: 'Stamina', hero: null },
] as never[];

describe('filterTextureGridItems', () => {
  it('matches a pasted game-path fragment case-insensitively', () => {
    expect(filterTextureGridItems(items, 'GAME/MATERIALS/ICONS/ABRAMS', 'all')).toEqual([items[0]]);
  });

  it('combines a hero scope with the label search', () => {
    expect(filterTextureGridItems(items, 'dash', 'abrams')).toEqual([items[0]]);
    expect(filterTextureGridItems(items, 'haze', 'abrams')).toEqual([]);
  });

  it('scopes to a hero through their codename aliases and keeps unattributed assets', () => {
    // Abrams' icons live under `atlas`, so a strict `abrams` filter finds none.
    expect(filterTextureGridItems(icons, '', 'abrams')).toEqual([]);
    expect(filterTextureGridItems(icons, '', `${HERO_SCOPE_PREFIX}abrams`)).toEqual([icons[0], icons[2]]);
  });

  it('never lets a hero-scoped embed show another hero', () => {
    const scoped = filterTextureGridItems(icons, '', `${HERO_SCOPE_PREFIX}abrams`) as { hero: string | null }[];
    expect(scoped.some((it) => it.hero === 'archer')).toBe(false);
  });

  it('scopes from a display name as well as a roster codename', () => {
    expect(filterTextureGridItems(icons, '', `${HERO_SCOPE_PREFIX}Grey Talon`)).toEqual([icons[1], icons[2]]);
  });
});

// Ability icons live flat and encode the hero in the filename, so the catalog
// attributes none of them. This is the real Abrams case from the live catalog.
const flatIcons = [
  { path: 'panorama/images/hud/abilities/bull_charge_psd.vtex_c', label: 'bull charge', hero: null },
  { path: 'panorama/images/hud/abilities/inferno_dash_psd.vtex_c', label: 'inferno dash', hero: null },
  { path: 'panorama/images/hud/abilities/ability_activate_psd.vtex_c', label: 'ability activate', hero: null },
  { path: 'panorama/images/hud/abilities/phalanx_beef_psd.vtex_c', label: 'phalanx beef', hero: null },
] as never[];

describe('attributedHeroCodename', () => {
  it('reads the hero out of a flat icon filename', () => {
    expect(attributedHeroCodename(flatIcons[0])).toBe('bull');
    expect(attributedHeroCodename(flatIcons[1])).toBe('inferno');
  });

  it('leaves genuinely shared and unknown-token icons unattributed', () => {
    expect(attributedHeroCodename(flatIcons[2])).toBeNull();
    expect(attributedHeroCodename(flatIcons[3])).toBeNull();
  });

  it('prefers the catalog attribution when there is one', () => {
    expect(attributedHeroCodename(items[1])).toBe('haze');
  });
});

describe('a hero-scoped flat icon catalog', () => {
  it('keeps this hero plus shared icons and drops other heroes', () => {
    const scoped = filterTextureGridItems(flatIcons, '', `${HERO_SCOPE_PREFIX}atlas`);
    // bull is an Abrams alias; inferno is Infernus and must go.
    expect(scoped).toEqual([flatIcons[0], flatIcons[2], flatIcons[3]]);
  });
});

describe('heroScopeIdentity', () => {
  it('reads the identity out of a scope value and ignores plain ones', () => {
    expect(heroScopeIdentity(`${HERO_SCOPE_PREFIX}abrams`)).toBe('abrams');
    expect(heroScopeIdentity('all')).toBeNull();
    expect(heroScopeIdentity('haze')).toBeNull();
  });
});
