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

/** The sections of a hero drill-in, in rail order. */
export const HERO_SECTIONS = ['skins', 'sounds', 'cards', 'effects'] as const;
export type HeroSection = (typeof HERO_SECTIONS)[number];

/**
 * Which Locker surface a URL names, and which of its sections is selected.
 *
 * Route shape is the part of this page that keeps breaking (a section that
 * could not be returned to, a deep link that dropped its section, a legacy
 * path that lost its query), and it is also the part that is pure. Resolving
 * it in one place makes those regressions cheap to catch in a test instead of
 * expensive to catch by hand.
 *
 * `section` is already defaulted, so a caller never re-decides what a bare
 * `/locker/global` or `/locker/hero/33306` opens on.
 */
export type LockerRoute =
  | { drillIn: 'grid'; section: null }
  | { drillIn: 'global'; section: LockerMode }
  | { drillIn: 'hero'; heroId: string; section: HeroSection }
  /** A shipped link that no longer names a real surface. `legacy` says where
   *  it has to be rewritten to; a hero one still needs the roster to turn a
   *  display name into the id the route uses. */
  | { drillIn: 'legacy'; section: null; legacy: NonNullable<LegacySoundTarget> };

export function resolveLockerRoute(pathname: string, search: string): LockerRoute {
  const legacy = legacySoundTarget(pathname);
  if (legacy) {
    // `/locker/sounds?hero=<display name>` is how Foundry's My changes panel
    // links a hero's sounds. The path alone reads as the old landing page, so
    // without the query it would rewrite to the grid and silently drop the
    // hero the user asked for.
    const hero = legacy.kind === 'locker' ? new URLSearchParams(search).get('hero') : null;
    return { drillIn: 'legacy', section: null, legacy: hero ? { kind: 'hero', hero } : legacy };
  }

  if (/^\/locker\/global\/?$/.test(pathname)) {
    return { drillIn: 'global', section: lockerModeFromSearch(search) ?? 'looks' };
  }

  const hero = /^\/locker\/hero\/([^/]+)\/?$/.exec(pathname);
  if (hero) {
    const wanted = new URLSearchParams(search).get('section');
    const section = HERO_SECTIONS.find((id) => id === wanted) ?? 'skins';
    return { drillIn: 'hero', heroId: decodeURIComponent(hero[1]), section };
  }

  return { drillIn: 'grid', section: null };
}
