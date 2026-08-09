import { describe, expect, it } from 'vitest';
import type { Mod } from '../types/mod';
import { heroSoundShuffleRows, soundLockerHref } from './foundrySoundShuffle';
import { shuffleSoundKey } from './lockerRandomizer';

/**
 * Minimal Mod factory, mirroring lockerRandomizer.test.ts. Only the fields the
 * hero-pool selector reads matter (id, name, lockerHero, soundSwap).
 */
function mod(over: Partial<Mod> & { id: string }): Mod {
  return {
    name: over.id,
    fileName: `${over.id}.vpk`,
    path: `/addons/${over.id}.vpk`,
    metaKey: `${over.id}.vpk`,
    enabled: false,
    priority: 1,
    size: 0,
    installedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

/** A sound-swap mod whose hero comes from the recorded reforge request. */
function soundSwapMod(over: Partial<Mod> & { id: string }, heroName: string): Mod {
  return mod({
    soundSwap: {
      heroCodename: 'hero',
      event: 'Hero.Ability',
      audioFileName: 'a.mp3',
      loop: 'auto',
      pool: 'all',
      reforge: { heroName, audioPath: 'a.mp3', assignments: [] },
    },
    ...over,
  });
}

describe('heroSoundShuffleRows', () => {
  it('excludes a mod with no soundSwap record', () => {
    const plain = mod({ id: 'plain', lockerHero: 'Vindicta' });
    expect(heroSoundShuffleRows([plain], 'Vindicta')).toEqual([]);
  });

  it('excludes a sound-swap mod scoped to another hero', () => {
    const seven = soundSwapMod({ id: 'seven' }, 'Seven');
    expect(heroSoundShuffleRows([seven], 'Vindicta')).toEqual([]);
  });

  it('matches a hero recorded as an alias through canonicalHeroName', () => {
    // "The Doorman" is the deadlock-api roster name; "Doorman" is the canonical
    // client label. The two must resolve to the same pool.
    const doorman = soundSwapMod({ id: 'doorman' }, 'The Doorman');
    const rows = heroSoundShuffleRows([doorman], 'Doorman');
    expect(rows.map((row) => row.name)).toEqual(['doorman']);
  });

  it('prefers lockerHero over the reforge record hero name', () => {
    // changeList.ts resolves a sound row the same way: lockerHero first, then
    // soundSwap.reforge.heroName. A mod tagged by hand must not be re-scoped
    // by a stale reforge record.
    const conflicting = soundSwapMod({ id: 'tagged', lockerHero: 'Vindicta' }, 'Seven');
    expect(heroSoundShuffleRows([conflicting], 'Vindicta').map((row) => row.name)).toEqual(['tagged']);
    expect(heroSoundShuffleRows([conflicting], 'Seven')).toEqual([]);
  });

  it('uses shuffleSoundKey(mod) exactly as the pool key', () => {
    const mods = [
      soundSwapMod({ id: 'a', gameBananaId: 42 }, 'Vindicta'),
      soundSwapMod({ id: 'b', sha256: 'cafe' }, 'Vindicta'),
    ];
    const rows = heroSoundShuffleRows(mods, 'Vindicta');
    expect(rows.map((row) => row.key)).toEqual(mods.map(shuffleSoundKey));
  });

  it('returns an empty list for an empty mod list, and for a blank hero name', () => {
    expect(heroSoundShuffleRows([], 'Vindicta')).toEqual([]);
    expect(heroSoundShuffleRows([soundSwapMod({ id: 'a' }, 'Vindicta')], '')).toEqual([]);
  });

  it('orders rows stably by mod name, then mod id', () => {
    const mods = [
      soundSwapMod({ id: 'b', name: 'Same name' }, 'Vindicta'),
      soundSwapMod({ id: 'a', name: 'Same name' }, 'Vindicta'),
      soundSwapMod({ id: 'c', name: 'Alpha' }, 'Vindicta'),
    ];
    expect(heroSoundShuffleRows(mods, 'Vindicta').map((row) => row.mod.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('soundLockerHref', () => {
  it('percent-encodes a hero display name into the hero-scoped path', () => {
    expect(soundLockerHref('Grey Talon')).toBe('/locker/sounds?hero=Grey%20Talon');
    expect(soundLockerHref('Mo & Krill')).toBe('/locker/sounds?hero=Mo%20%26%20Krill');
  });

  it('encodes a plus sign rather than letting it read as a space', () => {
    expect(soundLockerHref('C++ Hero')).toBe('/locker/sounds?hero=C%2B%2B%20Hero');
  });

  it('falls back to the global sounds path for null or blank names', () => {
    expect(soundLockerHref(null)).toBe('/locker/sounds/global');
    expect(soundLockerHref('')).toBe('/locker/sounds/global');
    expect(soundLockerHref('   ')).toBe('/locker/sounds/global');
  });
});
