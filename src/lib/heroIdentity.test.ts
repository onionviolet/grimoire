import { describe, expect, it } from 'vitest';
import {
    allHeroIdentities,
    classifyHeroCodename,
    heroForPanoramaCodename,
    heroForSoundPathCodename,
    modelCodenamesForHero,
    modelEntryForHero,
    panoramaCodenamesForHero,
    resolveHeroByName,
    soundCodenameForHeroName,
} from './heroIdentity';

/**
 * Every hero whose engine names differ from their display name, which is the
 * whole population this module exists for. A hero that spells the same in every
 * namespace cannot drift; these can, and did, across four separate tables.
 *
 * `panorama` is the ordered folder list (current name first, legacy after).
 * `sound` is the `sounds/abilities/<codename>/` folder. Where they differ the
 * row is the regression that mattered: Abrams and Mo & Krill are the two heroes
 * whose card picker silently returned nothing when a caller read the sound
 * codename and looked it up in the panorama namespace.
 */
const ALIASED: ReadonlyArray<{
    display: string;
    roster?: string;
    displayAlias?: string;
    panorama: string[];
    sound: string | null;
}> = [
    { display: 'Abrams', roster: 'abrams', panorama: ['atlas', 'bull'], sound: 'abrams' },
    { display: 'Apollo', panorama: ['fencer'], sound: 'fencer' },
    { display: 'Billy', panorama: ['punkgoat'], sound: 'punkgoat' },
    { display: 'Calico', panorama: ['nano'], sound: 'nano' },
    { display: 'Celeste', panorama: ['unicorn'], sound: 'unicorn' },
    { display: 'Doorman', roster: 'doorman', displayAlias: 'The Doorman', panorama: ['doorman'], sound: 'doorman' },
    { display: 'Dynamo', panorama: ['dynamo', 'sumo'], sound: 'dynamo' },
    { display: 'Graves', panorama: ['necro'], sound: 'necro' },
    { display: 'Grey Talon', roster: 'grey_talon', panorama: ['orion', 'archer'], sound: 'orion' },
    { display: 'Holliday', panorama: ['astro'], sound: 'astro' },
    { display: 'Infernus', panorama: ['inferno'], sound: 'inferno' },
    { display: 'Ivy', panorama: ['tengu'], sound: 'tengu' },
    { display: 'Lady Geist', roster: 'lady_geist', panorama: ['ghost', 'spectre'], sound: 'ghost' },
    { display: 'McGinnis', roster: 'mcginnis', panorama: ['forge', 'engineer'], sound: 'forge' },
    { display: 'Mina', panorama: ['vampirebat'], sound: 'vampirebat' },
    { display: 'Mo & Krill', roster: 'mo_and_krill', panorama: ['krill', 'digger'], sound: 'mokrill' },
    { display: 'Paige', panorama: ['bookworm'], sound: 'bookworm' },
    { display: 'Paradox', panorama: ['chrono'], sound: 'chrono' },
    { display: 'Pocket', panorama: ['synth'], sound: 'synth' },
    { display: 'Rem', panorama: ['familiar'], sound: 'familiar' },
    { display: 'Seven', panorama: ['gigawatt'], sound: 'gigawatt' },
    { display: 'Silver', panorama: ['werewolf'], sound: 'werewolf' },
    { display: 'Sinclair', panorama: ['magician'], sound: 'magician' },
    { display: 'Venator', panorama: ['priest'], sound: 'priest' },
    { display: 'Victor', panorama: ['frank'], sound: 'frank' },
    { display: 'Vindicta', panorama: ['hornet'], sound: 'hornet' },
    { display: 'Vyper', panorama: ['viper'], sound: 'viper' },
];

describe('the aliased roster', () => {
    it.each(ALIASED)('resolves $display in every namespace it has one in', (hero) => {
        expect(panoramaCodenamesForHero(hero.display)).toEqual(hero.panorama);
        expect(soundCodenameForHeroName(hero.display)).toBe(hero.sound);
        if (hero.roster) {
            expect(panoramaCodenamesForHero(hero.roster)).toEqual(hero.panorama);
            expect(soundCodenameForHeroName(hero.roster)).toBe(hero.sound);
        }
        if (hero.displayAlias) {
            expect(panoramaCodenamesForHero(hero.displayAlias)).toEqual(hero.panorama);
            expect(soundCodenameForHeroName(hero.displayAlias)).toBe(hero.sound);
        }
    });

    it.each(ALIASED)('maps every $display codename back to the same hero', (hero) => {
        for (const code of hero.panorama) {
            expect(heroForPanoramaCodename(code)?.displayName).toBe(hero.display);
        }
        if (hero.sound) expect(heroForSoundPathCodename(hero.sound)?.displayName).toBe(hero.display);
    });
});

