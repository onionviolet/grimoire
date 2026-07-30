/**
 * Hero identity at the panorama portrait boundary.
 *
 * Roster, sound, and panorama namespaces are deliberately not interchangeable.
 * Keep every portrait alias here so Foundry catalog filtering and Locker source
 * discovery ask the same question: which panorama folders can represent this
 * displayed hero?
 */
export interface PortraitHeroIdentity {
  /** Canonical display label used by the product, when known. */
  displayName: string;
  /** Current panorama class_name, followed by legacy panorama folders. */
  panoramaCodenames: readonly string[];
}

export interface PortraitHeroDefinition extends PortraitHeroIdentity {
  /** Roster codenames accepted in addition to the display label. */
  rosterCodenames?: readonly string[];
  displayAliases?: readonly string[];
}

// `class_name` values from the hero roster. The aliases are old panorama
// folders still used by community packs, not sound codenames.
/**
 * The single portrait-namespace mapping. Keep this exported so lookup-path
 * tests can exercise every alias rather than preserving one hand-picked hero.
 */
export const portraitHeroDefinitions: readonly PortraitHeroDefinition[] = [
  { displayName: 'Abrams', rosterCodenames: ['abrams'], panoramaCodenames: ['atlas', 'bull'] },
  { displayName: 'Apollo', panoramaCodenames: ['fencer'] },
  { displayName: 'Bebop', panoramaCodenames: ['bebop'] },
  { displayName: 'Billy', panoramaCodenames: ['punkgoat'] },
  { displayName: 'Calico', panoramaCodenames: ['nano'] },
  { displayName: 'Celeste', panoramaCodenames: ['unicorn'] },
  { displayName: 'Doorman', displayAliases: ['The Doorman'], rosterCodenames: ['doorman'], panoramaCodenames: ['doorman'] },
  { displayName: 'Drifter', panoramaCodenames: ['drifter'] },
  { displayName: 'Dynamo', panoramaCodenames: ['dynamo', 'sumo'] },
  { displayName: 'Graves', panoramaCodenames: ['necro'] },
  { displayName: 'Grey Talon', rosterCodenames: ['grey_talon'], panoramaCodenames: ['orion', 'archer'] },
  { displayName: 'Haze', panoramaCodenames: ['haze'] },
  { displayName: 'Holliday', panoramaCodenames: ['astro'] },
  { displayName: 'Infernus', panoramaCodenames: ['inferno'] },
  { displayName: 'Ivy', panoramaCodenames: ['tengu'] },
  { displayName: 'Kelvin', panoramaCodenames: ['kelvin'] },
  { displayName: 'Lady Geist', rosterCodenames: ['lady_geist'], panoramaCodenames: ['ghost', 'spectre'] },
  { displayName: 'Lash', panoramaCodenames: ['lash'] },
  { displayName: 'McGinnis', rosterCodenames: ['mcginnis'], panoramaCodenames: ['forge', 'engineer'] },
  { displayName: 'Mina', panoramaCodenames: ['vampirebat'] },
  { displayName: 'Mirage', panoramaCodenames: ['mirage'] },
  { displayName: 'Mo & Krill', rosterCodenames: ['mo_and_krill'], panoramaCodenames: ['krill', 'digger'] },
  { displayName: 'Paige', panoramaCodenames: ['bookworm'] },
  { displayName: 'Paradox', panoramaCodenames: ['chrono'] },
  { displayName: 'Pocket', panoramaCodenames: ['synth'] },
  { displayName: 'Rem', panoramaCodenames: ['familiar'] },
  { displayName: 'Seven', panoramaCodenames: ['gigawatt'] },
  { displayName: 'Shiv', panoramaCodenames: ['shiv'] },
  { displayName: 'Silver', panoramaCodenames: ['werewolf'] },
  { displayName: 'Sinclair', panoramaCodenames: ['magician'] },
  { displayName: 'Venator', panoramaCodenames: ['priest'] },
  { displayName: 'Victor', panoramaCodenames: ['frank'] },
  { displayName: 'Vindicta', panoramaCodenames: ['hornet'] },
  { displayName: 'Viscous', panoramaCodenames: ['viscous'] },
  { displayName: 'Vyper', panoramaCodenames: ['viper'] },
  { displayName: 'Warden', panoramaCodenames: ['warden'] },
  { displayName: 'Wraith', panoramaCodenames: ['wraith'] },
  { displayName: 'Yamato', panoramaCodenames: ['yamato'] },
];

function key(value: string): string {
  return value.trim().toLocaleLowerCase();
}

const byKnownName = new Map<string, PortraitHeroDefinition>();
for (const hero of portraitHeroDefinitions) {
  for (const name of [hero.displayName, ...(hero.displayAliases ?? []), ...(hero.rosterCodenames ?? [])]) {
    byKnownName.set(key(name), hero);
  }
}

// Reverse direction: a catalog codename back to the hero it belongs to. Asset
// catalogs are keyed on engine codenames (`archer`, `punkgoat`), so any surface
// that shows one to a user needs this or it prints a codename as a hero name.
const byAnyCodename = new Map<string, PortraitHeroDefinition>();
for (const hero of portraitHeroDefinitions) {
  for (const code of [...(hero.rosterCodenames ?? []), ...hero.panoramaCodenames]) {
    byAnyCodename.set(key(code), hero);
  }
}

/** Resolve a display name or roster codename to every portrait folder it owns. */
export function resolvePortraitHero(identity: string | null | undefined): PortraitHeroIdentity | null {
  if (!identity) return null;
  const hero = byKnownName.get(key(identity));
  return hero ? { displayName: hero.displayName, panoramaCodenames: hero.panoramaCodenames } : null;
}

/** True when a catalog's panorama hero field belongs to this roster/display hero. */
export function matchesPortraitHero(
  identity: string | null | undefined,
  panoramaCodename: string | null | undefined,
): boolean {
  const hero = resolvePortraitHero(identity);
  return Boolean(hero && panoramaCodename && hero.panoramaCodenames.includes(key(panoramaCodename)));
}

/** Compatibility helper for Locker's existing source discovery callers. */
export function portraitCodenamesForHero(heroName: string): string[] {
  return [...(resolvePortraitHero(heroName)?.panoramaCodenames ?? [])];
}

/**
 * Display name for an engine codename (`archer` -> `Grey Talon`), or null when
 * the codename belongs to no known hero. Null is a real answer: unreleased and
 * internal codenames (`genericperson`, `duo`) exist in shipped catalogs and
 * should be presented as unresolved, not as heroes.
 */
export function displayNameForHeroCodename(codename: string | null | undefined): string | null {
  if (!codename) return null;
  return byAnyCodename.get(key(codename))?.displayName ?? null;
}

/**
 * Every codename that can carry this hero's assets, including the identity that
 * was passed in. Use it to scope a catalog to one hero without losing the
 * aliases a subsystem happens to use.
 */
export function heroCodenameScope(identity: string | null | undefined): Set<string> {
  const scope = new Set<string>();
  if (!identity) return scope;
  scope.add(key(identity));
  const hero = byKnownName.get(key(identity)) ?? byAnyCodename.get(key(identity));
  if (hero) {
    for (const code of [...(hero.rosterCodenames ?? []), ...hero.panoramaCodenames]) {
      scope.add(key(code));
    }
  }
  return scope;
}

/** Compatibility helper for callers that only need the current panorama name. */
export function portraitCodenameForHero(heroName: string): string | undefined {
  return resolvePortraitHero(heroName)?.panoramaCodenames[0];
}
