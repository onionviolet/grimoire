/**
 * Hero identity: one table, four namespaces.
 *
 * Deadlock names the same hero differently in every subsystem, and this fork
 * had grown one mapping per consumer (panorama aliases in the renderer, sound
 * codenames in the main process, model basenames beside the pose exporter).
 * Four tables drift: Abrams alone is `abrams` to the roster, `atlas` or `bull`
 * in panorama, `hero_atlas` in the API, `abrams` in sound paths, and
 * `atlas_detective` as a body-model basename. That is structural cause S5.
 *
 * Everything a subsystem needs about a hero's names lives here, and every other
 * module reaches it through a namespace-scoped accessor rather than reading the
 * table. The namespaces are deliberately NOT interchangeable: a sound codename
 * is not a panorama folder, and asking for one when you meant the other is the
 * bug this module exists to make impossible to write.
 *
 * Namespaces:
 *  - **display**  the product-facing name ("Grey Talon"), plus the aliases the
 *                 GameBanana category and the API disagree on ("The Doorman").
 *  - **roster**   `class_name` from the hero roster, minus the `hero_` prefix.
 *  - **panorama** the folder hero card art and portraits live under, current
 *                 name first and legacy folders after, because community packs
 *                 still ship the old ones.
 *  - **sound**    the folder under `sounds/abilities/<codename>/`.
 *  - **model**    body-model `.vmdl_c` basenames, and a pinned exact entry when
 *                 codename discovery lands on a stale model.
 *
 * Unresolved is a real answer. Shipped catalogs contain codenames that belong
 * to no released hero (`genericperson`, `duo`, `grappler`) and heroes whose
 * assets ship before they do (Fathom, Kali). A surface must be able to say
 * "unreleased or internal" instead of printing a codename as a hero name; see
 * `classifyHeroCodename`.
 */

/** Whether this hero is on the live roster or only present in shipped assets. */
export type HeroReleaseStatus = 'released' | 'unreleased';

export interface HeroIdentity {
    /** Canonical display label used by the product. */
    displayName: string;
    /** Other display spellings that flow in from GameBanana or the API. */
    displayAliases?: readonly string[];
    /** Roster codenames accepted in addition to the display label. */
    rosterCodenames?: readonly string[];
    /** Current panorama class_name, followed by legacy panorama folders. */
    panoramaCodenames: readonly string[];
    /** Folder under `sounds/abilities/`, when the hero ships ability sounds. */
    soundCodename?: string;
    /**
     * Body-model `.vmdl_c` basenames that diverge from the panorama codename,
     * most specific first. Absent when `--hero <panorama>` discovery finds the
     * model on its own, which is true for most of the roster.
     */
    modelCodenames?: readonly string[];
    /**
     * Exact `models/...vmdl_c` entry to export, pinned where codename discovery
     * picks the wrong (usually pre-rework) model. See heroPoseModels.ts for the
     * per-hero verification notes; this table holds the values, that module
     * holds the reasoning about the exporter.
     */
    modelEntry?: string;
    /** Defaults to 'released'. */
    status?: HeroReleaseStatus;
}

/**
 * The roster. One row per hero, every namespace on the row.
 *
 * Order is alphabetical by display name so a missing hero is easy to spot. The
 * unreleased rows sit at the end: their assets ship today and a mod targeting
 * them should still resolve, but they own no panorama folder we can name, so
 * `panoramaCodenames` is empty rather than guessed.
 */