describe('namespaces stay separate', () => {
    // The exact pair that broke the card picker: reading the sound codename and
    // looking it up in the panorama table finds nothing, and must keep finding
    // nothing rather than being quietly merged into one lookup.
    it('does not accept a sound codename as a panorama codename', () => {
        expect(soundCodenameForHeroName('Abrams')).toBe('abrams');
        expect(panoramaCodenamesForHero('Abrams')).toEqual(['atlas', 'bull']);
        expect(heroForPanoramaCodename('abrams')?.displayName).toBe('Abrams'); // roster codename, not panorama
        expect(heroForPanoramaCodename('mokrill')).toBeNull();
        expect(heroForSoundPathCodename('krill')).toBeNull();
    });

    it('keeps every sound codename unique, so the reverse lookup is unambiguous', () => {
        const codes = allHeroIdentities().map((hero) => hero.soundCodename).filter(Boolean);
        expect(new Set(codes).size).toBe(codes.length);
    });

    it('keeps every panorama codename owned by exactly one hero', () => {
        const seen = new Map<string, string>();
        for (const hero of allHeroIdentities()) {
            for (const code of hero.panoramaCodenames) {
                expect(seen.get(code) ?? hero.displayName).toBe(hero.displayName);
                seen.set(code, hero.displayName);
            }
        }
    });
});

describe('the model namespace', () => {
    it('tries the divergent body-model basename before the panorama codename', () => {
        expect(modelCodenamesForHero('Abrams')).toEqual(['atlas_detective', 'atlas', 'bull']);
        expect(modelCodenamesForHero('Seven')).toEqual(['gigawatt_prisoner', 'gigawatt']);
        expect(modelCodenamesForHero('Mo & Krill')).toEqual(['digger', 'krill']);
    });

    it('falls back to the panorama codenames for the rest of the roster', () => {
        expect(modelCodenamesForHero('Haze')).toEqual(['haze']);
        expect(modelCodenamesForHero('Not a hero')).toEqual([]);
    });

    it('pins the reworked heroes to an exact entry and leaves everyone else on discovery', () => {
        expect(modelEntryForHero('Infernus')).toBe('models/heroes_wip/inferno/inferno.vmdl_c');
        expect(modelEntryForHero('Rem')).toBe('models/heroes_wip/familiar/familiar_wip.vmdl_c');
        // Deliberately not pinned: Billy ships the rig but no pose clip.
        expect(modelEntryForHero('Billy')).toBeNull();
    });

    it('only pins entries for heroes that exist', () => {
        for (const hero of allHeroIdentities()) {
            if (hero.modelEntry) expect(resolveHeroByName(hero.displayName)).not.toBeNull();
        }
    });
});

describe('the unresolved bucket', () => {
    it('names a released hero', () => {
        expect(classifyHeroCodename('archer')).toEqual({
            kind: 'hero',
            displayName: 'Grey Talon',
            status: 'released',
        });
    });

    it('separates heroes whose assets ship before they do', () => {
        // Sound assets for these exist in the shipped paks, so a sound mod
        // targeting them resolves, but they own no panorama folder to scope to.
        expect(classifyHeroCodename('fathom')).toEqual({ kind: 'unreleased', displayName: 'Fathom' });
        expect(panoramaCodenamesForHero('Fathom')).toEqual([]);
        expect(heroForPanoramaCodename('fathom')).toBeNull();
        expect(heroForSoundPathCodename('fathom')?.displayName).toBe('Fathom');
    });

    it('reports internal codenames as internal rather than inventing a hero', () => {
        expect(classifyHeroCodename('genericperson')).toEqual({ kind: 'internal', codename: 'genericperson' });
        expect(classifyHeroCodename('duo')).toEqual({ kind: 'internal', codename: 'duo' });
    });

    it('reports anything else as unknown, never as a hero name', () => {
        expect(classifyHeroCodename('some_new_codename')).toEqual({
            kind: 'unknown',
            codename: 'some_new_codename',
        });
        expect(classifyHeroCodename(null)).toEqual({ kind: 'unknown', codename: '' });
    });
});
