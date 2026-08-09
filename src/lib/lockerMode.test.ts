import { describe, expect, it } from 'vitest';
import { legacySoundTarget, lockerModeFromSearch, resolveLockerRoute } from './lockerMode';

describe('Global Locker section from the URL', () => {
  it('accepts only supported URL modes', () => {
    expect(lockerModeFromSearch('?mode=all')).toBe('all');
    expect(lockerModeFromSearch('?mode=sounds')).toBe('sounds');
    expect(lockerModeFromSearch('?mode=looks')).toBe('looks');
    expect(lockerModeFromSearch('?mode=other')).toBeNull();
    expect(lockerModeFromSearch('')).toBeNull();
  });
});

describe('legacy Sound Locker deep links', () => {
  it('ignores paths that were never Sound Locker routes', () => {
    expect(legacySoundTarget('/locker')).toBeNull();
    expect(legacySoundTarget('/locker/global')).toBeNull();
    expect(legacySoundTarget('/locker/hero/33306')).toBeNull();
    // Guards against a prefix match swallowing an unrelated sibling route.
    expect(legacySoundTarget('/locker/soundsomething')).toBeNull();
  });

  it('sends the global shelf to the Global drill-in', () => {
    expect(legacySoundTarget('/locker/sounds/global')).toEqual({ kind: 'global' });
    expect(legacySoundTarget('/locker/sounds/global/')).toEqual({ kind: 'global' });
  });

  it('sends a hero shelf to that hero, decoding the display name', () => {
    expect(legacySoundTarget('/locker/sounds/hero/Seven')).toEqual({ kind: 'hero', hero: 'Seven' });
    expect(legacySoundTarget('/locker/sounds/hero/Grey%20Talon')).toEqual({
      kind: 'hero',
      hero: 'Grey Talon',
    });
    expect(legacySoundTarget('/locker/sounds/hero/The%20Doorman/')).toEqual({
      kind: 'hero',
      hero: 'The Doorman',
    });
  });

  it('sends the old landing to the Locker grid', () => {
    expect(legacySoundTarget('/locker/sounds')).toEqual({ kind: 'locker' });
    expect(legacySoundTarget('/locker/sounds/')).toEqual({ kind: 'locker' });
  });
});

describe('resolveLockerRoute', () => {
  it('reads the grid', () => {
    expect(resolveLockerRoute('/locker', '')).toEqual({ drillIn: 'grid', section: null });
    // A query the grid does not own must not turn it into something else.
    expect(resolveLockerRoute('/locker', '?hero=Seven')).toEqual({
      drillIn: 'grid',
      section: null,
    });
  });

  it('opens a bare Global drill-in on All content', () => {
    expect(resolveLockerRoute('/locker/global', '')).toEqual({
      drillIn: 'global',
      section: 'all',
    });
    expect(resolveLockerRoute('/locker/global/', '')).toEqual({
      drillIn: 'global',
      section: 'all',
    });
  });

  it('keeps the Global looks and sounds sections addressable', () => {
    expect(resolveLockerRoute('/locker/global', '?mode=sounds')).toEqual({
      drillIn: 'global',
      section: 'sounds',
    });
    expect(resolveLockerRoute('/locker/global', '?mode=looks')).toEqual({
      drillIn: 'global',
      section: 'looks',
    });
    expect(resolveLockerRoute('/locker/global', '?mode=all')).toEqual({
      drillIn: 'global',
      section: 'all',
    });
    // An unrecognised mode is the default section, not a broken drill-in.
    expect(resolveLockerRoute('/locker/global', '?mode=nonsense')).toEqual({
      drillIn: 'global',
      section: 'all',
    });
  });

  it('opens a bare hero drill-in on Skins', () => {
    expect(resolveLockerRoute('/locker/hero/33306', '')).toEqual({
      drillIn: 'hero',
      heroId: '33306',
      section: 'skins',
    });
  });

  it('deep-links every hero section, not just sounds', () => {
    for (const section of ['skins', 'sounds', 'cards', 'effects'] as const) {
      expect(resolveLockerRoute('/locker/hero/33306', `?section=${section}`)).toEqual({
        drillIn: 'hero',
        heroId: '33306',
        section,
      });
    }
    expect(resolveLockerRoute('/locker/hero/33306', '?section=nonsense')).toEqual({
      drillIn: 'hero',
      heroId: '33306',
      section: 'skins',
    });
  });

  it('routes the three legacy sound shapes', () => {
    expect(resolveLockerRoute('/locker/sounds', '')).toEqual({
      drillIn: 'legacy',
      section: null,
      legacy: { kind: 'locker' },
    });
    expect(resolveLockerRoute('/locker/sounds/global', '')).toEqual({
      drillIn: 'legacy',
      section: null,
      legacy: { kind: 'global' },
    });
    expect(resolveLockerRoute('/locker/sounds/hero/Grey%20Talon', '')).toEqual({
      drillIn: 'legacy',
      section: null,
      legacy: { kind: 'hero', hero: 'Grey Talon' },
    });
  });

  it('keeps the hero on the legacy landing that carries one', () => {
    // Foundry's My changes panel links `/locker/sounds?hero=<name>`. Reading
    // the path alone rewrote that to the grid and dropped the hero.
    expect(resolveLockerRoute('/locker/sounds', '?hero=Seven')).toEqual({
      drillIn: 'legacy',
      section: null,
      legacy: { kind: 'hero', hero: 'Seven' },
    });
  });

  it('does not let a section survive a drill-in it does not belong to', () => {
    // `?section=` is the hero vocabulary and `?mode=` the global one. Neither
    // may leak into the other, or a stale query would select a phantom tab.
    expect(resolveLockerRoute('/locker/global', '?section=cards')).toEqual({
      drillIn: 'global',
      section: 'all',
    });
    expect(resolveLockerRoute('/locker/hero/33306', '?mode=sounds')).toEqual({
      drillIn: 'hero',
      heroId: '33306',
      section: 'skins',
    });
  });
});
