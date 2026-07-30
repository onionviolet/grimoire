/**
 * Hero identity at the panorama portrait boundary.
 *
 * The alias data itself now lives in one place: [heroIdentity.ts](heroIdentity.ts),
 * which holds every namespace (display, roster, panorama, sound, model) on one
 * row per hero. This file is the panorama-namespace view of it, kept as the
 * import surface Foundry catalog filtering and Locker source discovery already
 * use so both keep asking the same question: which panorama folders can
 * represent this displayed hero?
 *
 * Nothing here holds a table any more. Add a hero, an alias, or a codename to
 * `heroIdentity.ts`; if a change only makes sense to portraits, it still belongs
 * there, on the row, next to the names it has to stay consistent with.
 */
import {
    classifyHeroCodename,
    heroCodenameScope,
    heroForPanoramaCodename,
    panoramaCodenamesForHero,
    resolveHeroByName,
} from './heroIdentity';

export { classifyHeroCodename, heroCodenameScope };

export interface PortraitHeroIdentity {
    /** Canonical display label used by the product, when known. */
    displayName: string;
    /** Current panorama class_name, followed by legacy panorama folders. */
    panoramaCodenames: readonly string[];
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

/** Resolve a display name or roster codename to every portrait folder it owns. */
export function resolvePortraitHero(identity: string | null | undefined): PortraitHeroIdentity | null {
    const hero = resolveHeroByName(identity);
    return hero ? { displayName: hero.displayName, panoramaCodenames: hero.panoramaCodenames } : null;
}

/** True when a catalog's panorama hero field belongs to this roster/display hero. */
export function matchesPortraitHero(
    identity: string | null | undefined,
    panoramaCodename: string | null | undefined,
): boolean {
    const hero = resolvePortraitHero(identity);
    return Boolean(hero && panoramaCodename && hero.panoramaCodenames.includes(normalize(panoramaCodename)));
}

/** Compatibility helper for Locker's existing source discovery callers. */
export function portraitCodenamesForHero(heroName: string): string[] {
    return panoramaCodenamesForHero(heroName);
}

/**
 * Display name for a panorama or roster codename (`archer` -> `Grey Talon`), or
 * null when the codename belongs to no hero in that namespace. Null is a real
 * answer: unreleased and internal codenames (`genericperson`, `duo`) exist in
 * shipped catalogs and should be presented as unresolved, not as heroes.
 * `classifyHeroCodename` says *which* kind of unresolved it is.
 */
export function displayNameForHeroCodename(codename: string | null | undefined): string | null {
    return heroForPanoramaCodename(codename)?.displayName ?? null;
}

/** Compatibility helper for callers that only need the current panorama name. */
export function portraitCodenameForHero(heroName: string): string | undefined {
    return panoramaCodenamesForHero(heroName)[0];
}
