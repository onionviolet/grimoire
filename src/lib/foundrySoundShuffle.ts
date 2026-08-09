import type { Mod } from '../types/mod';
import { canonicalHeroName } from './lockerUtils';
import { shuffleSoundKey } from './lockerRandomizer';

/** One installed sound-swap mod for a hero, plus its launch-shuffle pool key. */
export interface HeroSoundShuffleRow {
  mod: Mod;
  /** Pool identity: shuffleSoundKey(mod), the exact key the Locker writes. */
  key: string;
  /** The mod's display name, shown on the row. */
  name: string;
}

/** The hero a sound-swap mod is scoped to, resolved the same way changeList.ts
 *  resolves a sound row: the explicit lockerHero tag first, then the reforge
 *  record's hero name. */
function soundSwapHeroName(mod: Mod): string {
  return mod.lockerHero?.trim() || mod.soundSwap?.reforge?.heroName?.trim() || '';
}

/**
 * The hero's installed sound-swap mods and their shuffle keys. Only mods
 * carrying a soundSwap record scoped to that hero are selected; the hero name
 * is compared through canonicalHeroName so an alias recorded by one surface
 * still matches the roster name another surface used. Stable order: mod name,
 * then mod id, so equal-comparing rows never reorder between renders.
 */
export function heroSoundShuffleRows(
  mods: readonly Mod[],
  heroDisplayName: string,
): HeroSoundShuffleRow[] {
  const wanted = canonicalHeroName(heroDisplayName);
  if (!wanted) return [];
  return mods
    .filter(
      (mod) => mod.soundSwap && canonicalHeroName(soundSwapHeroName(mod)) === wanted,
    )
    .map((mod) => ({ mod, key: shuffleSoundKey(mod), name: mod.name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.mod.id.localeCompare(b.mod.id));
}

/**
 * The Locker's hero-scoped sounds path for a display name (percent-encoded),
 * or the global sounds path when the name is null or blank. The only place
 * either route string is written.
 */
export function soundLockerHref(heroDisplayName: string | null): string {
  const name = heroDisplayName?.trim();
  return name ? `/locker/sounds?hero=${encodeURIComponent(name)}` : '/locker/sounds/global';
}
