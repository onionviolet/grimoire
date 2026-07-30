import type { HeroSelectOption } from '../common/HeroSelect';
import { displayNameForHeroCodename } from '../../lib/heroPortraitIdentity';
import { HERO_SCOPE_PREFIX } from './assetSearch';

interface HeroFilterLabels {
  /** "All heroes". */
  all: string;
  /** "{{hero}} & shared", already interpolated by the caller. */
  scoped?: (heroName: string) => string;
  /** Said under a codename that resolves to no hero: "Unreleased or internal". */
  unresolved: string;
}

interface HeroFilterParams {
  /** Codenames the loaded catalog actually contains. */
  codenames: Iterable<string>;
  /** Roster codename -> display name, resolved by the Foundry shell. */
  heroNames: Map<string, string>;
  /** Roster codename of the hero this browse is embedded in, when it is. */
  scopedHero?: string;
  /** Display label for `scopedHero`, when the caller already knows it. */
  scopedHeroName?: string;
  labels: HeroFilterLabels;
}

/**
 * Options for the catalog's hero filter.
 *
 * Two names exist for every hero and both are needed. The one people know
 * (`Grey Talon`) is the label; the one the game files use (`archer`) is the
 * hint underneath, because it is what appears in asset paths and in what
 * modders say to each other. Showing only the codename made a dropdown read as
 * a list of nonsense next to real hero names; showing only the display name
 * would hide the token you need to search paths by.
 *
 * A codename that resolves to no hero (`genericperson`, `duo`) is not given a
 * hero name it does not have. It keeps the codename as its label and says it is
 * unreleased or internal, sorted below the real roster.
 */
/**
 * The codename, unless the display name already contains it. Roughly half the
 * roster is its own codename (`Bebop`/`bebop`), and some names merely wrap one
 * (`The Doorman`/`doorman`, `Mo & Krill`/`krill`). Printing those twice is noise
 * on every row, which is what would train people to stop reading the line.
 */
function hintFor(displayName: string, codename: string): string | undefined {
  const flat = displayName.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  return flat.includes(codename.toLocaleLowerCase()) ? undefined : codename;
}

export function buildHeroFilterOptions({
  codenames,
  heroNames,
  scopedHero,
  scopedHeroName,
  labels,
}: HeroFilterParams): HeroSelectOption[] {
  const resolved: HeroSelectOption[] = [];
  const unresolved: HeroSelectOption[] = [];

  for (const code of new Set(codenames)) {
    const name = heroNames.get(code) ?? displayNameForHeroCodename(code);
    if (name) {
      resolved.push({ value: code, label: name, hint: hintFor(name, code), heroName: name });
    } else {
      unresolved.push({ value: code, label: code, hint: labels.unresolved, muted: true });
    }
  }

  const byLabel = (a: HeroSelectOption, b: HeroSelectOption) => a.label.localeCompare(b.label);
  resolved.sort(byLabel);
  unresolved.sort(byLabel);

  const head: HeroSelectOption[] = [];
  if (scopedHero && labels.scoped) {
    const name = scopedHeroName ?? displayNameForHeroCodename(scopedHero) ?? scopedHero;
    head.push({
      value: `${HERO_SCOPE_PREFIX}${scopedHero}`,
      label: labels.scoped(name),
      hint: hintFor(name, scopedHero),
      heroName: name,
    });
  }
  head.push({ value: 'all', label: labels.all });

  return [...head, ...resolved, ...unresolved];
}
