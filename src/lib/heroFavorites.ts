import { useCallback, useEffect, useState } from 'react';
import { canonicalHeroName } from './lockerUtils';

/**
 * Favorited heroes, shared by every hero grid.
 *
 * The Locker stored favorites as GameBanana category ids, which only the Locker
 * can resolve: Foundry knows heroes by name and codename and has no category
 * fetch. Rather than give Foundry a parallel store (two stars for one hero,
 * silently disagreeing), the shared store is keyed by canonical hero name, which
 * both surfaces already have. The old id list is migrated the first time a
 * roster is available to translate it.
 *
 * Persistence is localStorage, unchanged in spirit from the Locker's original.
 * The custom event is what makes it genuinely shared rather than merely
 * co-located: starring in one grid updates the other without a reload.
 */

const FAVORITE_HERO_NAMES_KEY = 'lockerFavoriteHeroes';

/** The Locker's original numeric-id list, migrated once and then left alone so
 *  a downgrade still finds the user's favorites where it expects them. */
export const LEGACY_FAVORITE_IDS_KEY = 'lockerFavorites';

const CHANGE_EVENT = 'grimoire:hero-favorites';

function read(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITE_HERO_NAMES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name): name is string => typeof name === 'string');
  } catch {
    return [];
  }
}

function write(names: readonly string[]): void {
  try {
    localStorage.setItem(FAVORITE_HERO_NAMES_KEY, JSON.stringify([...names]));
  } catch {
    /* a full or blocked localStorage must not break the grid */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Whether the name store has ever been written. Distinguishes "no favorites"
 *  from "not migrated yet", which the migration below depends on. */
function hasNameStore(): boolean {
  try {
    return localStorage.getItem(FAVORITE_HERO_NAMES_KEY) !== null;
  } catch {
    return false;
  }
}

function readLegacyIds(): number[] {
  try {
    const stored = localStorage.getItem(LEGACY_FAVORITE_IDS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === 'number');
  } catch {
    return [];
  }
}

/**
 * Translate the legacy id list into names, once, using a roster that can map
 * them. Only the Locker can supply that roster, so this is a no-op everywhere
 * else and is safe to call on every render pass.
 *
 * Deliberately keyed on "has the name store ever been written", not on "is it
 * empty": a user who un-favorited everything must not have the old ids restored
 * on the next load.
 */
export function migrateLegacyHeroFavorites(
  roster: ReadonlyArray<{ id: number; name: string }>
): void {
  if (hasNameStore() || roster.length === 0) return;
  const ids = new Set(readLegacyIds());
  if (ids.size === 0) return;
  const names = roster
    .filter((hero) => ids.has(hero.id))
    .map((hero) => canonicalHeroName(hero.name));
  write([...new Set(names)]);
}

/**
 * The shared favorites set, live across surfaces.
 *
 * Values are canonical hero names, so callers compare with
 * `canonicalHeroName(...)` rather than a raw display name: an alias recorded by
 * one surface has to match the roster name another surface used.
 */
export function useHeroFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  useEffect(() => {
    const refresh = () => setFavorites(read());
    window.addEventListener(CHANGE_EVENT, refresh);
    // `storage` fires for other windows/tabs; the custom event covers this one.
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const isFavorite = useCallback(
    (heroName: string) => favorites.includes(canonicalHeroName(heroName)),
    [favorites]
  );

  const toggleFavorite = useCallback((heroName: string) => {
    const canonical = canonicalHeroName(heroName);
    const current = read();
    write(
      current.includes(canonical)
        ? current.filter((name) => name !== canonical)
        : [...current, canonical]
    );
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