const HEROES: readonly HeroIdentity[] = [
    { displayName: 'Abrams', rosterCodenames: ['abrams'], panoramaCodenames: ['atlas', 'bull'], soundCodename: 'abrams', modelCodenames: ['atlas_detective'], modelEntry: 'models/heroes_wip/abrams/abrams.vmdl_c' },
    { displayName: 'Apollo', panoramaCodenames: ['fencer'], soundCodename: 'fencer' },
    { displayName: 'Bebop', panoramaCodenames: ['bebop'], soundCodename: 'bebop' },
    { displayName: 'Billy', panoramaCodenames: ['punkgoat'], soundCodename: 'punkgoat' },
    { displayName: 'Calico', panoramaCodenames: ['nano'], soundCodename: 'nano' },
    { displayName: 'Celeste', panoramaCodenames: ['unicorn'], soundCodename: 'unicorn' },
    { displayName: 'Doorman', displayAliases: ['The Doorman'], rosterCodenames: ['doorman'], panoramaCodenames: ['doorman'], soundCodename: 'doorman' },
    { displayName: 'Drifter', panoramaCodenames: ['drifter'], soundCodename: 'drifter' },
    { displayName: 'Dynamo', panoramaCodenames: ['dynamo', 'sumo'], soundCodename: 'dynamo' },
    { displayName: 'Graves', panoramaCodenames: ['necro'], soundCodename: 'necro' },
    { displayName: 'Grey Talon', rosterCodenames: ['grey_talon'], panoramaCodenames: ['orion', 'archer'], soundCodename: 'orion', modelCodenames: ['archer'] },
    { displayName: 'Haze', panoramaCodenames: ['haze'], soundCodename: 'haze' },
    { displayName: 'Holliday', panoramaCodenames: ['astro'], soundCodename: 'astro' },
    { displayName: 'Infernus', panoramaCodenames: ['inferno'], soundCodename: 'inferno', modelEntry: 'models/heroes_wip/inferno/inferno.vmdl_c' },
    { displayName: 'Ivy', panoramaCodenames: ['tengu'], soundCodename: 'tengu', modelEntry: 'models/heroes_wip/ivy/ivy.vmdl_c' },
    { displayName: 'Kelvin', panoramaCodenames: ['kelvin'], soundCodename: 'kelvin' },
    { displayName: 'Lady Geist', rosterCodenames: ['lady_geist'], panoramaCodenames: ['ghost', 'spectre'], soundCodename: 'ghost', modelEntry: 'models/heroes_wip/geist/geist.vmdl_c' },
    { displayName: 'Lash', panoramaCodenames: ['lash'], soundCodename: 'lash' },
    { displayName: 'McGinnis', rosterCodenames: ['mcginnis'], panoramaCodenames: ['forge', 'engineer'], soundCodename: 'forge', modelCodenames: ['engineer'], modelEntry: 'models/heroes_wip/mcginnis/mcginnis.vmdl_c' },
    { displayName: 'Mina', panoramaCodenames: ['vampirebat'], soundCodename: 'vampirebat' },
    { displayName: 'Mirage', panoramaCodenames: ['mirage'], soundCodename: 'mirage' },
    { displayName: 'Mo & Krill', rosterCodenames: ['mo_and_krill'], panoramaCodenames: ['krill', 'digger'], soundCodename: 'mokrill', modelCodenames: ['digger'] },
    { displayName: 'Paige', panoramaCodenames: ['bookworm'], soundCodename: 'bookworm' },
    { displayName: 'Paradox', panoramaCodenames: ['chrono'], soundCodename: 'chrono' },
    { displayName: 'Pocket', panoramaCodenames: ['synth'], soundCodename: 'synth', modelEntry: 'models/heroes_wip/pocket/pocket.vmdl_c' },
    { displayName: 'Rem', panoramaCodenames: ['familiar'], soundCodename: 'familiar', modelEntry: 'models/heroes_wip/familiar/familiar_wip.vmdl_c' },
    { displayName: 'Seven', panoramaCodenames: ['gigawatt'], soundCodename: 'gigawatt', modelCodenames: ['gigawatt_prisoner'] },
    { displayName: 'Shiv', panoramaCodenames: ['shiv'], soundCodename: 'shiv' },
    { displayName: 'Silver', panoramaCodenames: ['werewolf'], soundCodename: 'werewolf' },
    { displayName: 'Sinclair', panoramaCodenames: ['magician'], soundCodename: 'magician' },
    { displayName: 'Venator', panoramaCodenames: ['priest'], soundCodename: 'priest' },
    { displayName: 'Victor', panoramaCodenames: ['frank'], soundCodename: 'frank' },
    { displayName: 'Vindicta', panoramaCodenames: ['hornet'], soundCodename: 'hornet' },
    { displayName: 'Viscous', panoramaCodenames: ['viscous'], soundCodename: 'viscous', modelEntry: 'models/heroes_staging/viscous/viscous.vmdl_c' },
    { displayName: 'Vyper', panoramaCodenames: ['viper'], soundCodename: 'viper' },
    { displayName: 'Warden', panoramaCodenames: ['warden'], soundCodename: 'warden' },
    { displayName: 'Wraith', panoramaCodenames: ['wraith'], soundCodename: 'wraith', modelEntry: 'models/heroes_wip/wraith/wraith.vmdl_c' },
    { displayName: 'Yamato', panoramaCodenames: ['yamato'], soundCodename: 'yamato' },
    // Not on the live roster. Their VPK sound assets ship today, so a sound mod
    // targeting them still resolves to a name; they own no panorama folder this
    // fork has seen, and inventing one would silently scope portrait discovery
    // to a directory that does not exist.
    { displayName: 'Fathom', panoramaCodenames: [], soundCodename: 'fathom', status: 'unreleased' },
    { displayName: 'Kali', panoramaCodenames: [], soundCodename: 'kali', status: 'unreleased' },
    { displayName: 'Tokamak', panoramaCodenames: [], soundCodename: 'tokamak', status: 'unreleased' },
    { displayName: 'Trapper', panoramaCodenames: [], soundCodename: 'trapper', status: 'unreleased' },
    { displayName: 'Wrecker', panoramaCodenames: [], soundCodename: 'wrecker', status: 'unreleased' },
];

