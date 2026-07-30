import { matchesPortraitHero } from '../../lib/heroPortraitIdentity';

/**
 * Restrict portrait families to a roster/display hero through the portrait
 * identity map. Catalog entries use panorama codenames, so direct equality
 * would drop every hero whose roster and panorama names differ.
 */
export function portraitFamiliesForHero<T extends { hero: string | null }>(
  families: readonly T[],
  identity: string,
): T[] {
  return families.filter((family) => matchesPortraitHero(identity, family.hero));
}
