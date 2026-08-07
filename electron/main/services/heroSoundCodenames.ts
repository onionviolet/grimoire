/**
 * Deadlock hero "sound-path" codename -> display name dictionary.
 *
 * This is the sound-namespace view of the one hero identity table in
 * [heroIdentity.ts](../../../src/lib/heroIdentity.ts). It used to be a table of
 * its own, which is why it drifted: it omitted heroes whose only modded art is
 * panorama cards and it had no idea the panorama namespace disagreed with it
 * about Abrams (`abrams` here, `atlas` there) and Mo & Krill (`mokrill` vs
 * `krill`). One row per hero now carries both, so neither can move without the
 * other being looked at.
 *
 * Sound mods organize their payloads under
 * `sounds/abilities/<sound_codename>/aN_*` (and a handful under
 * `sounds/heroes/<sound_codename>/`), so this namespace keys off the sound-path
 * folder, not the API `class_name` (Abrams' `class_name` is `hero_atlas`).
 *
 * Heroes flagged as in-development or disabled in deadlock-api are
 * intentionally still resolved: their VPK assets ship today, and a sound mod
 * targeting them should still get tagged. UI filtering (hiding disabled heroes
 * from the Locker list) happens elsewhere.
 *
 * Source of truth for the names: docs/hero-sound-codenames.md.
 */
import {
    allHeroIdentities,
    heroForSoundPathCodename,
    soundCodenameForHeroName,
} from '../../../src/lib/heroIdentity';

/** Sound-path codename -> display name, projected from the identity table. */
export const HERO_SOUND_CODENAMES: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(
        allHeroIdentities()
            .filter((hero) => hero.soundCodename)
            .map((hero) => [hero.soundCodename as string, hero.displayName]),
    ),
);

/**
 * Resolve a sound-path codename to a display name. Case-insensitive.
 * Returns null when the codename isn't a known Deadlock hero.
 */
export function heroForSoundCodename(codename: string): string | null {
    return heroForSoundPathCodename(codename)?.displayName ?? null;
}

/**
 * Resolve a hero display name to its sound-path codename. Case-insensitive, and
 * display aliases resolve too ("The Doorman" and "Doorman" are one hero), which
 * a reverse map built from display names alone could not do.
 * Returns null when the name isn't a known Deadlock hero.
 */
export function soundCodenameForHero(name: string): string | null {
    return soundCodenameForHeroName(name);
}