/**
 * Codenames that appear in shipped catalogs and belong to no hero at all:
 * placeholder rigs, tutorial dummies, and internal experiments. Listing them is
 * how a dropdown can group them honestly instead of printing `genericperson`
 * beside "Grey Talon" as though both were heroes.
 *
 * Not exhaustive and does not need to be: anything unlisted resolves to
 * `unknown`, which the same surfaces present the same way. This list only
 * records the ones we have actually seen, so the next reader knows they were
 * looked at rather than missed.
 */
const INTERNAL_CODENAMES: ReadonlySet<string> = new Set(['genericperson', 'duo', 'grappler', 'hero_base', 'dummy']);

function key(value: string): string {
    return value.trim().toLocaleLowerCase();
}

/** Display name, display alias, or roster codename -> hero. */
const byKnownName = new Map<string, HeroIdentity>();
for (const hero of HEROES) {
    for (const name of [hero.displayName, ...(hero.displayAliases ?? []), ...(hero.rosterCodenames ?? [])]) {
        byKnownName.set(key(name), hero);
    }
}

/**
 * Reverse direction for the panorama/roster namespace: a catalog codename back
 * to the hero it belongs to. Asset catalogs are keyed on engine codenames
 * (`archer`, `punkgoat`), so any surface that shows one to a user needs this or
 * it prints a codename as a hero name.
 */
const byPanoramaCodename = new Map<string, HeroIdentity>();
for (const hero of HEROES) {
    for (const code of [...(hero.rosterCodenames ?? []), ...hero.panoramaCodenames]) {
        byPanoramaCodename.set(key(code), hero);
    }
}

/** Sound-path codename -> hero. Separate map because the namespaces diverge
 *  (Abrams is `abrams` here and `atlas` in panorama). */
const bySoundCodename = new Map<string, HeroIdentity>();
for (const hero of HEROES) {
    if (hero.soundCodename) bySoundCodename.set(key(hero.soundCodename), hero);
}

/** Every hero row, for callers that need to enumerate rather than look up. */
export function allHeroIdentities(): readonly HeroIdentity[] {
    return HEROES;
}

/**
 * Resolve any display name, display alias, or roster codename to its hero row.
 * Does NOT accept a bare panorama or sound codename: those namespaces have
 * their own accessors, because accepting all of them here is how a caller ends
 * up looking a sound codename up in the panorama table and getting a match by
 * coincidence.
 */
export function resolveHeroByName(identity: string | null | undefined): HeroIdentity | null {
    if (!identity) return null;
    return byKnownName.get(key(identity)) ?? null;
}

