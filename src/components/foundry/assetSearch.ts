import type { TextureGridItem } from '../../types/foundry';
import { displayNameForHeroCodename, heroCodenameScope } from '../../lib/heroPortraitIdentity';

/**
 * Hero-filter value meaning "this hero, plus every asset the catalog could not
 * attribute to anyone". Hero attribution comes from the asset path alone and is
 * sparse (most ability icons carry no hero at all), so a strict per-codename
 * filter inside a hero workshop shows an empty grid. `scope:` is the honest
 * filter for an embedded, hero-scoped browse.
 */
export const HERO_SCOPE_PREFIX = 'scope:';

/** The hero identity a `scope:` filter value refers to, or null for any other value. */
export function heroScopeIdentity(heroFilter: string): string | null {
  return heroFilter.startsWith(HERO_SCOPE_PREFIX) ? heroFilter.slice(HERO_SCOPE_PREFIX.length) : null;
}

/**
 * Who an asset belongs to, when the catalog's own attribution is missing.
 *
 * The catalog sets `hero` only when a path segment is a hero folder, which most
 * ability icons are not: they live flat in `panorama/images/hud/abilities/` and
 * encode the hero in the filename (`bull_charge_psd.vtex_c`). Reading that
 * leading token against the alias table is what makes a hero scope mean
 * anything here. A token that matches no known hero (`ability_activate`,
 * `melee_damage`) stays unattributed, which is the correct answer: those really
 * are shared icons.
 */
export function attributedHeroCodename(item: Pick<TextureGridItem, 'path' | 'hero'>): string | null {
  if (item.hero) return item.hero.toLowerCase();
  const file = item.path.split('/').pop() ?? '';
  const token = file.split(/[_.]/)[0]?.toLowerCase() ?? '';
  return token && displayNameForHeroCodename(token) ? token : null;
}

/** The bounded thumbnail catalog searches friendly labels and exact game paths. */
export function filterTextureGridItems(items: TextureGridItem[], search: string, heroFilter: string) {
  const q = search.trim().toLowerCase();
  const scopeIdentity = heroScopeIdentity(heroFilter);
  const scope = scopeIdentity ? heroCodenameScope(scopeIdentity) : null;
  return items.filter((it) => {
    if (scope) {
      // Unattributed assets stay visible: they are shared icons this hero uses.
      const owner = attributedHeroCodename(it);
      if (owner && !scope.has(owner)) return false;
    } else if (heroFilter !== 'all' && it.hero !== heroFilter) {
      return false;
    }
    if (!q) return true;
    return it.label.toLowerCase().includes(q) || it.path.toLowerCase().includes(q);
  });
}
