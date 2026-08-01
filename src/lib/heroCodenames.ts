/**
 * The hero codename join.
 *
 * A hero does not have "a codename". Deadlock files the same hero under
 * different names in different namespaces, and joining them wrongly does not
 * throw: it silently resolves to another hero's asset. This table is the one
 * place that join happens, one row per hero, with an explicit `null` wherever a
 * namespace is genuinely unknown rather than a plausible guess.
 *
 * #15 called this three namespaces. Reading the tree it is **four**, and the
 * fourth is the one most likely to be missed, because "the model codename" is
 * two different things:
 *
 * | Column | Where it is used | Example of it going wrong |
 * | --- | --- | --- |
 * | `panorama` | `panorama/images/heroes/<x>_*`, and the API `class_name` | Abrams is `atlas`, not `abrams` |
 * | `sound` | `sounds/abilities/<x>/aN_*`, keys `HERO_ABILITY_SLOTS` | Mo & Krill is `mokrill`, not `krill` |
 * | `particle` | `particles/abilities/<x>/`, and the `recolor-hero` recipe key | Pocket is `pocket`, not `synth` |
 * | `bodyModel` | the `<x>.vmdl_c` basename under `models/heroes*` | Seven is `gigawatt_prisoner`, not `gigawatt` |
 *
 * Six heroes diverge across those four columns, and **Mo & Krill uses three
 * distinct names for four namespaces** (`krill` / `mokrill` / `digger`). Abrams
 * uses three as well. Every other hero happens to agree, which is precisely why
 * a join written from one hero's example passes review and then plays Grey
 * Talon's particles for McGinnis.
 *
 * `background` is the hero-select `_bg` art namespace. It is `null` for
 * everyone but Paige (`patience`) because that mapping arrives with upstream
 * `f91b9a1`'s `BACKGROUND_CODENAME_BY_HERO`, which is not in this tree. Null
 * here means "not established", and a caller must treat it as "do not guess",
 * not as "same as panorama": Paige is the counterexample proving those differ.
 *
 * Five rows have a `sound` codename and no `panorama`, `particle` or
 * `bodyModel` (Fathom, Kali, Tokamak, Trapper, Wrecker). They ship sound assets
 * for heroes that are not on the selectable roster, so their sound mods must
 * still classify while nothing else about them may be assumed. That asymmetry
 * is the reason the columns are nullable per column rather than per row.
 *
 * Pure data with no imports on purpose, so both processes can read it: the main
 * process derives its recolor and pose-model tables from here, and the renderer
 * can resolve a hero without an IPC round trip.
 *
 * **Which columns this file owns.** `particle`, `bodyModel` and `background`
 * are defined here and nowhere else: `heroColors.ts`'s recolor table and
 * `heroPoseModels.ts`'s model overrides were folded into these columns and now
 * read them. `panorama` and `sound` are still owned by
 * `heroPortraitIdentity.ts` and `heroSoundCodenames.ts`, which carry more than
 * this table needs (legacy panorama aliases, the sound-mod classification
 * vocabulary), so they are repeated here as join keys rather than moved.
 * `heroCodenames.test.ts` checks both of those in both directions, so a hero
 * added to one side and not the other fails CI instead of resolving to the
 * wrong asset at runtime.
 */

export interface HeroCodenames {
  /** Canonical product display name. The join key everything else hangs off. */
  displayName: string;
  /** `panorama/images/heroes/<x>_*` and the API `class_name`. Legacy panorama
   *  aliases are NOT here; they live in `heroPortraitIdentity.ts`, which owns
   *  the "which folders can represent this hero" question. */
  panorama: string | null;
  /** `sounds/abilities/<x>/`. The key of `HERO_ABILITY_SLOTS`. */
  sound: string | null;
  /** `particles/abilities/<x>/`, and the pinned `recolor-hero` recipe key.
   *  Null means no recipe is pinned, so recolor is not offered. */
  particle: string | null;
  /** The `<x>.vmdl_c` basename under `models/heroes*`. */
  bodyModel: string | null;
  /** Hero-select `_bg` art. Null means not established: see the note above. */
  background: string | null;
}