/** ---- panorama namespace ---- */

/** Every panorama folder that can carry this hero's art, current name first. */
export function panoramaCodenamesForHero(identity: string | null | undefined): string[] {
    return [...(resolveHeroByName(identity)?.panoramaCodenames ?? [])];
}

/** Hero owning a panorama or roster codename, or null when none does. */
export function heroForPanoramaCodename(codename: string | null | undefined): HeroIdentity | null {
    if (!codename) return null;
    return byPanoramaCodename.get(key(codename)) ?? null;
}

/** ---- sound namespace ---- */

/** Sound-path codename for a hero, or null when the hero ships no ability sounds. */
export function soundCodenameForHeroName(identity: string | null | undefined): string | null {
    return resolveHeroByName(identity)?.soundCodename ?? null;
}

/** Hero owning a `sounds/abilities/<codename>/` folder, or null. */
export function heroForSoundPathCodename(codename: string | null | undefined): HeroIdentity | null {
    if (!codename) return null;
    return bySoundCodename.get(key(codename)) ?? null;
}

/** ---- model namespace ---- */

/**
 * Body-model basenames to try for a hero, most specific first: any divergent
 * `.vmdl_c` basename, then the panorama codenames that cover the rest of the
 * roster. De-duplicated, order preserved.
 */
export function modelCodenamesForHero(identity: string | null | undefined): string[] {
    const hero = resolveHeroByName(identity);
    if (!hero) return [];
    return [...new Set([...(hero.modelCodenames ?? []), ...hero.panoramaCodenames])];
}

/** Pinned exact model entry for a reworked hero, or null to use discovery. */
export function modelEntryForHero(identity: string | null | undefined): string | null {
    return resolveHeroByName(identity)?.modelEntry ?? null;
}

/** ---- display namespace ---- */

/** What a codename turned out to be. `unresolved` is a real, presentable answer. */
export type HeroCodenameClassification =
    | { kind: 'hero'; displayName: string; status: HeroReleaseStatus }
    /** A hero whose assets ship but who is not on the live roster. */
    | { kind: 'unreleased'; displayName: string }
    /** A known non-hero codename: placeholder rigs, dummies, internal content. */
    | { kind: 'internal'; codename: string }
    /** Nothing in this module knows what it is. Present it as unresolved. */
    | { kind: 'unknown'; codename: string };

/**
 * Classify a codename from any namespace for presentation.
 *
 * This is the accessor a dropdown, a filter label, or a group heading should
 * use, because it never returns a codename dressed up as a hero name. The
 * panorama namespace is consulted first (catalogs are keyed on it), then sound.
 */
export function classifyHeroCodename(codename: string | null | undefined): HeroCodenameClassification {
    const raw = (codename ?? '').trim();
    if (!raw) return { kind: 'unknown', codename: '' };
    const hero = heroForPanoramaCodename(raw) ?? heroForSoundPathCodename(raw);
    if (hero) {
        return hero.status === 'unreleased'
            ? { kind: 'unreleased', displayName: hero.displayName }
            : { kind: 'hero', displayName: hero.displayName, status: 'released' };
    }
    if (INTERNAL_CODENAMES.has(key(raw))) return { kind: 'internal', codename: raw };
    return { kind: 'unknown', codename: raw };
}

/**
 * Every codename that can carry this hero's *catalog* assets, including the
 * identity that was passed in. Use it to scope an asset catalog to one hero
 * without losing whichever panorama alias a pack happens to use.
 *
 * Scoped to the panorama/roster namespace on purpose. Asset catalogs are keyed
 * on it, and folding sound codenames in would widen a texture scope with a
 * folder name that only ever appears under `sounds/`.
 */
export function heroCodenameScope(identity: string | null | undefined): Set<string> {
    const scope = new Set<string>();
    if (!identity) return scope;
    scope.add(key(identity));
    const hero = resolveHeroByName(identity) ?? heroForPanoramaCodename(identity);
    if (hero) {
        for (const code of [...(hero.rosterCodenames ?? []), ...hero.panoramaCodenames]) {
            scope.add(key(code));
        }
    }
    return scope;
}
