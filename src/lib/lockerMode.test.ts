import { describe, expect, it } from 'vitest';
import { legacySoundTarget, lockerModeFromSearch } from './lockerMode';

describe('Global Locker section from the URL', () => {
  it('accepts only supported URL modes', () => {
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