/** One row per hero, sorted by display name. */
export const HERO_CODENAMES: readonly HeroCodenames[] = [
  { displayName: 'Abrams', panorama: 'atlas', sound: 'abrams', particle: 'abrams', bodyModel: 'atlas_detective', background: null },
  { displayName: 'Apollo', panorama: 'fencer', sound: 'fencer', particle: 'fencer', bodyModel: 'fencer', background: null },
  { displayName: 'Bebop', panorama: 'bebop', sound: 'bebop', particle: 'bebop', bodyModel: 'bebop', background: null },
  { displayName: 'Billy', panorama: 'punkgoat', sound: 'punkgoat', particle: 'punkgoat', bodyModel: 'punkgoat', background: null },
  { displayName: 'Calico', panorama: 'nano', sound: 'nano', particle: 'nano', bodyModel: 'nano', background: null },
  { displayName: 'Celeste', panorama: 'unicorn', sound: 'unicorn', particle: 'unicorn', bodyModel: 'unicorn', background: null },
  { displayName: 'Doorman', panorama: 'doorman', sound: 'doorman', particle: 'doorman', bodyModel: 'doorman', background: null },
  { displayName: 'Drifter', panorama: 'drifter', sound: 'drifter', particle: 'drifter', bodyModel: 'drifter', background: null },
  { displayName: 'Dynamo', panorama: 'dynamo', sound: 'dynamo', particle: 'dynamo', bodyModel: 'dynamo', background: null },
  { displayName: 'Fathom', panorama: null, sound: 'fathom', particle: null, bodyModel: null, background: null },
  { displayName: 'Graves', panorama: 'necro', sound: 'necro', particle: 'necro', bodyModel: 'necro', background: null },
  { displayName: 'Grey Talon', panorama: 'orion', sound: 'orion', particle: 'archer', bodyModel: 'archer', background: null },
  { displayName: 'Haze', panorama: 'haze', sound: 'haze', particle: 'haze', bodyModel: 'haze', background: null },
  { displayName: 'Holliday', panorama: 'astro', sound: 'astro', particle: 'astro', bodyModel: 'astro', background: null },
  { displayName: 'Infernus', panorama: 'inferno', sound: 'inferno', particle: 'inferno', bodyModel: 'inferno', background: null },
  { displayName: 'Ivy', panorama: 'tengu', sound: 'tengu', particle: 'tengu', bodyModel: 'tengu', background: null },
  { displayName: 'Kali', panorama: null, sound: 'kali', particle: null, bodyModel: null, background: null },
  { displayName: 'Kelvin', panorama: 'kelvin', sound: 'kelvin', particle: 'kelvin', bodyModel: 'kelvin', background: null },
  { displayName: 'Lady Geist', panorama: 'ghost', sound: 'ghost', particle: 'ghost', bodyModel: 'ghost', background: null },
  { displayName: 'Lash', panorama: 'lash', sound: 'lash', particle: 'lash', bodyModel: 'lash', background: null },
  { displayName: 'McGinnis', panorama: 'forge', sound: 'forge', particle: 'mcginnis', bodyModel: 'engineer', background: null },
  { displayName: 'Mina', panorama: 'vampirebat', sound: 'vampirebat', particle: 'vampirebat', bodyModel: 'vampirebat', background: null },
  { displayName: 'Mirage', panorama: 'mirage', sound: 'mirage', particle: 'mirage', bodyModel: 'mirage', background: null },
  { displayName: 'Mo & Krill', panorama: 'krill', sound: 'mokrill', particle: 'digger', bodyModel: 'digger', background: null },
  { displayName: 'Paige', panorama: 'bookworm', sound: 'bookworm', particle: 'bookworm', bodyModel: 'bookworm', background: 'patience' },
  { displayName: 'Paradox', panorama: 'chrono', sound: 'chrono', particle: 'chrono', bodyModel: 'chrono', background: null },
  { displayName: 'Pocket', panorama: 'synth', sound: 'synth', particle: 'pocket', bodyModel: 'synth', background: null },
  { displayName: 'Rem', panorama: 'familiar', sound: 'familiar', particle: 'familiar', bodyModel: 'familiar', background: null },
  { displayName: 'Seven', panorama: 'gigawatt', sound: 'gigawatt', particle: 'gigawatt', bodyModel: 'gigawatt_prisoner', background: null },
  { displayName: 'Shiv', panorama: 'shiv', sound: 'shiv', particle: 'shiv', bodyModel: 'shiv', background: null },
  { displayName: 'Silver', panorama: 'werewolf', sound: 'werewolf', particle: 'werewolf', bodyModel: 'werewolf', background: null },
  { displayName: 'Sinclair', panorama: 'magician', sound: 'magician', particle: 'magician', bodyModel: 'magician', background: null },
  { displayName: 'Tokamak', panorama: null, sound: 'tokamak', particle: null, bodyModel: null, background: null },
  { displayName: 'Trapper', panorama: null, sound: 'trapper', particle: null, bodyModel: null, background: null },
  { displayName: 'Venator', panorama: 'priest', sound: 'priest', particle: 'priest', bodyModel: 'priest', background: null },
  { displayName: 'Victor', panorama: 'frank', sound: 'frank', particle: 'frank', bodyModel: 'frank', background: null },
  { displayName: 'Vindicta', panorama: 'hornet', sound: 'hornet', particle: 'hornet', bodyModel: 'hornet', background: null },
  { displayName: 'Viscous', panorama: 'viscous', sound: 'viscous', particle: 'viscous', bodyModel: 'viscous', background: null },
  { displayName: 'Vyper', panorama: 'viper', sound: 'viper', particle: 'viper', bodyModel: 'viper', background: null },
  { displayName: 'Warden', panorama: 'warden', sound: 'warden', particle: 'warden', bodyModel: 'warden', background: null },
  { displayName: 'Wraith', panorama: 'wraith', sound: 'wraith', particle: 'wraith', bodyModel: 'wraith', background: null },
  { displayName: 'Wrecker', panorama: null, sound: 'wrecker', particle: null, bodyModel: null, background: null },
  { displayName: 'Yamato', panorama: 'yamato', sound: 'yamato', particle: 'yamato', bodyModel: 'yamato', background: null },
];

