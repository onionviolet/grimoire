/**
 * Which section of the Global Locker drill-in is showing.
 *
 * This was briefly a top-level Looks/Sounds mode over two hero grids. Per-hero
 * sounds now live on the hero's own Locker page as a tab, so the only thing
 * still selected by `?mode=` is the Global drill-in's Visuals/Sounds section.
 * The name is kept because the query parameter is already in shipped links.
 */
export type LockerMode = 'looks' | 'sounds';

export function lockerModeFromSearch(search: string): LockerMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'looks' || mode === 'sounds' ? mode : null;
}

/** Where a shipped `/locker/sounds*` link should end up now that per-hero
 *  sounds are a tab on the hero page. `hero` is the display name still needing
 *  resolution to a category id; null means the path is not a legacy one. */
export type LegacySoundTarget =
  | { kind: 'global' }
  | { kind: 'hero'; hero: string }
  | { kind: 'locker' }
  | null;

export function legacySoundTarget(pathname: string): LegacySoundTarget {
  if (!/^\/locker\/sounds(?:\/|$)/.test(pathname)) return null;
  if (/^\/locker\/sounds\/global\/?$/.test(pathname)) return { kind: 'global' };
  const hero = /^\/locker\/sounds\/hero\/(.+?)\/?$/.exec(pathname);
  if (hero) return { kind: 'hero', hero: decodeURIComponent(hero[1]) };
  return { kind: 'locker' };
}