function key(value: string): string {
  return value.trim().toLocaleLowerCase();
}

const byDisplayName = new Map<string, HeroCodenames>();
for (const hero of HERO_CODENAMES) byDisplayName.set(key(hero.displayName), hero);

/**
 * Every codename in every namespace, back to its hero.
 *
 * Built with a collision check rather than last-write-wins: two heroes sharing
 * a codename in any namespace would make the reverse lookup silently pick one,
 * which is the failure this module exists to prevent. There are no collisions
 * today, and the guard is what keeps that true as rows are added.
 */
const byAnyCodename = new Map<string, HeroCodenames>();
export const HERO_CODENAME_COLLISIONS: readonly string[] = (() => {
  const collisions: string[] = [];
  for (const hero of HERO_CODENAMES) {
    for (const code of [hero.panorama, hero.sound, hero.particle, hero.bodyModel, hero.background]) {
      if (!code) continue;
      const existing = byAnyCodename.get(key(code));
      if (existing && existing !== hero) {
        collisions.push(code);
        continue;
      }
      byAnyCodename.set(key(code), hero);
    }
  }
  return collisions;
})();

/** Look a hero up by display name. Null when the name is not a known hero. */
export function heroCodenames(displayName: string | null | undefined): HeroCodenames | null {
  return displayName ? byDisplayName.get(key(displayName)) ?? null : null;
}

/**
 * Look a hero up by any codename in any namespace.
 *
 * Deliberately namespace-blind, because callers routinely hold a codename
 * without knowing which namespace produced it. When the namespace IS known,
 * prefer `translateHeroCodename`: a blind lookup resolves `digger` to
 * Mo & Krill even in a context where only sound codenames are valid, and
 * Mo & Krill's sound codename is `mokrill`.
 */
export function heroForAnyCodename(codename: string | null | undefined): HeroCodenames | null {
  return codename ? byAnyCodename.get(key(codename)) ?? null : null;
}

export type HeroCodenameNamespace = keyof Omit<HeroCodenames, 'displayName'>;

/**
 * Translate a codename from one namespace to another.
 *
 * This is the operation #15 calls "the join", and the one that must never
 * guess: it returns null when the source codename is unknown OR when the target
 * namespace is null for that hero. A caller that wants a fallback has to write
 * one, in view of the specific hero it is about to act on.
 */
export function translateHeroCodename(
  codename: string | null | undefined,
  from: HeroCodenameNamespace,
  to: HeroCodenameNamespace,
): string | null {
  if (!codename) return null;
  const wanted = key(codename);
  const hero = HERO_CODENAMES.find((candidate) => {
    const value = candidate[from];
    return value !== null && key(value) === wanted;
  });
  return hero ? hero[to] : null;
}

/** Display name -> `recolor-hero` recipe key, for heroes that have one. */
export function particleCodenameForHero(displayName: string): string | null {
  return heroCodenames(displayName)?.particle ?? null;
}

/**
 * Body-model basenames to try for a hero, most specific first.
 *
 * Only returns a name when it differs from the panorama codename: the caller
 * already falls back to the panorama codename (and its legacy aliases), so
 * repeating an identical name would only make discovery do the same work twice.
 */
export function divergentBodyModelForHero(displayName: string): string[] {
  const hero = heroCodenames(displayName);
  if (!hero?.bodyModel || hero.bodyModel === hero.panorama) return [];
  return [hero.bodyModel];
}
